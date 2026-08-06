# Hardening guidance

Azure FinOps Agent is designed as an audit-safe sample. Production use still requires a full
security review.

## Defaults

- `FINOPS_READONLY=true` keeps the agent in read-only mode.
- Azure OpenAI local key authentication is disabled.
- Azure access uses managed identity and RBAC.
- Key Vault uses RBAC authorization.
- Application telemetry is sent to the user's Application Insights resource.

## Recommended production controls

- Use private networking by setting `ENABLE_PRIVATE_NETWORKING=true`.
- Keep Azure RBAC scoped to Reader and Cost Management Reader where possible.
- Enable GitHub secret scanning and push protection.
- Review Application Insights retention and data handling policies.
- Validate all generated recommendations before applying changes.
- Treat this repository as a sample, not as a supported production service.
