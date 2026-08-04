# Testing Guidelines

## Framework

Vitest (`npm test`). Test files: `src/**/*.test.ts`. Config: `vitest.config.ts`.

## TDD Workflow (mandatory)

Every task follows this sequence — no exceptions:

1. Write the failing test
2. Run it → confirm it fails with the expected error
3. Write minimal implementation to make it pass
4. Run it → confirm it passes
5. Commit

Never write implementation before the test exists.

## Mocking fetch

Use `vi.stubGlobal` for the global `fetch`:

```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// In test:
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ /* response shape */ }),
});
```

## Mocking modules

Use `vi.mock` at the top of the file (hoisted automatically):

```typescript
vi.mock('../../clients/retail-prices.client.js', () => ({
  fetchPrices: vi.fn(),
}));

import { fetchPrices } from '../../clients/retail-prices.client.js';
const mockFetch = vi.mocked(fetchPrices);
```

Note: the mock path must match the actual import path including `.js` extension.

## Mocking MSAL

```typescript
vi.mock('../auth/azure-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));
```

## Env var isolation

Always save and restore `process.env` in env config tests:

```typescript
const originalEnv = process.env;
beforeEach(() => { process.env = { ...originalEnv }; });
afterEach(() => { process.env = originalEnv; });
```

## Running tests

```bash
npm test                                    # all tests
npm test -- src/utils/odata-builder.test.ts # single file
npm test -- src/tools/retail/              # directory
npm run test:coverage                       # with coverage
```

## What to test

- All utility functions: full coverage (pure functions, easy to test)
- HTTP clients: mock fetch, test success + error + edge cases
- Tool handlers: mock the client, test output formatting and error paths
- Entry point (`src/index.ts`): excluded from coverage (integration only)
