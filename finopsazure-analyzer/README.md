# FinOpsAzure Analyzer

Aplicación full-stack para analizar **costos, inventario, recomendaciones y oportunidades de optimización** en una o varias suscripciones de Azure. Se ejecuta localmente con Docker Compose y se despliega en Azure con **Azure Container Apps**.

> Esta app vive en el subdirectorio `finopsazure-analyzer/` del monorepo `azure-finops-agent` para no interferir con los componentes existentes (`agent/`, `cost-mcp/`). Todos los comandos de esta guía se ejecutan desde `finopsazure-analyzer/`.

---

## 1. Descripción de la solución

FinOpsAzure Analyzer permite a un equipo FinOps:

- Registrar conexiones a Azure mediante un **service principal** (Tenant ID + Client ID + Client Secret + Subscription IDs).
- Ejecutar análisis por suscripción que recopilan **costos**, **inventario** y **recomendaciones de Advisor**.
- Generar un **resumen ejecutivo con IA** (Azure OpenAI / Azure AI Foundry) o, si no hay IA configurada, un resumen basado en reglas.
- Visualizar todo en un **dashboard** limpio con tarjetas, tablas filtrables y estados de carga/error.

La seguridad es central: los secretos **se cifran en reposo** (Fernet en local, Key Vault en Azure), **nunca** se devuelven por API, **nunca** se guardan en el frontend y **nunca** se imprimen en logs.

---

## 2. Arquitectura

- **Backend**: Python 3.12 · FastAPI · Uvicorn · SQLAlchemy · SQLite (local) / PostgreSQL-ready · Azure SDK + REST a Azure Management APIs · Pydantic.
- **Frontend**: React · TypeScript · Vite · Axios · Nginx (en contenedor).
- **Contenedores**: Dockerfile backend + Dockerfile frontend + docker-compose.
- **IaC**: Bicep (Container Apps, ACR, Key Vault, Log Analytics, App Insights, VNet, Azure OpenAI, User-Assigned Managed Identity).

### 3. Diagrama textual

```
┌────────────────────────────────────────────────────────────────────────┐
│                            Navegador (usuario)                          │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTP(S)
                ┌───────────────▼──────────────┐
                │  Frontend (React + Nginx)    │  :3000 local / Container App
                │  Dashboard · Config · Runs   │
                └───────────────┬──────────────┘
                                │ REST /api/*
                ┌───────────────▼──────────────┐
                │  Backend (FastAPI + Uvicorn) │  :8000 local / Container App
                │  ┌────────────────────────┐  │
                │  │ api/  services/  security/ │
                │  └────────────────────────┘  │
                │  Cifrado Fernet / Key Vault  │
                └───┬───────────┬───────────┬──┘
                    │           │           │
          ┌─────────▼──┐ ┌──────▼──────┐ ┌──▼───────────────┐
          │ Cost Mgmt  │ │ Resource    │ │ Advisor          │
          │ Query API  │ │ Graph API   │ │ Recommendations  │
          └────────────┘ └─────────────┘ └──────────────────┘
                    │
          ┌─────────▼───────────┐
          │ Azure OpenAI/Foundry│  → AI Summary (opcional)
          └─────────────────────┘

          SQLite (local, volumen)  /  PostgreSQL (via DATABASE_URL)
```

---

## 4. Requisitos

- **Docker** ≥ 24 y **Docker Compose** v2
- **Azure CLI** ≥ 2.60 (`az`)
- Una **suscripción de Azure** y permisos para crear recursos (para el despliegue)
- Un **service principal** con permisos de solo lectura (para el análisis) — ver §8

---

## 5. Cómo ejecutar en local

```bash
cd finopsazure-analyzer

# 1) Copiar variables de entorno de ejemplo
cp .env.example .env

# 2) Generar una clave Fernet para cifrar secretos en reposo
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copia el valor en FINOPS_CONFIG_ENCRYPTION_KEY dentro de .env

# 3) Construir imágenes locales
./scripts/build-local.sh

# 4) Levantar la app
./scripts/run-local.sh
```

> En Windows sin bash, usa `docker compose up --build` directamente.

## 6. Cómo abrir

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger (OpenAPI) | http://localhost:8000/docs |

---

## 7. Cómo configurar una conexión Azure

1. Abre el frontend → **Configuración Azure**.
2. Pulsa **Nueva conexión** y captura:
   - `connectionName` — nombre descriptivo.
   - `tenantId`, `clientId`, `clientSecret` del service principal.
   - `subscriptionIds` — una o varias (GUID).
   - `defaultCurrency` (opcional).
