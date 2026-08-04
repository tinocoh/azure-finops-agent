# Notas Técnicas — FinOps AI Agent para el a regulated public-sector organization

> Generado: 2026-07-01 | Repositorio: `Azure-Samples/azure-finops-agent` | Rama: `main`

---

## 1. Resumen Ejecutivo

**regulated tenant-finops-pilot** es un monorepo que integra dos componentes upstream de Microsoft en una solución FinOps *audit-safe* for a regulated public-sector tenant (entorno fiscal regulado mexicano). El agente responde preguntas de costos Azure en lenguaje natural, usando acceso solo-lectura delegado al tenant del usuario, con una cadena de auditoría inmutable y postura de red privada.

| Dimensión | Valor |
|---|---|
| **Propósito** | Optimización de costos Azure + cumplimiento fiscal (regulated public-sector requirements) |
| **Modelo LLM** | Azure OpenAI gpt-5.4 (recomendado) / gpt-4o |
| **Stack principal** | .NET 10, Vue 3, TypeScript/Node ≥20 |
| **Postura de seguridad** | Read-only por defecto, audit trail hash-encadenado SHA-256 |
| **Despliegue** | App Service Linux (contenedor) + Private Endpoints |
| **Moneda nativa** | MXN (billing nativo del regulated tenant) |

---

## 2. Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR — Regulated tenant user                              │
│                    Vue 3 SPA  ·  HTTPS / SSE streaming                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ OAuth sign-in + chat HTTP/SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              agent/  —  App Service Linux (contenedor .NET 10)              │
│                                                                             │
│  ┌──────────────┐  ┌─────────────────────┐  ┌──────────────────────────┐   │
│  │  ASP.NET Core│  │ GitHub Copilot SDK  │  │  OAuth / Entra ID        │   │
│  │  Endpoints   │  │ CopilotSessionFactory│  │  EntraClientCredentials  │   │
│  │  (chat/upload│  │ (sesión por usuario) │  │  IdTokenValidator        │   │
│  │  /download)  │  │                     │  │  SessionTokenStore       │   │
│  └──────┬───────┘  └──────────┬──────────┘  └──────────────────────────┘   │
│         │                     │                                             │
│         │          ┌──────────▼──────────────────────────────────────┐     │
│         │          │   19 Tools In-Process (AIFunction)               │     │
│         │          │  AzureQueryTools · GraphQueryTools · KQL         │     │
│         │          │  PricesheetTools · CostEstimateTools             │     │
│         │          │  IdleResourceTools · AnomalyTools                │     │
│         │          │  ScoreTools · MaturityReportTools                │     │
│         │          │  ChartTools · ScriptTools · WebFetchTools        │     │
│         │          │  UploadedFileTools · HtmlPresentationTools       │     │
│         │          └──────────┬──────────────────────────────────────┘     │
│         │                     │                                             │
│         │          ┌──────────▼──────────────────────────────────────┐     │
│         │          │   HttpHelper — Read-Only Gate                    │     │
│         │          │   GET ✅ · POST ✅ · PUT ⛔ · PATCH ⛔ · DELETE ⛔│     │
│         │          │   + AuditLog SHA-256 hash-encadenado             │     │
│         │          └──────────┬──────────────────────────────────────┘     │
│         │                     │                                             │
│  ┌──────▼─────────────────────▼──────────────────────┐                     │
│  │  OTel Collector sidecar (OTLP → App Insights)     │                     │
│  └───────────────────────────────────────────────────┘                     │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │ stdio subprocess (MCP protocol)
                         │ AZURE_ACCESS_TOKEN inyectado por sesión
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           cost-mcp/  —  Node.js MCP Server (subproceso stdio)               │
│                     azure-cost-mcp  v0.1.0                                  │
│                                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐    │
│  │   5 Retail Tools (sin auth)  │  │  5 Cost Mgmt Tools (token deleg) │    │
│  │  azure_search_prices         │  │  azure_query_costs               │    │
│  │  azure_compare_vm_prices     │  │  azure_query_costs_by_resource   │    │
│  │  azure_find_cheapest_region  │  │  azure_get_cost_forecast         │    │
│  │  azure_compare_reservation   │  │  azure_list_budgets              │    │
│  │  azure_estimate_architecture │  │  azure_get_advisor_recommendations│   │
│  └──────────────┬───────────────┘  └─────────────────┬────────────────┘    │
└─────────────────┼─────────────────────────────────────┼────────────────────┘
                  │                                     │ token delegado RBAC
                  ▼                                     ▼
          prices.azure.com                    Azure Cost Management API
          (Retail Pricing API)                Azure Advisor API
