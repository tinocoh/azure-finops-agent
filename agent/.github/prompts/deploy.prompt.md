---
agent: agent
description: "Deploy Azure FinOps Agent container to Azure App Service via ACR"
---

## Deploy to Azure (Docker Container)

1. Run `az account show` to confirm the active Azure subscription. Show the subscription name and ID.

2. Clean build artifacts to keep the Docker context small (~76 KB):

```powershell
cd src/Dashboard
Remove-Item -Recurse -Force bin, obj, publish, deploy.zip, wwwroot, client/node_modules -ErrorAction SilentlyContinue
```

3. Get the git short SHA and commit count for build metadata:

```powershell
$buildSha = git rev-parse --short HEAD
$buildNumber = git rev-list --count HEAD
```

4. Build and push the Docker image to ACR (cloud build — no local Docker needed). Use `--no-logs` to avoid the Azure CLI Unicode crash on Windows. Pass build args for version tracking:

```powershell
az acr build --registry crfinopsagent --image finops-agent:latest --platform linux/amd64 --no-logs --build-arg BUILD_SHA=$buildSha --build-arg BUILD_NUMBER=$buildNumber .
```

5. Restart the container app to pull the new image:

```powershell
az webapp restart --name finops-agent-container --resource-group rg-finops-agent
```

6. Wait ~30 seconds, then confirm the app is running:

```powershell
Invoke-RestMethod "https://finops-agent-container.azurewebsites.net/api/version"
```

7. Verify the custom domain:

```powershell
Invoke-RestMethod "https://azure-finops-agent.com/api/version"
```

### Rules

- **Never deploy automatically.** This prompt is a manual checklist for the repo owner only. Always confirm with the user before running `az acr build` or `az webapp restart` — deployment is the user's decision, not the agent's.
- **Always clean** `bin/`, `obj/`, `node_modules/` before building to keep context under 100 KB.
- **Always use `--no-logs`** — the Azure CLI on Windows crashes on vite's `✓` Unicode character without it.
- The ACR build output JSON includes `status: "Succeeded"` when the image is pushed successfully.

### Infrastructure

- **ACR**: `crfinopsagent.azurecr.io` (Basic SKU, admin enabled)
- **Container App**: `finops-agent-container` on `ASP-rgfinopsagent-b74f` (P0v3 Premium plan)
- **Custom Domain**: `https://www.azure-finops-agent.com` and `https://azure-finops-agent.com`
- **Container startup timeout**: `WEBSITES_CONTAINER_START_TIME_LIMIT=600`

### Notes

- Multi-stage Dockerfile: node:22 (frontend) → dotnet/sdk:10.0 (build) → dotnet/aspnet:10.0 (runtime + Python 3 + pip packages)
- All Python dependencies (pandas, numpy, openpyxl, pdfminer.six, pyarrow) are baked into the image.
- `appsettings.Local.json` is excluded via `.dockerignore` — it will NOT be in the container.
- Microsoft Entra ID OAuth callbacks: `https://azure-finops-agent.com/auth/microsoft/callback`, `https://finops-agent-container.azurewebsites.net/auth/microsoft/callback`
