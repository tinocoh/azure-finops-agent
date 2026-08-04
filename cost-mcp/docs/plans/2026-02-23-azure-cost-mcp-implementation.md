# Azure Cost MCP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript MCP server that gives Claude live access to Azure pricing data and cost management, plus a companion skill that encodes reasoning patterns for using those tools.

**Architecture:** Two artifacts — an MCP server (9 tools, stdio transport) calling Azure Retail Prices API (public) and Azure Cost Management API (authenticated), plus a Claude Code skill file encoding tool routing, reservation comparison rules, and output conventions.

**Tech Stack:** TypeScript 5.9, Node 20 ESM, `@modelcontextprotocol/sdk ^1.26.0`, `@azure/msal-node ^5.0.4`, `zod ^4.3.6`, `vitest ^4.0.18`

---

## Task 1: Project Scaffolding

> **ALREADY COMPLETE.** `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, and `.husky/pre-commit` are all committed. `node_modules/` is installed. Skip to Task 2.

For reference, the actual `package.json` in the repo includes ESLint, Prettier, Husky, and lint-staged on top of the core deps, and all packages are pinned to their latest versions as of 2026-02-23.

---

## Task 2: Constants and Environment Config

**Files:**

- Create: `src/constants.ts`
- Create: `src/config/env.ts`
- Create: `src/config/env.test.ts`

**Step 1: Write the failing test**

Create `src/config/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when optional vars are absent', async () => {
    delete process.env.AZURE_RETAIL_DEFAULT_CURRENCY;
    const { loadConfig } = await import('./env.js');
    const config = loadConfig();
    expect(config.retailCurrency).toBe('USD');
    expect(config.useManagedIdentity).toBe(false);
  });

  it('reads cost management vars when present', async () => {
    process.env.AZURE_TENANT_ID = 'tenant-123';
    process.env.AZURE_CLIENT_ID = 'client-456';
    process.env.AZURE_CLIENT_SECRET = 'secret-789';
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-abc';
    const { loadConfig } = await import('./env.js');
    const config = loadConfig();
    expect(config.costManagement).toEqual({
      tenantId: 'tenant-123',
      clientId: 'client-456',
      clientSecret: 'secret-789',
      subscriptionId: 'sub-abc',
    });
  });

  it('returns null costManagement when vars are absent', async () => {
    delete process.env.AZURE_TENANT_ID;
    const { loadConfig } = await import('./env.js');
    const config = loadConfig();
    expect(config.costManagement).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/config/env.test.ts`
Expected: FAIL — `Cannot find module './env.js'`

**Step 3: Create `src/constants.ts`**

```typescript
export const RETAIL_API_BASE = 'https://prices.azure.com/api/retail/prices';
export const RETAIL_API_VERSION = '2023-01-01-preview';
export const COST_MGMT_API_BASE = 'https://management.azure.com';
export const CHARACTER_LIMIT = 25_000;
```

**Step 4: Create `src/config/env.ts`**

```typescript
export interface CostManagementConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface Config {
  retailCurrency: string;
  useManagedIdentity: boolean;
  costManagement: CostManagementConfig | null;
}

export function loadConfig(): Config {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID } =
    process.env;

  const costManagement =
    AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && AZURE_SUBSCRIPTION_ID
      ? {
          tenantId: AZURE_TENANT_ID,
          clientId: AZURE_CLIENT_ID,
          clientSecret: AZURE_CLIENT_SECRET,
          subscriptionId: AZURE_SUBSCRIPTION_ID,
        }
      : null;

  if (!costManagement) {
    console.error(
      '[azure-cost-mcp] Cost Management vars not set — authenticated tools will be unavailable.'
    );
  }

  return {
    retailCurrency: process.env.AZURE_RETAIL_DEFAULT_CURRENCY ?? 'USD',
    useManagedIdentity: process.env.AZURE_USE_MANAGED_IDENTITY === 'true',
    costManagement,
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/config/env.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add src/constants.ts src/config/env.ts src/config/env.test.ts
git commit -m "feat: constants and environment config"
```

---

## Task 3: OData Filter Builder

**Files:**

- Create: `src/utils/odata-builder.ts`
- Create: `src/utils/odata-builder.test.ts`

**Step 1: Write the failing tests**

Create `src/utils/odata-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildFilter } from './odata-builder.js';

describe('buildFilter', () => {
  it('returns empty string for empty clauses', () => {
    expect(buildFilter([])).toBe('');
  });

  it('builds a single eq clause with quoted string', () => {
    expect(buildFilter([{ field: 'serviceName', op: 'eq', value: 'Virtual Machines' }])).toBe(
      "serviceName eq 'Virtual Machines'"
    );
  });

  it('joins multiple clauses with " and "', () => {
    expect(
      buildFilter([
        { field: 'serviceName', op: 'eq', value: 'Virtual Machines' },
        { field: 'armRegionName', op: 'eq', value: 'eastus' },
      ])
    ).toBe("serviceName eq 'Virtual Machines' and armRegionName eq 'eastus'");
  });

  it('supports ne operator', () => {
    expect(buildFilter([{ field: 'priceType', op: 'ne', value: 'DevTest' }])).toBe(
      "priceType ne 'DevTest'"
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/odata-builder.test.ts`
Expected: FAIL

**Step 3: Create `src/utils/odata-builder.ts`**

```typescript
export type ODataOp = 'eq' | 'ne';

export interface FilterClause {
  field: string;
  op: ODataOp;
  value: string;
}

export function buildFilter(clauses: FilterClause[]): string {
  if (clauses.length === 0) return '';
  return clauses.map((c) => `${c.field} ${c.op} '${c.value}'`).join(' and ');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/odata-builder.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/utils/odata-builder.ts src/utils/odata-builder.test.ts
git commit -m "feat: OData filter builder utility"
```

---

## Task 4: Response Formatters and Error Handler

**Files:**

- Create: `src/utils/formatters.ts`
- Create: `src/utils/formatters.test.ts`
- Create: `src/utils/error-handler.ts`
- Create: `src/utils/error-handler.test.ts`

**Step 1: Write formatter tests**

Create `src/utils/formatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatAsMarkdown, formatAsJSON } from './formatters.js';

describe('formatAsJSON', () => {
  it('returns pretty-printed JSON', () => {
    expect(formatAsJSON({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe('formatAsMarkdown', () => {
  it('renders a GFM table from array of objects', () => {
    const rows = [
      { name: 'Standard_D2s_v5', region: 'eastus', price: '0.096' },
      { name: 'Standard_D4s_v5', region: 'eastus', price: '0.192' },
    ];
    const result = formatAsMarkdown(rows);
    expect(result).toContain('| name |');
    expect(result).toContain('| Standard_D2s_v5 |');
    expect(result).toContain('| Standard_D4s_v5 |');
  });

  it('includes a summary line when provided', () => {
    const result = formatAsMarkdown([{ a: '1' }], { summary: '1 result found' });
    expect(result).toContain('1 result found');
  });
});
```

**Step 2: Create `src/utils/formatters.ts`**

```typescript
export type ResponseFormat = 'markdown' | 'json';

export function formatAsJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatAsMarkdown(
  rows: Record<string, unknown>[],
  options?: { summary?: string }
): string {
  if (rows.length === 0) return options?.summary ? `_${options.summary}_` : '_No results_';

  const headers = Object.keys(rows[0]);
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((r) => `| ${headers.map((h) => String(r[h] ?? '')).join(' | ')} |`);

  const table = [headerRow, separator, ...dataRows].join('\n');
  return options?.summary ? `${table}\n\n_${options.summary}_` : table;
}
```

**Step 3: Write error handler tests**

Create `src/utils/error-handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleApiError, handleAuthError } from './error-handler.js';

describe('handleApiError', () => {
  it('handles 404 with not-found message', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    expect(handleApiError(err)).toContain('not found');
  });

  it('handles 429 with rate-limit message', () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(handleApiError(err)).toContain('rate limit');
  });

  it('handles generic errors with message passthrough', () => {
    expect(handleApiError(new Error('unexpected'))).toContain('unexpected');
  });
});

describe('handleAuthError', () => {
  it('returns setup instructions for 401', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(handleAuthError(err)).toContain('AZURE_TENANT_ID');
  });
});
```

**Step 4: Create `src/utils/error-handler.ts`**

```typescript
interface StatusError extends Error {
  status?: number;
}

export function handleApiError(error: unknown): string {
  const err = error as StatusError;
  if (err.status === 404)
    return `Resource not found. Check that the SKU name and region are valid.`;
  if (err.status === 429) return `Azure API rate limit reached. Wait a moment and retry.`;
  if (err.status === 503) return `Azure API temporarily unavailable. Retry in a few minutes.`;
  return `API error: ${err.message ?? String(error)}`;
}

export function handleAuthError(error: unknown): string {
  const err = error as StatusError;
  if (err.status === 401 || err.status === 403) {
    return (
      `Authentication failed. Ensure these environment variables are set:\n` +
      `  AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID\n` +
      `The service principal needs the "Cost Management Reader" role.`
    );
  }
  return handleApiError(error);
}
```

**Step 5: Run all util tests**

Run: `npm test -- src/utils/`
Expected: PASS (all tests)

**Step 6: Commit**

```bash
git add src/utils/
git commit -m "feat: response formatters and error handler utilities"
```

---

## Task 5: Retail Prices Schema and Client

**Files:**

- Create: `src/schemas/retail-prices.schema.ts`
- Create: `src/clients/retail-prices.client.ts`
- Create: `src/clients/retail-prices.client.test.ts`

**Step 1: Create `src/schemas/retail-prices.schema.ts`**

```typescript
import { z } from 'zod';

export const PriceItemSchema = z.object({
  currencyCode: z.string(),
  tierMinimumUnits: z.number(),
  retailPrice: z.number(),
  unitPrice: z.number(),
  armRegionName: z.string(),
  location: z.string(),
  effectiveStartDate: z.string(),
  meterId: z.string(),
  meterName: z.string(),
  productId: z.string(),
  skuId: z.string(),
  productName: z.string(),
  skuName: z.string(),
  serviceName: z.string(),
  serviceId: z.string(),
  serviceFamily: z.string(),
  unitOfMeasure: z.string(),
  type: z.string(),
  isPrimaryMeterRegion: z.boolean(),
  armSkuName: z.string(),
});

export type PriceItem = z.infer<typeof PriceItemSchema>;

export const RetailPricesResponseSchema = z.object({
  BillingCurrency: z.string(),
  CustomerEntityId: z.string(),
  CustomerEntityType: z.string(),
  Items: z.array(PriceItemSchema),
  NextPageLink: z.string().nullable().optional(),
  Count: z.number(),
});
```

**Step 2: Write the failing client tests**

Create `src/clients/retail-prices.client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchPrices', () => {
  beforeEach(() => mockFetch.mockReset());

  function makeResponse(items: object[], nextPageLink?: string) {
    return {
      ok: true,
      json: async () => ({
        BillingCurrency: 'USD',
        CustomerEntityId: 'default',
        CustomerEntityType: 'Enterprise',
        Items: items,
        NextPageLink: nextPageLink ?? null,
        Count: items.length,
      }),
    };
  }

  const sampleItem = {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice: 0.096,
    unitPrice: 0.096,
    armRegionName: 'eastus',
    location: 'East US',
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'meter-1',
    meterName: 'D2s v5',
    productId: 'prod-1',
    skuId: 'sku-1',
    productName: 'Virtual Machines D Series',
    skuName: 'D2s v5',
    serviceName: 'Virtual Machines',
    serviceId: 'svc-1',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    armSkuName: 'Standard_D2s_v5',
  };

  it('fetches prices from the retail API', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem]));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].armSkuName).toBe('Standard_D2s_v5');
    expect(result.nextPageLink).toBeUndefined();
  });

  it('returns nextPageLink when present', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem], 'https://next-page'));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'");
    expect(result.nextPageLink).toBe('https://next-page');
  });

  it('respects limit option', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem, sampleItem, sampleItem]));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'", { limit: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    const { fetchPrices } = await import('./retail-prices.client.js');
    await expect(fetchPrices("serviceName eq 'Nope'")).rejects.toThrow('HTTP 404');
  });
});
```

**Step 3: Create `src/clients/retail-prices.client.ts`**

```typescript
import { RETAIL_API_BASE, RETAIL_API_VERSION } from '../constants.js';
import { RetailPricesResponseSchema, PriceItem } from '../schemas/retail-prices.schema.js';

