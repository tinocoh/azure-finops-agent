# azure-cost-mcp

![CI](https://github.com/MO2k4/azure-cost-mcp/actions/workflows/ci.yml/badge.svg)

An MCP server that gives Claude live access to Azure pricing and cost data — retail prices, VM comparisons, reservation analysis, architecture estimates, and actual subscription spend.

## What it does

Nine tools across two API groups:

| Tool                                | Description                                                              | Auth required |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------- |
| `azure_search_prices`               | Search Azure retail prices with OData filters                            | No            |
| `azure_compare_vm_prices`           | Compare VM SKUs across regions (monthly matrix)                          | No            |
| `azure_find_cheapest_region`        | Find cheapest regions for a given SKU                                    | No            |
| `azure_compare_reservation_vs_payg` | PAYG vs 1-yr / 3-yr reservation with break-even                          | No            |
| `azure_estimate_architecture_cost`  | Estimate multi-component architecture monthly cost                       | No            |
| `azure_query_costs`                 | Query actual subscription spend (group by service, resource group, etc.) | Yes           |
| `azure_query_costs_by_resource`     | Top-N resources by spend with % of total                                 | Yes           |
| `azure_get_cost_forecast`           | Cost forecast for a period                                               | Yes           |
| `azure_list_budgets`                | List budgets with CRITICAL / WARNING / OK status                         | Yes           |

## Prerequisites

- Node.js 20+
- npm

## Build

```bash
npm install
npm run build
```

## Azure setup (for authenticated tools)

Create a service principal and assign the **Cost Management Reader** role:

```bash
# Create service principal
az ad sp create-for-rbac --name azure-cost-mcp --role "Cost Management Reader" \
  --scopes /subscriptions/<SUBSCRIPTION_ID>

# Output includes appId (clientId), password (clientSecret), tenant (tenantId)
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "azure-cost": {
      "command": "node",
      "args": ["/absolute/path/to/azure-cost-mcp/dist/index.js"],
      "env": {
        "AZURE_TENANT_ID": "...",
        "AZURE_CLIENT_ID": "...",
        "AZURE_CLIENT_SECRET": "...",
        "AZURE_SUBSCRIPTION_ID": "..."
      }
    }
  }
}
```

The retail tools work without credentials. Cost Management tools will return setup instructions if credentials are missing.

## Environment variables

| Variable                        | Required       | Description                       |
| ------------------------------- | -------------- | --------------------------------- |
| `AZURE_TENANT_ID`               | For auth tools | Azure AD tenant ID                |
| `AZURE_CLIENT_ID`               | For auth tools | Service principal application ID  |
| `AZURE_CLIENT_SECRET`           | For auth tools | Service principal secret          |
| `AZURE_SUBSCRIPTION_ID`         | For auth tools | Subscription to query             |
| `AZURE_RETAIL_DEFAULT_CURRENCY` | No             | Default currency (default: `USD`) |

## Companion skill

A Claude Code skill at `~/.claude/skills/azure-cost.md` encodes tool routing rules, the reservation comparison rule, output conventions, and graceful degradation guidance. Install it by copying `skills/azure-cost.md` from this repository to `~/.claude/skills/`.

## Development

```bash
npm test            # run tests
npm run test:watch  # watch mode
npm run lint        # ESLint
npm run format      # Prettier
```
