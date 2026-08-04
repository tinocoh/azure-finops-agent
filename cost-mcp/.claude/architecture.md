# Architecture & Tool Patterns

## Overview

Two artifacts, distinct responsibilities:

| Artifact                                           | Purpose                                              |
| -------------------------------------------------- | ---------------------------------------------------- |
| MCP server (`src/`)                                | Live API calls — retail prices + cost management     |
| Companion skill (`~/.claude/skills/azure-cost.md`) | Reasoning patterns, tool routing, output conventions |

## Source Layout

```
src/
  constants.ts                         # API base URLs, version strings
  index.ts                             # Entry point — wires all tools
  config/
    env.ts                             # Reads env vars, returns Config
  auth/
    azure-auth.ts                      # MSAL token acquisition
  schemas/
    retail-prices.schema.ts            # Zod schema for Retail Prices API
    cost-management.schema.ts          # Zod schema + normalizeQueryResult()
  clients/
    retail-prices.client.ts            # fetchPrices() with retry
    cost-management.client.ts          # queryUsage(), getForecast(), listBudgets()
  utils/
    odata-builder.ts                   # buildFilter(clauses[]) → OData string
    formatters.ts                      # formatAsMarkdown(), formatAsJSON()
    error-handler.ts                   # handleApiError(), handleAuthError()
  tools/
    retail/                            # No auth required (public API)
      search-prices.tool.ts
      compare-vm-prices.tool.ts
      find-cheapest-region.tool.ts
      compare-reservation.tool.ts
      estimate-architecture.tool.ts
    cost-management/                   # Requires Azure AD credentials
      query-costs.tool.ts
      query-costs-by-resource.tool.ts
      get-forecast.tool.ts
      list-budgets.tool.ts
```

## Tool Pattern (mandatory for all 9 tools)

Each tool file exports exactly two things:

```typescript
// 1. Handler — pure business logic, unit-testable without MCP
export async function myToolHandler(params: Params): Promise<string> {
  // resolve data, format, return string
}

// 2. Register — wires handler into MCP server
export function register(server: McpServer): void {
  server.tool('tool_name', 'description', Schema.shape, async (params) => ({
    content: [{ type: 'text', text: await myToolHandler(params) }],
  }));
}
```

Tests call `myToolHandler()` directly — no MCP server setup needed.

## Cost Management Auth Guard

All cost management handlers must check for credentials first:

```typescript
const config = loadConfig();
if (!config.costManagement) {
  return handleAuthError(Object.assign(new Error('Not configured'), { status: 401 }));
}
```

## APIs

| Group           | Base URL                                     | Auth                               |
| --------------- | -------------------------------------------- | ---------------------------------- |
| Retail Prices   | `https://prices.azure.com/api/retail/prices` | None                               |
| Cost Management | `https://management.azure.com`               | Azure AD (MSAL client credentials) |

## Zod v4 Note

Using Zod v4. The implementation plan examples use `.strict()` which still works but is deprecated — prefer `z.strictObject({...})` instead. All other patterns (`z.object`, `z.string`, `z.infer`, `.parse()`) are unchanged from v3.

## Companion Skill

Created in Task 17 at `~/.claude/skills/azure-cost.md`. Contains tool routing table, mandatory reservation comparison rule, graceful degradation instructions, and output conventions. Global scope — available in all Claude Code sessions.