```

---

## 3. Diagrama de Arquitectura en Azure

```
Internet / regulated-tenant users
        │
        │  HTTPS 443
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Azure App Service  (Linux / Contenedor · P1v3)                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  .NET 10 App  +  Node.js MCP subprocess  +  OTel Collector sidecar  │  │
│  │  Managed Identity (SystemAssigned)                                   │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
│                                 │ VNet Integration (vnetRouteAllEnabled)    │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  │
          ┌───────────────────────┤  10.20.1.0/24  (subred app)
          │           ┌───────────┴─────────────────────────────┐
          │           │     Azure Virtual Network /16           │
          │           │   ┌─────────────────────────────────┐  │
          │           │   │  subred privateendpoints         │  │
          │           │   │  10.20.2.0/24                   │  │
          │           │   └────────────┬────────────────────┘  │
          │           └────────────────┼────────────────────────┘
          │                            │
    ┌─────▼──────┐    ┌────────────────▼──────────────────────────────────┐
    │  Microsoft │    │  Private Endpoints (sin acceso público)            │
    │  Entra ID  │    │                                                    │
    │  (OAuth    │    │  ┌─────────────────────┐  ┌─────────────────────┐ │
    │  delegado) │    │  │  Azure OpenAI (S0)  │  │  Azure Key Vault    │ │
    └─────┬──────┘    │  │  gpt-5.4 deployment │  │  (Standard, RBAC)  │ │
          │           │  │  publicNetwork:OFF  │  │  publicNetwork:OFF  │ │
          │           │  │  disableLocalAuth   │  │  federated MI creds │ │
          │           │  └─────────────────────┘  └─────────────────────┘ │
          │           └────────────────────────────────────────────────────┘
          │
    ┌─────▼──────────────────────────────────────────────────────────────────┐
    │  APIs de Azure (acceso con token delegado del usuario — RBAC Reader)  │
    │                                                                        │
    │  Azure Cost Management API  ·  Azure Resource Graph                   │
    │  Azure Advisor API  ·  Microsoft Graph  ·  Log Analytics              │
    └────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────┐
    │  Observabilidad (OTLP W3C)                                           │
    │  Log Analytics Workspace  →  Application Insights  (retención 90d)  │
    └───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes Detallados

### 4.1 `agent/` — Capa de Experiencia (.NET 10)

| Archivo | Función |
|---|---|
| [agent/src/Dashboard/Program.cs](agent/src/Dashboard/Program.cs) | Bootstrap: DI, sesión, OAuth, OTel, `CopilotSessionFactory` |
| [agent/src/Dashboard/AI/CopilotSessionFactory.cs](agent/src/Dashboard/AI/CopilotSessionFactory.cs) | Gestión de sesiones por usuario, inyección de tools y MCP server |
| [agent/src/Dashboard/AI/McpServerRegistration.cs](agent/src/Dashboard/AI/McpServerRegistration.cs) | Registra `azure-cost-mcp` por stdio; allow-list de 10 tools |
| `agent/src/Dashboard/AI/Tools/` (19 tools) | Tools in-proc: ARM, Graph, KQL, precios, scripts, charts, archivos |
| `agent/src/Dashboard/Infrastructure/HttpHelper.cs` | **Gate de seguridad read-only**: bloquea PUT/PATCH/DELETE |
| `agent/src/Dashboard/Observability/AuditLog.cs` | Auditoría hash-encadenada SHA-256, append-only |
| `agent/src/Dashboard/Auth/` | OAuth Entra ID, validación de tokens, `PersistentIdentity` |
| `agent/src/Dashboard/webui/` | Vue 3 + Vite (frontend), servido desde `wwwroot` |
| [agent/src/Dashboard/Dockerfile](agent/src/Dashboard/Dockerfile) | Multi-stage: Node → .NET SDK → runtime; Python, OTel Collector |

**Dependencias NuGet clave:**

