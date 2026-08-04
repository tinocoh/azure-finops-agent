"""Azure Advisor recommendations client."""
from __future__ import annotations

import logging

from ..config import get_settings
from .http_client import request_with_retry

logger = logging.getLogger("finopsazure.advisor")

_QUICK_WIN_CATEGORIES = {"Cost"}


def get_recommendations(token: str, subscription_id: str) -> dict:
    """Fetch Advisor recommendations. Never fails the whole analysis."""
    settings = get_settings()
    url = (
        f"{settings.arm_endpoint}/subscriptions/{subscription_id}"
        "/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01"
    )
    resp = request_with_retry("GET", url, token)
    if resp.status_code in (401, 403):
        return {"error": "no_permission", "available": False, "recommendations": [], "byCategory": {}}
    if resp.status_code != 200:
        return {"error": f"api_error_{resp.status_code}", "available": False, "recommendations": [], "byCategory": {}}
    return parse_advisor_response(resp.json())


def parse_advisor_response(payload: dict) -> dict:
    """Parse Advisor list into normalized, grouped recommendations. Pure/testable."""
    items = payload.get("value", [])
    recommendations: list[dict] = []
    by_category: dict[str, int] = {}

    for it in items:
        props = it.get("properties", {})
        category = props.get("category", "Uncategorized")
        impact = props.get("impact", "Low")
        short = props.get("shortDescription", {}) or {}
        rec = {
            "id": it.get("id", ""),
            "category": category,
            "impact": impact,
            "problem": short.get("problem", ""),
            "solution": short.get("solution", ""),
            "impactedField": props.get("impactedField", ""),
            "impactedValue": props.get("impactedValue", ""),
            "quickWin": category in _QUICK_WIN_CATEGORIES and impact in ("High", "Medium"),
        }
        recommendations.append(rec)
        by_category[category] = by_category.get(category, 0) + 1

    return {
        "available": True,
        "total": len(recommendations),
        "byCategory": by_category,
        "quickWins": [r for r in recommendations if r["quickWin"]],
        "recommendations": recommendations,
    }
