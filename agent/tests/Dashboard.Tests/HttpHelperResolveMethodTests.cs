using System.Net.Http;
using AzureFinOps.Dashboard.Infrastructure;
using Xunit;

namespace AzureFinOps.Dashboard.Tests;

/// <summary>
/// Policy tests for the centralised method gate (HttpHelper.ResolveMethod) that every
/// pass-through Azure/Graph tool routes through. These lock in the audit-safe posture
/// for regulated pilots: no writes, no deletes, reads (GET + POST query endpoints) allowed.
/// Tests run sequentially within this class, so toggling FINOPS_READONLY is safe.
/// </summary>
public class HttpHelperResolveMethodTests : IDisposable
{
    private readonly string? _original = Environment.GetEnvironmentVariable("FINOPS_READONLY");

    private static void SetReadOnly(string? value) =>
        Environment.SetEnvironmentVariable("FINOPS_READONLY", value);

    public void Dispose() => SetReadOnly(_original);

    [Theory]
    [InlineData("GET")]
    [InlineData("POST")]
    public void Allows_reads_in_readonly_mode(string method)
    {
        SetReadOnly(null); // default = read-only ON
        var (resolved, error) = HttpHelper.ResolveMethod(method, null, "test");
        Assert.Null(error);
        Assert.NotNull(resolved);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    public void Blocks_writes_in_readonly_mode(string method)
    {
        SetReadOnly(null);
        var (resolved, error) = HttpHelper.ResolveMethod(method, null, "test");
        Assert.Null(resolved);
        Assert.NotNull(error);
        Assert.Contains("403", error);
        Assert.Contains("Read-only", error);
    }

    [Fact]
    public void Blocks_delete_even_when_writes_enabled()
    {
        SetReadOnly("false"); // writes allowed, but DELETE must still be blocked
        var (resolved, error) = HttpHelper.ResolveMethod("DELETE", null, "test");
        Assert.Null(resolved);
        Assert.NotNull(error);
        Assert.Contains("403", error);
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    public void Allows_writes_when_readonly_disabled(string method)
    {
        SetReadOnly("false");
        var (resolved, error) = HttpHelper.ResolveMethod(method, null, "test");
        Assert.Null(error);
        Assert.NotNull(resolved);
    }

    [Fact]
    public void Defaults_to_get_for_null_method()
    {
        SetReadOnly(null);
        var (resolved, error) = HttpHelper.ResolveMethod(null, null, "test");
        Assert.Null(error);
        Assert.Equal(HttpMethod.Get, resolved);
    }
}
