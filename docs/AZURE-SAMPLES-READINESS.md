# Azure-Samples publication readiness

This document records (1) the characteristics observed across the most popular repositories in the
[Azure-Samples](https://github.com/Azure-Samples) GitHub organization, (2) how this repository
measured up against them, and (3) the checklist that must stay green for the sample to remain
published.

It is the reference used to bring this repository up to Azure-Samples standard. Keep it updated when
the upstream guidance changes.

## 1. Where the standard comes from

Azure-Samples repositories are not governed by informal convention — there is a written,
machine-validated standard for **azd templates**:

| Source | What it defines |
| --- | --- |
| [`Azure-Samples/azd-template-artifacts`](https://github.com/Azure-Samples/azd-template-artifacts) → `publishing-guidelines.md` | Who may publish, repo requirements, non-conformity levels and unpublishing SLAs |
| Same repo → `docs/development-guidelines/definition-of-done.md` | The concrete Definition of Done checklist |
| [`microsoft/template-validation-action`](https://github.com/microsoft/template-validation-action) | The automated validator that enforces the above on every push to `main` |
| [Make your project compatible with azd](https://learn.microsoft.com/azure/developer/azure-developer-cli/make-azd-compatible) | `azure.yaml` schema and infra requirements |

Reference implementations reviewed: `azure-search-openai-demo`, `contoso-chat`,
`rag-postgres-openai-python`, `todo-nodejs-mongo`, `get-started-with-ai-chat`,
`azure-search-openai-demo-csharp`.

### Non-conformity consequences

These are enforced, not advisory:

| Failing item | Level | Consequence |
| --- | --- | --- |
| `azd up` fails | **High** | Unpublished within **48 hours** |
| README missing required sections | Moderate | Unpublished within 7 days |
| Missing standard OSS files | Moderate | Unpublished within 7 days |
| Missing `.devcontainer` configuration | Moderate | Unpublished within 7 days |
| Managed identity not enabled for all services | Moderate | Unpublished within 7 days |
| `azd down` fails | Moderate | Unpublished within 7 days |
| Missing pipeline configuration | Low | Notification only |

## 2. Observed characteristics of popular Azure-Samples repositories

### 2.1 Repository-level

- **Public visibility** and **issues enabled** are hard prerequisites. Private/internal repos are
  only acceptable while the underlying product is itself under NDA.
- **Name** is lowercase with hyphens and describes use case plus stack
  (`rag-postgres-openai-python`, `azure-search-openai-demo-csharp`, `todo-nodejs-mongo`). The repo
  name, the README `urlFragment`, and `azure.yaml:name` all match.
- A one-sentence **description** is set in the GitHub "About" panel.
- **Topics** always include `azd-templates` and, for AI samples, `ai-azd-templates`, plus
  language and service topics (`python`, `dotnet`, `bicep`, `azure-openai`, ...).
- **English only.** No multi-language README pattern exists in the organization. Localization, when
  present, lives in application UI strings, never in the README.
- No customer names, tenant identifiers, engagement codes, or internal project names appear
  anywhere in the tree.

### 2.2 Root files

| File | Status | Notes |
| --- | --- | --- |
| `azure.yaml` | Required | Starts with the `yaml-language-server` schema comment; carries `name`, `metadata.template: <name>@<semver>`, and a `services:` map |
| `README.md` | Required | YAML front matter plus a fixed set of `h2` sections (§2.3) |
| `LICENSE` | Required | MIT, copyright holder is **`Azure Samples`**, not Microsoft Corporation |
| `CONTRIBUTING.md` | Required | Verbatim CLA paragraph plus Code of Conduct link |
| `SECURITY.md` | Required | Verbatim MSRC boilerplate, block version `V0.0.9`, at the **root** |
| `.gitignore` / `.gitattributes` | Standard | Present in every repo reviewed |
| `CHANGELOG.md`, `SUPPORT.md` | Optional | Present in some repos; harmless and useful to include |

`CODE_OF_CONDUCT.md` lives in `.github/`, not at the root. `SECURITY.md` and `CONTRIBUTING.md` live
at the root, not in `.github/`.

### 2.3 README structure

The README opens with an HTML-commented YAML front matter block consumed by the Microsoft Learn
sample gallery:

```yaml
---
page_type: sample
languages: [azdeveloper, csharp, typescript, python, bicep]
products: [azure, azure-openai, azure-app-service]
urlFragment: <must equal the repository name>
name: <human readable title>
description: <one sentence>
---
```

Immediately below it come the **Open in GitHub Codespaces** and **Open in Dev Containers** badges.

The validator checks that these appear as `h2` headings:

1. `## Important Security Notice`
2. `## Features`
3. `## Getting Started`
4. `## Guidance`
5. `## Resources`

In practice the observed ordering is: title → badges → *Important Security Notice* → overview →
*Features* (with an architecture diagram) → *Prerequisites* / *Cost estimation* → *Getting Started*
(Codespaces / Dev Containers / local) → *Deployment* → *Clean up* → *Guidance* (Region availability,
Costs, Security guidelines, *Resources*) → *Contributing* → *Trademarks*.

### 2.4 Infrastructure conventions

- `infra/main.bicep` uses **`targetScope = 'subscription'`** and creates the resource group itself.
- `param environmentName` and `param location` are declared, with `location` carrying
  `@metadata({ azd: { type: 'location' } })` so azd prompts for it.
- A deterministic name token is derived:
  `var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))`.
- `infra/abbreviations.json` maps resource types to Microsoft naming prefixes; resources are named
  `'${abbrs.keyVaultVaults}${resourceToken}'`.
- **Every** resource carries the tag `azd-env-name: <environmentName>`.
- The resource hosting each `azure.yaml` service carries `azd-service-name: <service key>`.
- `infra/main.parameters.json` binds parameters to azd environment variables using
  `"${AZURE_ENV_NAME}"` and `"${VAR=default}"` token syntax.
- **Keyless authentication with managed identity is mandatory** and enforced at Moderate level.
  Role assignments go through a small reusable `infra/core/security/role.bicep` module using
  built-in role definition GUIDs.
- `infra/main.test.bicep` provides a concrete instantiation so PSRule can analyze real resource
  properties; `infra/bicepconfig.json` enables the Bicep analyzers.

### 2.5 Developer environment

`.devcontainer/devcontainer.json` is required and must install the latest azd. It is based on an
`mcr.microsoft.com/devcontainers/*` image and always includes the
`ghcr.io/azure/azure-dev/azd:latest` feature, the `azure-cli` feature, and the
`ms-azuretools.azure-dev` VS Code extension. `.vscode/extensions.json` recommends the same set.

### 2.6 CI/CD

- `.github/workflows/azure-dev.yml` — deploys with azd using **federated OIDC credentials**
  (`permissions: id-token: write`, `Azure/setup-azd`, `azd auth login --federated-credential-provider github`).
  No client secrets are stored.
- `.github/workflows/azure-dev-validation.yaml` — runs `az bicep build` for linting and
  `microsoft/ps-rule` with `PSRule.Rules.Azure` and the `Azure.Pillar.Security` baseline, uploading
  SARIF to the GitHub Security tab.
- `.github/dependabot.yaml` — weekly updates, with the `github-actions` ecosystem always rooted at `/`.
- `.github/ISSUE_TEMPLATE/` and a pull request template.
- All jobs run on **GitHub-hosted runners** (`ubuntu-latest`). Self-hosted runners do not exist in
  the Azure-Samples organization.

## 3. Gap analysis for this repository

State of the repository before this work, and the resolution applied.

| # | Gap | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | Repository visibility was **internal**; Azure-Samples is a public organization | Blocking | Must be flipped to public at transfer time — see §5 |
| 2 | Customer identity and engagement code appeared in ~20 files including the README | Blocking | Replaced with neutral "regulated public-sector tenant" wording |
| 3 | Root README was written in Spanish | High | Rewritten in English to the standard structure |
| 4 | No `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md` at the root | High | Added with the verbatim Microsoft boilerplate |
| 5 | No `azure.yaml` — the repository was not an azd template at all | Blocking | Added at the root with all three services mapped |
| 6 | `infra/main.bicep` was resource-group scoped, with no `main.parameters.json`, no `abbreviations.json`, and no azd tags | High | Refactored to subscription scope with the full azd contract |
| 7 | No `.devcontainer/` or `.vscode/` | High | Added, including the `azd` dev container feature |
| 8 | CI targeted `[self-hosted, windows, x64]` runners | High | Moved to `ubuntu-latest` |
| 9 | Azurite emulator databases and large generated/demo media were committed | Medium | Emulator state removed and ignored; large media removed from the tracked tree and documented as local/generated assets |
| 10 | No `dependabot.yaml`, no PSRule validation workflow, no issue templates | Medium | All added |
| 11 | `CODEOWNERS` referenced placeholder account names | Low | Updated to a maintainers team reference |

## 4. Definition of Done checklist

### Repository management

- [x] README with the five required `h2` sections and YAML front matter
- [x] `LICENSE` (MIT, "Azure Samples")
- [x] `SECURITY.md`
- [x] `CONTRIBUTING.md`
- [x] `.github/CODE_OF_CONDUCT.md`
- [x] `.github/ISSUE_TEMPLATE/`
- [x] Topics `azd-templates` and `ai-azd-templates` applied
- [x] Description set in the GitHub "About" panel

### Source structure

- [x] `.github/workflows/azure-dev.yml`
- [x] `.devcontainer/devcontainer.json` installing the latest `azd`
- [x] `infra/` with `main.bicep`, `main.parameters.json`, `abbreviations.json`
- [x] `azure.yaml` at the root

### Functional

- [x] `az bicep build --file infra/main.bicep` succeeds
- [x] `azd up` provisions the template in a real subscription
- [x] `azd down --force --purge` tears everything down cleanly
- [ ] Dev container and Codespaces verified by hand
- [x] Component build and test jobs run in CI on GitHub-hosted runners

### Security

- [x] Managed identity used for every service; no keys or connection strings in configuration
- [x] PSRule security scan wired into CI (`Azure.Pillar.Security`)
- [x] Dependabot configuration added
- [ ] GitHub secret scanning and push protection enabled — *requires repository security settings*

## 5. Remaining actions that require repository administration

These cannot be completed from the source tree and must be done by a repository administrator as
part of the transfer:

1. **Azure-Samples review path.** The previously documented Microsoft Forms link now returns 404.
   Tracking issue: <https://github.com/Azure-Samples/azd-template-artifacts/issues/46>.
2. **Microsoft OSS portal review.** Prepare and submit the internal Microsoft open source
   publication packet. See [`OSS-PORTAL-PREP.md`](OSS-PORTAL-PREP.md).
3. **Transfer to Azure-Samples.** After the current review path is confirmed, transfer from the
   public staging repository to `Azure-Samples/azure-finops-agent`.

Completed admin actions:

- Repository renamed to `azure-finops-agent`.
- Public staging repository created at <https://github.com/tinocoh/azure-finops-agent>.
- `main` rewritten to a clean, customer-neutral root commit before publication.
- Issues, discussions, topics, description, homepage, Code Security, secret scanning, push
  protection, and Dependabot security updates enabled.
- Real `azd up` / `azd down --force --purge` executed against subscription
  `<VALIDATION_SUBSCRIPTION_ID>` with environment `<azd-validation-environment>`.
  The validation subscription has zero App Service VM quota, so the run used
  `DEPLOY_AGENT_SERVICE=false`; shared infrastructure provisioned successfully
  (resource group, Key Vault, Azure OpenAI + model deployment, VNet, Log Analytics,
  Application Insights) and was fully removed/purged.
