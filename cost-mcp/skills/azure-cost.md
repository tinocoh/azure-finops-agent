---
name: azure-cost
description: Use when asked about Azure infrastructure costs, VM pricing, reservations, budgets, or architecture cost estimation. Activates routing rules and output conventions for the azure-cost-mcp tools.
---

# Azure Cost Analysis

## When to use this skill

Invoke when the user asks anything related to:

- Azure VM or service pricing ("how much does X cost?")
- Region comparison ("where is X cheapest?")
- Reservation vs pay-as-you-go decisions
- Architecture cost estimation
- Actual subscription spend or budgets

## Tool Selection

| User intent                           | Tool(s)                                     |
| ------------------------------------- | ------------------------------------------- |
| Price lookup for a specific SKU       | `azure_search_prices`                       |
| Compare VM SKUs side by side          | `azure_compare_vm_prices`                   |
| Find cheapest region for a SKU        | `azure_find_cheapest_region`                |
| Reservation vs PAYG decision          | `azure_compare_reservation_vs_payg`         |
| Multi-component architecture estimate | `azure_estimate_architecture_cost`          |
| Actual spend this month               | `azure_query_costs` (timeframe=MonthToDate) |
| Top resources by cost                 | `azure_query_costs_by_resource`             |
| Spending forecast                     | `azure_get_cost_forecast`                   |
| Budget status                         | `azure_list_budgets`                        |

## Required Comparisons

**Reservation rule:** Any recommendation involving a compute SKU (VM, AKS node, etc.) for a workload expected to run >6 months MUST include a call to `azure_compare_reservation_vs_payg`. Never recommend pay-as-you-go without showing reservation savings.

**Architecture estimates:** Always follow `azure_estimate_architecture_cost` with `azure_compare_reservation_vs_payg` for any compute-heavy components.

## Graceful Degradation

If a Cost Management tool returns an auth error or the config is missing:

1. State clearly: "Actual spend data is unavailable — showing retail price estimates instead."
2. Continue with retail pricing tools.
3. Tell the user: "To enable actual cost data, set these environment variables in your Claude Desktop config: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID. The service principal needs the Cost Management Reader role."

## Output Conventions

- Always show costs as **monthly AND annual** figures (never hourly only)
- Label confidence: **HIGH** (exact armSkuName match) / **MEDIUM** (fuzzy) / **LOW** (no match)
- Architecture estimates: show per-component breakdown, then totals
- Region comparisons: show delta as both dollar amount and percentage
- Default format: markdown tables
- Raw JSON only when user explicitly requests it
