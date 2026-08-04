# DefaultAzureCredential Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace MSAL service-principal-only auth with `DefaultAzureCredential` so the server works out of the box with `az login`, Managed Identity, or service principal env vars — with zero explicit auth config required.

**Architecture:** Swap `@azure/msal-node` for `@azure/identity`. Rewrite `azure-auth.ts` to use a module-level `DefaultAzureCredential` singleton. Rewrite `env.ts` to make `CostManagementConfig` carry only `subscriptionId`, resolved from `AZURE_SUBSCRIPTION_ID` or `az account show`. Remove the unused `useManagedIdentity` field. All tool and client call sites are unchanged except removing the config args from `getAccessToken`.

**Tech Stack:** `@azure/identity`, `child_process.execSync` (for `az account show`), Vitest `vi.mock` + `vi.hoisted`

---

### Task 1: Swap npm dependencies

**Files:**

- Modify: `package.json`

**Step 1: Uninstall MSAL, install @azure/identity**

```bash
npm uninstall @azure/msal-node
npm install @azure/identity
```

**Step 2: Verify the swap**

```bash
npm ls @azure/identity @azure/msal-node 2>&1
```

Expected: `@azure/identity` listed, `@azure/msal-node` absent (or shown as extraneous/missing).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace @azure/msal-node with @azure/identity"
```

---

### Task 2: Rewrite `azure-auth.ts` (TDD)

**Files:**

- Create: `src/auth/azure-auth.test.ts`
- Modify: `src/auth/azure-auth.ts`

**Step 1: Write the failing tests**

Create `src/auth/azure-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mockGetToken is declared before vi.mock so the same function reference
// is used by the singleton credential across all tests.
const mockGetToken = vi.fn();

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(() => ({ getToken: mockGetToken })),
}));

import { getAccessToken } from './azure-auth.js';

