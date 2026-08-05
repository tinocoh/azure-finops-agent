# Infrastructure

This folder contains the Bicep modules used by the Azure Developer CLI (`azd`) deployment.

## What `main.bicep` creates

`main.bicep` is subscription-scoped, creates the resource group, and delegates the resource-group
deployment to `resources.bicep`.

The deployment creates:

- Azure OpenAI with local key authentication disabled.
- Azure Key Vault with RBAC authorization, soft delete, and purge protection.
- Azure App Service for the `agent` service declared in [`../azure.yaml`](../azure.yaml).
- A virtual network with an App Service integration subnet and a private endpoint subnet.
- Optional private endpoints for Azure OpenAI and Key Vault when `ENABLE_PRIVATE_NETWORKING=true`.
- Log Analytics and Application Insights for observability.
- Managed-identity role assignments for Azure OpenAI and Key Vault access.

All resources are tagged with `azd-env-name`. The App Service is also tagged with
`azd-service-name=agent` so `azd deploy` can map the service in `azure.yaml` to the Azure resource.

## Files

| File | Purpose |
| --- | --- |
| `main.bicep` | Subscription-scoped azd entry point |
| `resources.bicep` | Resource-group scoped resources |
| `main.parameters.json` | azd environment variable bindings |
| `main.test.bicep` | PSRule test instantiation |
| `abbreviations.json` | Azure resource naming prefixes |
| `bicepconfig.json` | Bicep analyzer configuration |
| `core/security/role.bicep` | Reusable RBAC role-assignment module |
| `modules/private-endpoint.bicep` | Private endpoint + private DNS module |

## Validate

```bash
az bicep build --file infra/main.bicep
az bicep build --file infra/main.test.bicep
```

The GitHub workflow `.github/workflows/azure-dev-validation.yaml` runs the same Bicep checks and
PSRule with the `Azure.Pillar.Security` baseline.

## Deploy

```bash
azd auth login
azd env new
azd up
```

Enable the strict private-networking posture before `azd up`:

```bash
azd env set ENABLE_PRIVATE_NETWORKING true
```

Keep the audit-safe default:

```bash
azd env set FINOPS_READONLY true
```

For quota-limited validation environments only, skip the App Service while still validating and
provisioning the shared infrastructure:

```bash
azd env set DEPLOY_AGENT_SERVICE false
```

Leave `DEPLOY_AGENT_SERVICE=true` for normal Azure-Samples deployments.
