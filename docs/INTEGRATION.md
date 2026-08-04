# Integración agent ↔ cost-mcp (MCP-native)

Implementa el Camino A de [ADR-0002](ADR-0002-seam-integracion-mcp.md): el agente
registra `azure-cost-mcp` como **MCP server por stdio** y le inyecta el token delegado
del usuario por sesión.

## Variables de entorno (lado agente)

| Variable | Requerida | Efecto |
|---|---|---|
| `COST_MCP_PATH` | sí (para activar) | Ruta al entrypoint construido de cost-mcp (`cost-mcp/dist/index.js`). Si no se define, la integración queda **desactivada** y el comportamiento es idéntico al actual. |
| `AZURE_SUBSCRIPTION_ID` | no | Se propaga al subproceso MCP para habilitar las tools de Cost Management. |

El token del usuario se inyecta automáticamente como `AZURE_ACCESS_TOKEN` por sesión
(desde `UserTokens.AzureToken`); no se configura a mano.

## Comportamiento de auth (lado cost-mcp)

`getAccessToken()` ahora prioriza `AZURE_ACCESS_TOKEN` (token delegado del usuario) y
cae a `DefaultAzureCredential` si no está presente. Así cada subproceso MCP opera **como
el usuario** (RBAC delegado, solo lectura Cost Management Reader), no como la identidad
del proceso host. Postura audit-safe preservada extremo a extremo.

## Puesta en marcha local

```powershell
# 1) construir el motor de costos
cd cost-mcp; npm ci; npm run build

# 2) apuntar el agente al entrypoint construido
$env:COST_MCP_PATH = "C:\...\cost-mcp\dist\index.js"
$env:AZURE_SUBSCRIPTION_ID = "<sub-id>"   # opcional

# 3) correr el agente; el SDK levanta el MCP server por stdio en cada sesión
cd ..\agent\src\Dashboard; dotnet run
```

## ⚠️ Gotcha crítico: allow-list de tools (McpStdioServerConfig.Tools)
El Copilot CLI **conecta** el MCP server pero **expone CERO de sus tools al modelo** si
`McpStdioServerConfig.Tools` está vacío/null (es un allow-list, no un filtro opcional).
Hay que nombrar explícitamente las tools a exponer. Verificado empíricamente:
- Sin `Tools`: el modelo solo ve built-ins (`web_fetch`, etc.) y dice "no existe azure_search_prices".
- Con `Tools` poblado: el modelo ve y **usa** las 10 tools, namespaced como **`azure-cost-<nombre>`** (incluye `azure_get_advisor_recommendations`).

`McpServerRegistration.CostToolNames` mantiene la lista (sincronizada con `cost-mcp/scripts/mcp-smoke.mjs`).
Validado e2e con `gpt-5.4`: el agente invoca `azure-cost-azure_search_prices` y devuelve el precio real.

> Nota de modelo: usar un deployment **gpt-5.x** (reasoning). `gpt-4o` no prioriza bien el tool-calling
> con este system-prompt.

## Paridad de tools (qué reemplaza a qué)

Cuando `COST_MCP_PATH` está definido, el agente **excluye** `GetAzureRetailPricing`
(in-proc) porque las tools retail del MCP lo cubren con mayor granularidad:

| Agente (in-proc, excluido con MCP on) | cost-mcp (MCP) |
|---|---|
| `GetAzureRetailPricing` | `azure_search_prices`, `azure_compare_vm_prices`, `azure_find_cheapest_region`, `azure_compare_reservation_vs_payg`, `azure_estimate_architecture_cost` |

Tools que **NO** se tocan (capacidad única, sin equivalente en el MCP):
- `EstimateTokenCost` (CostEstimateTools) — calculadora determinista de costo de tokens LLM.
- `StartPricesheetDownload` / pricesheet (PricesheetTools) — tarifas negociadas EA/MCA.

> Caveat de paridad: `GetAzureRetailPricing` trae guía extensa de precios de Foundry/AOAI.
> Antes de retirarlo en hosts sin MCP, validar que `azure_search_prices` cubre esos casos.

## Verificación e2e
`cost-mcp/scripts/mcp-smoke.mjs` (`npm run smoke`) levanta el server por stdio, hace el
handshake MCP y verifica que expone las 10 tools — el mismo contrato que usa el agente.
Corre en CI tras el build.

## Pendiente (siguientes slices de #4)
- Validar cobertura Foundry/AOAI de `azure_search_prices` y entonces retirar `GetAzureRetailPricing` también en hosts sin MCP.
- Prueba e2e con Azure OpenAI real: pregunta de costo del usuario resuelta por un tool MCP, con traza en App Insights (`ToolExecutionStartData.McpServerName`).