describe('getAccessToken', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
  });

  it('returns the token string on success', async () => {
    mockGetToken.mockResolvedValueOnce({ token: 'test-token-abc' });

    const result = await getAccessToken();

    expect(result).toBe('test-token-abc');
    expect(mockGetToken).toHaveBeenCalledWith('https://management.azure.com/.default');
  });

  it('throws with status 401 when credential returns null', async () => {
    mockGetToken.mockResolvedValueOnce(null);

    await expect(getAccessToken()).rejects.toMatchObject({ status: 401 });
  });

  it('propagates errors from DefaultAzureCredential', async () => {
    mockGetToken.mockRejectedValueOnce(
      new Error('DefaultAzureCredential: No credentials available')
    );

    await expect(getAccessToken()).rejects.toThrow('No credentials available');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm test -- azure-auth
```

Expected: FAIL — `@azure/identity` not yet used in implementation (still using MSAL).

**Step 3: Rewrite `src/auth/azure-auth.ts`**

Replace the entire file with:

```typescript
import { DefaultAzureCredential } from '@azure/identity';

const SCOPE = 'https://management.azure.com/.default';

let credential: DefaultAzureCredential | null = null;

export async function getAccessToken(): Promise<string> {
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  const token = await credential.getToken(SCOPE);
  if (!token?.token) {
    throw Object.assign(new Error('Failed to acquire Azure AD token'), { status: 401 });
  }
  return token.token;
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- azure-auth
```

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add src/auth/azure-auth.ts src/auth/azure-auth.test.ts
git commit -m "feat: replace MSAL with DefaultAzureCredential in azure-auth"
```

---

### Task 3: Rewrite `env.ts` and its tests (TDD)

**Files:**

- Modify: `src/config/env.test.ts`
- Modify: `src/config/env.ts`

**Step 1: Write failing tests**

Replace the entire content of `src/config/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ execSync: mockExecSync }));

import { loadConfig } from './env.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_RETAIL_DEFAULT_CURRENCY;
    mockExecSync.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves subscription ID from AZURE_SUBSCRIPTION_ID env var', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-env-123';

    const config = loadConfig();

    expect(config.costManagement).toEqual({ subscriptionId: 'sub-env-123' });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('falls back to az account show when AZURE_SUBSCRIPTION_ID is absent', () => {
    mockExecSync.mockReturnValueOnce('sub-cli-456\n');

    const config = loadConfig();

    expect(config.costManagement).toEqual({ subscriptionId: 'sub-cli-456' });
    expect(mockExecSync).toHaveBeenCalledWith('az account show --query id --output tsv', {
      encoding: 'utf8',
    });
  });

  it('sets costManagement to null when env var absent and az CLI throws', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not logged in');
    });

    const config = loadConfig();

    expect(config.costManagement).toBeNull();
  });

  it('uses USD as default retail currency', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-xyz';

    const config = loadConfig();

    expect(config.retailCurrency).toBe('USD');
  });

  it('reads custom retail currency from AZURE_RETAIL_DEFAULT_CURRENCY', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-xyz';
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY = 'EUR';

    const config = loadConfig();

    expect(config.retailCurrency).toBe('EUR');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npm test -- env.test
```

Expected: FAIL — `CostManagementConfig` still has old fields; `useManagedIdentity` still present; no `execSync` call.

**Step 3: Rewrite `src/config/env.ts`**

Replace the entire file with:

```typescript
import { execSync } from 'child_process';

export interface CostManagementConfig {
  subscriptionId: string;
}

export interface Config {
  retailCurrency: string;
  costManagement: CostManagementConfig | null;
}

function resolveSubscriptionId(): string | null {
  if (process.env.AZURE_SUBSCRIPTION_ID) return process.env.AZURE_SUBSCRIPTION_ID;
  try {
    return execSync('az account show --query id --output tsv', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  const subscriptionId = resolveSubscriptionId();
  const costManagement = subscriptionId ? { subscriptionId } : null;

  if (!costManagement) {
    console.error(
      "[azure-cost-mcp] No Azure subscription found. Set AZURE_SUBSCRIPTION_ID or run 'az login'."
    );
  }

  return {
    retailCurrency: process.env.AZURE_RETAIL_DEFAULT_CURRENCY ?? 'USD',
    costManagement,
  };
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- env.test
```

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/config/env.ts src/config/env.test.ts
git commit -m "feat: resolve subscription from env or az cli, remove SP fields from config"
```

---

### Task 4: Update `cost-management.client.ts` call site

**Files:**

- Modify: `src/clients/cost-management.client.ts`
- Modify: `src/clients/cost-management.client.test.ts`

**Step 1: Update the call sites in `cost-management.client.ts`**

In `src/clients/cost-management.client.ts`, there are three `getAccessToken(config)` calls. Change each one to `getAccessToken()` (remove the `config` argument).

The function signatures themselves (`queryUsage`, `getForecast`, `listBudgets`) still accept `config: CostManagementConfig` because they need `config.subscriptionId` for URL construction.

Find these three lines:

```typescript
const token = await getAccessToken(config);
```

Replace all three with:

```typescript
const token = await getAccessToken();
```

**Step 2: Update the config fixture in `cost-management.client.test.ts`**

On line 36, change:

```typescript
const config = { tenantId: 't', clientId: 'c', clientSecret: 's', subscriptionId: 'sub-1' };
```

To:

```typescript
const config = { subscriptionId: 'sub-1' };
```

**Step 3: Run tests**

```bash
npm test -- cost-management.client
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/clients/cost-management.client.ts src/clients/cost-management.client.test.ts
git commit -m "fix: remove config arg from getAccessToken calls in cost-management client"
```

---

### Task 5: Update error messages and tool test fixtures

The `AUTH_MISSING` constant in each tool references the old SP env vars. Update it to guide users toward `az login` or `AZURE_SUBSCRIPTION_ID`. Also update the 4 tool test files to use the simplified config fixture and correct assertions.

**Files:**

- Modify: `src/tools/cost-management/query-costs.tool.ts`
- Modify: `src/tools/cost-management/query-costs-by-resource.tool.ts`
- Modify: `src/tools/cost-management/get-forecast.tool.ts`
- Modify: `src/tools/cost-management/list-budgets.tool.ts`
- Modify: `src/tools/cost-management/query-costs.tool.test.ts`
- Modify: `src/tools/cost-management/query-costs-by-resource.tool.test.ts`
- Modify: `src/tools/cost-management/get-forecast.tool.test.ts`
- Modify: `src/tools/cost-management/list-budgets.tool.test.ts`
- Modify: `src/utils/error-handler.ts`
- Modify: `src/utils/error-handler.test.ts`

**Step 1: Update `AUTH_MISSING` in all 4 tool files**

In each of the four tool files, find and replace the `AUTH_MISSING` constant:

Old (in all 4 tools):

```typescript
const AUTH_MISSING =
  `Cost Management credentials not configured. Set these environment variables:\n` +
  `  AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID\n` +
  `The service principal needs the "Cost Management Reader" role.`;
```

New (same in all 4 tools):

```typescript
const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs the "Cost Management Reader" role on the subscription.`;
```

**Step 2: Update `handleAuthError` in `src/utils/error-handler.ts`**

Find:

```typescript
if (err.status === 401 || err.status === 403) {
  return (
    `Authentication failed. Ensure these environment variables are set:\n` +
    `  AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID\n` +
    `The service principal needs the "Cost Management Reader" role.`
  );
}
```

Replace with:

```typescript
if (err.status === 401 || err.status === 403) {
  return (
    `Authentication failed. Run 'az login' or set AZURE_TENANT_ID, AZURE_CLIENT_ID, ` +
    `AZURE_CLIENT_SECRET.\nThe account needs the "Cost Management Reader" role.`
  );
}
```

**Step 3: Update tool test config fixtures (all 4 tool test files)**

In each of the four tool test files, find:

```typescript
const config = { tenantId: 't', clientId: 'c', clientSecret: 's', subscriptionId: 'sub-1' };
```

Replace with:

```typescript
const config = { subscriptionId: 'sub-1' };
```

**Step 4: Update test assertions for the `config = null` path**

In each of the four tool test files, find the test that checks the `null` config response. The assertion currently checks for `'AZURE_TENANT_ID'`. Change it to check for `'AZURE_SUBSCRIPTION_ID'`:

Old:

```typescript
it('returns setup instructions when config is null', async () => {
  const result = await ...Handler(..., null);
  expect(result).toContain('AZURE_TENANT_ID');
});
```

New:

```typescript
it('returns setup instructions when config is null', async () => {
  const result = await ...Handler(..., null);
  expect(result).toContain('AZURE_SUBSCRIPTION_ID');
});
```

Apply this change in all four tool test files:

- `query-costs.tool.test.ts` line 31
- `query-costs-by-resource.tool.test.ts` line 48
- `get-forecast.tool.test.ts` line 29
- `list-budgets.tool.test.ts` line 46

**Step 5: Update `error-handler.test.ts`**

The test for 401 errors still needs to find some auth guidance. The new message still contains `AZURE_TENANT_ID`, so that assertion passes. Only the 403 test needs reviewing:

Check that `src/utils/error-handler.test.ts` still passes — the 401 test checks `toContain('AZURE_TENANT_ID')` which our new message still includes. No change needed to these assertions.

**Step 6: Run all tests**

```bash
npm test
```

Expected: PASS (all tests).

**Step 7: Commit**

```bash
git add \
  src/tools/cost-management/query-costs.tool.ts \
  src/tools/cost-management/query-costs-by-resource.tool.ts \
  src/tools/cost-management/get-forecast.tool.ts \
  src/tools/cost-management/list-budgets.tool.ts \
  src/tools/cost-management/query-costs.tool.test.ts \
  src/tools/cost-management/query-costs-by-resource.tool.test.ts \
  src/tools/cost-management/get-forecast.tool.test.ts \
  src/tools/cost-management/list-budgets.tool.test.ts \
  src/utils/error-handler.ts
git commit -m "fix: update AUTH_MISSING messages and config fixtures for new auth model"
```

---

### Task 6: TypeScript build and final verification

**Step 1: Run TypeScript compiler**

```bash
npm run build
```

Expected: exits 0 with no errors. If there are type errors about `CostManagementConfig` having extra/missing fields, track them to the file and update the type usage.

**Step 2: Run the full test suite with coverage**

```bash
npm run test:coverage
```

Expected: all tests pass, coverage above 70% thresholds.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

**Step 4: Commit if there were any TypeScript fixes**

Only commit if step 1 required changes not already committed:

```bash
git add -p
git commit -m "fix: resolve TypeScript type errors after CostManagementConfig simplification"
```

**Step 5: Push to remote**

```bash
git push
```
