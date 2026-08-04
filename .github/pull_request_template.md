## Purpose

<!-- What does this pull request change, and why? Link the issue it closes. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Infrastructure (`infra/`, `azure.yaml`)
- [ ] Documentation
- [ ] Build, CI, or tooling

## How this was verified

<!-- Commands you ran and what you observed. -->

- [ ] Component build and tests pass locally
- [ ] `az bicep build --file infra/main.bicep` succeeds (if `infra/` changed)
- [ ] `azd up` and `azd down` still succeed end to end (if `infra/` or `azure.yaml` changed)

## Sample standards checklist

- [ ] No secrets, keys, connection strings, tenant IDs, or customer names are introduced
- [ ] New Azure resources authenticate with managed identity rather than keys
- [ ] New resources carry the `azd-env-name` tag; service hosts carry `azd-service-name`
- [ ] README and `docs/` are updated when behaviour or configuration changes
- [ ] All user-facing documentation is written in English
