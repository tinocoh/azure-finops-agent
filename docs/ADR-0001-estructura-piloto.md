# ADR-0001 — Estructura y arranque del piloto de integración

Estado: Aceptado · Fecha: 2026-06-23

## Contexto
El a regulated public-sector organization aceptó el piloto. Hay que integrar dos componentes upstream
independientes en una solución FinOps audit-safe, con 3 personas (lead + 2 internos
de Microsoft) trabajando en paralelo, priorizando **simplicidad de administración**.

## Decisión
1. **Monorepo privado único** (`regulated tenant-finops-pilot`) con `agent/` y `cost-mcp/` como
   subcarpetas vendored, en lugar de dos forks. Un solo lugar para permisos, CI,
   issues y board. Los PRs de integración (que cruzan ambos componentes) quedan atómicos.
2. **Upstream por pin**, no por fork: los SHAs base se registran en
   `docs/UPSTREAM_PINS.txt`; se traen parches manualmente si hace falta.
3. **Colaboradores directos** (sin org/teams) para minimizar administración.
4. **Trunk-based** con ramas cortas + PR + 1 review; `main` protegida.

## Seam de integración (a validar en ADR-0002)
- El GitHub Copilot SDK ejecuta el Copilot CLI como subproceso con soporte MCP nativo;
  las tools se inyectan vía `SessionConfig.Tools` (List<AIFunction>).
- **Camino A (objetivo):** registrar `cost-mcp` como MCP server consumido por el agente.
- **Camino B (fallback):** envolver los handlers de cost-mcp como AIFunction in-proc.
- Hay duplicación real a eliminar (`agent/.../PricesheetTools.cs` replica el patrón del MCP).

## Consecuencias
- (+) Administración mínima, onboarding de 1 clone, PRs atómicos, CI único.
- (−) Se pierde el flujo nativo de rebase con upstream → mitigado con pins documentados.

## Pendiente
- ADR-0002: veredicto del spike de soporte MCP del SDK (Camino A vs B).
- Branch protection y CODEOWNERS definitivos al tener los handles.
