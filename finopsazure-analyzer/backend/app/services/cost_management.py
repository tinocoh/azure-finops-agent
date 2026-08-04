"""Azure Cost Management Query API client."""
from __future__ import annotations

import logging
from datetime import date, timedelta

from ..config import get_settings
from .http_client import request_with_retry

logger = logging.getLogger("finopsazure.cost")

_GROUP_DIMENSION = {
    "ServiceName": "ServiceName",
    "ResourceGroup": "ResourceGroupName",
    "ResourceLocation": "ResourceLocation",
}


def _default_range() -> tuple[str, str]:
    today = date.today()
    first = today.replace(day=1)
    return first.isoformat(), today.isoformat()


def _month_range(offset_months: int) -> tuple[str, str]:
    today = date.today()
    year = today.year
    month = today.month - offset_months
    while month <= 0:
        month += 12
        year -= 1
    first = date(year, month, 1)
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    last = nxt - timedelta(days=1)
    return first.isoformat(), last.isoformat()


def query_costs(
    token: str,
    subscription_id: str,
    *,
    group_by: str = "ServiceName",
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Query actual cost grouped by a dimension. Returns parsed rows."""
    settings = get_settings()
    if not date_from or not date_to:
        date_from, date_to = _default_range()

    dimension = _GROUP_DIMENSION.get(group_by, "ServiceName")
    url = (
        f"{settings.arm_endpoint}/subscriptions/{subscription_id}"
        "/providers/Microsoft.CostManagement/query?api-version=2023-11-01"
    )
    body = {
        "type": "ActualCost",
        "timeframe": "Custom",
        "timePeriod": {"from": date_from, "to": date_to},
        "dataset": {
            "granularity": "None",
            "aggregation": {"totalCost": {"name": "Cost", "function": "Sum"}},
            "grouping": [{"type": "Dimension", "name": dimension}],
        },
    }
    resp = request_with_retry("POST", url, token, json_body=body)
    if resp.status_code in (401, 403):
        return {"error": "no_permission", "rows": [], "groupBy": group_by}
    if resp.status_code != 200:
        return {"error": f"api_error_{resp.status_code}", "rows": [], "groupBy": group_by}
    return parse_cost_response(resp.json(), group_by)


def parse_cost_response(payload: dict, group_by: str) -> dict:
    """Parse a Cost Management response into a normalized shape.

    Kept pure so it can be unit-tested without Azure.
    """
    props = payload.get("properties", payload)
    columns = [c.get("name") for c in props.get("columns", [])]
    rows_raw = props.get("rows", [])

    try:
        cost_idx = columns.index("Cost")
    except ValueError:
        cost_idx = 0
    # The grouping dimension is the non-Cost, non-Currency string column.
    group_idx = None
    currency_idx = columns.index("Currency") if "Currency" in columns else None
    for i, name in enumerate(columns):
        if i not in (cost_idx, currency_idx):
            group_idx = i
            break

    rows: list[dict] = []
    total = 0.0
    currency = None
    for r in rows_raw:
        cost = float(r[cost_idx]) if r[cost_idx] is not None else 0.0
        key = r[group_idx] if group_idx is not None and group_idx < len(r) else "Unknown"
        if currency_idx is not None and currency_idx < len(r):
            currency = r[currency_idx]
        total += cost
        rows.append({"key": key or "Unknown", "cost": round(cost, 2)})

    rows.sort(key=lambda x: x["cost"], reverse=True)
    return {
        "groupBy": group_by,
        "currency": currency,
        "total": round(total, 2),
        "rows": rows,
        "top10": rows[:10],
    }


def cost_summary(
    token: str,
    subscription_id: str,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Aggregate current vs previous month + breakdowns by service and RG."""
    cur_from, cur_to = (date_from, date_to) if date_from and date_to else _default_range()
    prev_from, prev_to = _month_range(1)

    by_service = query_costs(token, subscription_id, group_by="ServiceName", date_from=cur_from, date_to=cur_to)
    by_rg = query_costs(token, subscription_id, group_by="ResourceGroup", date_from=cur_from, date_to=cur_to)
    by_location = query_costs(token, subscription_id, group_by="ResourceLocation", date_from=cur_from, date_to=cur_to)
    prev = query_costs(token, subscription_id, group_by="ServiceName", date_from=prev_from, date_to=prev_to)

    current_total = by_service.get("total", 0.0)
    previous_total = prev.get("total", 0.0)
    delta = current_total - previous_total
    delta_pct = round((delta / previous_total) * 100, 1) if previous_total else None

    return {
        "subscriptionId": subscription_id,
        "currency": by_service.get("currency"),
        "currentMonthCost": current_total,
        "previousMonthCost": previous_total,
        "deltaAbsolute": round(delta, 2),
        "deltaPercent": delta_pct,
        "trend": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
        "topServices": by_service.get("top10", []),
        "topResourceGroups": by_rg.get("top10", []),
        "byLocation": by_location.get("rows", []),
        "errors": [b.get("error") for b in (by_service, by_rg, prev) if b.get("error")],
    }
