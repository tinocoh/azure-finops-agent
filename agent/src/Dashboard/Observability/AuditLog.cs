using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AzureFinOps.Dashboard.Observability;

/// <summary>
/// One immutable, tamper-evident audit record. Each entry is chained to the previous
/// one via <see cref="Hash"/> = SHA-256(prevHash + "\n" + payload), so any later edit,
/// reorder, or deletion breaks the chain and is detectable by <see cref="AuditLog.Verify"/>.
/// </summary>
public sealed record AuditEntry(
    string Timestamp,
    string Actor,
    string Action,
    string Target,
    string Decision,
    string? Detail,
    string PrevHash,
    string Hash);

/// <summary>
/// Append-only, hash-chained audit trail for the FinOps agent. Every security-relevant
/// decision (e.g. an Azure ARM method allowed or blocked by the read-only policy) is
/// recorded as an <see cref="AuditEntry"/> linked to the previous one. The chain is
/// tamper-evident: mutating, dropping, or reordering any record invalidates every hash
/// after it. Optionally mirrors entries as JSON lines to an append-only file
/// (AUDIT_LOG_PATH) for off-box retention required by regulated environments.
/// Thread-safe.
/// </summary>
public sealed class AuditLog
{
    public const string Genesis = "0000000000000000000000000000000000000000000000000000000000000000";

    private static readonly Lazy<AuditLog> _shared = new(() =>
        new AuditLog(Environment.GetEnvironmentVariable("AUDIT_LOG_PATH")));

    /// <summary>Process-wide audit log. File sink controlled by AUDIT_LOG_PATH.</summary>
    public static AuditLog Shared => _shared.Value;

    private readonly object _lock = new();
    private readonly string? _filePath;

    /// <summary>Hash of the most recent entry (or <see cref="Genesis"/> when empty).</summary>
    public string HeadHash { get; private set; } = Genesis;

    public AuditLog(string? filePath = null) => _filePath = filePath;

    public AuditEntry Record(string actor, string action, string target, string decision, string? detail = null)
    {
        lock (_lock)
        {
            var ts = DateTimeOffset.UtcNow.ToString("o");
            var payload = string.Join('|', ts, actor, action, target, decision, detail ?? "");
            var hash = Sha256Hex(HeadHash + "\n" + payload);
            var entry = new AuditEntry(ts, actor, action, target, decision, detail, HeadHash, hash);
            HeadHash = hash;

            if (!string.IsNullOrEmpty(_filePath))
            {
                try { File.AppendAllText(_filePath, JsonSerializer.Serialize(entry) + "\n"); }
                catch { /* never let audit persistence break a request; OTel still has the span */ }
            }

            return entry;
        }
    }

    /// <summary>
    /// Recomputes the chain over <paramref name="entries"/> (in order) and returns true only
    /// if every PrevHash/Hash links correctly from <see cref="Genesis"/>. Any tamper returns false.
    /// </summary>
    public static bool Verify(IEnumerable<AuditEntry> entries)
    {
        var prev = Genesis;
        foreach (var e in entries)
        {
            if (e.PrevHash != prev) return false;
            var payload = string.Join('|', e.Timestamp, e.Actor, e.Action, e.Target, e.Decision, e.Detail ?? "");
            var expected = Sha256Hex(prev + "\n" + payload);
            if (e.Hash != expected) return false;
            prev = e.Hash;
        }
        return true;
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(bytes);
    }
}