| Paquete | Versión | Uso |
|---|---|---|
| `GitHub.Copilot.SDK` | 1.0.0-beta.4 | SDK del agente, soporte MCP nativo |
| `Azure.Identity` | 1.21.0 | DefaultAzureCredential, Managed Identity |
| `Azure.Monitor.OpenTelemetry.AspNetCore` | 1.5.0 | Telemetría OTel → App Insights |
| `OpenTelemetry` / `OpenTelemetry.Api` | 1.15.3 | Trazas W3C distribuidas |
| `Microsoft.IdentityModel.*` | 8.18.0 | Validación JWT / OpenID Connect |

### 4.2 `cost-mcp/` — Motor de Costos (TypeScript/Node ≥20)

Servidor MCP por **stdio**; el agente lo lanza como subproceso e inyecta el token delegado del usuario como `AZURE_ACCESS_TOKEN`.

**Dependencias npm clave:**

| Paquete | Versión | Uso |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.26.0 | Protocolo MCP stdio |
| `@azure/identity` | ^4.13.0 | DefaultAzureCredential / token delegado |
| `zod` | ^4.3.6 | Validación de schemas de tools |

**10 Tools expuestas (allow-list en `McpServerRegistration.CostToolNames`):**

| # | Tool | Categoría | Auth |
|---|---|---|---|
| 1 | `azure_search_prices` | Retail | ❌ pública |
| 2 | `azure_compare_vm_prices` | Retail | ❌ pública |
| 3 | `azure_find_cheapest_region` | Retail | ❌ pública |
| 4 | `azure_compare_reservation_vs_payg` | Retail | ❌ pública |
| 5 | `azure_estimate_architecture_cost` | Retail | ❌ pública |
| 6 | `azure_query_costs` | Cost Management | ✅ token delegado |
| 7 | `azure_query_costs_by_resource` | Cost Management | ✅ token delegado |
| 8 | `azure_get_cost_forecast` | Cost Management | ✅ token delegado |
| 9 | `azure_list_budgets` | Cost Management | ✅ token delegado |
| 10 | `azure_get_advisor_recommendations` | Advisor | ✅ token delegado |

### 4.3 `infra/` — Infraestructura Bicep (audit-safe)

Definida en [infra/main.bicep](infra/main.bicep). Despliega todos los recursos con acceso público deshabilitado.

---

## 5. Servicios de Azure Requeridos

### 5.1 Servicios obligatorios

| Servicio Azure | SKU / Tier | Configuración clave | Para qué |
|---|---|---|---|
| **Azure OpenAI** | S0 | `publicNetworkAccess: Disabled`, `disableLocalAuth: true`, deployment gpt-5.4 (GlobalStandard, 50K TPM) | Motor LLM del agente |
| **App Service Plan** | P1v3 (PremiumV3) | Linux, reserved | Hosting del contenedor .NET 10 |
| **App Service** | — | SystemAssigned MI, VNet integration, HTTPS-only, TLS 1.2, `vnetRouteAllEnabled` | Alojamiento del agente |
| **Azure Virtual Network** | — | `/16`, subred `app` (10.20.1.0/24) delegada + subred `privateendpoints` (10.20.2.0/24) | Aislamiento de red |
| **Private Endpoint (OpenAI)** | — | Zona `privatelink.openai.azure.com` | Acceso privado a OpenAI |
| **Private Endpoint (Key Vault)** | — | Zona `privatelink.vaultcore.azure.net` | Acceso privado a Key Vault |
| **Azure Key Vault** | Standard | `publicNetworkAccess: Disabled`, RBAC, `enableRbacAuthorization: true` | Secretos / config sin credenciales locales en prod |
| **Microsoft Entra ID** | — | App Registration single-tenant (`AzureADMyOrg`), permisos: `ARM user_impersonation` + `Graph User.Read` | OAuth delegado del usuario |

### 5.2 Servicios de observabilidad

| Servicio Azure | Configuración | Para qué |
|---|---|---|
| **Log Analytics Workspace** | SKU `PerGB2018`, retención 90 días | Backend de Application Insights |
| **Application Insights** | Kind `web`, vinculado al LAW | Trazas OTel W3C, telemetría de tools, auditoría |

### 5.3 APIs de Azure consumidas (acceso delegado del usuario)

