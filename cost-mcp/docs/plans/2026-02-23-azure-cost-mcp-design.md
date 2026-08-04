# Azure Cost MCP — Design Document

**Date:** 2026-02-23
**Status:** Approved

---

## Overview

Two artifacts with distinct responsibilities:

1. **MCP server** (`azure-cost-mcp`) — live data access via Azure APIs
2. **Companion skill** (`~/.claude/skills/azure-cost.md`) — reasoning patterns for using the tools

The MCP answers *"what does this cost?"*
The skill answers *"how should I think about cost when helping a user?"*

---

## MCP Server

Fully specified in `plan.md`. No changes to that spec.

- 9 tools: 5 retail (no auth) + 4 cost management (Azure AD required)
- Transport: stdio
- Language: TypeScript, Node 20+
- APIs: Azure Retail Prices API + Azure Cost Management API

---

## Companion Skill

### Location

`~/.claude/skills/azure-cost.md` — global, available across all projects (not inside the repo).

### Trigger

Invoked when a user asks anything cost- or infrastructure-related:
- "How much will this architecture cost?"
- "Which VM should I use?"
- "Are we over budget?"

Pre-loads the reasoning framework before Claude calls any MCP tools.

### Tool Selection Decision Tree

| User intent | Tool(s) to call |
|---|---|
| "What does X VM cost?" | `azure_search_prices` |
| "Compare VM A vs VM B" | `azure_compare_vm_prices` |
| "Cheapest region for X" | `azure_find_cheapest_region` |
| "Should I use reservations?" | `azure_compare_reservation_vs_payg` |
| "Estimate cost of this architecture" | `azure_estimate_architecture_cost` + `azure_compare_reservation_vs_payg` for compute components |
| "What have we spent this month?" | `azure_query_costs` (MonthToDate) |
| "Which resources cost the most?" | `azure_query_costs_by_resource` |
| "Will we exceed budget?" | `azure_get_cost_forecast` + `azure_list_budgets` |
| "Are we on budget?" | `azure_list_budgets` |

### Mandatory Rules

**Reservation rule:** Any recommendation involving a VM or compute SKU must include a reservation comparison. Never recommend pay-as-you-go for workloads running >6 months without showing reservation savings.

**Degradation rule:** If Cost Management tools return an auth error:
1. Note that actual spend data is unavailable
2. Proceed with retail price estimates
3. Tell the user exactly which env vars to set (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`)

### Output Conventions

- Always show costs as **monthly + annual** (never just hourly)
- Always label confidence: `HIGH` (exact SKU match) / `MEDIUM` (fuzzy) / `LOW` (no match)
- For architecture estimates: show per-component breakdown, then total
- For region comparisons: show price delta as both absolute ($) and percentage
- Format: markdown tables by default; raw JSON only if user explicitly requests it

### Skill File Structure

```markdown
# Azure Cost Analysis — Usage Guide

## When to use this skill
## Tool selection
## Required comparisons (reservation rule)
## Graceful degradation (missing auth)
## Output conventions
## Example prompts → tool sequences
```

---

## Decision Rationale

A skill alone was rejected because it cannot make live HTTP requests to Azure APIs. An MCP alone was considered sufficient but leaves reasoning patterns implicit and inconsistent across sessions. The MCP + skill combination gives live data access with consistent, encoded best practices layered on top.
