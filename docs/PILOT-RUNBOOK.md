# Runbook del regulated pilot — validación e2e

Pasos para validar el piloto en la **suscripción of the regulated tenant** una vez asignado el rol
**Cost Management Reader / Reader** a la identidad del piloto. El agente queda en
**modo read-only** por defecto.

## 0. Pre-requisitos
- Suscripción piloto of the regulated tenant + rol **Reader** (y **Cost Management Reader**) en la identidad.
- Azure OpenAI desplegado (ver [`infra/`](../infra/README.md)) o endpoint existente.
- Variables: `AzureOpenAI__Endpoint`, `COST_MCP_PATH`, `AZURE_SUBSCRIPTION_ID`,
  `FINOPS_READONLY=true`, `AUDIT_LOG_PATH`.

## 1. Build + smoke local (sin Azure)
```bash
cd cost-mcp && npm ci && npm run build && npm test && npm run smoke   # 9 tools por stdio
cd ../agent/tests/Dashboard.Tests && dotnet test -c Release           # politica + auditoria + MCP
```

## 2. Arranque integrado
```powershell
$env:COST_MCP_PATH = "<ruta>/cost-mcp/dist/index.js"
$env:AZURE_SUBSCRIPTION_ID = "<sub-id-regulated tenant>"
$env:FINOPS_READONLY = "true"
$env:AUDIT_LOG_PATH = "<ruta>/finops-audit.log"
cd agent/src/Dashboard; dotnet run
```

## 3. Checklist de aceptación e2e
> **Validado el 2026-06-23** contra una suscripción real (`az login` + token ARM delegado):
> el tool MCP `azure_query_costs` devolvió gasto MonthToDate real por servicio, y
> `azure_search_prices` devolvió precios retail reales — todo por stdio con el token
> inyectado. Reproducir con `npm run e2e` (requiere `AZURE_ACCESS_TOKEN` + `AZURE_SUBSCRIPTION_ID`).
>
> Nota: la moneda reportada es la **billing currency** de la suscripción; en el tenant
> real of the regulated tenant será **MXN** automáticamente.

- [ ] **Pregunta de costo** ("¿cuánto gasté el mes pasado por servicio?") la resuelve un tool
      del MCP (`azure_query_costs`), no el QueryAzure genérico. Verificar en App Insights que
      la traza tiene `ToolExecutionStartData.McpServerName = azure-cost`.
- [ ] **Moneda**: el gasto de Cost Management se reporta en **MXN** (billing nativo of the regulated tenant).
- [ ] **Read-only**: pedir una acción de escritura (p. ej. crear budget) → el agente responde
      con un **script** (GenerateScript), nunca ejecuta el PUT/PATCH. La traza muestra
      `blocked_readonly`.
- [ ] **DELETE**: cualquier intento de borrado → `blocked_delete`.
- [ ] **Auditoría**: `AUDIT_LOG_PATH` contiene una línea JSON por decisión; correr la
      verificación de cadena (`AuditLog.Verify`) sobre el archivo da `true`.
- [ ] **Aislamiento**: con `infra/` desplegado, OpenAI y Key Vault no son accesibles desde
      Internet (solo Private Endpoints).

## 4. Métrica del piloto
Registrar, en la primera conversación real, **cuántos pesos de desperdicio** identifica el
agente (recursos ociosos, budgets faltantes, right-sizing) — la métrica de éxito acordada.

## Pendiente que requiere la suscripción of the regulated tenant
- Ejecutar el checklist anterior contra datos reales (bloqueado hasta tener acceso).
- Validar paridad Foundry/AOAI de `azure_search_prices` antes de retirar del todo
  `GetAzureRetailPricing` (issue #4, slice final).