3. Guarda. El `clientSecret` se cifra en el backend y **no se vuelve a mostrar**.
4. Pulsa **Validar** para verificar credenciales y acceso por suscripción.
5. Para cambiar el secreto, usa **Rotar secreto** (único momento en que se vuelve a pedir).

---

## 8. Permisos mínimos del service principal

El service principal que **analiza** suscripciones debe tener **mínimos privilegios**:

| Rol | Scope | Para qué |
|---|---|---|
| **Cost Management Reader** | Suscripción | Consultar costos (Cost Management Query API) |
| **Reader** | Suscripción | Inventario (Resource Graph) y Advisor |

> No asignes **Owner** ni **Contributor** al service principal de análisis. Advisor y Resource Graph funcionan con `Reader`. Si Advisor no tiene permisos, el análisis continúa y marca esa sección como no disponible (no rompe el flujo).

```bash
# Ejemplo de asignación de roles de solo lectura (ajusta <sp-app-id> y <sub-id>)
az role assignment create --assignee <sp-app-id> --role "Reader" \
  --scope /subscriptions/<sub-id>
az role assignment create --assignee <sp-app-id> --role "Cost Management Reader" \
  --scope /subscriptions/<sub-id>
```

---

## 9. Cómo desplegar infraestructura en Azure

```bash
cd finopsazure-analyzer

# 1) Bootstrap: crea el Resource Group FinOpsAzure y registra providers
./scripts/bootstrap-azure.sh -l eastus2 -s <deployment-subscription-id>

# 2) Desplegar infraestructura (Bicep)
./scripts/deploy-infra.sh

# 3) Construir y publicar imágenes en ACR
./scripts/build-and-push-acr.sh

# 4) Actualizar las Container Apps con las imágenes nuevas
./scripts/deploy-container-apps.sh
```

Edita `infra/main.parameters.json` para ajustar región, nombre de ACR, modelo de IA, etc.

---

## 10. Cómo validar el despliegue

- `deploy-infra.sh` imprime los outputs: **ACR login server**, **backend app name**, **frontend app name**, **Azure OpenAI endpoint**, **Key Vault URI**.
- Abre la URL pública del frontend Container App.
- Prueba el backend: `GET https://<backend-fqdn>/api/health`.
- Ejecuta `./scripts/smoke-test-local.sh` en local antes de desplegar.

---

## 11. Consideraciones de seguridad

- El `clientSecret` **se cifra** con Fernet (`FINOPS_CONFIG_ENCRYPTION_KEY`) antes de guardarse en la base.
- La API **nunca** devuelve el `clientSecret`; solo un indicador `secretSet: true` y una pista enmascarada.
- El frontend **no** persiste el secreto en `localStorage`, `sessionStorage` ni cookies. Solo lo envía una vez al backend.
- Los logs **nunca** imprimen secretos ni tokens.
- Antes de llamar al modelo de IA, los datos se **sanitizan** (IDs de suscripción/recurso enmascarados). Nunca se envían secretos ni tokens al modelo.
- En Azure, los secretos se referencian vía **Key Vault** y **Managed Identity** (sin secretos hardcodeados en Bicep).
- `.env` está en `.gitignore`. Usa `.env.example` (sin valores reales).

---

## 12. Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `authorization_failed` | El SP no tiene rol en la suscripción | Asigna `Reader` + `Cost Management Reader` |
| `invalid_client` | Client ID/Secret incorrecto o secreto expirado | Rota el secreto en el SP y en la conexión |
| Modelo IA no disponible en región | El deployment no existe en esa región | Cambia `modelName`/`location` en `main.parameters.json` y re-despliega |
| Errores CORS | Origen del frontend no permitido | Ajusta `CORS_ALLOWED_ORIGINS` en el backend |
| Frontend no ve el backend | Ingress interno/externo mal configurado | Revisa `VITE_API_BASE_URL` y el ingress del backend Container App |
| `429 Too Many Requests` | Throttling de Azure APIs | El backend reintenta con backoff exponencial; reduce el rango de fechas |

---

## 13. Limpieza de recursos

```bash
az group delete --name FinOpsAzure --yes --no-wait
```

---

## Mejoras futuras

- Ejecución de análisis en background (cola/worker) en vez de síncrona.
- Persistencia PostgreSQL gestionada (Azure Database for PostgreSQL).
- Exportación de resultados a Excel/PDF.
- Autenticación de usuarios de la propia app (Entra ID).
- Cacheo de resultados de Cost Management por rango de fechas.