export interface FetchOptions {
  currencyCode?: string;
  limit?: number;
  nextPageLink?: string;
}

export async function fetchPrices(
  filter: string,
  options?: FetchOptions
): Promise<{ items: PriceItem[]; nextPageLink?: string }> {
  const url = options?.nextPageLink ?? buildUrl(filter, options?.currencyCode);
  const response = await fetchWithRetry(url);
  const data = RetailPricesResponseSchema.parse(await response.json());
  const items = options?.limit ? data.Items.slice(0, options.limit) : data.Items;
  return { items, nextPageLink: data.NextPageLink ?? undefined };
}

function buildUrl(filter: string, currencyCode = 'USD'): string {
  const params = new URLSearchParams({
    'api-version': RETAIL_API_VERSION,
    $filter: filter,
    currencyCode,
  });
  return `${RETAIL_API_BASE}?${params}`;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(url);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
      await sleep(retryAfter * 1000 * Math.pow(2, i));
      continue;
    }
    if (!response.ok) {
      const err = Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
        status: response.status,
      });
      throw err;
    }
    return response;
  }
  throw new Error(`Failed after ${attempts} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Step 4: Run tests**

Run: `npm test -- src/clients/retail-prices.client.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/schemas/retail-prices.schema.ts src/clients/retail-prices.client.ts src/clients/retail-prices.client.test.ts
git commit -m "feat: retail prices schema and HTTP client"
```

---

## Task 6: Azure Auth and Cost Management Client

**Files:**

- Create: `src/auth/azure-auth.ts`
- Create: `src/schemas/cost-management.schema.ts`
- Create: `src/clients/cost-management.client.ts`
- Create: `src/clients/cost-management.client.test.ts`

**Step 1: Create `src/auth/azure-auth.ts`**

```typescript
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { CostManagementConfig } from '../config/env.js';

const SCOPE = 'https://management.azure.com/.default';

let msalApp: ConfidentialClientApplication | null = null;

export async function getAccessToken(config: CostManagementConfig): Promise<string> {
  if (!msalApp) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    };
    msalApp = new ConfidentialClientApplication(msalConfig);
  }

  const result = await msalApp.acquireTokenByClientCredential({ scopes: [SCOPE] });
  if (!result?.accessToken) {
    throw Object.assign(new Error('Failed to acquire Azure AD token'), { status: 401 });
  }
  return result.accessToken;
}
```

**Step 2: Create `src/schemas/cost-management.schema.ts`**

```typescript
import { z } from 'zod';

