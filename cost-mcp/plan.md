# Azure Cost MCP Server — Implementation Plan

## Context

Build a TypeScript MCP server (`azure-cost-mcp`) from scratch in the existing empty git repo at `/Users/martino/Work/github/azure-cost-mcp`. The server enables cost analysis for Azure projects via two APIs:

1. **Azure Retail Prices API** — public, no auth, for estimation and price comparison
2. **Azure Cost Management API** — requires Azure AD credentials, for actual subscription spend

Transport: **stdio** (local tool, runs as Claude Desktop subprocess).

---

## Project Structure

```
azure-cost-mcp/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── index.ts                          # Entry point — registers all tools, starts stdio
│   ├── constants.ts                      # API URLs, CHARACTER_LIMIT, defaults
│   ├── config/
│   │   └── env.ts                        # Env var loading & validation
│   ├── auth/
│   │   └── azure-auth.ts                 # MSAL token acquisition (client credentials + managed identity)
│   ├── clients/
│   │   ├── retail-prices.client.ts       # HTTP client for prices.azure.com
│   │   └── cost-management.client.ts     # HTTP client for management.azure.com
│   ├── tools/
│   │   ├── retail/
│   │   │   ├── search-prices.tool.ts
│   │   │   ├── compare-vm-prices.tool.ts
│   │   │   ├── find-cheapest-region.tool.ts
│   │   │   ├── compare-reservation.tool.ts
│   │   │   └── estimate-architecture.tool.ts
│   │   └── cost-management/
│   │       ├── query-costs.tool.ts
│   │       ├── query-costs-by-resource.tool.ts
│   │       ├── get-forecast.tool.ts
│   │       └── list-budgets.tool.ts
│   ├── schemas/
│   │   ├── retail-prices.schema.ts       # Zod types for Retail Prices API responses
│   │   └── cost-management.schema.ts     # Zod types for Cost Management API responses
│   └── utils/
│       ├── formatters.ts                 # toMarkdown() / toJSON() response formatters
│       ├── odata-builder.ts              # Type-safe OData $filter string builder
│       └── error-handler.ts             # handleApiError(), actionable error messages
└── dist/                                 # Built output (gitignored)
```

---

## Step 1 — Project Scaffolding

Create these config files:

**`package.json`**

```json
{
  "name": "azure-cost-mcp",
  "version": "0.1.0",
  "description": "MCP server for Azure cost analysis — retail prices and cost management",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "azure-cost-mcp": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "@azure/msal-node": "^2.16.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

**`tsconfig.json`** — strict mode, ES2022, Node16 module resolution, ESM output

**`.env.example`**

```bash
# Required for Cost Management tools
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_SUBSCRIPTION_ID=

# Optional
AZURE_USE_MANAGED_IDENTITY=false
AZURE_RETAIL_DEFAULT_CURRENCY=USD
```

**`.gitignore`** — node_modules, dist, .env

---

## Step 2 — Core Infrastructure

### `src/constants.ts`

- `RETAIL_API_BASE = "https://prices.azure.com/api/retail/prices"`
- `RETAIL_API_VERSION = "2023-01-01-preview"`
- `COST_MGMT_API_BASE = "https://management.azure.com"`
- `CHARACTER_LIMIT = 25000`

### `src/config/env.ts`

- Load and validate env vars on startup
- Expose typed config object; warn (not error) if Cost Management vars are missing (retail tools still work)

### `src/auth/azure-auth.ts`

- Uses `@azure/msal-node` `ConfidentialClientApplication`
- Scope: `https://management.azure.com/.default`
- Cached token via MSAL's in-memory cache (auto-refresh)
- Managed Identity path when `AZURE_USE_MANAGED_IDENTITY=true`
- Throws with clear setup instructions if credentials are missing

### `src/utils/odata-builder.ts`

- `buildFilter(clauses: FilterClause[]): string` — assembles `and`-chained OData filter string with proper string quoting
- Used by all 5 retail tools

### `src/utils/formatters.ts`

- `formatAsMarkdown(data, options): string` — renders tabular data as GFM table with summary line
- `formatAsJSON(data): string` — pretty-printed JSON
- `ResponseFormat` enum: `"markdown" | "json"`

### `src/utils/error-handler.ts`

- `handleApiError(error: unknown): string` — maps HTTP status codes to actionable messages
- `handleAuthError(error: unknown): string` — specific guidance for 401/403

### `src/clients/retail-prices.client.ts`

- `fetchPrices(filter: string, options): Promise<PriceItem[]>` — handles pagination via `NextPageLink`
- `fetchAllPages(filter: string): AsyncGenerator<PriceItem[]>` — yields all pages
- Retry: 3 attempts, exponential backoff, respects `Retry-After` header on 429

