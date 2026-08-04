# Resultados E2E — FinOps AI Agent (regulated pilot)

Evidencia consolidada de la validación end-to-end de la solución integrada
(`agent` + `cost-mcp`) contra Azure real. Fecha: 2026-06-23/24.

> Entorno de prueba: suscripción `11803c68-…` (tenant de desarrollo MngEnvMCAP704974,
> billing **USD**). En el tenant real of the regulated tenant el gasto se reportará en **MXN** nativo.
> Modelo: deployment **gpt-5.4** en `pizza-foundry-resource-banorte`. Postura **read-only**.

## Resumen

| Capa | Qué se probó | Resultado |
|---|---|---|
| cost-mcp (directo) | MCP stdio: handshake + `azure_query_costs` y `azure_search_prices` con token ARM delegado | ✅ datos reales |
| Copilot SDK (sonda) | Registro/conexión del MCP server + exposición de tools al modelo | ✅ tras fix allow-list |
| Agente web (gpt-5.4) | El LLM invoca la tool del MCP por sí mismo | ✅ `azure-cost-azure_search_prices` |
| OAuth de usuario | Sign-in Entra delegado → datos de costo del tenant en el agente | ✅ `azure-cost-azure_query_costs` |
| Hardening | Read-only (PUT/PATCH/DELETE bloqueados) + auditoría inmutable | ✅ tests + en vivo |

## 1. cost-mcp directo (MCP stdio)
`npm run e2e` inyecta un token ARM delegado y llama `azure_query_costs` (MonthToDate):
```
| Cost   | ServiceName                  | Currency |
| 212.04 | GitHub                       | USD |
| 11.28  | Microsoft Defender for Cloud | USD |
| 4.45   | Azure App Service            | USD |
| ...    | Storage / Event Grid / ...   | USD |
```
`azure_search_prices` (Standard_D4s_v5 / eastus) → PAYG $0.376, Spot $0.079, Low Priority $0.038. `npm run smoke` verifica las 9 tools por stdio.

## 2. Causa raíz y fix: exposición de tools del MCP (PR #20)
Una sonda con el Copilot SDK reveló que el CLI **conecta** el MCP server (`status=connected`)
pero **no expone sus tools al modelo** si `McpStdioServerConfig.Tools` está vacío (allow-list).
- Sin allow-list: el modelo solo veía built-ins (`web_fetch`, …) → "no existe azure_search_prices".
- Con allow-list (`McpServerRegistration.CostToolNames`): el modelo lista y **usa** las 9 tools,
  namespaced como `azure-cost-<nombre>`.

## 3. Agente web con gpt-5.4 (tras el fix)
Pregunta de precio por `/api/chat` →
```
tool_start: azure-cost-azure_search_prices  →  "0.192"  (Linux PAYG, dato real)
```
gpt-4o NO prioriza el tool-calling con este system-prompt; **producción requiere gpt-5.x**.

## 4. OAuth de usuario + costo del tenant en el agente (PR #21)
Flujo real en navegador: `/auth/microsoft` → SSO → consentimiento read-only
(ARM como tú + perfil) → callback OK → `/auth/me` confirma sesión. Pregunta de costo:
```
[CONTEXT: User IS connected to Azure]
tool_start: azure-cost-azure_query_costs
Respuesta (datos reales del tenant, MTD):
  | Servicio                     | Gasto MTD (USD) |
  | GitHub                       | 202.30 |
  | Microsoft Defender for Cloud | 11.28  |
  | Azure App Service            | 4.45   |
  | Storage                      | 0.01   |
  Total ≈ $218.05
```
El token delegado del usuario se inyecta a cost-mcp como `AZURE_ACCESS_TOKEN`; opera con su RBAC.

## 5. Hardening en vivo
- `FINOPS_READONLY=true`: GET/POST (queries de lectura) permitidos; PUT/PATCH/DELETE → 403 con
  fallback a script. Cubierto por `Dashboard.Tests` (21 tests) y la política de `HttpHelper`.
- Auditoría inmutable hash-encadenada (`AuditLog`) registra cada decisión; `Verify` detecta tamper.

## Cómo reproducir
1. `cd cost-mcp && npm ci && npm run build && npm run smoke` (sin Azure).
2. Token + e2e: `az login`; `$env:AZURE_ACCESS_TOKEN = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv`; `$env:AZURE_SUBSCRIPTION_ID=<sub>`; `npm run e2e`.
3. Agente: ver [`docs/OAUTH-SETUP.md`](OAUTH-SETUP.md) y [`docs/PILOT-RUNBOOK.md`](PILOT-RUNBOOK.md); `dotnet run`, Connect Azure, preguntar costo.

## Limitaciones / pendientes
- Validación con datos del **tenant real of the regulated tenant** (sub + Reader): pendiente del acceso. Todo el código y runbooks están listos.
- Retiro total de `GetAzureRetailPricing` tras validar paridad Foundry/AOAI: enhancement #19.
- Durabilidad del runner self-hosted: instalar como servicio de Windows (requiere admin).
