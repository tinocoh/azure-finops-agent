using AzureFinOps.Dashboard.Observability;
using Xunit;

namespace AzureFinOps.Dashboard.Tests;

/// <summary>
/// Tamper-evidence tests for the immutable audit trail (issue #6). These prove the
/// chain detects mutation, deletion, and reordering — the property regulated pilots rely
/// on to defend the audit log.
/// </summary>
public class AuditLogTests
{
    private static List<AuditEntry> Sample(out AuditLog log)
    {
        log = new AuditLog();
        return new List<AuditEntry>
        {
            log.Record("agent", "azure:GET", "/subscriptions", "allowed"),
            log.Record("agent", "azure:PATCH", "/rg/x", "blocked_readonly"),
            log.Record("agent", "bulk:DELETE", "/rg/y", "blocked_delete"),
        };
    }

    [Fact]
    public void First_entry_links_to_genesis_and_advances_head()
    {
        var log = new AuditLog();
        Assert.Equal(AuditLog.Genesis, log.HeadHash);

        var e = log.Record("agent", "azure:GET", "/subscriptions", "allowed");

        Assert.Equal(AuditLog.Genesis, e.PrevHash);
        Assert.NotEqual(AuditLog.Genesis, e.Hash);
        Assert.Equal(e.Hash, log.HeadHash);
    }

    [Fact]
    public void Untampered_chain_verifies()
    {
        var entries = Sample(out _);
        Assert.True(AuditLog.Verify(entries));
    }

    [Fact]
    public void Mutating_a_record_breaks_verification()
    {
        var entries = Sample(out _);
        // Attacker rewrites the decision on the blocked write to look allowed.
        entries[1] = entries[1] with { Decision = "allowed" };
        Assert.False(AuditLog.Verify(entries));
    }

    [Fact]
    public void Deleting_a_record_breaks_verification()
    {
        var entries = Sample(out _);
        entries.RemoveAt(1);
        Assert.False(AuditLog.Verify(entries));
    }

    [Fact]
    public void Reordering_records_breaks_verification()
    {
        var entries = Sample(out _);
        (entries[0], entries[1]) = (entries[1], entries[0]);
        Assert.False(AuditLog.Verify(entries));
    }

    [Fact]
    public void File_sink_appends_one_json_line_per_record()
    {
        var path = Path.Combine(Path.GetTempPath(), $"audit-{Guid.NewGuid():N}.log");
        try
        {
            var log = new AuditLog(path);
            log.Record("agent", "azure:GET", "/a", "allowed");
            log.Record("agent", "azure:PUT", "/b", "blocked_readonly");

            var lines = File.ReadAllLines(path);
            Assert.Equal(2, lines.Length);
            Assert.Contains("blocked_readonly", lines[1]);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
