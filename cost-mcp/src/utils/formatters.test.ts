import { describe, it, expect } from 'vitest';
import { formatAsMarkdown, formatAsJSON } from './formatters.js';

describe('formatAsJSON', () => {
  it('returns pretty-printed JSON', () => {
    expect(formatAsJSON({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

describe('formatAsMarkdown', () => {
  it('renders a GFM table from array of objects', () => {
    const rows = [
      { name: 'Standard_D2s_v5', region: 'eastus', price: '0.096' },
      { name: 'Standard_D4s_v5', region: 'eastus', price: '0.192' },
    ];
    const result = formatAsMarkdown(rows);
    expect(result).toContain('| name |');
    expect(result).toContain('| Standard_D2s_v5 |');
    expect(result).toContain('| Standard_D4s_v5 |');
  });

  it('includes a summary line when provided', () => {
    const result = formatAsMarkdown([{ a: '1' }], { summary: '1 result found' });
    expect(result).toContain('1 result found');
  });

  it('returns _No results_ for empty array with no summary', () => {
    expect(formatAsMarkdown([])).toBe('_No results_');
  });

  it('returns summary text for empty array with summary', () => {
    expect(formatAsMarkdown([], { summary: 'Nothing here' })).toBe('_Nothing here_');
  });

  it('omits summary line when not provided', () => {
    const result = formatAsMarkdown([{ a: '1' }]);
    expect(result).not.toContain('_');
  });
});
