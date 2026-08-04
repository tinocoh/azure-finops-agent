"""Natural-language chat grounded on a subscription's FinOps data.

Gathers a compact snapshot (costs + inventory + advisor) for a connection's
subscriptions, caches it briefly to avoid Cost Management throttling, sanitizes
it, and asks Azure OpenAI to answer. Degrades to a rule-based answer when AI is
not configured. Never sends secrets/tokens to the model.
"""
from __future__ import annotations

import json
import logging
import time
from threading import Lock

from ..security.sanitization import sanitize_for_ai
from . import advisor, azure_auth, cost_management, resource_graph
from .analysis_runner import _aggregate_costs, _aggregate_inventory, _aggregate_recs
from .encryption import decrypt
from .openai_client import get_openai_client

logger = logging.getLogger("finopsazure.chat")

# In-memory TTL cache for the per-connection snapshot (avoids re-hitting the
# throttled Cost Management API on every chat message).
_SNAPSHOT_TTL_SECONDS = 300
_snapshot_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = Lock()

_SYSTEM_PROMPT = (
    "Eres un asistente FinOps de Azure. Respondes en español, de forma breve y precisa, "
    "ÚNICAMENTE con base en el CONTEXTO de datos de la suscripción que se te entrega "
    "(costos, inventario y recomendaciones). Si la respuesta no está en el contexto, dilo "
    "claramente y sugiere ejecutar un análisis o revisar permisos. No inventes cifras. "
    "No incluyas identificadores sensibles. Cuando cites montos, incluye la moneda si está disponible."
)


def _build_snapshot(token: str, subscription_ids: list[str]) -> dict:
    costs, inv, recs = [], [], []
    for sub in subscription_ids:
        try:
            costs.append(cost_management.cost_summary(token, sub))
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat snapshot costs %s: %s", sub, type(exc).__name__)
        try:
            i = resource_graph.inventory_summary(token, [sub])
            inv.append(i)
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat snapshot inventory %s: %s", sub, type(exc).__name__)
        try:
            r = advisor.get_recommendations(token, sub)
            recs.append(r)
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat snapshot advisor %s: %s", sub, type(exc).__name__)

    return {
        "costs": _aggregate_costs(costs),
        "inventory": _aggregate_inventory(inv),
        "recommendations": _aggregate_recs(recs),
    }


def get_snapshot(connection, token: str) -> dict:
    """Return a cached-or-fresh snapshot for the connection's subscriptions."""
    subs = [s for s in (connection.subscription_ids or "").split(",") if s]
    now = time.time()
    with _cache_lock:
        cached = _snapshot_cache.get(connection.id)
        if cached and (now - cached[0]) < _SNAPSHOT_TTL_SECONDS:
            return cached[1]
    snapshot = _build_snapshot(token, subs)
    with _cache_lock:
        _snapshot_cache[connection.id] = (now, snapshot)
    return snapshot


def _rule_based_answer(message: str, snapshot: dict) -> dict:
    costs = snapshot.get("costs", {})
    inv = snapshot.get("inventory", {})
    recs = snapshot.get("recommendations", {})
    top = costs.get("topServices", [])[:3]
    lines = [
        "IA no configurada; respuesta basada en los datos recopilados:",
        f"- Costo mes actual: {costs.get('currentMonthCost', 0)} {costs.get('currency') or ''}".strip(),
        f"- Variación vs mes anterior: {costs.get('deltaPercent')}%",
        f"- Recursos totales: {inv.get('totalResources', 0)} (sin tags: {inv.get('resourcesWithoutTags', 0)})",
        f"- Recomendaciones: {recs.get('total', 0)} (quick wins: {len(recs.get('quickWins', []))})",
    ]
    if top:
        lines.append("- Top servicios: " + ", ".join(f"{t['key']} ({t['cost']})" for t in top))
    return {"reply": "\n".join(lines), "generatedBy": "rules"}


def answer(connection, message: str, history: list[dict] | None = None) -> dict:
    """Answer a natural-language question grounded on the subscription data."""
    secret = decrypt(connection.client_secret_encrypted)
    try:
        token = azure_auth.get_token(connection.tenant_id, connection.client_id, secret)
    except azure_auth.AzureAuthError as exc:
        return {"reply": f"No pude autenticar con Azure ({exc.code}: {exc.message}).", "generatedBy": "error"}

    snapshot = get_snapshot(connection, token)
    safe = sanitize_for_ai(snapshot)

    client, deployment = get_openai_client()
    if client is None:
        return _rule_based_answer(message, safe)

    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for h in (history or [])[-8:]:
        role = h.get("role")
        content = h.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": f"CONTEXTO (datos de la suscripción):\n{json.dumps(safe, ensure_ascii=False)}\n\nPREGUNTA: {message}",
        }
    )

    try:
        completion = client.chat.completions.create(
            model=deployment, messages=messages, temperature=0.2, max_tokens=700
        )
        reply = completion.choices[0].message.content or ""
        return {"reply": reply, "generatedBy": "azure_openai"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Fallo del chat con IA: %s", type(exc).__name__)
        result = _rule_based_answer(message, safe)
        result["aiError"] = "ai_unavailable"
        return result
