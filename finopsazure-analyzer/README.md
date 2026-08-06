# FinOpsAzure Analyzer

Full-stack application for analyzing **costs, inventory, recommendations, and optimization opportunities** across one or more Azure subscriptions. It runs locally with Docker Compose and deploys to Azure with **Azure Container Apps**.

> This app lives in the `finopsazure-analyzer/` subdirectory of the `azure-finops-agent` monorepo so it can coexist with the existing `agent/` and `cost-mcp/` components. All commands in this guide run from `finopsazure-analyzer/`.

---

## 1. Solution description

FinOpsAzure Analyzer enables a FinOps team to:

- Register Azure connections through a **service principal** (Tenant ID + Client ID + Client Secret + Subscription IDs).
- Run subscription-level analyses that collect **costs**, **inventory**, and **Advisor recommendations**.
- Generate an **AI executive summary** (Azure OpenAI / Azure AI Foundry) or, when AI is not configured, a rules-based summary.
- Visualize everything in a clean **dashboard** with cards, filterable tables, and loading/error states.

Security is central: secrets are **encrypted at rest** (Fernet locally, Key Vault in Azure), are **never** returned by the API, are **never** stored in the frontend, and are **never** printed in logs.

---

## 2. Architecture

- **Backend**: Python 3.12 · FastAPI · Uvicorn · SQLAlchemy · SQLite (local) / PostgreSQL-ready · Azure SDK + REST calls to Azure Management APIs · Pydantic.
- **Frontend**: React · TypeScript · Vite · Axios · Nginx (containerized).
- **Containers**: backend Dockerfile + frontend Dockerfile + docker-compose.
- **IaC**: Bicep (Container Apps, ACR, Key Vault, Log Analytics, App Insights, VNet, Azure OpenAI, User-Assigned Managed Identity).

### 3. Text diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Browser (user)                              │
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
          │ Azure OpenAI/Foundry│  → AI Summary (optional)
          └─────────────────────┘

          SQLite (local, volumen)  /  PostgreSQL (via DATABASE_URL)
```

---

## 4. Requirements

- **Docker** >= 24 and **Docker Compose** v2
- **Azure CLI** ≥ 2.60 (`az`)
- An **Azure subscription** and permissions to create resources (for deployment)
- A **service principal** with read-only permissions (for analysis) — see section 8

---

## 5. Run locally

```bash
cd finopsazure-analyzer

# 1) Copy sample environment variables
cp .env.example .env

# 2) Generate a Fernet key to encrypt secrets at rest
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copy the value into FINOPS_CONFIG_ENCRYPTION_KEY in .env

# 3) Build local images
./scripts/build-local.sh

# 4) Start the app
./scripts/run-local.sh
```

> On Windows without bash, run `docker compose up --build` directly.

## 6. Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger (OpenAPI) | http://localhost:8000/docs |

---

## 7. Configure an Azure connection

1. Open the frontend → **Azure configuration**.
2. Select **New connection** and enter:
   - `connectionName` — descriptive name.
   - `tenantId`, `clientId`, and `clientSecret` for the service principal.
   - `subscriptionIds` — one or more subscription GUIDs.
   - `defaultCurrency` (optional).
3. Save. The `clientSecret` is encrypted in the backend and **is not displayed again**.
4. Select **Validate** to verify credentials and subscription access.
5. To change the secret, rotate it by editing the connection and entering a new value.

---

## 8. Minimum service principal permissions

The service principal that **analyzes** subscriptions should use **least privilege**:

| Role | Scope | Purpose |
|---|---|---|
| **Cost Management Reader** | Subscription | Query costs through the Cost Management Query API |
| **Reader** | Subscription | Inventory through Resource Graph and Advisor |

> Do not assign **Owner** or **Contributor** to the analysis service principal. Advisor and Resource Graph work with `Reader`. If Advisor is not available, the analysis continues and marks that section unavailable instead of breaking the flow.

```bash
# Read-only role assignment example. Replace <sp-app-id> and <sub-id>.
az role assignment create --assignee <sp-app-id> --role "Reader" \
  --scope /subscriptions/<sub-id>
az role assignment create --assignee <sp-app-id> --role "Cost Management Reader" \
  --scope /subscriptions/<sub-id>
```

---

## 9. Deploy infrastructure on Azure

```bash
cd finopsazure-analyzer

# 1) Bootstrap: create the FinOpsAzure resource group and register providers
./scripts/bootstrap-azure.sh -l eastus2 -s <deployment-subscription-id>

# 2) Deploy infrastructure (Bicep)
./scripts/deploy-infra.sh

# 3) Build and push images to ACR
./scripts/build-and-push-acr.sh

# 4) Update Container Apps with the new images
./scripts/deploy-container-apps.sh
```

Edit `infra/main.parameters.json` to adjust region, ACR name, AI model, and related settings.

---

## 10. Validate the deployment

- `deploy-infra.sh` prints outputs such as **ACR login server**, **backend app name**, **frontend app name**, **Azure OpenAI endpoint**, and **Key Vault URI**.
- Open the public frontend Container App URL.
- Test the backend with `GET https://<backend-fqdn>/api/health`.
- Run `./scripts/smoke-test-local.sh` locally before deploying.

---

## 11. Security considerations

- The `clientSecret` is **encrypted** with Fernet (`FINOPS_CONFIG_ENCRYPTION_KEY`) before it is stored.
- The API **never** returns the `clientSecret`; it only returns `secretSet: true` and a masked hint.
- The frontend does **not** persist the secret in `localStorage`, `sessionStorage`, or cookies. It sends it once to the backend.
- Logs **never** print secrets or tokens.
- Before calling the AI model, data is **sanitized** with subscription/resource identifiers masked. Secrets and tokens are never sent to the model.
- In Azure, secrets are referenced through **Key Vault** and **Managed Identity** without hardcoded secrets in Bicep.
- `.env` is in `.gitignore`. Use `.env.example` without real values.

---

## 12. Troubleshooting

| Problem | Likely cause | Solution |
|---|---|---|
| `authorization_failed` | The service principal does not have a role on the subscription | Assign `Reader` + `Cost Management Reader` |
| `invalid_client` | Incorrect Client ID/Secret or expired secret | Rotate the secret in the app registration and connection |
| AI model unavailable in region | The deployment does not exist in that region | Change `modelName`/`location` in `main.parameters.json` and redeploy |
| CORS errors | Frontend origin is not allowed | Adjust `CORS_ALLOWED_ORIGINS` in the backend |
| Frontend cannot reach backend | Internal/external ingress is misconfigured | Review `VITE_API_BASE_URL` and backend Container App ingress |
| `429 Too Many Requests` | Azure API throttling | Backend retries with exponential backoff; reduce the date range |

---

## 13. Clean up resources

```bash
az group delete --name FinOpsAzure --yes --no-wait
```

---

## Future improvements

- Run analyses in the background with a queue/worker instead of synchronously.
- Managed PostgreSQL persistence with Azure Database for PostgreSQL.
- Export results to Excel/PDF.
- Add first-party user authentication for the app with Entra ID.
- Cache Cost Management results by date range.
