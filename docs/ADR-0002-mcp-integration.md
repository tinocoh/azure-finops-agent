# ADR-0002 - MCP integration boundary

## Status

Accepted.

## Context

The agent needs Azure cost, pricing, budget, forecast, and optimization capabilities. Those
capabilities should remain reusable and testable outside the .NET web experience.

## Decision

Keep Azure cost intelligence in `cost-mcp/` and call it from the agent through the MCP protocol.
The agent is responsible for user experience, authentication context, and orchestration. The MCP
server is responsible for tool implementations and Azure cost/pricing API access.

## Consequences

- Cost intelligence can be tested independently with Node.js.
- The agent avoids duplicating cost-query logic.
- Tool calls are auditable and can be surfaced in the UX.
- Future clients can reuse the MCP server without depending on the .NET agent.
