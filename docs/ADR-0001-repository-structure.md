# ADR-0001 - Repository structure

## Status

Accepted.

## Context

Azure FinOps Agent combines multiple implementation areas that need to be developed and validated
together:

- A .NET agent experience.
- A TypeScript MCP server for Azure cost intelligence.
- A Python/FastAPI + React analyzer.
- Bicep infrastructure and Azure Developer CLI (`azd`) configuration.

The project is intended for publication as an Azure sample, so the root repository must expose a
single coherent sample with shared documentation, validation, and release governance.

## Decision

Use a monorepo with top-level component folders:

| Folder | Purpose |
| --- | --- |
| `agent/` | .NET agent experience and web UI |
| `cost-mcp/` | Azure cost intelligence MCP server |
| `finopsazure-analyzer/` | Analyzer backend and frontend |
| `infra/` | Shared Bicep infrastructure for `azd` |
| `docs/` | Architecture, readiness, and release documentation |

## Consequences

- Root-level CI validates all components together.
- The `azure.yaml` file provides a single `azd` entry point.
- Azure-Samples and OSS review artifacts live at the root and apply to the full sample.
