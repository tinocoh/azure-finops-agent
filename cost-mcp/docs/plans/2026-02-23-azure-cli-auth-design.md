# Design: DefaultAzureCredential Auth (Azure CLI + Service Principal)

**Date:** 2026-02-23
**Status:** Approved

## Problem

The MCP server currently only supports service principal auth (client ID + secret + tenant ID via MSAL). Users who are already logged in via `az login` must redundantly configure env vars. Managed Identity is declared in config but never implemented.

## Goal

Zero-config authentication: if the user has run `az login`, cost management tools work immediately. If service principal env vars are set, they are used automatically. The subscription ID can also be resolved from the active CLI context rather than requiring an explicit env var.

## Architecture

The change is scoped to the auth and config layers. Tools and clients are untouched except for the removal of `clientId`/`clientSecret`/`tenantId` from the `CostManagementConfig` type.

```
Before:
  env.ts → CostManagementConfig{tenantId,clientId,clientSecret,subscriptionId}
         → azure-auth.ts (MSAL ConfidentialClientApplication)

After:
  env.ts → CostManagementConfig{subscriptionId}
         → azure-auth.ts (DefaultAzureCredential)
             ├─ EnvironmentCredential (reads AZURE_TENANT_ID, CLIENT_ID, CLIENT_SECRET if set)
             ├─ WorkloadIdentityCredential
             ├─ ManagedIdentityCredential
             └─ AzureCliCredential  ← picks up 'az login' sessions
```

## Components

| File                                    | Change                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`                          | Remove `@azure/msal-node`, add `@azure/identity`                                                                                                                                                       |
| `src/config/env.ts`                     | `CostManagementConfig` drops `tenantId/clientId/clientSecret`; subscription ID resolution (env var → `az account show`); startup warning if neither resolves; remove unused `useManagedIdentity` field |
| `src/auth/azure-auth.ts`                | Replace `ConfidentialClientApplication` with `DefaultAzureCredential`; `getAccessToken()` takes no arguments; credential is module-level singleton                                                     |
| `src/clients/cost-management.client.ts` | `getAccessToken(config)` → `getAccessToken()`                                                                                                                                                          |
| `src/config/env.test.ts`                | Tests for all three subscription resolution paths                                                                                                                                                      |
| `src/auth/azure-auth.test.ts`           | New file: mock `DefaultAzureCredential`, test success and `CredentialUnavailableError` paths                                                                                                           |

## Data Flow

### Startup — subscription ID resolution (once, in `loadConfig()`)

1. Read `AZURE_SUBSCRIPTION_ID` from env.
2. If not set → run `az account show --query id --output tsv`.
3. If that fails → log `"[azure-cost-mcp] No subscription found. Set AZURE_SUBSCRIPTION_ID or run 'az login'."` and set `costManagement = null`.
4. If resolved → `costManagement = { subscriptionId }`.

### Per-request — token acquisition (in `getAccessToken()`)

1. `DefaultAzureCredential.getToken("https://management.azure.com/.default")` tries its chain in order.
2. On failure → throws `CredentialUnavailableError` → `handleAuthError()` returns: `"Authentication failed. Run 'az login' or set AZURE_CLIENT_ID/SECRET/TENANT_ID."`.
3. On success → Bearer token used in Azure REST API calls (unchanged).

The `DefaultAzureCredential` instance is a module-level singleton; tokens are cached internally by the SDK.

## Error Handling

| Scenario                                             | Behavior                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| No subscription ID, no `az` CLI                      | Startup warning; `costManagement = null`; tools return `"Cost Management not configured."` |
| Subscription resolved, credential fails at call time | `handleAuthError()` wraps `CredentialUnavailableError` with guidance                       |
| `az account show` exits non-zero (not logged in)     | Caught; falls through to `costManagement = null`                                           |

## Testing

- **`env.test.ts`**: mock `child_process.execSync` for `az account show`; test env var path, CLI fallback path, and neither-present path.
- **`azure-auth.test.ts`** (new): mock `DefaultAzureCredential` via `vi.mock('@azure/identity')`; test successful token return and `CredentialUnavailableError` path.
- **Existing cost management tool tests**: remove `clientId/clientSecret/tenantId` from config fixtures — only `subscriptionId` remains.

## Backward Compatibility

Existing service principal users are unaffected. `DefaultAzureCredential`'s `EnvironmentCredential` reads `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` automatically — the same env vars previously required.
