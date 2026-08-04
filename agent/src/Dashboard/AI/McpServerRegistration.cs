using System.Collections.Generic;
using GitHub.Copilot.SDK;

namespace AzureFinOps.Dashboard.AI;

/// <summary>
/// Pure, testable construction of the MCP server registration for the canonical
/// cost-intelligence engine (azure-cost-mcp). Kept separate from CopilotSessionFactory
/// (which needs a live CopilotClient) so the integration contract — stdio command,
/// args, and per-session delegated-token injection — can be unit-tested. See ADR-0002.
/// </summary>
public static class McpServerRegistration
{
    public const string ServerKey = "azure-cost";

    /// <summary>
    /// The tool names exposed by azure-cost-mcp. This list is REQUIRED: the GitHub Copilot
    /// CLI connects a configured MCP server but surfaces ZERO of its tools to the model
    /// unless they are named here (McpServerConfig.Tools is an allow-list; null/empty =
    /// none exposed). Verified empirically against the CLI. Tools reach the model namespaced
    /// as "azure-cost-&lt;name&gt;". Keep in sync with cost-mcp (see cost-mcp/scripts/mcp-smoke.mjs).
    /// </summary>
    public static readonly IReadOnlyList<string> CostToolNames = new[]
    {
        "azure_search_prices",
        "azure_compare_vm_prices",
        "azure_find_cheapest_region",
        "azure_compare_reservation_vs_payg",
        "azure_estimate_architecture_cost",
        "azure_query_costs",
        "azure_query_costs_by_resource",
        "azure_get_cost_forecast",
        "azure_list_budgets",
        "azure_get_advisor_recommendations",
    };

    /// <summary>
    /// Returns the MCP server map to register on a Copilot session, or null when
    /// <paramref name="costMcpPath"/> is not configured (integration disabled).
    /// The user's delegated Entra token (when present) is injected as AZURE_ACCESS_TOKEN
    /// so the stdio subprocess acts as the user; an optional subscription id is forwarded.
    /// </summary>
    public static IDictionary<string, McpServerConfig>? Build(
        string? costMcpPath,
        string? azureToken,
        string? subscriptionId)
    {
        if (string.IsNullOrWhiteSpace(costMcpPath))
            return null;

        var env = new Dictionary<string, string>();
        if (!string.IsNullOrEmpty(azureToken))
            env["AZURE_ACCESS_TOKEN"] = azureToken;
        if (!string.IsNullOrEmpty(subscriptionId))
            env["AZURE_SUBSCRIPTION_ID"] = subscriptionId;

        return new Dictionary<string, McpServerConfig>
        {
            [ServerKey] = new McpStdioServerConfig
            {
                Command = "node",
                Args = new List<string> { costMcpPath },
                Env = env,
                // REQUIRED allow-list — without it the CLI exposes none of the server's
                // tools to the model. See CostToolNames remarks above.
                Tools = CostToolNames.ToList(),
            },
        };
    }
}
