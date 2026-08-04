# Resumen de Producción — FinOps AI Agent for a regulated public-sector tenant

> Versión: 2026-07-02 | Repositorio: `Azure-Samples/azure-finops-agent`

Este documento cubre los tres pilares que necesita el equipo para llevar el servicio a producción en Azure:

1. **Prerrequisitos de producción** — qué debe existir antes del primer despliegue.
2. **Bóveda de secretos (Azure Key Vault)** — cómo centralizar claves, tokens, URLs y secrets para que ningún componente tenga credenciales hardcodeadas.
3. **Niveles de acceso y suscripciones** — quién puede ver qué dentro del sistema.

---

## Parte 1 — Prerrequisitos de Producción en Azure

### 1.1 Herramientas en la máquina de despliegue

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| **Azure CLI** | ≥ 2.65 | `az --version` |
| **.NET SDK** | 10.0.x | `dotnet --version` |
| **Node.js** | ≥ 20 LTS | `node --version` |
| **npm** | ≥ 10 | `npm --version` |
| **Docker Desktop** | ≥ 4.30 (BuildKit activado) | `docker buildx version` |
| **Git** | ≥ 2.40 | `git --version` |

```powershell
# Verificación rápida de todo
az --version; dotnet --version; node --version; npm --version; docker buildx version
```

### 1.2 Acceso Azure requerido para quien despliega

| Permiso | Scope | Para qué |
|---|---|---|
| **Contributor** | Resource Group `rg-regulated tenant-finops-pilot` | Crear y modificar todos los recursos |
| **User Access Administrator** | Resource Group | Asignar roles RBAC (necesario para los `roleAssignments` del Bicep) |
| **Application Administrator** (Entra) | regulated tenant | Registrar la App Entra y crear federated credentials |

> Si no se tiene User Access Administrator, solicitar al equipo de IAM que ejecute el paso de role assignments del Bicep por separado.

### 1.3 Recursos Azure que deben existir antes del despliegue

```
Suscripción Azure of the regulated tenant
└── Resource Group: rg-regulated tenant-finops-pilot (Contributor)
    ├── [se crea con Bicep] Azure OpenAI
    ├── [se crea con Bicep] Azure Key Vault          ← bóveda central de secretos
    ├── [se crea con Bicep] Azure Virtual Network
    ├── [se crea con Bicep] App Service Plan (P1v3)
    ├── [se crea con Bicep] App Service (contenedor)
    ├── [se crea con Bicep] Log Analytics Workspace
    └── [se crea con Bicep] Application Insights
```

El comando `az deployment group create -f infra/main.bicep` crea **todos** los recursos anteriores en un solo paso.

### 1.4 Registro de App en Microsoft Entra ID (regulated tenant)

Este paso se hace **una sola vez** en el tenant of the regulated tenant, antes o después del Bicep, pero antes del primer uso:

```bash
# 1. Crear el App Registration single-tenant
az ad app create \
  --display-name "FinOps Agent regulated tenant" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://<hostname-del-app-service>/auth/microsoft/callback"

# 2. Agregar permisos delegados de solo lectura
# ARM user_impersonation (Azure Service Management)
az ad app permission add --id <app-id> \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope

# Microsoft Graph User.Read
az ad app permission add --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# 3. Admin-consent (requiere Global Admin o Application Admin)
az ad app permission admin-consent --id <app-id>
```

### 1.5 Federated Credential (sin secrets en producción)

Después de desplegar el Bicep (que crea la Managed Identity del App Service), registrar el vínculo:

```bash
# Obtener el principal ID de la Managed Identity creada por el Bicep
$principalId = az webapp identity show \
  --name <site-name> --resource-group rg-regulated tenant-finops-pilot \
  --query principalId -o tsv

# Obtener el issuer y subject de la MI para la federated credential
$miInfo = az identity show \
  --ids $(az webapp show -n <site-name> -g rg-regulated tenant-finops-pilot --query id -o tsv) 2>/dev/null

# Crear federated credential en el App Registration
az ad app federated-credential create \
  --id <app-id> \
  --parameters '{
    "name": "regulated tenant-appservice-mi",
    "issuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
    "subject": "<object-id-de-la-MI>",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

> Resultado: `Microsoft__ClientSecret` queda **vacío** en el App Service. La identidad administrada actúa como credencial del app sin almacenar ningún secret.

### 1.6 Quota de Azure OpenAI

Verificar disponibilidad de modelo antes de desplegar:

```bash
# Verificar quota disponible en la región objetivo
az cognitiveservices usage list \
  --location eastus2 \
  --query "[?contains(name.value, 'gpt')]" -o table