export const QueryResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  properties: z.object({
    nextLink: z.string().nullable().optional(),
    columns: z.array(z.object({ name: z.string(), type: z.string() })),
    rows: z.array(z.array(z.unknown())),
  }),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

export interface NormalizedCostRow {
  [key: string]: unknown;
}

export function normalizeQueryResult(result: QueryResult): NormalizedCostRow[] {
  const { columns, rows } = result.properties;
  return rows.map((row) => Object.fromEntries(columns.map((col, i) => [col.name, row[i]])));
}
```

**Step 3: Write cost management client tests**

Create `src/clients/cost-management.client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/azure-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('queryUsage', () => {
  beforeEach(() => mockFetch.mockReset());

  const mockQueryResult = {
    id: '/subscriptions/sub-1/providers/Microsoft.CostManagement/query/result',
    name: 'result',
    type: 'Microsoft.CostManagement/query',
    properties: {
      nextLink: null,
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'ServiceName', type: 'String' },
      ],
      rows: [
        [12.5, 'Virtual Machines'],
        [3.2, 'Storage'],
      ],
    },
  };

  it('returns normalized rows from query result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueryResult,
    });
    const { queryUsage } = await import('./cost-management.client.js');
    const config = { tenantId: 't', clientId: 'c', clientSecret: 's', subscriptionId: 'sub-1' };
    const rows = await queryUsage(config, {
      type: 'ActualCost',
      timeframe: 'MonthToDate',
      dataset: {
        granularity: 'None',
        aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Cost: 12.5, ServiceName: 'Virtual Machines' });
  });
});
```

**Step 4: Create `src/clients/cost-management.client.ts`**

```typescript
import { COST_MGMT_API_BASE } from '../constants.js';
import { getAccessToken } from '../auth/azure-auth.js';
import {
  QueryResultSchema,
  normalizeQueryResult,
  NormalizedCostRow,
} from '../schemas/cost-management.schema.js';
import { CostManagementConfig } from '../config/env.js';

