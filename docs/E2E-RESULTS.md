# End-to-end validation results

## Summary

The repository was validated as an Azure Developer CLI (`azd`) template and as a multi-component
sample.

## Local validation

- Bicep build succeeds for `infra/main.bicep`.
- Bicep build succeeds for `infra/main.test.bicep`.
- Cost MCP builds, lints, and tests successfully.
- Agent .NET build and tests pass in CI.
- Agent web UI builds successfully in CI.
- Analyzer backend imports and tests pass.
- Analyzer frontend builds successfully.

## Real azd validation

Real `azd up` / `azd down` validation was executed against Azure subscription
`11803c68-c0dc-4892-882c-b330d9ae273a` with environment `finopsvalme`.

The validation subscription has zero App Service VM quota, so the run used:

```bash
azd env set DEPLOY_AGENT_SERVICE false
```

`azd up` provisioned:

- Resource group
- Key Vault
- Azure OpenAI account
- Azure OpenAI model deployment
- Virtual network
- Log Analytics workspace
- Application Insights

Cleanup was completed with:

```bash
azd down --force --purge
```

The validation resource group no longer exists.