```

Solicitar quota de modelo `gpt-4o` (o `gpt-5.4`) mínimo **50K TPM GlobalStandard** en la región elegida si no está disponible.

---

## Parte 2 — Bóveda de Secretos: Azure Key Vault

### 2.1 Por qué Key Vault es el centro de la solución

Ningún componente de la aplicación tiene credenciales, tokens, URLs ni API keys escritas en código, variables de entorno manuales ni archivos de configuración del repositorio. **Todo fluye desde Key Vault** a través de la Managed Identity del App Service.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Azure Key Vault (acceso público: DESHABILITADO)     │
│                     Solo accesible vía Private Endpoint en la VNet      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SECRETS  (valores sensibles sin expiración)                    │   │
│  │  Microsoft--ClientId          → GUID del App Entra              │   │
│  │  Microsoft--TenantId          → GUID del regulated tenant             │   │
│  │  Microsoft--HomeTenantId      → GUID del regulated tenant             │   │
│  │  AzureOpenAI--Endpoint        → URL del recurso OpenAI          │   │
│  │  AzureOpenAI--DeploymentName  → nombre del deployment gpt-5.4   │   │
│  │  AppInsights--ConnString      → connection string de App Insights│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  NOTA: Microsoft--ClientSecret   → VACÍO en producción (federated MI)  │
│  NOTA: AZURE_ACCESS_TOKEN        → generado en tiempo de ejecución      │
│                                    (token delegado del usuario)          │
└─────────────────────────────────────────────────────────────────────────┘
            ▲
            │  RBAC: Key Vault Secrets User
            │  (asignado automáticamente por el Bicep a la MI del App Service)
            │
┌───────────┴──────────────────────────┐
│  App Service — Managed Identity      │
│  (SystemAssigned, sin contraseñas)   │
└──────────────────────────────────────┘
```

### 2.2 Qué se almacena en Key Vault y por qué

| Secret en Key Vault | Tipo | Contiene | Quién lo usa |
|---|---|---|---|
| `Microsoft--ClientId` | Secret | GUID del App Registration Entra | Agente .NET (OAuth delegado) |
| `Microsoft--TenantId` | Secret | GUID del regulated tenant | Agente .NET (OAuth delegado) |
| `Microsoft--HomeTenantId` | Secret | GUID del regulated tenant | Agente .NET (validación de tokens) |
| `AzureOpenAI--Endpoint` | Secret | `https://<nombre>.openai.azure.com/` | Agente .NET (llamadas LLM) |
| `AzureOpenAI--DeploymentName` | Secret | `gpt-5.4` (o el deployment activo) | Agente .NET |
| `AppInsights--ConnString` | Secret | Connection string de Application Insights | Agente .NET (OTel) |

> Los dobles guiones (`--`) son la convención de .NET para separadores de jerarquía de configuración cuando se usan como nombres de secrets en Key Vault (equivalen a `Microsoft:ClientId` en `appsettings.json`).

### 2.3 Qué NO se almacena (fluye por otros mecanismos)

| Valor | Mecanismo real | Por qué no va en Key Vault |
|---|---|---|
| `Microsoft--ClientSecret` | **Vacío** — federated Managed Identity | La MI es la credencial; no existe secret |
| `AZURE_ACCESS_TOKEN` | Generado en runtime por el flujo OAuth del usuario | Tiene vida de ~1h, va en sesión de usuario, no en bóveda |
| `AZURE_SUBSCRIPTION_ID` | App Setting no sensible en el App Service | Es un GUID público de la suscripción, no es secreto |
| `FINOPS_READONLY` | App Setting no sensible | Es un flag de comportamiento (`true/false`) |
| `AUDIT_LOG_PATH` | App Setting no sensible | Es una ruta de archivo en el contenedor |

