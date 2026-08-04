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
    "Eres un analista FinOps senior de Azure. Con base en los datos agregados "
    "(costos, inventario y recomendaciones) genera un resumen ejecutivo en español, "
    "claro y accionable. Estructura la respuesta en: Hallazgos principales, Riesgos, "
    "Oportunidades de ahorro, Acciones recomendadas y Próximos pasos. "
    "No incluyas identificadores sensibles. Sé conciso."
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
        f"Costo del mes en curso: {current} (mes anterior: {prev}).",
        f"Variación vs mes anterior: {delta_pct}%." if delta_pct is not None else "Sin comparativa disponible.",
    ]
    if top:
        findings.append("Servicios de mayor costo: " + ", ".join(t["key"] for t in top) + ".")

    risks = []
    if without_tags:
        risks.append(f"{without_tags} recursos sin etiquetas (dificulta asignación de costos).")
    if not risks:
        risks.append("No se detectaron riesgos evidentes en los datos recopilados.")

    savings = []
    if unattached:
        savings.append(f"{unattached} discos sin adjuntar: candidatos a eliminación.")
    if stopped:
        savings.append(f"{stopped} VMs detenidas/desasignadas: revisar si siguen generando costo de disco.")
    if quick_wins:
        savings.append(f"{quick_wins} quick wins de Advisor en categoría Costo.")
    if not savings:
        savings.append("Ejecuta Advisor con permisos de lectura para detectar ahorros.")

    actions = [
        "Etiquetar recursos sin tags con owner y centro de costos." if without_tags else "Mantener la disciplina de etiquetado.",
        "Eliminar discos no adjuntos tras validar con los dueños." if unattached else "Revisar inventario periódicamente.",
        "Aplicar las recomendaciones de Advisor marcadas como quick win." if quick_wins else "Habilitar Advisor.",
    ]

    return {
        "generatedBy": "rules",
        "summary": {
            "hallazgos": findings,
            "riesgos": risks,
            "oportunidadesAhorro": savings,
            "accionesRecomendadas": actions,
            "proximosPasos": [
                "Programar análisis recurrente.",
                "Definir presupuestos y alertas por suscripción.",
            ],
        },
    }


def generate_ai_summary(data: dict) -> dict:
    """Generate an executive summary. Uses Azure OpenAI if configured, else rules."""
    settings = get_settings()
    safe = sanitize_for_ai(data)

    if not settings.azure_openai_endpoint or not settings.azure_openai_deployment:
        logger.info("Azure OpenAI no configurado; usando resumen basado en reglas.")
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
        logger.warning("Fallo al generar resumen con IA: %s. Usando reglas.", type(exc).__name__)
        result = _rule_based_summary(safe)
        result["aiError"] = "ai_unavailable"
        return result
