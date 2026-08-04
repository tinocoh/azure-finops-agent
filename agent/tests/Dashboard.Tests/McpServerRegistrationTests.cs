using System.Collections.Generic;
using GitHub.Copilot.SDK;
using AzureFinOps.Dashboard.AI;
using Xunit;

namespace AzureFinOps.Dashboard.Tests;

/// <summary>
/// Contract tests for the MCP registration of azure-cost-mcp (issues #4 / #9):
/// the agent must spawn it over stdio and inject the user's delegated token per session.
/// </summary>
public class McpServerRegistrationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Returns_null_when_path_not_configured(string? path)
    {
        Assert.Null(McpServerRegistration.Build(path, "tok", "sub"));
    }

    [Fact]
    public void Registers_stdio_server_with_node_command_and_path()
    {
        var map = McpServerRegistration.Build("/app/cost-mcp/dist/index.js", "user-token", "sub-123");

        Assert.NotNull(map);
        Assert.True(map!.ContainsKey(McpServerRegistration.ServerKey));
        var stdio = Assert.IsType<McpStdioServerConfig>(map[McpServerRegistration.ServerKey]);
        Assert.Equal("stdio", stdio.Type);
        Assert.Equal("node", stdio.Command);
        Assert.Contains("/app/cost-mcp/dist/index.js", stdio.Args);
    }

    [Fact]
    public void Injects_delegated_token_and_subscription()
    {
        var map = McpServerRegistration.Build("/x/index.js", "user-token", "sub-123");
        var stdio = (McpStdioServerConfig)map![McpServerRegistration.ServerKey];

        Assert.Equal("user-token", stdio.Env!["AZURE_ACCESS_TOKEN"]);
        Assert.Equal("sub-123", stdio.Env!["AZURE_SUBSCRIPTION_ID"]);
    }

    [Fact]
    public void Omits_token_when_anonymous()
    {
        var map = McpServerRegistration.Build("/x/index.js", null, null);
        var stdio = (McpStdioServerConfig)map![McpServerRegistration.ServerKey];

        Assert.False(stdio.Env!.ContainsKey("AZURE_ACCESS_TOKEN"));
        Assert.False(stdio.Env!.ContainsKey("AZURE_SUBSCRIPTION_ID"));
    }

    [Fact]
    public void Exposes_cost_tools_via_required_allowlist()
    {
        // Regression guard: the Copilot CLI surfaces NONE of a connected MCP server's
        // tools to the model unless McpStdioServerConfig.Tools names them.
        var map = McpServerRegistration.Build("/x/index.js", "tok", "sub");
        var stdio = (McpStdioServerConfig)map![McpServerRegistration.ServerKey];

        Assert.NotNull(stdio.Tools);
        Assert.NotEmpty(stdio.Tools!);
        Assert.Contains("azure_search_prices", stdio.Tools!);
        Assert.Contains("azure_query_costs", stdio.Tools!);
        Assert.Equal(McpServerRegistration.CostToolNames.Count, stdio.Tools!.Count);
    }
}