type QueryBody = Record<string, unknown>;

export async function queryUsage(
  config: CostManagementConfig,
  body: QueryBody
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken(config);
  const url = `${COST_MGMT_API_BASE}/subscriptions/${config.subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const result = QueryResultSchema.parse(await response.json());
  return normalizeQueryResult(result);
}

export async function getForecast(
  config: CostManagementConfig,
  body: QueryBody
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken(config);
  const url = `${COST_MGMT_API_BASE}/subscriptions/${config.subscriptionId}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const result = QueryResultSchema.parse(await response.json());
  return normalizeQueryResult(result);
}

export async function listBudgets(
  config: CostManagementConfig,
  resourceGroup?: string
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken(config);
  const scope = resourceGroup
    ? `subscriptions/${config.subscriptionId}/resourceGroups/${resourceGroup}`
    : `subscriptions/${config.subscriptionId}`;
  const url = `${COST_MGMT_API_BASE}/${scope}/providers/Microsoft.Consumption/budgets?api-version=2023-11-01`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const data = (await response.json()) as { value: object[] };
  return data.value as NormalizedCostRow[];
}
```

**Step 5: Run tests**

Run: `npm test -- src/clients/cost-management.client.test.ts`
Expected: PASS

**Step 6: Verify build compiles**

Run: `npm run build`
Expected: `dist/` created with no TypeScript errors.

**Step 7: Commit**

```bash
git add src/auth/ src/schemas/cost-management.schema.ts src/clients/cost-management.client.ts src/clients/cost-management.client.test.ts
git commit -m "feat: Azure auth and Cost Management client"
```

---

## Task 7: Tool Pattern — azure_search_prices (Full TDD)

This task establishes the pattern all tools follow. Read carefully; subsequent tool tasks use the same structure.

**Files:**

- Create: `src/tools/retail/search-prices.tool.ts`
- Create: `src/tools/retail/search-prices.tool.test.ts`

**Tool pattern:** Each tool exports two things:

1. An `async handler(params)` function — the business logic, unit-testable
2. A `register(server)` function — wires the handler into the MCP server

**Step 1: Write the failing test**

Create `src/tools/retail/search-prices.tool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/retail-prices.client.js', () => ({
  fetchPrices: vi.fn(),
}));

import { fetchPrices } from '../../clients/retail-prices.client.js';
import { searchPricesHandler } from './search-prices.tool.js';

const mockFetch = vi.mocked(fetchPrices);

const sampleItem = {
  currencyCode: 'USD',
  tierMinimumUnits: 0,
  retailPrice: 0.096,
  unitPrice: 0.096,
  armRegionName: 'eastus',
  location: 'East US',
  effectiveStartDate: '2024-01-01T00:00:00Z',
  meterId: 'm1',
  meterName: 'D2s v5',
  productId: 'p1',
  skuId: 's1',
  productName: 'Virtual Machines D Series',
  skuName: 'D2s v5',
  serviceName: 'Virtual Machines',
  serviceId: 'sv1',
  serviceFamily: 'Compute',
  unitOfMeasure: '1 Hour',
  type: 'Consumption',
  isPrimaryMeterRegion: true,
  armSkuName: 'Standard_D2s_v5',
};

