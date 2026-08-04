# azure-cost-mcp

TypeScript MCP server giving Claude live access to Azure pricing (retail + cost management), paired with a companion Claude Code skill encoding reasoning patterns for those tools.

## Commands

- `npm install` — install dependencies
- `npm run build` — compile TypeScript → `dist/`
- `npm test` — run all tests (vitest)
- `npm run test:watch` — watch mode
- `npm run dev` — run with tsx (no build step)
- `npm run lint` — ESLint
- `npm run lint:fix` — ESLint with auto-fix
- `npm run format` — Prettier write
- `npm run format:check` — Prettier check (CI)

> **Note:** Task 1 (scaffolding) of the implementation plan is already complete.

## Critical: ESM `.js` imports

This is `"module": "Node16"`. All local imports require `.js` extensions at the source level:

```typescript
import { fetchPrices } from './retail-prices.client.js'; // ✓
import { fetchPrices } from './retail-prices.client'; // ✗ — will fail at runtime
```

## Implementation Plan

`docs/plans/2026-02-23-azure-cost-mcp-implementation.md` — 17 TDD tasks.
Use `superpowers:executing-plans` to execute task-by-task.

## Guidelines

- [Architecture & Tool Patterns](.claude/architecture.md)
- [Testing Guidelines](.claude/testing.md)
