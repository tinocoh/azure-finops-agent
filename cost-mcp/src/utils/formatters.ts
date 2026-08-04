export type ResponseFormat = 'markdown' | 'json';

export function formatAsJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatAsMarkdown(
  rows: Record<string, unknown>[],
  options?: { summary?: string }
): string {
  if (rows.length === 0) return options?.summary ? `_${options.summary}_` : '_No results_';

  const headers = Object.keys(rows[0]);
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map((r) => `| ${headers.map((h) => String(r[h] ?? '')).join(' | ')} |`);

  const table = [headerRow, separator, ...dataRows].join('\n');
  return options?.summary ? `${table}\n\n_${options.summary}_` : table;
}
