# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit <https://cla.opensource.microsoft.com>.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Repository layout

This is a monorepo. Each top-level folder is an independently buildable component:

| Folder | Component | Stack |
| --- | --- | --- |
| [`agent/`](agent/) | FinOps agent experience and orchestration layer | .NET 10 · Vue 3 |
| [`cost-mcp/`](cost-mcp/) | Azure cost intelligence MCP server | TypeScript · Node 20+ |
| [`finopsazure-analyzer/`](finopsazure-analyzer/) | Cost, inventory and Advisor analyzer | Python 3.12 · FastAPI · React |
| [`infra/`](infra/) | Bicep infrastructure for the whole solution | Bicep |
| [`docs/`](docs/) | Architecture decision records and guides | Markdown |

## Before you start

1. Open an issue describing the change. This avoids duplicate work and lets maintainers
   confirm the change fits the direction of the sample.
2. For anything that touches `infra/`, confirm `azd up` still succeeds end to end. A template
   whose `azd up` fails is removed from the gallery within 48 hours.

## Development workflow

Short-lived branches off `main`, one pull request per change, at least one approving review.
Direct pushes to `main` are disabled.

```bash
git switch -c feat/<area>-<short-description>
# ... make your change ...
git commit -m "feat(<area>): <what changed>"
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Building and testing locally

```bash
# Cost intelligence MCP server
cd cost-mcp && npm ci && npm run build && npm run lint && npm test

# Agent API and SPA
cd agent/src/Dashboard && dotnet build -c Release
cd agent/tests/Dashboard.Tests && dotnet test -c Release

# Analyzer
cd finopsazure-analyzer && docker compose up --build

# Infrastructure
az bicep build --file infra/main.bicep
```

All of the above run in CI on every pull request. Please make sure they pass locally first.

## Pull request checklist

- [ ] The change is covered by a test, or you explain why a test is not applicable.
- [ ] `az bicep build --file infra/main.bicep` succeeds if you touched `infra/`.
- [ ] README and `docs/` are updated when behaviour or configuration changes.
- [ ] No secrets, connection strings, customer names, or tenant identifiers are added.
- [ ] New Azure resources authenticate with managed identity, not keys.

## Reporting security issues

Please do not open a public issue. Follow the process in [SECURITY.md](SECURITY.md).
