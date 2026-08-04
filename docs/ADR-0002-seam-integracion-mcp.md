# ADR-0002 — Seam de integración: MCP-native (Camino A) CONFIRMADO

Estado: Aceptado · Fecha: 2026-06-23 · Issue: #3 (spike)

## Pregunta del spike
¿El GitHub Copilot SDK (`GitHub.Copilot.SDK` 1.0.0-beta.4, usado por `azure-finops-agent`)
permite registrar `azure-cost-mcp` como **servidor MCP** consumido por el agente
(Camino A), o hay que envolver sus tools in-proc (Camino B)?

## Evidencia (reflexión sobre el ensamblado real del SDK)
El SDK expone soporte MCP de **primera clase**, no como afterthought:

- **Configuración por sesión:**
  - `SessionConfig.McpServers : IDictionary<string, McpServerConfig>`
  - `ResumeSessionConfig.McpServers` y `CustomAgentConfig.McpServers`
- **Tipos de config de servidor:**
  - `McpStdioServerConfig`  ← transporte **stdio** (exactamente como corre azure-cost-mcp)
  - `McpHttpServerConfig` (+ `McpHttpServerConfigOauthGrantType`) ← variante HTTP/OAuth
- **Ciclo de vida y telemetría:**
  - Eventos `SessionMcpServersLoadedEvent`, `SessionMcpServerStatusChangedEvent`
  - `ToolExecutionStartData.McpServerName` / `.McpToolName` (trazabilidad por tool MCP)
  - Permisos: `PermissionRequestMcp`, `UserToolSessionApprovalMcp`
- **Gestión en runtime (RPC):** `McpConfigAddRequest`, enable/disable/reload, discover.

> Conclusión: **Camino A es viable y es el camino soportado.** El agente puede cargar
> los 9 tools de costo de azure-cost-mcp por stdio **sin reescribirlos**.

## Decisión
Adoptar **Camino A (MCP-native, stdio)**. `azure-cost-mcp` pasa a ser el **motor de
costos canónico**; el agente lo consume vía `SessionConfig.McpServers`. Se elimina la
lógica duplicada en el agente (p. ej. `PricesheetTools.cs`, que ya "mirrors the proven
start/poll pattern from the Azure Cost Management MCP server").

### Diseño de registro (en `CopilotSessionFactory.CreateSessionConfigAsync`)
```csharp
McpServers = new Dictionary<string, McpServerConfig>
{
    ["azure-cost"] = new McpStdioServerConfig
    {
        Command = "node",
        Args = new[] { Path.Combine(costMcpDir, "dist", "index.js") },
        Env = new Dictionary<string, string>
        {
            // Inyectar el token DELEGADO del usuario por sesión (ver nota auth)
            ["AZURE_ACCESS_TOKEN"]   = tokens.AzureToken,
            ["AZURE_SUBSCRIPTION_ID"] = subscriptionId,
        },
    },
};
```

## Nota crítica de auth (entra en el workstream Hardening)
- El agente usa **tokens delegados de Entra por usuario** (`UserTokens`).
- `azure-cost-mcp` hoy usa `DefaultAzureCredential` (identidad del proceso), **no** el
  token del usuario. En multiusuario for a regulated public-sector tenant eso mezclaría identidades.
- **Acción:** pequeño cambio en `cost-mcp/src/auth/azure-auth.ts` para aceptar un token
  vía `AZURE_ACCESS_TOKEN` (fallback a DefaultAzureCredential). El `McpStdioServerConfig.Env`
  permite inyectarlo **por sesión** → cada subproceso MCP opera con el token del usuario.
- Mantiene la postura **read-only** (rol Cost Management Reader) extremo a extremo.

## Consecuencias
- (+) Integración a nivel de **configuración**, no de reescritura. Motor de costos único y testeado (77 tests).
- (+) Trazabilidad nativa por tool MCP → alimenta auditoría audit-safe of the regulated tenant.
- (+) Un solo límite de seguridad read-only que endurecer.
- (−) Requiere el ajuste de auth por token en cost-mcp (acotado, con tests).
- (−) Gestión del ciclo de vida del subproceso MCP por sesión (cubierto por eventos del SDK).

## Próximos pasos (issue #4 — Unificar)
1. Ajustar `azure-auth.ts` para token por env (+ test).
2. Registrar `McpServers` en `CreateSessionConfigAsync` / `CreateResumeConfigAsync`.
3. Deprecate tools duplicados del agente (PricesheetTools, RetailPricingTools) tras paridad.
4. Prueba e2e: una pregunta de costo del usuario resuelta por el tool MCP, con traza en App Insights.