| API / Servicio | Permisos RBAC requeridos en suscripción | Uso |
|---|---|---|
| **Azure Cost Management API** | `Cost Management Reader` | Gasto real, forecast, budgets |
| **Azure Resource Graph** | `Reader` | Inventario de recursos multi-suscripción |
| **Azure Advisor API** | `Reader` | Recomendaciones de ahorro y right-sizing |
| **Microsoft Graph** | `User.Read` (delegado) | Perfil del usuario firmado |
| **Log Analytics** | `Reader` (workspace) | KQL sobre logs de recursos |
| **prices.azure.com** | ❌ sin auth (pública) | Precios retail de Azure |

### 5.4 RBAC de la Managed Identity (identidad del App Service)

| Rol | Scope | Para qué |
|---|---|---|
| `Cognitive Services User` | Recurso Azure OpenAI | Llamadas de inferencia sin secret |
| `Key Vault Secrets User` | Key Vault | Leer secretos de configuración |

### 5.5 RBAC para usuarios del regulated pilot

| Rol | Scope | Para qué |
|---|---|---|
| `Reader` | Suscripción piloto | Acceso de lectura a todos los recursos |
| `Cost Management Reader` | Suscripción piloto | Consultar datos de costo y billing |

---

## 6. Variables de Entorno / Configuración

### Agente (.NET)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `AzureOpenAI__Endpoint` | ✅ | `https://<resource>.openai.azure.com/` |
| `AzureOpenAI__DeploymentName` | — | Default: `gpt-5.4` |
| `Microsoft__ClientId` | ✅ | App ID de Entra (OAuth delegado) |
| `Microsoft__TenantId` | ✅ | Tenant GUID of the regulated tenant |
| `Microsoft__HomeTenantId` | ✅ | Igual que `TenantId` en single-tenant |
| `Microsoft__ClientSecret` | Solo local | Vacío en prod → federated Managed Identity |
| `COST_MCP_PATH` | ✅ (activa MCP) | Ruta a `cost-mcp/dist/index.js` |
| `AZURE_SUBSCRIPTION_ID` | Recomendada | Suscripción a consultar en Cost Management |
| `FINOPS_READONLY` | — | Default implícito: `true` (bloquea PUT/PATCH) |
| `AUDIT_LOG_PATH` | Recomendada | Ruta del log de auditoría append-only (JSON lines) |
| `ApplicationInsights__ConnectionString` | Recomendada | Telemetría OTel → App Insights |

### Motor de costos (cost-mcp, inyectado por sesión)

| Variable | Inyectada por | Descripción |
|---|---|---|
| `AZURE_ACCESS_TOKEN` | Agente (por sesión) | Token delegado del usuario Entra |
| `AZURE_SUBSCRIPTION_ID` | Agente (env) | Suscripción objetivo |

---

## 7. Flujos de Autenticación

### Ruta 1 — Usuario → Datos del tenant (OAuth delegado)

```
Usuario (browser)
    │ 1. Click "Conectar Azure"
    ▼
App Service (.NET)
    │ 2. Redirect → Entra ID /authorize
    ▼
Microsoft Entra ID
    │ 3. sign-in + consentimiento (ARM user_impersonation + User.Read)
    ▼
App Service (.NET)
    │ 4. token delegado guardado en sesión (SessionTokenStore)
    │ 5. token inyectado como AZURE_ACCESS_TOKEN al subproceso cost-mcp
    ▼
cost-mcp (stdio) → Cost Management API / Advisor / Resource Graph
    [opera como el usuario, bajo su RBAC Reader]
```

### Ruta 2 — App Service → Azure OpenAI (Managed Identity)

```
App Service (Managed Identity SystemAssigned)
    │ Cognitive Services User role
    ▼
Azure OpenAI (Private Endpoint)
    [sin secrets, sin credenciales locales]
```

### Producción: Federated Workload Identity (sin secrets)

```
App Service (Managed Identity)
    │ registrada como federated credential del App Registration Entra
    ▼
Entra ID emite tokens sin necesidad de client_secret
    [Microsoft__ClientSecret = vacío en producción]
```

---

## 8. Postura de Seguridad (audit-safe para entorno fiscal)

