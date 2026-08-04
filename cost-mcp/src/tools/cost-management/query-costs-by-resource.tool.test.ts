import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/cost-management.client.js', () => ({
  queryUsage: vi.fn(),
}));

import { queryUsage } from '../../clients/cost-management.client.js';
import { queryCostsByResourceHandler } from './query-costs-by-resource.tool.js';

const mockQuery = vi.mocked(queryUsage);

const config = { subscriptionId: 'sub-1' };

describe('queryCostsByResourceHandler', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns top-N resources sorted by cost descending', async () => {
    mockQuery.mockResolvedValueOnce([
      { Cost: 50.0, ResourceId: '/subscriptions/s/resourceGroups/rg/providers/vm/myvm' },
      { Cost: 200.0, ResourceId: '/subscriptions/s/resourceGroups/rg/providers/storage/mybucket' },
      { Cost: 10.0, ResourceId: '/subscriptions/s/resourceGroups/rg/providers/db/mydb' },
    ]);

    const result = await queryCostsByResourceHandler({ topN: 2 }, config);

    // Most expensive first
    const storageIdx = result.indexOf('mybucket');
    const vmIdx = result.indexOf('myvm');
    expect(storageIdx).toBeLessThan(vmIdx);
    // topN=2, so mydb (cheapest) excluded
    expect(result).not.toContain('mydb');
  });

  it('includes % of total spend', async () => {
    mockQuery.mockResolvedValueOnce([
      { Cost: 75.0, ResourceId: 'resource-a' },
      { Cost: 25.0, ResourceId: 'resource-b' },
    ]);

    const result = await queryCostsByResourceHandler({ topN: 10 }, config);
    // resource-a is 75% of total
    expect(result).toContain('75.0');
    expect(result).toContain('25.0');
  });

  it('returns setup instructions when config is null', async () => {
    const result = await queryCostsByResourceHandler({ topN: 10 }, null);
    expect(result).toContain('AZURE_SUBSCRIPTION_ID');
  });

  it('returns no-data message when rows are empty', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await queryCostsByResourceHandler({ topN: 10 }, config);
    expect(result).toContain('No resource cost data found');
  });

  it('returns JSON when response_format is json', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 100, ResourceId: 'my-resource' }]);
    const result = await queryCostsByResourceHandler({ topN: 10, response_format: 'json' }, config);
    const parsed = JSON.parse(result);
    expect(parsed[0]).toHaveProperty('resource', 'my-resource');
  });

  it('includes resourceGroup filter in query when provided', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 50, ResourceId: 'res-1' }]);
    await queryCostsByResourceHandler({ topN: 10, resourceGroup: 'rg-prod' }, config);
    expect(mockQuery).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        dataset: expect.objectContaining({
          filter: {
            dimensions: { name: 'ResourceGroup', operator: 'In', values: ['rg-prod'] },
          },
        }),
      })
    );
  });

  it('passes custom time period when timeframe is Custom', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 10, ResourceId: 'res-1' }]);
    await queryCostsByResourceHandler(
      { topN: 5, timeframe: 'Custom', startDate: '2026-01-01', endDate: '2026-01-31' },
      config
    );
    expect(mockQuery).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ timePeriod: { from: '2026-01-01', to: '2026-01-31' } })
    );
  });

  it('handles errors by returning error message', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const result = await queryCostsByResourceHandler({ topN: 10 }, config);
    expect(result).toContain('AZURE_TENANT_ID');
  });
});
