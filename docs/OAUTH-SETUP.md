# OAuth de usuario (Entra ID) — sign-in delegado para datos del tenant

El agente accede a los datos de costo **del tenant** (Cost Management, Resource Graph,
Log Analytics) con el **token delegado del usuario**, obtenido por sign-in OAuth ("Connect
Azure"). Sin sign-in, el agente solo responde info pública (precios retail, conceptos) — por
diseño. Esto es independiente de qué tenant se use; cambia el *registro de app* y *quién firma*.

## Principios de diseño (correcto + migración simple)
- **Single-tenant por entorno** (`AzureADMyOrg`): sign-in restringido al directorio del entorno
  — postura correcta para gobierno (regulated tenant). Un registro por tenant.
- **Least-privilege read-only delegado**: ARM `user_impersonation` (costos) + Graph `User.Read`
  (perfil). Tiers adicionales (Graph Org/Reports, Log Analytics, Storage) son **consentimiento
  incremental**, opt-in.
- **Config-driven, sin cambios de código entre entornos**: todo via `Microsoft:*`.
- **Local** → secret en **.NET user-secrets** (fuera del repo).
- **Producción (regulated tenant)** → **federated workload identity** (sin secret): la identidad administrada
  del App Service se registra como *federated credential* del app Entra. La app ya lo soporta
  (`EntraClientCredentials`: "federated client assertion (no secret)"). Config no-secreta en
  **Key Vault** (ya provisto en `infra/`).

## Claves de configuración
| Key | Local (user-secrets) | Prod (regulated tenant) |
|---|---|---|
| `Microsoft:ClientId` | GUID del app | GUID del app of the regulated tenant (Key Vault/app setting) |
| `Microsoft:TenantId` | tenant GUID | tenant GUID of the regulated tenant |
| `Microsoft:HomeTenantId` | tenant GUID | tenant GUID of the regulated tenant |
| `Microsoft:ClientSecret` | secret (solo local) | **vacío** → federated MI |

Redirect URI registrado: `{host}/auth/microsoft/callback` (ej. `http://localhost:5180/auth/microsoft/callback`).

## Setup local (ya aplicado en este entorno)
App single-tenant `FinOps Agent - regulated tenant Pilot (dev)` en el tenant de desarrollo, redirect a
`localhost:5180` y `localhost:5000`, permisos read-only (ARM user_impersonation + Graph
User.Read), SP creado, secret guardado en user-secrets. Para reproducir:
```powershell
az ad app create --display-name "FinOps Agent" --sign-in-audience AzureADMyOrg \
  --web-redirect-uris http://localhost:5180/auth/microsoft/callback
# + required-resource-accesses read-only, az ad sp create, credential reset
cd agent/src/Dashboard
dotnet user-secrets set "Microsoft:ClientId"    "<appId>"
dotnet user-secrets set "Microsoft:ClientSecret" "<secret>"
dotnet user-secrets set "Microsoft:TenantId"     "<tenantGuid>"
dotnet user-secrets set "Microsoft:HomeTenantId" "<tenantGuid>"
```

## Validación
1. `dotnet run` (con `COST_MCP_PATH`, `AZURE_SUBSCRIPTION_ID`, `FINOPS_READONLY=true`).
2. Abrir `http://localhost:5180`, **Connect Azure**, firmar y consentir (ARM + perfil).
3. Preguntar "¿cuánto gasté este mes por servicio?" → el agente usa `azure-cost-azure_query_costs`
   con tu RBAC (Reader). Verás `[CONTEXT: User IS connected to Azure]` y la traza del tool MCP.

## Migración al entorno of the regulated tenant (checklist — cero cambios de código)
1. En el tenant del **regulated tenant**: registrar app **single-tenant** (`AzureADMyOrg`), redirect = `https://<host-prod>/auth/microsoft/callback`.
2. Mismos permisos **read-only delegados** (ARM user_impersonation + Graph User.Read; tiers opcionales con admin-consent of the regulated tenant).
3. **Federated credential**: vincular la identidad administrada del App Service como credencial federada del app → **sin secret**.
4. Poner `Microsoft:ClientId`, `Microsoft:TenantId`, `Microsoft:HomeTenantId` en **Key Vault**/app settings (ver `infra/`). `Microsoft:ClientSecret` vacío.
5. Asignar **Reader** + **Cost Management Reader** a los usuarios del piloto en la suscripción of the regulated tenant.
6. Desplegar `infra/main.bicep`. Listo — el código es idéntico.

> Nota: el OAuth de usuario (este doc) es distinto del **BYOK a Azure OpenAI** (identidad
> administrada / `az login` para el modelo). Dos rutas de auth independientes.
