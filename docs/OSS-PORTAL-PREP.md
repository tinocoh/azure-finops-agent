# Microsoft Open Source portal preparation

This document prepares the Microsoft Open Source portal submission for **Azure FinOps Agent**.
It complements the Azure-Samples readiness checklist in
[`AZURE-SAMPLES-READINESS.md`](AZURE-SAMPLES-READINESS.md).

## Purpose

The Azure-Samples submission path is currently paused until
[`Azure-Samples/azd-template-artifacts#46`](https://github.com/Azure-Samples/azd-template-artifacts/issues/46)
confirms the current review channel. In parallel, this document gathers the evidence and suggested
answers needed for the Microsoft Open Source portal.

The portal at <https://docs.opensource.microsoft.com/> requires Microsoft Entra authentication, so
this file avoids copying internal portal instructions. It records the public facts and validation
evidence that can be safely pasted into the portal.

## Current repository

| Field | Value |
| --- | --- |
| Public staging repository | <https://github.com/tinocoh/azure-finops-agent> |
| Intended final owner | `Azure-Samples` |
| Intended final repository name | `Azure-Samples/azure-finops-agent` |
| Template name | `azure-finops-agent` |
| Current visibility | Public |
| Microsoft contact / sponsor | `<MICROSOFT_SPONSOR_ALIAS>@microsoft.com` |
| GitHub account used for staging | `tinocoh` |
| Reason for personal staging | Microsoft Enterprise Managed User restrictions prevent the Microsoft-managed GitHub organization from hosting public repositories. |

## Suggested short description

Azure FinOps Agent is an Azure Developer CLI (`azd`) sample that demonstrates a keyless,
audit-safe FinOps assistant on Azure. It combines a .NET agent experience, an MCP server for Azure
cost intelligence, and a FastAPI/React analyzer for cost, inventory, Azure Advisor
recommendations, and optimization opportunities.

## Suggested long description

Azure FinOps Agent helps developers and solution teams understand how to build a secure,
deployment-ready FinOps assistant on Azure. The sample uses managed identities and RBAC for
service-to-service access, disables local Azure OpenAI key authentication, enables read-only mode
by default, and includes optional private networking for regulated environments.

The repository is structured as an `azd` template and includes the expected Azure-Samples assets:
`azure.yaml`, Bicep infrastructure, GitHub Actions CI, an azd validation workflow, a dev container,
Microsoft OSS community health files, and Azure-Samples README metadata.

## Public value

- Demonstrates a practical Azure FinOps architecture with AI-assisted analysis.
- Shows keyless Azure OpenAI and Key Vault access through managed identity.
- Provides a reusable MCP server for Azure cost, pricing, reservation, forecast, and budget data.
- Includes a working `azd` template that provisions Azure OpenAI, Key Vault, networking, and
  observability resources.
- Provides sample implementation patterns for audit-safe, read-only, regulated deployments.

## Target audience

- Azure solution architects and cloud solution architects.
- Developers building FinOps tools on Azure.
- FinOps practitioners evaluating AI-assisted optimization workflows.
- Teams building Azure OpenAI samples that need managed identity, RBAC, and `azd` deployment
  patterns.

## Scope and support expectations

This is a sample, not a production Microsoft product or service. It demonstrates architecture and
implementation patterns. It does not provide an SLA. Production use requires additional review,
hardening, cost governance, security validation, and operational ownership.

Support channels:

- GitHub Issues for bugs and feature requests.
- `SECURITY.md` / MSRC for security vulnerabilities.
- Azure support plans for production support of underlying Azure services.

## Repository readiness checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Public repository | Complete | <https://github.com/tinocoh/azure-finops-agent> |
| Issues enabled | Complete | Repository settings |
| Discussions enabled | Complete | Repository settings |
| MIT license | Complete | [`LICENSE`](../LICENSE) |
| Code of Conduct | Complete | [`.github/CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) |
| Contributing guidance / CLA text | Complete | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Security policy | Complete | [`SECURITY.md`](../SECURITY.md) |
| Support statement | Complete | [`SUPPORT.md`](../SUPPORT.md) |
| README metadata and required sections | Complete | [`README.md`](../README.md) |
| `azure.yaml` present | Complete | [`azure.yaml`](../azure.yaml) |
| Bicep infrastructure present | Complete | [`infra/`](../infra/) |
| Dev container present | Complete | [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json) |
| CI passing | Complete | GitHub Actions `CI` workflow |
| azd validation workflow passing | Complete | GitHub Actions `Validate AZD template` workflow |
| Real `azd up` / `azd down` performed | Complete | See validation notes below |
| Sensitive references removed | Complete | Full-tree and history scan completed with zero matches |
| Large generated assets removed | Complete | No tracked files larger than 5 MB |

## Real azd validation evidence

Validation was executed against Azure subscription `<VALIDATION_SUBSCRIPTION_ID>` using
environment `<azd-validation-environment>`.

Because that validation subscription has zero App Service VM quota, the run used:

```bash
azd env set DEPLOY_AGENT_SERVICE false
```

With that quota-limited validation mode, `azd up` successfully provisioned:

- Resource group
- Key Vault
- Azure OpenAI account
- Azure OpenAI model deployment (`gpt-4.1-mini`)
- Virtual network
- Log Analytics workspace
- Application Insights

Cleanup was completed with:

```bash
azd down --force --purge
```

The validation resource group `rg-<azd-validation-environment>` no longer exists.

Normal users should leave `DEPLOY_AGENT_SERVICE=true` so the App Service agent is deployed.

## Security and privacy posture

- Azure OpenAI local key authentication is disabled.
- Azure service access uses managed identity and RBAC.
- Default app posture is read-only through `FINOPS_READONLY=true`.
- Optional private networking is available through `ENABLE_PRIVATE_NETWORKING=true`.
- No customer names, tenant identifiers, or engagement codes are present in the public repository.
- Generated demo files are fake and seeded; large generated files are git-ignored.
- GitHub secret scanning and push protection are enabled on the public staging repository.

## Dependency status

Most dependency alerts were remediated. Two known open Dependabot alerts remain because the
patched versions referenced by GitHub Advisory are not published on npm at the time of writing:

| Package | Severity | Required patched version | Current status |
| --- | --- | --- | --- |
| `fast-uri` | High | `4.1.2` | npm returns 404 for `fast-uri@4.1.2` |
| `hono` | Medium | `4.12.34` | npm returns 404 for `hono@4.12.34` |

The repository should be updated as soon as these versions are published.

## Known limitations

- Final destination is expected to be `Azure-Samples`; current public repository is personal staging
  due to Enterprise Managed User restrictions.
- The Azure-Samples submission form documented in the older publishing guidance returns 404.
  Tracking issue: <https://github.com/Azure-Samples/azd-template-artifacts/issues/46>.
- Code Security could not be enabled on the personal GitHub account due billing/Advanced Security
  requirements. It should be enabled after transfer to the Microsoft-owned destination.
- The validation subscription used for `azd up` had zero App Service VM quota, so the recorded real
  deployment validated shared infrastructure with `DEPLOY_AGENT_SERVICE=false`.

## Suggested OSS portal answers

### Project name

Azure FinOps Agent

### Repository URL

<https://github.com/tinocoh/azure-finops-agent>

### Intended Microsoft-owned destination

`Azure-Samples/azure-finops-agent`

### Microsoft business owner

`<MICROSOFT_SPONSOR_ALIAS>@microsoft.com`

### License

MIT

### Project type

Sample / Azure Developer CLI template / Azure AI + FinOps reference implementation.

### Is this a new open source project?

Yes. It is a new sample intended for public publication and eventual transfer to `Azure-Samples`.

### Does it contain Microsoft confidential or customer data?

No. Direct customer references, engagement names, tenant identifiers, and generated emulator state
were removed. The public repository was scanned for sensitive references across the current tree
and public history.

### Does it include third-party dependencies?

Yes. Dependencies are declared in npm, NuGet, and pip manifests. Known remaining alerts are tracked
above and are blocked on unpublished npm patched versions.

### Does it collect telemetry?

The deployed sample provisions Application Insights and Log Analytics for observability. Users
control deployment and Azure resources in their own subscription. The sample does not send data to
a Microsoft-operated service beyond the Azure services the user provisions.

### Does it use AI-generated content?

The sample integrates Azure OpenAI for user-controlled FinOps analysis. The README includes a
Responsible AI note. Generated recommendations should be reviewed by a human before any production
change is applied.

### Why is the staging repository under a personal GitHub account?

The Microsoft-managed GitHub enterprise organization available to the owner is an Enterprise
Managed User environment that does not permit public repositories. A personal GitHub account is
used only as a temporary public staging location until the project can be reviewed and transferred
to `Azure-Samples`.

## Pre-submission checklist for the owner

- [ ] Sign in to <https://repos.opensource.microsoft.com/release> with `<MICROSOFT_SPONSOR_ALIAS>@microsoft.com`.
- [ ] Choose **Get release pre-approval**.
- [ ] Use this document as the submission packet.
- [ ] Include the Azure-Samples tracking issue:
  <https://github.com/Azure-Samples/azd-template-artifacts/issues/46>.
- [ ] Mention the personal staging repo is temporary and required by EMU restrictions.
- [ ] Ask whether an internal Microsoft-owned staging org is preferred before transfer to
  `Azure-Samples`.
- [ ] After OSS portal approval, continue Azure-Samples submission/transfer path.

## Exact OSS portal route and field guide

As of 2026-08-06, the current internal route is:

1. Go to <https://repos.opensource.microsoft.com/release>.
2. Choose **Get release pre-approval**.
3. The form opens at <https://repos.opensource.microsoft.com/releases>.
4. Complete the fields below.
5. Submit with **Submit pre-approval request**.

Use **Get release pre-approval**, not **Create a GitHub repository**, because the public staging
repository already exists at <https://github.com/tinocoh/azure-finops-agent>.

| Portal field | Recommended answer |
| --- | --- |
| Is this going to ship as a public open source-licensed project? | **Yes, creating an open source-licensed project** |
| What type of open source project will this be? | **Sample code** |
| What license will you be releasing with? | **MIT** |
| Did your team write all the code and create all of the assets you are releasing? | **No, created by other teams** |
| Contains 3rd-party embedded open source code or components? | **No** |
| Contains Microsoft code owned by another Microsoft team? | **Yes, contains code owned by other teams** |
| Details | `This sample integrates and adapts Microsoft-owned sample components: a .NET Azure FinOps agent experience, an Azure cost MCP server, and a FastAPI/React Azure FinOps analyzer. The public repository includes upstream attribution and keeps the release under MIT. The intended final destination is Azure-Samples/azure-finops-agent after OSS and Azure-Samples review.` |
| Does this project send any data or telemetry back to Microsoft? | **Yes, telemetry** |
| Does this project implement cryptography? | **No** |
| Please confirm where your project will be published | **GitHub** |
| Project name | `Azure FinOps Agent` |
| Project version | `0.1.0` |
| Project description | See suggested project description below. |
| Business goals | See suggested business goals below. |
| Will this be used in a Microsoft product or service? | `No production Microsoft product or service dependency. This is intended as public Azure sample code and an Azure Developer CLI template for eventual publication under Azure-Samples.` |

### Suggested project description for the portal

```text
Azure FinOps Agent is an Azure Developer CLI (azd) sample that demonstrates how to build a secure, keyless, audit-safe FinOps assistant on Azure. It combines a .NET agent experience, an MCP server for Azure cost intelligence, and a FastAPI/React analyzer for cost, inventory, Azure Advisor recommendations, and optimization opportunities.

The sample provisions Azure OpenAI, Key Vault, virtual networking, Log Analytics, and Application Insights using Bicep and azd. It uses managed identity and RBAC for service-to-service access, disables Azure OpenAI local key authentication, and enables read-only operation by default.
```

### Suggested business goals for the portal

```text
The goal is to publish a standards-compliant Azure sample that helps customers, partners, and Microsoft field teams understand how to build AI-assisted FinOps experiences on Azure using secure-by-default patterns.

The sample demonstrates Azure Developer CLI template structure, managed identity, RBAC, Azure OpenAI, Key Vault, Azure Monitor, and Azure cost optimization workflows. It is intended to become Azure-Samples/azure-finops-agent after Microsoft OSS portal approval and Azure-Samples review.

The repository is currently staged publicly at https://github.com/tinocoh/azure-finops-agent because Enterprise Managed User restrictions prevent the Microsoft-managed GitHub organization available to the owner from hosting public repositories. The staging repo has a clean public history, OSS community files, CI, azd validation, and documented real azd up/down validation.

Azure-Samples submission tracking issue: https://github.com/Azure-Samples/azd-template-artifacts/issues/46
```

## Notes on selected answers

- **Sample code** is the most accurate project type. The project uses Azure OpenAI but does not
  release an AI/ML model.
- **No 3rd-party embedded open source code** means no third-party source is vendored directly into
  the repository. Third-party dependencies are referenced through NuGet, npm, and pip manifests.
- **Yes, Microsoft code owned by another team** is the safest answer because this repo integrates
  and adapts Microsoft-owned sample components. The portal may route this for acknowledgment/review.
- **Yes, telemetry** is conservative because the sample provisions Application Insights and Log
  Analytics. Telemetry is deployed into the user's Azure subscription; the sample does not phone
  home to a Microsoft-operated product endpoint outside the Azure resources the user provisions.
- **No cryptography** means the project does not implement custom cryptographic algorithms. It uses
  standard platform TLS, Azure SDKs, and dependency libraries.