describe('searchPricesHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns markdown table by default', async () => {
    mockFetch.mockResolvedValueOnce({ items: [sampleItem], nextPageLink: undefined });
    const result = await searchPricesHandler({ serviceName: 'Virtual Machines' });
    expect(result).toContain('Standard_D2s_v5');
    expect(result).toContain('|');
  });

  it('returns JSON when response_format is json', async () => {
    mockFetch.mockResolvedValueOnce({ items: [sampleItem], nextPageLink: undefined });
    const result = await searchPricesHandler({
      serviceName: 'Virtual Machines',
      response_format: 'json',
    });
    const parsed = JSON.parse(result);
    expect(parsed.items[0].armSkuName).toBe('Standard_D2s_v5');
  });

  it('returns no-results message when empty', async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });
    const result = await searchPricesHandler({ serviceName: 'Nonexistent' });
    expect(result).toContain('No results');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/tools/retail/search-prices.tool.test.ts`
Expected: FAIL

**Step 3: Create `src/tools/retail/search-prices.tool.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const SearchPricesSchema = z.strictObject({
  serviceName: z.string().optional().describe('e.g. "Virtual Machines"'),
  serviceFamily: z.string().optional().describe('e.g. "Compute"'),
  armRegionName: z.string().optional().describe('e.g. "eastus"'),
  skuName: z.string().optional().describe('partial match, e.g. "D2s v5"'),
  armSkuName: z.string().optional().describe('exact SKU, e.g. "Standard_D2s_v5"'),
  priceType: z.enum(['Consumption', 'Reservation', 'DevTest']).optional(),
  currencyCode: z.string().optional().default('USD'),
  limit: z.number().int().min(1).max(200).optional().default(50),
  nextPageLink: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type SearchPricesParams = z.infer<typeof SearchPricesSchema>;

export async function searchPricesHandler(params: SearchPricesParams): Promise<string> {
  try {
    const clauses = [
      params.serviceName && { field: 'serviceName', op: 'eq' as const, value: params.serviceName },
      params.serviceFamily && {
        field: 'serviceFamily',
        op: 'eq' as const,
        value: params.serviceFamily,
      },
      params.armRegionName && {
        field: 'armRegionName',
        op: 'eq' as const,
        value: params.armRegionName,
      },
      params.armSkuName && { field: 'armSkuName', op: 'eq' as const, value: params.armSkuName },
      params.priceType && { field: 'priceType', op: 'eq' as const, value: params.priceType },
    ].filter(Boolean) as { field: string; op: 'eq'; value: string }[];

    const filter = buildFilter(clauses);
    const { items, nextPageLink } = await fetchPrices(filter, {
      currencyCode: params.currencyCode,
      limit: params.limit,
      nextPageLink: params.nextPageLink,
    });

    if (items.length === 0) return 'No results found. Try broader filter parameters.';

    const rows = items.map((item) => ({
      armSkuName: item.armSkuName,
      skuName: item.skuName,
      region: item.armRegionName,
      retailPrice: `$${item.retailPrice}`,
      unitOfMeasure: item.unitOfMeasure,
      type: item.type,
    }));

    if (params.response_format === 'json') {
      return formatAsJSON({ items: rows, nextPageLink });
    }

    const summary = nextPageLink
      ? `${items.length} results shown. Pass nextPageLink to fetch more.`
      : `${items.length} results.`;
    return formatAsMarkdown(rows, { summary });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_search_prices',
    'Search Azure retail prices with OData filters. Use for ad-hoc price lookups.',
    SearchPricesSchema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await searchPricesHandler(params) }],
    })
  );
}
```

**Step 4: Run tests**

Run: `npm test -- src/tools/retail/search-prices.tool.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/tools/retail/search-prices.tool.ts src/tools/retail/search-prices.tool.test.ts
git commit -m "feat: azure_search_prices tool"
```

---

## Task 8: azure_compare_vm_prices

**Files:**

- Create: `src/tools/retail/compare-vm-prices.tool.ts`
- Create: `src/tools/retail/compare-vm-prices.tool.test.ts`

**Pattern:** Same handler + register pattern as Task 7. Test the handler directly with mocked `fetchPrices`.

**Key logic:** For each SKU × region pair, build a filter and fetch in parallel (`Promise.all`). Merge into a matrix. Monthly estimate = `retailPrice × 730`. Highlight cheapest cell.

**Step 1: Write tests**

```typescript
// compare-vm-prices.tool.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../clients/retail-prices.client.js', () => ({ fetchPrices: vi.fn() }));
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { compareVmPricesHandler } from './compare-vm-prices.tool.js';

const mockFetch = vi.mocked(fetchPrices);

function makeItem(armSkuName: string, armRegionName: string, retailPrice: number) {
  return {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice,
    unitPrice: retailPrice,
    armRegionName,
    location: armRegionName,
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'm',
    meterName: armSkuName,
    productId: 'p',
    skuId: 's',
    productName: 'VMs',
    skuName: armSkuName,
    serviceName: 'Virtual Machines',
    serviceId: 'sv',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    armSkuName,
  };
}

