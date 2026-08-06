# Pilot runbook

Use this runbook to validate the sample in an Azure subscription.

## Prerequisites

- Azure Developer CLI (`azd`)
- Azure CLI
- Azure subscription with Azure OpenAI access
- Required Azure RBAC permissions for deployment

## Deploy

```bash
azd auth login
azd env new
azd up
```

If the validation subscription has zero App Service quota, validate shared infrastructure only:

```bash
azd env set DEPLOY_AGENT_SERVICE false
azd up
```

## Validate

- Confirm the resource group was created.
- Confirm Key Vault was created.
- Confirm Azure OpenAI and model deployment were created.
- Confirm Log Analytics and Application Insights were created.
- If `DEPLOY_AGENT_SERVICE=true`, confirm the App Service URL loads.

## Clean up

```bash
azd down --force --purge
```

Confirm the resource group no longer exists.
