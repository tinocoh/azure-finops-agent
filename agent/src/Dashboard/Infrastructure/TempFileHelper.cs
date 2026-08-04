using System.Collections.Concurrent;

namespace AzureFinOps.Dashboard.Infrastructure;

internal static class TempFileHelper
{
    internal static void CleanupOldFiles<T>(ConcurrentDictionary<string, T> files, Func<T, DateTime> getCreated, Func<T, string> getPath)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-30);
        foreach (var kvp in files)
        {
            if (getCreated(kvp.Value) < cutoff)
            {
                files.TryRemove(kvp.Key, out _);
                try { File.Delete(getPath(kvp.Value)); } catch { }
            }
        }
    }

    internal static string SanitizeFilename(string name, string fallback)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = new string(name.Where(c => !invalid.Contains(c)).ToArray());
        return string.IsNullOrWhiteSpace(sanitized) ? fallback : sanitized;
    }
}