### 2.4 Cómo cargar los secrets en Key Vault después del despliegue

```bash
# Variables
KV_NAME=$(az keyvault list -g rg-regulated tenant-finops-pilot --query "[0].name" -o tsv)
APP_ID="<guid-del-app-entra>"
TENANT_ID="<guid-del-tenant-regulated tenant>"
AOAI_NAME=$(az cognitiveservices account list -g rg-regulated tenant-finops-pilot --query "[0].name" -o tsv)
AI_CS=$(az monitor app-insights component show -g rg-regulated tenant-finops-pilot --query "[0].connectionString" -o tsv 2>/dev/null || \
        az resource list -g rg-regulated tenant-finops-pilot --resource-type "Microsoft.Insights/components" --query "[0].properties.ConnectionString" -o tsv)

# Cargar secrets (ningún valor va al repo ni a variables de entorno del desarrollador)
az keyvault secret set --vault-name $KV_NAME --name "Microsoft--ClientId"         --value "$APP_ID"
az keyvault secret set --vault-name $KV_NAME --name "Microsoft--TenantId"         --value "$TENANT_ID"
az keyvault secret set --vault-name $KV_NAME --name "Microsoft--HomeTenantId"     --value "$TENANT_ID"
az keyvault secret set --vault-name $KV_NAME --name "AzureOpenAI--Endpoint"       --value "https://${AOAI_NAME}.openai.azure.com/"
az keyvault secret set --vault-name $KV_NAME --name "AzureOpenAI--DeploymentName" --value "gpt-5.4"
az keyvault secret set --vault-name $KV_NAME --name "AppInsights--ConnString"     --value "$AI_CS"

echo "Secrets cargados en: $KV_NAME"
```

### 2.5 Cómo el App Service lee Key Vault sin código adicional

.NET lee Key Vault automáticamente si se configura el proveedor en `Program.cs`. El Bicep ya asigna `Key Vault Secrets User` a la Managed Identity. La integración queda así:

```
Key Vault (Private Endpoint)
    ▲
    │  Key Vault Secrets User (RBAC — asignado por Bicep)
    │
App Service Managed Identity
    │
    ▼  .NET Configuration Provider lee /secrets como variables de configuración
App  →  Microsoft:ClientId, AzureOpenAI:Endpoint, etc.
        (mismas claves que en appsettings.json, sin ningún valor hardcodeado)
```

> Para habilitar Key Vault como proveedor de configuración en `Program.cs`, agregar el paquete `Azure.Extensions.AspNetCore.Configuration.Secrets` y la línea `builder.Configuration.AddAzureKeyVault(new Uri(kvUri), new DefaultAzureCredential())` antes de leer la configuración.

### 2.6 Política de acceso a Key Vault por identidad

| Identidad | Rol en Key Vault | Qué puede hacer |
|---|---|---|
| **Managed Identity del App Service** | `Key Vault Secrets User` | Leer secrets (GET, LIST de nombres) — asignado por Bicep |
| **Equipo DevOps** (al desplegar) | `Key Vault Secrets Officer` | Crear, actualizar, eliminar secrets — temporal, para carga inicial |
| **regulated audit team** | `Key Vault Reader` | Ver metadatos (nombres, versiones) pero NO el valor de los secrets |
| **Ningún usuario de negocio** | Sin acceso | Key Vault solo accesible desde la VNet (Private Endpoint) |

```bash
# Asignar acceso temporal al equipo DevOps para cargar secrets (revocar después)
az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee <upn-devops> \
  --scope $(az keyvault show -n $KV_NAME -g rg-regulated tenant-finops-pilot --query id -o tsv)

# Verificar que la MI tiene su rol
az role assignment list \
  --scope $(az keyvault show -n $KV_NAME -g rg-regulated tenant-finops-pilot --query id -o tsv) \
  --query "[].{Principal:principalName, Role:roleDefinitionName}" -o table
```

---

## Parte 3 — Niveles de Acceso y Suscripciones

La información que reporta el agente proviene de varias fuentes de Azure. Cada nivel de usuario necesita permisos distintos para que el agente pueda consultar sus datos.

