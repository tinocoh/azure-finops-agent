# V2.0 Roadmap — FinOps AI Agent (regulated tenant)

Mejoras candidatas para V2 y los **repos base de Microsoft/Azure (verificados)** sobre los
que construirlas — el mismo enfoque con que V1 se fundó en `Azure-Samples/azure-finops-agent`
+ `MO2k4/azure-cost-mcp`. Repos verificados contra GitHub API en junio 2026.

## Hallazgos que condicionan el diseño
- ⚠️ **`Azure/azure-mcp` fue ARCHIVADO (feb 2026)** → el repo oficial vivo es **`microsoft/mcp`**.
- 🚨 **El Azure MCP Server oficial (43+ servicios) NO cubre Cost Management/Billing.** Esto
  **valida** mantener un MCP de costos especializado (lo que ya construimos en V1). Es una
  brecha de producto real.
- **`microsoft/agent-framework`** es el nuevo estándar de orquestación de Microsoft (hay guía
  de migración *desde* Semantic Kernel *hacia* él).

## Mapeo mejora → repo base (verificado)

| # | Mejora V2 | Repo base (URL) | Estado |
|---|---|---|---|
| 1 | Orquestación multi-agente de producción (reemplaza el uso directo del Copilot SDK; workflows, checkpointing, human-in-the-loop, OTel, Foundry hosted) | https://github.com/microsoft/agent-framework | 🟢 11.6k⭐, .NET+Python, MCP nativo |
| 2 | Capa de tools Azure oficial (reemplaza tools ARM/Resource Graph hechas a mano por 43+ servicios mantenidos por MS) | https://github.com/microsoft/mcp | 🟢 3.4k⭐, C# |
| 2b | Motor de costos especializado (cubre el gap de Cost Management) | https://github.com/MO2k4/azure-cost-mcp (evolucionarlo — base de V1) | nuestro V1 |
| 3 | Fundación de datos FinOps (FOCUS, FinOps Hubs, exports normalizados, recomendaciones AOE, Power BI, Bicep, KQL) | https://github.com/microsoft/finops-toolkit | 🟢 573⭐, v14 (jun 2026) |
| 3b | Contrato de datos (esquema normativo de costos) | https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec | 🟢 298⭐, activo |
| 3c | Reporting/optimización complementario | https://github.com/Azure/CCOInsights | 🟢 Power BI |
| 4 | Masking de datos fiscales / PII (RFC, CURP) — **crítico regulated tenant** | https://github.com/microsoft/presidio | 🟢 9.5k⭐, recognizer custom RFC |
| 5 | RAG sobre normativa interna of the regulated tenant | https://github.com/Azure-Samples/azure-search-openai-demo | 🟢 7.7k⭐ |
| 5b | RAG avanzado (razonamiento multi-hop sobre normas) — fase posterior | https://github.com/microsoft/graphrag | 🟢 34k⭐ (costo de indexado alto) |
| 6 | Evaluación continua + groundedness + regresión en CI/CD | https://github.com/microsoft/promptflow + Azure AI Evaluation SDK (`Azure/azure-sdk-for-python` → `sdk/evaluation/azure-ai-evaluation`) | 🟢 11k⭐ |
| 6b | Patrón de eval en CI/CD de referencia | https://github.com/Azure-Samples/contoso-chat | 🟢 sample |
| 7 | Responsible AI / Content Safety (filtrado de salidas, fairness) | https://github.com/Azure-Samples/AzureAIContentSafety + https://github.com/microsoft/responsible-ai-toolbox | 🟡 samples |
| 8 | GreenOps / sostenibilidad (costo financiero + huella de carbono) — diferenciador | https://github.com/Green-Software-Foundation/carbon-aware-sdk (MS miembro fundador) + Azure Carbon Optimization API | 🟢 582⭐ |

## Stack objetivo V2 (todo oficial y mantenido)
```
Orquestación:  microsoft/agent-framework  (.NET, multi-agente, MCP nativo, Foundry)
Tools Azure:   microsoft/mcp (43 servicios)  +  azure-cost-mcp (costos = el gap)
Datos FinOps:  microsoft/finops-toolkit (Hubs/FOCUS/AOE/PowerBI)  ·  FOCUS_Spec
Gobernanza:    microsoft/presidio (PII/RFC)  ·  Content Safety  ·  read-only+auditoría (V1)
Conocimiento:  azure-search-openai-demo (RAG)  → graphrag (fase 2)
Calidad:       promptflow + azure-ai-evaluation (eval CI/CD)  ·  OTel→App Insights (V1)
Sostenib.:     carbon-aware-sdk
Copilot:       github/copilot-sdk (.NET) como bridge si se mantiene Copilot
```

## Qué se conserva de V1 (no se reescribe)
- Patrón **MCP de costos** (`azure-cost-mcp`) — cubre el gap que el MCP oficial no resuelve.
- **Hardening read-only + auditoría inmutable** (hash-encadenada).
- **OAuth delegado de usuario** (single-tenant, federated en prod) — ver `docs/OAUTH-SETUP.md`.
- **Despliegue privado Bicep** (Private Endpoints, Key Vault, MI) — ver `infra/`.
- **OpenTelemetry → App Insights**.

## Plan por olas (valor vs. esfuerzo)

### Ola 1 — Fundación de valor (alto valor, esfuerzo medio)
- **#3 finops-toolkit + #3b FOCUS**: ingesta/normalización de datos reales (FinOps Hubs), base para análisis confiable a escala multi-suscripción.
- **#4 presidio**: masking de RFC/CURP/PII — **prerequisito de cumplimiento** para datos of the regulated tenant antes de ampliar el alcance.
- **#6 evaluación**: suite de eval (groundedness/regresión) en CI para no degradar calidad al iterar.

### Ola 2 — Plataforma de agente (alto valor, esfuerzo alto)
- **#1 agent-framework**: migrar la orquestación a multi-agente con checkpointing y human-in-the-loop (habilita el flujo de aprobación de acciones para entornos regulados).
- **#2 microsoft/mcp**: adoptar el Azure MCP Server oficial para ARM/Monitor/Advisor/Policy/Quota, reduciendo tools propias a mantener; mantener `azure-cost-mcp` para costos.

### Ola 3 — Conocimiento y experiencia (valor medio-alto)
- **#5 azure-search-openai-demo (RAG)**: fundamentar respuestas en normativa/lineamientos internos of the regulated tenant.
- **#7 Content Safety / Responsible AI**: filtrado de salidas y fairness para uso institucional.

### Ola 4 — Diferenciadores (valor medio, opcional)
- **#5b graphrag**: razonamiento multi-hop sobre relaciones normativas (evaluar costo de indexado).
- **#8 carbon-aware-sdk**: GreenOps — correlacionar costo financiero con huella de carbono.

## Repos a evitar (archivados o inexistentes)
- 🔴 `Azure/azure-mcp` — **archivado**, migrado a `microsoft/mcp`.
- 🔴 `Azure-Samples/azure-ai-agent-service-enterprise-demo` — archivado.
- ❌ No existen: `microsoft/azure-optimization-engine` (migrado al finops-toolkit),
  `Azure/azure-ai-foundry` (es un servicio, no repo), `microsoft/copilot-sdk`
  (el correcto es `github/copilot-sdk`), `finopsfoundation/FOCUS`
  (el correcto es `FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec`).

> Nota: estrellas/fechas verificadas vía GitHub API en jun 2026 y pueden variar.
