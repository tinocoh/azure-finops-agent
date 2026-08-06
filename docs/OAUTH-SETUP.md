# OAuth setup

Azure FinOps Agent can use Microsoft Entra ID for user sign-in.

## Configuration

The infrastructure template exposes the following settings:

| Setting | Purpose |
| --- | --- |
| `AZURE_CLIENT_APP_ID` | Entra application client ID for user sign-in |
| `Microsoft__ClientId` | Application setting consumed by the .NET agent |
| `Microsoft__TenantId` | Tenant ID used for sign-in |
| `Microsoft__HomeTenantId` | Home tenant validation setting |

## Local development

For local development, use a development Entra app registration and configure redirect URIs for
the local agent URL.

## Production guidance

- Use a tenant-specific app registration.
- Prefer managed identity and federated credentials for service-to-service access.
- Keep user-delegated permissions read-only.
- Grant only Reader and Cost Management Reader roles where possible.
- Do not store client secrets in source control.