### 3.1 Mapa de fuentes de datos y permisos mínimos

| Fuente de datos | Qué devuelve el agente | Rol RBAC requerido en suscripción |
|---|---|---|
| **Azure Cost Management** | Gasto real por servicio, recurso, suscripción; MoM, MoD, YTD | `Cost Management Reader` |
| **Azure Resource Graph** | Inventario de recursos, tags, ubicaciones, tipos | `Reader` |
| **Azure Advisor** | Recomendaciones de ahorro, right-sizing, alta disponibilidad | `Reader` |
| **Azure Budgets** | Presupuestos y alertas configurados | `Cost Management Reader` |
| **Azure Monitor / Log Analytics** | Logs de recursos, métricas de VMs/Kubernetes/App Service | `Log Analytics Reader` (workspace) |
| **Microsoft Graph** | Perfil del usuario firmado (nombre, email) | `User.Read` (delegado, consentimiento individual) |
| **prices.azure.com** | Precios retail públicos | ❌ Sin permisos (API pública) |

### 3.2 Niveles de usuario y acceso recomendado

#### Nivel 1 — Analista FinOps (acceso completo de lectura)

Puede hacer preguntas sobre gasto, forecast, recursos, budgets, recomendaciones y logs.

```bash
# Asignar en la suscripción piloto of the regulated tenant
az role assignment create --role "Reader" \
  --assignee <upn-analista> --scope /subscriptions/<sub-id>

az role assignment create --role "Cost Management Reader" \
  --assignee <upn-analista> --scope /subscriptions/<sub-id>

az role assignment create --role "Log Analytics Reader" \
  --assignee <upn-analista> \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.OperationalInsights/workspaces/<workspace>
```

**Capacidades en el agente:**

- ✅ `¿Cuánto gasté este mes por servicio?` → `azure_query_costs`
- ✅ `¿Cuál es mi forecast del próximo mes?` → `azure_get_cost_forecast`
- ✅ `¿Qué recursos tengo ociosos?` → `azure_get_advisor_recommendations` + Resource Graph
- ✅ `¿Cuáles son mis budgets?` → `azure_list_budgets`
- ✅ Precios retail comparativos (sin auth requerida)
- ✅ Consultas KQL sobre logs de recursos
- ✅ Score de madurez FinOps completo

#### Nivel 2 — Administrador de Área (lectura de costos, sin logs)

Puede ver costos y recursos pero no logs detallados de operaciones.

```bash
az role assignment create --role "Reader" \
  --assignee <upn-admin-area> --scope /subscriptions/<sub-id>

az role assignment create --role "Cost Management Reader" \
  --assignee <upn-admin-area> --scope /subscriptions/<sub-id>
```

**Capacidades en el agente:**

- ✅ Gasto, forecast, budgets, inventario de recursos, Advisor
- ✅ Precios retail y comparativas
- ✅ Score de madurez FinOps
- ❌ Consultas KQL (sin `Log Analytics Reader`)

#### Nivel 3 — Observador / Ejecutivo (solo costos agregados)

Solo puede ver resúmenes de gasto. Sin acceso a recursos individuales ni logs.

```bash
az role assignment create --role "Cost Management Reader" \
  --assignee <upn-ejecutivo> --scope /subscriptions/<sub-id>
```

**Capacidades en el agente:**

- ✅ Gasto total, forecast, budgets
- ✅ `azure_query_costs` (agrupado por servicio o suscripción)
- ✅ Precios retail
- ❌ Inventario de recursos (sin `Reader`)
- ❌ Recomendaciones Advisor (sin `Reader`)
- ❌ Consultas KQL

#### Nivel 4 — Sin permisos de suscripción (modo público)

Usuario autenticado en Entra pero sin roles en la suscripción.

**Capacidades en el agente:**

- ✅ Preguntas sobre precios retail de Azure (sin datos del tenant)
- ✅ Estimaciones de arquitectura
- ✅ Comparativas de VMs, reservaciones vs. PAYG
- ❌ Cualquier dato real del tenant (Cost Management devuelve 403)
- El agente muestra: `[CONTEXT: User IS connected to Azure but has no cost data access]`

### 3.3 Acceso multi-suscripción

