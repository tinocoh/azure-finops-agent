"""Analysis runner: orchestrates cost + inventory + advisor + AI per connection.

Handles partial failures per subscription so one bad sub doesn't fail the run.
Synchronous for now; structured to move to background execution later.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import AnalysisRun, Connection
from . import advisor, ai_summary, azure_auth, cost_management, resource_graph
from .encryption import decrypt

logger = logging.getLogger("finopsazure.runner")


def _subs(connection: Connection, requested: list[str] | None) -> list[str]:
    all_subs = [s for s in (connection.subscription_ids or "").split(",") if s]
    if requested:
        return [s for s in requested if s in all_subs] or requested
    return all_subs


def run_analysis(
    db: Session,
    connection: Connection,
    subscription_ids: list[str] | None,
    date_from: str | None,
    date_to: str | None,
) -> AnalysisRun:
    subs = _subs(connection, subscription_ids)
    run = AnalysisRun(
        connection_id=connection.id,
        status="running",
        date_from=date_from,
        date_to=date_to,
        subscription_ids=",".join(subs),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    errors: list[dict] = []
    per_sub_costs: list[dict] = []
    per_sub_inventory: list[dict] = []
    per_sub_recs: list[dict] = []

    try:
        secret = decrypt(connection.client_secret_encrypted)
        token = azure_auth.get_token(connection.tenant_id, connection.client_id, secret)
    except azure_auth.AzureAuthError as exc:
        run.status = "failed"
        run.errors_json = json.dumps([{"code": exc.code, "message": exc.message}])
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)
        return run
    except Exception as exc:  # noqa: BLE001
        run.status = "failed"
        run.errors_json = json.dumps([{"code": "decryption_error", "message": type(exc).__name__}])
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)
        return run

    for sub in subs:
        try:
            costs = cost_management.cost_summary(token, sub, date_from, date_to)
            per_sub_costs.append(costs)
        except Exception as exc:  # noqa: BLE001
            errors.append({"subscriptionId": sub, "stage": "costs", "message": type(exc).__name__})
        try:
            inv = resource_graph.inventory_summary(token, [sub])
            inv["subscriptionId"] = sub
            per_sub_inventory.append(inv)
        except Exception as exc:  # noqa: BLE001
            errors.append({"subscriptionId": sub, "stage": "inventory", "message": type(exc).__name__})
        try:
            recs = advisor.get_recommendations(token, sub)
            recs["subscriptionId"] = sub
            per_sub_recs.append(recs)
        except Exception as exc:  # noqa: BLE001
            errors.append({"subscriptionId": sub, "stage": "advisor", "message": type(exc).__name__})

    # Aggregate across subscriptions.
    costs_agg = _aggregate_costs(per_sub_costs)
    inv_agg = _aggregate_inventory(per_sub_inventory)
    recs_agg = _aggregate_recs(per_sub_recs)

    summary = {
        "subscriptions": len(subs),
        "currentMonthCost": costs_agg.get("currentMonthCost", 0),
        "previousMonthCost": costs_agg.get("previousMonthCost", 0),
        "deltaPercent": costs_agg.get("deltaPercent"),
        "totalResources": inv_agg.get("totalResources", 0),
        "resourcesWithoutTags": inv_agg.get("resourcesWithoutTags", 0),
        "recommendations": recs_agg.get("total", 0),
        "quickWins": len(recs_agg.get("quickWins", [])),
    }

    ai = ai_summary.generate_ai_summary(
        {"costs": costs_agg, "inventory": inv_agg, "recommendations": recs_agg}
    )

    run.summary_json = json.dumps(summary, ensure_ascii=False)
    run.costs_json = json.dumps({"aggregate": costs_agg, "perSubscription": per_sub_costs}, ensure_ascii=False)
    run.resources_json = json.dumps({"aggregate": inv_agg, "perSubscription": per_sub_inventory}, ensure_ascii=False)
    run.recommendations_json = json.dumps({"aggregate": recs_agg, "perSubscription": per_sub_recs}, ensure_ascii=False)
    run.ai_summary_json = json.dumps(ai, ensure_ascii=False)
    run.errors_json = json.dumps(errors, ensure_ascii=False)
    run.status = "completed" if not errors else "completed_with_errors"
    run.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run


def _aggregate_costs(items: list[dict]) -> dict:
    current = sum(i.get("currentMonthCost", 0) for i in items)
    previous = sum(i.get("previousMonthCost", 0) for i in items)
    delta = current - previous
    services: dict[str, float] = {}
    rgs: dict[str, float] = {}
    for i in items:
        for row in i.get("topServices", []):
            services[row["key"]] = services.get(row["key"], 0) + row["cost"]
        for row in i.get("topResourceGroups", []):
            rgs[row["key"]] = rgs.get(row["key"], 0) + row["cost"]
    top_services = sorted(
        [{"key": k, "cost": round(v, 2)} for k, v in services.items()], key=lambda x: x["cost"], reverse=True
    )[:10]
    top_rgs = sorted(
        [{"key": k, "cost": round(v, 2)} for k, v in rgs.items()], key=lambda x: x["cost"], reverse=True
    )[:10]
    return {
        "currency": items[0].get("currency") if items else None,
        "currentMonthCost": round(current, 2),
        "previousMonthCost": round(previous, 2),
        "deltaAbsolute": round(delta, 2),
        "deltaPercent": round((delta / previous) * 100, 1) if previous else None,
        "trend": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
        "topServices": top_services,
        "topResourceGroups": top_rgs,
    }


def _aggregate_inventory(items: list[dict]) -> dict:
    total = sum(i.get("totalResources", 0) for i in items)
    without_tags = sum(i.get("resourcesWithoutTags", 0) for i in items)
    public_ips = sum(i.get("publicIps", 0) for i in items)
    unattached = sum(i.get("unattachedDisks", 0) for i in items)
    storage = sum(i.get("storageAccounts", 0) for i in items)
    lbs = sum(i.get("loadBalancers", 0) for i in items)
    vms = [v for i in items for v in i.get("virtualMachines", [])]
    stopped = [v for i in items for v in i.get("stoppedVms", [])]
    return {
        "totalResources": total,
        "resourcesWithoutTags": without_tags,
        "publicIps": public_ips,
        "unattachedDisks": unattached,
        "storageAccounts": storage,
        "loadBalancers": lbs,
        "virtualMachines": vms,
        "stoppedVms": stopped,
    }


def _aggregate_recs(items: list[dict]) -> dict:
    by_category: dict[str, int] = {}
    quick_wins: list[dict] = []
    all_recs: list[dict] = []
    for i in items:
        for cat, n in i.get("byCategory", {}).items():
            by_category[cat] = by_category.get(cat, 0) + n
        quick_wins.extend(i.get("quickWins", []))
        all_recs.extend(i.get("recommendations", []))
    return {
        "total": len(all_recs),
        "byCategory": by_category,
        "quickWins": quick_wins,
        "recommendations": all_recs,
    }