| Control | Implementación | Archivo |
|---|---|---|
| **Read-only por defecto** | `HttpHelper` bloquea PUT/PATCH; DELETE siempre bloqueado | `Infrastructure/HttpHelper.cs` |
| **Auditoría inmutable** | SHA-256 hash-encadenado, archivo append-only; `AuditLog.Verify` detecta tamper | `Observability/AuditLog.cs` |
| **Sin credenciales locales en prod** | Federated Workload Identity (MI del App Service) | `Auth/EntraClientCredentials.cs` |
| **Red aislada** | Private Endpoints para OpenAI y Key Vault; VNet integration | `infra/main.bicep` |
| **RBAC mínimo (MI)** | `Cognitive Services User` + `Key Vault Secrets User` únicamente | `infra/main.bicep` |
| **RBAC usuario** | Solo `Reader` + `Cost Management Reader` (sin escritura) | RBAC suscripción regulated tenant |
| **Datos fiscales** | Patrón schema-first en `UploadedFileTools` (no envía payloads crudos al LLM) | `AI/Tools/UploadedFileTools.cs` |
| **Acción de escritura** | El agente genera scripts (`GenerateScript`), nunca ejecuta PUT/PATCH por sí mismo | System prompt + HttpHelper |
| **Trazabilidad** | Cada tool-call registrado en App Insights con `McpServerName`, actor, decisión | OTel + `AuditLog` |

---

## 9. Guía de Despliegue para el Equipo

### Prerrequisitos

- [ ] .NET 10 SDK (`dotnet --version` → `10.0.x`)
- [ ] Node.js ≥20 + npm ≥10 (`node --version`, `npm --version`)
- [ ] Azure CLI (`az --version`) + `az login` con cuenta con permisos de Contributor en la suscripción
- [ ] Docker Desktop (para build de imagen de contenedor)
- [ ] Acceso a la suscripción piloto of the regulated tenant (Owner o Contributor para crear recursos)

### Opción A — Ejecución Local (desarrollo / demo)

```powershell
# 1. Compilar el motor MCP
cd cost-mcp
npm ci
npm run build
npm test          # debe pasar 77/77 tests

# 2. Compilar el frontend Vue
cd ../agent/src/Dashboard/webui
npm install
npm run build     # genera ../wwwroot

# 3. Compilar el backend .NET
cd ..
dotnet build -c Release

# 4. Configurar secretos (una sola vez, fuera del repo)
dotnet user-secrets set "AzureOpenAI:Endpoint"    "https://TU-RESOURCE.openai.azure.com/"
dotnet user-secrets set "Microsoft:ClientId"       "<app-id-entra>"
dotnet user-secrets set "Microsoft:ClientSecret"   "<secret-dev>"
dotnet user-secrets set "Microsoft:TenantId"       "<tenant-guid>"
dotnet user-secrets set "Microsoft:HomeTenantId"   "<tenant-guid>"

# 5. Arrancar el agente
./run-local.ps1 -SubscriptionId "<sub-id-regulated tenant>"
# Abre http://localhost:5180 → "Conectar Azure"
```

### Opción B — Despliegue en Azure (producción)

```bash
# Paso 1 — Registrar App Entra single-tenant en el tenant of the regulated tenant
az ad app create \
  --display-name "FinOps Agent regulated tenant" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://<host-prod>/auth/microsoft/callback"

# Asignar permisos delegados read-only
az ad app permission add --id <app-id> \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \   # Azure Service Management
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope   # user_impersonation
az ad app permission add --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \   # Microsoft Graph
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope   # User.Read

# Paso 2 — Crear grupo de recursos y desplegar infraestructura Bicep
az group create -n rg-regulated tenant-finops-pilot -l eastus2

az deployment group create \
  -g rg-regulated tenant-finops-pilot \
  -f infra/main.bicep \
  -p namePrefix=regulated tenantfinops \
     openAiDeploymentName=gpt-5.4 \
     microsoftClientId=<app-id-entra> \
     microsoftTenantId=<tenant-guid>

# Paso 3 — Build imagen Docker multi-stage
cd agent/src/Dashboard
docker build \
  --build-arg BUILD_SHA=$(git rev-parse --short HEAD) \
  -t regulated tenantfinops-agent:latest .

# Paso 4 — Push a Azure Container Registry y actualizar App Service
az acr create -n regulated tenantfinopsacr -g rg-regulated tenant-finops-pilot --sku Basic
az acr login -n regulated tenantfinopsacr
docker tag regulated tenantfinops-agent:latest regulated tenantfinopsacr.azurecr.io/regulated tenantfinops-agent:latest
docker push regulated tenantfinopsacr.azurecr.io/regulated tenantfinops-agent:latest

az webapp config container set \
  -n <site-name> -g rg-regulated tenant-finops-pilot \
  --docker-custom-image-name regulated tenantfinopsacr.azurecr.io/regulated tenantfinops-agent:latest

# Paso 5 — Asignar RBAC a usuarios del piloto en la suscripción regulated tenant
az role assignment create \
  --role "Reader" \
  --assignee <user-upn-regulated tenant> \
  --scope /subscriptions/<sub-id-regulated tenant>

az role assignment create \
  --role "Cost Management Reader" \
  --assignee <user-upn-regulated tenant> \
  --scope /subscriptions/<sub-id-regulated tenant>
```