describe('compareVmPricesHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns comparison matrix with monthly cost', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Standard_D2s_v5', 'eastus', 0.096)] })
      .mockResolvedValueOnce({ items: [makeItem('Standard_D4s_v5', 'eastus', 0.192)] });
    const result = await compareVmPricesHandler({
      skuNames: ['Standard_D2s_v5', 'Standard_D4s_v5'],
      regions: ['eastus'],
    });
    expect(result).toContain('Standard_D2s_v5');
    expect(result).toContain('70.08'); // 0.096 * 730
  });
});
```

**Step 2: Implement**

```typescript
// compare-vm-prices.tool.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const Schema = z.strictObject({
  skuNames: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('armSkuName values, e.g. ["Standard_D2s_v5"]'),
  regions: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('armRegionName values, e.g. ["eastus", "westeurope"]'),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.infer<typeof Schema>;

export async function compareVmPricesHandler(params: Params): Promise<string> {
  try {
    const fetches = params.skuNames.flatMap((sku) =>
      params.regions.map((region) => ({
        sku,
        region,
        promise: fetchPrices(
          buildFilter([
            { field: 'armSkuName', op: 'eq', value: sku },
            { field: 'armRegionName', op: 'eq', value: region },
            { field: 'priceType', op: 'eq', value: 'Consumption' },
          ]),
          { currencyCode: params.currencyCode, limit: 1 }
        ),
      }))
    );

    const results = await Promise.all(
      fetches.map((f) => f.promise.then((r) => ({ ...f, item: r.items[0] })))
    );

    let cheapestPrice = Infinity;
    const rows = params.skuNames.map((sku) => {
      const row: Record<string, string> = { SKU: sku };
      for (const region of params.regions) {
        const found = results.find((r) => r.sku === sku && r.region === region);
        if (found?.item) {
          const monthly = (found.item.retailPrice * 730).toFixed(2);
          if (found.item.retailPrice < cheapestPrice) cheapestPrice = found.item.retailPrice;
          row[region] = `$${monthly}/mo`;
        } else {
          row[region] = 'N/A';
        }
      }
      return row;
    });

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows, {
      summary: 'Monthly estimates at 730h/mo. Cheapest highlighted by lowest hourly rate.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_compare_vm_prices',
    'Compare VM SKUs across regions. Always call azure_compare_reservation_vs_payg after for workloads running >6 months.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await compareVmPricesHandler(params) }],
    })
  );
}
```

**Step 3: Run tests, then commit**

```bash
npm test -- src/tools/retail/compare-vm-prices.tool.test.ts
git add src/tools/retail/compare-vm-prices.tool.ts src/tools/retail/compare-vm-prices.tool.test.ts
git commit -m "feat: azure_compare_vm_prices tool"
```

---

## Task 9: azure_find_cheapest_region

**Files:**

- Create: `src/tools/retail/find-cheapest-region.tool.ts`
- Create: `src/tools/retail/find-cheapest-region.tool.test.ts`

**Key logic:** Fetch all regions for a given `armSkuName` (no region filter), sort by `retailPrice` ascending, return top N. Optional `geographyZone` filter (Europe, Americas, Asia Pacific, etc.) applied client-side.

**Test:** mock fetchPrices returning items from 3 regions at different prices — verify sorted order and correct top-N.

**Schema:**

```typescript
z.strictObject({
  armSkuName: z.string(),
  topN: z.number().int().min(1).max(20).optional().default(5),
  priceType: z.enum(['Consumption', 'Reservation']).optional().default('Consumption'),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**Step: Run tests, then commit**

```bash
git add src/tools/retail/find-cheapest-region.tool.ts src/tools/retail/find-cheapest-region.tool.test.ts
git commit -m "feat: azure_find_cheapest_region tool"
```

---

## Task 10: azure_compare_reservation_vs_payg

**Files:**

- Create: `src/tools/retail/compare-reservation.tool.ts`
- Create: `src/tools/retail/compare-reservation.tool.test.ts`

**Key logic:** Fetch Consumption, `Reservation` 1-Year, and `Reservation` 3-Year prices for the same SKU + region. Build comparison table. Calculate break-even month: `ceil(reservationAnnualCost / (paygMonthly - reservationMonthly))`. Total savings over 1yr and 3yr.

**Test:** mock three fetchPrices calls returning PAYG=0.096, 1yr=0.058, 3yr=0.038. Verify break-even and savings calculations.

**Schema:**

```typescript
z.strictObject({
  armSkuName: z.string(),
  armRegionName: z.string(),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**Step: Run tests, then commit**

```bash
git add src/tools/retail/compare-reservation.tool.ts src/tools/retail/compare-reservation.tool.test.ts
git commit -m "feat: azure_compare_reservation_vs_payg tool"
```

---

## Task 11: azure_estimate_architecture_cost

**Files:**

- Create: `src/tools/retail/estimate-architecture.tool.ts`
- Create: `src/tools/retail/estimate-architecture.tool.test.ts`

**Key logic:** Accept array of components. For each, resolve price via `fetchPrices`. Compute cost:

- Compute: `retailPrice × usageHoursPerMonth × quantity`
- Storage: need storage-specific pricing per GB (use `unitPrice` where `unitOfMeasure` contains 'GB')
- Assign confidence: HIGH (exact armSkuName match returned), MEDIUM (no exact match but items returned), LOW (empty response)

Run all resolves in parallel via `Promise.all`. Sum total monthly and annual.

**Schema:**

```typescript
z.strictObject({
  components: z
    .array(
      z.strictObject({
        component: z.string().describe('human label, e.g. "App Server"'),
        armSkuName: z.string(),
        armRegionName: z.string(),
        quantity: z.number().int().min(1).optional().default(1),
        usageHoursPerMonth: z.number().min(0).max(744).optional().default(730),
        storageGB: z.number().min(0).optional().default(0),
        priceType: z.enum(['Consumption', 'Reservation']).optional().default('Consumption'),
      })
    )
    .min(1)
    .max(20),
  includeReservationAlternative: z.boolean().optional().default(false),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**Test:** 2-component estimate (VM + Storage), verify per-line and total costs.

**Step: Run tests, then commit**

```bash
git add src/tools/retail/estimate-architecture.tool.ts src/tools/retail/estimate-architecture.tool.test.ts
git commit -m "feat: azure_estimate_architecture_cost tool"
```

---

## Task 12: azure_query_costs

**Files:**

- Create: `src/tools/cost-management/query-costs.tool.ts`
- Create: `src/tools/cost-management/query-costs.tool.test.ts`

**Key logic:** Requires `config.costManagement` — if null, return the setup instructions message. Build Cost Management query body from params. Call `queryUsage`. Format rows.

**Schema:**

```typescript
z.strictObject({
  timeframe: z.enum([
    'MonthToDate',
    'BillingMonthToDate',
    'TheLastMonth',
    'TheLastBillingMonth',
    'Custom',
  ]),
  startDate: z.string().optional().describe('ISO date, required when timeframe=Custom'),
  endDate: z.string().optional().describe('ISO date, required when timeframe=Custom'),
  granularity: z.enum(['Daily', 'Monthly', 'None']).optional().default('None'),
  groupBy: z
    .array(z.enum(['ResourceGroup', 'ServiceName', 'Location', 'ResourceType']))
    .optional()
    .default(['ServiceName']),
  costType: z.enum(['ActualCost', 'AmortizedCost']).optional().default('ActualCost'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**Test:** mock `queryUsage` returning 2 rows — verify correct query body construction and formatted output.

**Step: Run tests, then commit**

```bash
git add src/tools/cost-management/query-costs.tool.ts src/tools/cost-management/query-costs.tool.test.ts
git commit -m "feat: azure_query_costs tool"
```

---

## Task 13: azure_query_costs_by_resource

**Files:**

- Create: `src/tools/cost-management/query-costs-by-resource.tool.ts`
- Create: `src/tools/cost-management/query-costs-by-resource.tool.test.ts`

**Key logic:** Call `queryUsage` grouping by `ResourceId`. Sort by cost descending. Return top N with % of total spend.

**Schema:**

```typescript
z.strictObject({
  topN: z.number().int().min(1).max(50).optional().default(10),
  resourceGroup: z.string().optional(),
  timeframe: z.enum(['MonthToDate', 'TheLastMonth', 'Custom']).optional().default('MonthToDate'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**Step: Run tests, then commit**

```bash
git add src/tools/cost-management/query-costs-by-resource.tool.ts src/tools/cost-management/query-costs-by-resource.tool.test.ts
git commit -m "feat: azure_query_costs_by_resource tool"
```

---

## Task 14: azure_get_cost_forecast and azure_list_budgets

**Files:**

- Create: `src/tools/cost-management/get-forecast.tool.ts`
- Create: `src/tools/cost-management/get-forecast.tool.test.ts`
- Create: `src/tools/cost-management/list-budgets.tool.ts`
- Create: `src/tools/cost-management/list-budgets.tool.test.ts`

**get-forecast schema:**

```typescript
z.strictObject({
  timeframe: z
    .enum(['MonthToDate', 'BillingMonthToDate', 'Custom'])
    .optional()
    .default('MonthToDate'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['Daily', 'Monthly']).optional().default('Daily'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});
```

**list-budgets:** Calls `listBudgets`. Augments each budget with a `status` field:

- `CRITICAL` if `currentSpend >= 90%` of amount
- `WARNING` if `currentSpend >= 75%`
- `OK` otherwise

**Step: Run tests, then commit**

```bash
git add src/tools/cost-management/
git commit -m "feat: azure_get_cost_forecast and azure_list_budgets tools"
```

---

## Task 15: Entry Point

**Files:**

- Create: `src/index.ts`

**Step 1: Create `src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { register as registerSearchPrices } from './tools/retail/search-prices.tool.js';
import { register as registerCompareVm } from './tools/retail/compare-vm-prices.tool.js';
import { register as registerCheapestRegion } from './tools/retail/find-cheapest-region.tool.js';
import { register as registerReservation } from './tools/retail/compare-reservation.tool.js';
import { register as registerEstimate } from './tools/retail/estimate-architecture.tool.js';
import { register as registerQueryCosts } from './tools/cost-management/query-costs.tool.js';
import { register as registerQueryByResource } from './tools/cost-management/query-costs-by-resource.tool.js';
import { register as registerForecast } from './tools/cost-management/get-forecast.tool.js';
import { register as registerBudgets } from './tools/cost-management/list-budgets.tool.js';

const server = new McpServer({ name: 'azure-cost-mcp', version: '0.1.0' });

registerSearchPrices(server);
registerCompareVm(server);
registerCheapestRegion(server);
registerReservation(server);
registerEstimate(server);
registerQueryCosts(server);
registerQueryByResource(server);
registerForecast(server);
registerBudgets(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('azure-cost-mcp running via stdio');
```

**Step 2: Build**

Run: `npm run build`
Expected: No TypeScript errors. `dist/index.js` exists.

**Step 3: Smoke test**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js`
Expected: JSON response listing all 9 tools.

**Step 4: Commit**

```bash
git add src/index.ts dist/
git commit -m "feat: entry point — wires all 9 tools"
```

---

## Task 16: README

**Files:**

- Create: `README.md`

**Step 1: Create `README.md`**

Include these sections:

- What it does (9 tools, two API groups)
- Prerequisites: Node 20+, npm
- Build: `npm install && npm run build`
- Azure setup: create service principal, assign `Cost Management Reader` role, copy credentials to env vars
- Claude Desktop config:

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

- Tool reference table (name, description, auth required)

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup and tool reference"
```

---

## Task 17: Companion Skill

**Files:**

- Create: `~/.claude/skills/azure-cost.md`

**Step 1: Create the companion skill**

```markdown
---
name: azure-cost
description: Use when asked about Azure infrastructure costs, VM pricing, reservations, budgets, or architecture cost estimation. Activates routing rules and output conventions for the azure-cost-mcp tools.
---

# Azure Cost Analysis

## When to use this skill

Invoke when the user asks anything related to:

- Azure VM or service pricing ("how much does X cost?")
- Region comparison ("where is X cheapest?")
- Reservation vs pay-as-you-go decisions
- Architecture cost estimation
- Actual subscription spend or budgets

## Tool Selection

| User intent                           | Tool(s)                                     |
| ------------------------------------- | ------------------------------------------- |
| Price lookup for a specific SKU       | `azure_search_prices`                       |
| Compare VM SKUs side by side          | `azure_compare_vm_prices`                   |
| Find cheapest region for a SKU        | `azure_find_cheapest_region`                |
| Reservation vs PAYG decision          | `azure_compare_reservation_vs_payg`         |
| Multi-component architecture estimate | `azure_estimate_architecture_cost`          |
| Actual spend this month               | `azure_query_costs` (timeframe=MonthToDate) |
| Top resources by cost                 | `azure_query_costs_by_resource`             |
| Spending forecast                     | `azure_get_cost_forecast`                   |
| Budget status                         | `azure_list_budgets`                        |

## Required Comparisons

**Reservation rule:** Any recommendation involving a compute SKU (VM, AKS node, etc.) for a workload expected to run >6 months MUST include a call to `azure_compare_reservation_vs_payg`. Never recommend pay-as-you-go without showing reservation savings.

**Architecture estimates:** Always follow `azure_estimate_architecture_cost` with `azure_compare_reservation_vs_payg` for any compute-heavy components.

## Graceful Degradation

If a Cost Management tool returns an auth error or the config is missing:

1. State clearly: "Actual spend data is unavailable — showing retail price estimates instead."
2. Continue with retail pricing tools.
3. Tell the user: "To enable actual cost data, set these environment variables in your Claude Desktop config: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID. The service principal needs the Cost Management Reader role."

## Output Conventions

- Always show costs as **monthly AND annual** figures (never hourly only)
- Label confidence: **HIGH** (exact armSkuName match) / **MEDIUM** (fuzzy) / **LOW** (no match)
- Architecture estimates: show per-component breakdown, then totals
- Region comparisons: show delta as both dollar amount and percentage
- Default format: markdown tables
- Raw JSON only when user explicitly requests it
```

**Step 2: Verify skill is discoverable**

Run: In a new Claude Code session, type `/azure-cost` and verify it loads.

**Step 3: Commit the skill reference**

Add a note to `README.md` about the companion skill location, then commit.

```bash
git add README.md
git commit -m "docs: document companion skill location"
```

---

## Verification Checklist

Run all these after completing all tasks:

```bash
# All tests pass
npm test

# TypeScript compiles clean
npm run build

# Server starts and responds
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# MCP Inspector (visual tool verification)
npx @modelcontextprotocol/inspector node dist/index.js

# Manual: invoke azure_search_prices
# In Inspector, call azure_search_prices with serviceName="Virtual Machines" and armRegionName="eastus"
# Expected: price table with SKU data

# Manual: invoke azure_compare_vm_prices
# skuNames=["Standard_D2s_v5","Standard_D4s_v5"], regions=["eastus","westeurope"]
# Expected: 2x2 matrix with monthly costs

# Manual: invoke azure_estimate_architecture_cost
# 3 components: VM (Standard_D4s_v5, eastus), disk (Premium_LRS, eastus, storageGB=128), storage account
# Expected: per-line breakdown + total monthly/annual
```