### `src/clients/cost-management.client.ts`

- `queryUsage(subscriptionId, body): Promise<QueryResult>` — POST to `/query`
- `getForecast(subscriptionId, body): Promise<ForecastResult>` — POST to `/forecast`
- `listBudgets(subscriptionId, resourceGroup?): Promise<Budget[]>` — GET
- Normalizes columnar response (columns[] + rows[][]) into typed object arrays
- Attaches Bearer token from auth module

---

## Step 3 — MCP Tools (9 total)

Each tool file exports `register(server: McpServer): void`. All use Zod `.strict()` schemas, annotations, and support `response_format: "markdown" | "json"`.

### Retail Prices Tools (no auth required)

| Tool                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azure_search_prices`               | Ad-hoc OData-filtered price search. Params: `serviceName`, `serviceFamily`, `armRegionName`, `skuName`, `armSkuName`, `priceType`, `currencyCode`, `limit`, `nextPageLink`                                                                                                                                                                                                                                                      |
| `azure_compare_vm_prices`           | Compare up to 10 SKUs × 5 regions side-by-side. Fires parallel requests per SKU, merges results into a comparison matrix. Returns monthly cost estimate (price × 730h) and highlights cheapest.                                                                                                                                                                                                                                 |
| `azure_find_cheapest_region`        | For a given `armSkuName`, fetches all regions and returns top-N ranked by price. Supports `geographyZone` filter.                                                                                                                                                                                                                                                                                                               |
| `azure_compare_reservation_vs_payg` | For a given SKU + region, returns a comparison table: PAYG / 1-Yr Reservation / 3-Yr Reservation / Savings Plan. Calculates break-even month and total savings.                                                                                                                                                                                                                                                                 |
| `azure_estimate_architecture_cost`  | Multi-component cost estimator. Accepts an array of `{component, armSkuName, armRegionName, quantity, usageHoursPerMonth, storageGB, priceType}`. Resolves prices in parallel with `Promise.all`. Returns per-line-item costs + total monthly/annual. Confidence scoring: HIGH (exact armSkuName match) / MEDIUM (fuzzy skuName) / LOW (no match). Optional `includeReservationAlternative` to show 1-year reservation savings. |

### Cost Management Tools (Azure credentials required)

| Tool                            | Description                                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `azure_query_costs`             | Query actual spend. Params: `timeframe`, `startDate/endDate`, `granularity`, `groupBy` (ResourceGroup/ServiceName/Location/Tag), `filterResourceGroups`, `filterServiceNames`, `filterTags`, `costType` (ActualCost/AmortizedCost) |
| `azure_query_costs_by_resource` | Top-N resources by cost within a subscription or resource group. Returns resource name, type, cost, % of total spend.                                                                                                              |
| `azure_get_cost_forecast`       | AI-generated forecast for current or future billing period. Returns daily/monthly forecasted costs.                                                                                                                                |
| `azure_list_budgets`            | Lists budgets with current spend, forecast, % utilized, alert thresholds, and status (OK/WARNING/CRITICAL).                                                                                                                        |

---

## Step 4 — Entry Point

**`src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { register as registerSearchPrices } from './tools/retail/search-prices.tool.js';
// ... all other imports

const server = new McpServer({ name: 'azure-cost-mcp', version: '0.1.0' });

// Register all tools
registerSearchPrices(server);
registerCompareVmPrices(server);
// ... etc.

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('azure-cost-mcp running via stdio');
```

---

## Step 5 — README

Include:

- What the server does and which tools are available
- Prerequisites (Node 20+, npm)
- Build instructions: `npm install && npm run build`
- Azure service principal setup (role: `Cost Management Reader`)
- Claude Desktop config snippet:
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

---

## Verification

1. `npm install` — no errors
2. `npm run build` — TypeScript compiles to `dist/` with no errors
3. `node dist/index.js` — server starts and accepts stdio connections
4. Test with MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`
5. Manually invoke `azure_search_prices` with `serviceName="Virtual Machines"` and `armRegionName="eastus"` — should return price list
6. Manually invoke `azure_compare_vm_prices` with `skuNames=["Standard_D4s_v5", "Standard_D2s_v5"]` and `regions=["eastus", "westeurope"]`
7. Manually invoke `azure_estimate_architecture_cost` with a 3-component architecture (VM + managed disk + storage account)
8. (If credentials configured) Invoke `azure_list_budgets` and `azure_query_costs` with `timeframe="MonthToDate"`
