import { describe, it, expect } from 'vitest';
import { buildFilter } from './odata-builder.js';

describe('buildFilter', () => {
  it('returns empty string for empty clauses', () => {
    expect(buildFilter([])).toBe('');
  });

  it('builds a single eq clause with quoted string', () => {
    expect(buildFilter([{ field: 'serviceName', op: 'eq', value: 'Virtual Machines' }])).toBe(
      "serviceName eq 'Virtual Machines'"
    );
  });

  it('joins multiple clauses with " and "', () => {
    expect(
      buildFilter([
        { field: 'serviceName', op: 'eq', value: 'Virtual Machines' },
        { field: 'armRegionName', op: 'eq', value: 'eastus' },
      ])
    ).toBe("serviceName eq 'Virtual Machines' and armRegionName eq 'eastus'");
  });

  it('supports ne operator', () => {
    expect(buildFilter([{ field: 'priceType', op: 'ne', value: 'DevTest' }])).toBe(
      "priceType ne 'DevTest'"
    );
  });
});