Si el regulated tenant tiene múltiples suscripciones, los roles se asignan en cada suscripción o a nivel de Management Group:

```bash
# Asignar a nivel de Management Group (cubre todas las suscripciones bajo él)
az role assignment create --role "Cost Management Reader" \
  --assignee <upn> \
  --scope /providers/Microsoft.Management/managementGroups/<mg-id>

az role assignment create --role "Reader" \
  --assignee <upn> \
  --scope /providers/Microsoft.Management/managementGroups/<mg-id>
```

El agente automáticamente consulta la suscripción definida en `AZURE_SUBSCRIPTION_ID` y puede ampliar el scope si el usuario tiene acceso a nivel Management Group.

### 3.4 Resumen de capacidades por nivel

| Capacidad del agente | Analista FinOps | Admin de Área | Ejecutivo | Sin permisos |
|---|:---:|:---:|:---:|:---:|
| Gasto real por servicio / recurso | ✅ | ✅ | ✅ | ❌ |
| Forecast de gasto | ✅ | ✅ | ✅ | ❌ |
| Budgets y alertas | ✅ | ✅ | ✅ | ❌ |
| Inventario de recursos (Resource Graph) | ✅ | ✅ | ❌ | ❌ |
| Recomendaciones Advisor | ✅ | ✅ | ❌ | ❌ |
| Logs de recursos (KQL) | ✅ | ❌ | ❌ | ❌ |
| Precios retail públicos | ✅ | ✅ | ✅ | ✅ |
| Score de madurez FinOps | ✅ | ✅ | ❌ | ❌ |
| Generar scripts de acción | ✅ | ✅ | ❌ | ❌ |

> **Nota de seguridad:** El agente opera en modo **read-only por defecto** para todos los niveles. Ningún usuario puede mutar el tenant a través del agente — las acciones de escritura siempre se generan como scripts que el usuario ejecuta manualmente tras revisarlos.

---

## Checklist Final de Producción

### Antes del despliegue

- [ ] Verificar herramientas instaladas (az, dotnet, node, docker)
- [ ] Confirmar acceso Contributor + User Access Admin en el Resource Group
- [ ] Confirmar acceso Application Administrator en el regulated tenant
- [ ] Verificar quota de Azure OpenAI disponible en la región (≥50K TPM)
- [ ] Crear el App Registration Entra (single-tenant, permisos delegados read-only)

### Despliegue

- [ ] `az deployment group create -f infra/main.bicep` → sin errores
- [ ] Crear federated credential en el App Registration apuntando a la MI del App Service
- [ ] Cargar los 6 secrets en Key Vault (`Microsoft--ClientId`, `TenantId`, `HomeTenantId`, `AzureOpenAI--Endpoint`, `AzureOpenAI--DeploymentName`, `AppInsights--ConnString`)
- [ ] Build y push de imagen Docker a ACR
- [ ] Actualizar App Service con la imagen nueva

### Tras el despliegue

- [ ] Verificar que Key Vault no es accesible desde Internet (solo Private Endpoint)
- [ ] Verificar que Azure OpenAI no es accesible desde Internet (solo Private Endpoint)
- [ ] Asignar roles `Reader` + `Cost Management Reader` a los usuarios del piloto
- [ ] Ejecutar checklist e2e del [PILOT-RUNBOOK.md](docs/PILOT-RUNBOOK.md)
- [ ] Revocar el acceso temporal `Key Vault Secrets Officer` del equipo DevOps

---

## Referencias

| Documento | Contenido |
|---|---|
| [NotasTecnicas.md](NotasTecnicas.md) | Reporte técnico completo: arquitectura, componentes, tools |
| [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md) | Detalle del flujo OAuth delegado y federated credential |
| [docs/HARDENING.md](docs/HARDENING.md) | Read-only gate y auditoría inmutable |
| [docs/PILOT-RUNBOOK.md](docs/PILOT-RUNBOOK.md) | Checklist de validación e2e |
| [infra/README.md](infra/README.md) | Parámetros del Bicep y notas de despliegue |
| [infra/main.bicep](infra/main.bicep) | IaC completo: VNet, OpenAI, Key Vault, App Service, RBAC |
