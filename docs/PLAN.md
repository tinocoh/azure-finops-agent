# Proyecto de Integración — FinOps AI Agent para el a regulated public-sector organization

## Problema / objetivo
El cliente (regulated tenant) aceptó el proyecto. Hay que convertir dos repos independientes en
**una solución integrada, endurecida y audit-safe** para un entorno fiscal regulado:

- `Azure-Samples/azure-finops-agent` — capa de experiencia (.NET 10 + Vue 3 + Copilot SDK), 19 tools embebidos.
- `MO2k4/azure-cost-mcp` — motor de inteligencia de costos (servidor MCP, TS/Node), 9 tools, 77 tests verdes.

Hoy **no se integran**: finops-agent reimplementa lógica del MCP en proceso
(ej. `PricesheetTools` "mirrors the proven start/poll pattern from the Azure Cost Management MCP").

## Línea base verificada (2026-06-23)
- Toolchain: .NET 10.0.301, Node 24.14, npm 11.9, git 2.54, gh autenticado (admin_tinocoms).
- `azure-finops-agent`: `dotnet build -c Release` → **OK, 0 errores** (descarga Copilot CLI 1.0.46 como parte del SDK).
- `azure-cost-mcp`: `npm run build` + `vitest` → **OK, 77/77 tests verdes**.
- Workspace de trabajo: `C:\dev\finops-regulated tenant\repos\` (fuera de OneDrive para evitar churn de sync).

## Seam de integración (hallazgo técnico)
- El Copilot SDK corre el **Copilot CLI como subproceso** y ya emite convenciones MCP en telemetría → MCP es ciudadano de primera clase.
- Las tools se inyectan vía `SessionConfig.Tools = List<AIFunction>` (en `CopilotSessionFactory.GetOrCreateUserTools`).
- Dos caminos de integración:
  - **A. MCP-native (objetivo):** registrar `azure-cost-mcp` como MCP server consumido por el agente → "una sola capa MCP", elimina duplicación, motor de costos único y testeado.
  - **B. In-proc (fallback):** envolver los handlers de cost-mcp como `AIFunction` dentro del agente.
- Decisión recomendada: **A como meta, validar soporte MCP del SDK; B como fallback de bajo riesgo.**

## Workstreams
1. **Fundación** — workspace, forks, git, CI, baseline reproducible, ADRs.
2. **Integración** — unificar cost-mcp ↔ finops-agent (Seam A/B), eliminar duplicación.
3. **Hardening audit-safe (regulated tenant)** — RBAC Reader-only, deshabilitar escrituras, auditoría inmutable, aprobación humana, despliegue privado (VNet/Private Endpoints), data masking.
4. **Localización MX** — MXN, impuestos, catálogos de gobierno, idioma.
5. **Pruebas y release** — pruebas de integración e2e, smoke en suscripción piloto of the regulated tenant, pipeline de release.

## Notas / consideraciones
- finops-agent es Azure-Samples (MIT), tratar como acelerador: mantener fork + capacidad de rebase con upstream.
- Copilot SDK en beta → fijar versión, plan de actualización.
- `QueryAzure` permite PUT/PATCH; para regulated tenant forzar Reader-only y bloquear escrituras a nivel de código + RBAC.
- Datos fiscales: no enviar payloads crudos al LLM (ya hay patrón "schema-first" en UploadedFileTools — reutilizar/extender).

## Decisiones pendientes del usuario
- [ ] Hosting del proyecto: repo privado en GitHub (forks bajo su cuenta/org) vs. solo local.
- [ ] Seam de integración preferido (A MCP-native recomendado).
- [ ] Suscripción/tenant piloto of the regulated tenant y rol asignado (Reader).
