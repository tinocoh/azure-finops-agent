---
description: "Audit read-only security enforcement and OAuth permissions for customer deployment"
---

Perform a complete security audit of this agent to verify it is strictly read-only. This is designed for customers cloning this project who want to independently verify the safety guarantees before deploying to their Azure tenant.

### 1. HTTP Method Enforcement

Scan `AzureQueryTools.cs` and confirm:

- Only `GET` and `POST` are accepted — `PUT`, `PATCH`, `DELETE` must be rejected (HTTP 400).
- POST requests are validated against the `SafePostSuffixes` allowlist.
- List every suffix in the allowlist and verify each is a read-only query/report endpoint.
- Search for any code path that could bypass the allowlist (e.g. direct `HttpClient` usage outside `HttpHelper`).

### 2. Graph and Log Analytics Tools

Scan `GraphQueryTools.cs` and confirm:

- Only `GET` requests are made — no method parameter exposed to the LLM.
- The URL is hardcoded to `https://graph.microsoft.com`.

Scan `LogAnalyticsQueryTools.cs` and confirm:

- Only `POST` to `/query` endpoints (`api.loganalytics.io` and `api.applicationinsights.io`).
- KQL is inherently read-only — no write commands exist in the Log Analytics query API.

### 3. OAuth Scopes

Scan `Program.cs` for all OAuth scopes requested during authentication. List every scope and confirm:

- All Microsoft Graph scopes are `.Read` variants (not `.ReadWrite`).
- Log Analytics scope is `Data.Read` (not `Data.ReadWrite`).
- ARM scope is `user_impersonation` — document that this is the only delegated scope ARM offers, and that read-only is enforced at the code level.

### 4. Setup Script

Scan `setup-entra-app.ps1` and confirm:

- All API permissions added are read-only (delegated `Scope` type, not application `Role` type).
- No admin-consent-required write permissions are configured.

### 5. Other Tools

Scan all remaining tool files (`ChartTools.cs`, `HealthTools.cs`, `FaqTools.cs`, `FollowUpTools.cs`, `HtmlPresentationTools.cs`) and confirm:

- No tool makes authenticated HTTP calls to Azure management APIs.
- Any external HTTP calls (e.g. RSS feeds, IndexNow) do not use Azure tokens.

### 6. HttpHelper

Scan `HttpHelper.cs` and confirm:

- It does not impose or bypass any method restrictions — it's a transport layer.
- Each tool controls what HTTP method is passed to it.

### 7. Token Context

Scan `TokenContext.cs` and confirm:

- Tokens are stored per-user with `volatile` fields for thread safety.
- No shared/global tokens that could leak across user sessions.

### Output

Print a summary table:

| Tool              | Methods Allowed | Write Capability | Scope |
| ----------------- | --------------- | ---------------- | ----- |
| QueryAzure        | ...             | ...              | ...   |
| QueryGraph        | ...             | ...              | ...   |
| QueryLogAnalytics | ...             | ...              | ...   |
| (etc.)            | ...             | ...              | ...   |

Then print the full list of OAuth scopes with their access level (read/write).

Flag any findings that deviate from read-only. If everything passes, confirm: **"All tools are verified read-only. Safe for customer deployment."**