### Validación Bicep antes de desplegar

```bash
az bicep build --file infra/main.bicep         # compilación (0 errores)
az deployment group what-if \
  -g rg-regulated tenant-finops-pilot -f infra/main.bicep   # preview de cambios
```

---

## 10. Checklist de Aceptación e2e

> Validado el 2026-06-23 contra suscripción Azure real.

| # | Verificación | Comando / Evidencia |
|---|---|---|
| 1 | Motor MCP: 10 tools por stdio | `cd cost-mcp && npm run smoke` |
| 2 | Tests unitarios verdes | `dotnet test agent/tests/Dashboard.Tests -c Release` (77 verde) |
| 3 | Pregunta de costo → tool MCP | Traza App Insights: `McpServerName = azure-cost` |
| 4 | Moneda MXN | Billing nativo del regulated tenant |
| 5 | PUT/PATCH bloqueados | Agente devuelve script, traza muestra `blocked_readonly` |
| 6 | DELETE siempre bloqueado | Traza muestra `blocked_delete` |
| 7 | Auditoría íntegra | `AuditLog.Verify` sobre `AUDIT_LOG_PATH` → `true` |
| 8 | OpenAI sin acceso público | `curl https://<openai>.openai.azure.com` → timeout desde Internet |
| 9 | Key Vault sin acceso público | `az keyvault show` → `publicNetworkAccess: Disabled` |

---

## 11. Roadmap V2 (referencia)

| Ola | Componente | Repo base | Prioridad |
|---|---|---|---|
| **1** | Datos normalizados FOCUS / FinOps Hubs | `microsoft/finops-toolkit` | Alta |
| **1** | Masking PII fiscal (RFC, CURP) — **prerequisito regulated tenant** | `microsoft/presidio` | Alta |
| **1** | Evaluación continua + regresión en CI | `microsoft/promptflow` + Azure AI Evaluation SDK | Alta |
| **2** | Multi-agente + human-in-the-loop | `microsoft/agent-framework` | Media |
| **2** | Azure MCP Server oficial (43 servicios ARM) | `microsoft/mcp` | Media |
| **3** | RAG sobre normativa regulated tenant | `Azure-Samples/azure-search-openai-demo` | Media |
| **4** | GreenOps (huella de carbono) | `Green-Software-Foundation/carbon-aware-sdk` | Baja |

---

## 12. Referencias

| Doc | Contenido |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Plan del proyecto, workstreams, decisiones pendientes |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Integración agent ↔ cost-mcp, gotcha del allow-list |
| [docs/HARDENING.md](docs/HARDENING.md) | Read-only gate, auditoría inmutable |
| [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md) | OAuth delegado, migración to the regulated tenant |
| [docs/PILOT-RUNBOOK.md](docs/PILOT-RUNBOOK.md) | Runbook de validación e2e |
| [infra/README.md](infra/README.md) | Despliegue Bicep privado |
| [docs/V2-ROADMAP.md](docs/V2-ROADMAP.md) | Roadmap V2 y repos base Microsoft |
| [docs/ADR-0001-estructura-piloto.md](docs/ADR-0001-estructura-piloto.md) | ADR: monorepo + estructura |
| [docs/ADR-0002-seam-integracion-mcp.md](docs/ADR-0002-seam-integracion-mcp.md) | ADR: integración MCP-native |
