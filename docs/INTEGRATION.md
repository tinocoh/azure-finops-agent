# Integration guide

This repository integrates the .NET agent experience with the TypeScript cost MCP server.

## Components

- `agent/` hosts the user experience and orchestrates tool calls.
- `cost-mcp/` exposes Azure cost and pricing tools through MCP.
- `infra/` provisions shared Azure resources with Bicep and `azd`.

## Local flow

1. Build the MCP server:

   ```bash
   cd cost-mcp
   npm ci
   npm run build
   ```

2. Run the agent:

   ```bash
   cd agent/src/Dashboard
   dotnet run
   ```

3. Open the local URL printed by the agent.

## Deployment flow

Use the root `azure.yaml` and `infra/main.bicep`:

```bash
azd auth login
azd env new
azd up
```

The `agent` service deploys to App Service by default. In quota-limited validation environments,
set `DEPLOY_AGENT_SERVICE=false` to validate shared infrastructure only.
