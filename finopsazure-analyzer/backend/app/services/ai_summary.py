# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.
"""AI executive summary via Azure OpenAI / Foundry.

Falls back to a deterministic rule-based summary when AI is not configured.
Never sends secrets or tokens to the model; sanitizes identifiers first.
"""
from __future__ import annotations

import logging

from ..config import get_settings
from ..security.sanitization import sanitize_for_ai

logger = logging.getLogger("finopsazure.ai")

_SYSTEM_PROMPT = (
    "You are a senior Azure FinOps analyst. Based on the aggregated data "
    "(costs, inventory, and recommendations), generate a clear and actionable "
    "executive summary in English. Structure the response as: Key findings, Risks, "
    "Savings opportunities, Recommended actions, and Next steps. "
    "Do not include sensitive identifiers. Be concise."
)


def _rule_based_summary(data: dict) -> dict:
    costs = data.get("costs", {})
    inv = data.get("inventory", {})
    recs = data.get("recommendations", {})

    current = costs.get("currentMonthCost", 0)
    prev = costs.get("previousMonthCost", 0)
    delta_pct = costs.get("deltaPercent")
    top = costs.get("topServices", [])[:3]
    without_tags = inv.get("resourcesWithoutTags", 0)
    unattached = inv.get("unattachedDisks", 0)
    stopped = len(inv.get("stoppedVms", []))
    quick_wins = len(recs.get("quickWins", []))

    findings = [
        f"Current month cost: {current} (previous month: {prev}).",
        f"Change vs previous month: {delta_pct}%." if delta_pct is not None else "No comparison available.",
    ]
    if top:
        findings.append("Highest-cost services: " + ", ".join(t["key"] for t in top) + ".")

    risks = []
    if without_tags:
        risks.append(f"{without_tags} resources without tags, making cost allocation harder.")
    if not risks:
        risks.append("No evident risks were detected in the collected data.")

    savings = []
    if unattached:
        savings.append(f"{unattached} unattached disks are candidates for deletion.")
    if stopped:
        savings.append(f"{stopped} stopped/deallocated VMs should be reviewed for ongoing disk costs.")
    if quick_wins:
        savings.append(f"{quick_wins} Advisor quick wins in the Cost category.")
    if not savings:
        savings.append("Run Advisor with read permissions to detect savings.")

    actions = [
        "Tag untagged resources with owner and cost center." if without_tags else "Maintain tagging discipline.",
        "Delete unattached disks after validating with owners." if unattached else "Review inventory periodically.",
        "Apply Advisor recommendations marked as quick wins." if quick_wins else "Enable Advisor.",
    ]

    return {
        "generatedBy": "rules",
        "summary": {
            "findings": findings,
            "risks": risks,
            "savingsOpportunities": savings,
            "recommendedActions": actions,
            "nextSteps": [
                "Schedule recurring analysis.",
                "Define budgets and alerts per subscription.",
            ],
        },
    }


def generate_ai_summary(data: dict) -> dict:
    """Generate an executive summary. Uses Azure OpenAI if configured, else rules."""
    settings = get_settings()
    safe = sanitize_for_ai(data)

    if not settings.azure_openai_endpoint or not settings.azure_openai_deployment:
        logger.info("Azure OpenAI is not configured; using rule-based summary.")
        return _rule_based_summary(safe)

    try:
        from openai import AzureOpenAI

        # Prefer API key if provided; else Managed Identity token provider.
        if settings.azure_openai_api_key:
            client = AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                api_key=settings.azure_openai_api_key,
                api_version=settings.azure_openai_api_version,
            )
        else:
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider

            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
            )
            client = AzureOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_ad_token_provider=token_provider,
                api_version=settings.azure_openai_api_version,
            )

        import json

        completion = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(safe, ensure_ascii=False)},
            ],
            temperature=0.2,
            max_tokens=900,
        )
        text = completion.choices[0].message.content or ""
        return {"generatedBy": "azure_openai", "summary": {"text": text}}
    except Exception as exc:  # noqa: BLE001 — never break analysis on AI failure
        logger.warning("AI summary generation failed: %s. Using rules.", type(exc).__name__)
        result = _rule_based_summary(safe)
        result["aiError"] = "ai_unavailable"
        return result
