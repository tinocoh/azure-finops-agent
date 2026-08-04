import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/cost-management.client.js', () => ({
  queryUsage: vi.fn(),
}));

import { queryUsage } from '../../clients/cost-management.client.js';
import { queryCostsHandler } from './query-costs.tool.js';

const mockQuery = vi.mocked(queryUsage);

const config = { subscriptionId: 'sub-1' };

describe('queryCostsHandler', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns formatted cost rows', async () => {
    mockQuery.mockResolvedValueOnce([
      { Cost: 120.5, ServiceName: 'Virtual Machines' },
      { Cost: 45.2, ServiceName: 'Storage' },
    ]);

    const result = await queryCostsHandler({ timeframe: 'MonthToDate' }, config);

    expect(result).toContain('Virtual Machines');
    expect(result).toContain('120.5');
  });

  it('returns setup instructions when config is null', async () => {
    const result = await queryCostsHandler({ timeframe: 'MonthToDate' }, null);
    expect(result).toContain('AZURE_SUBSCRIPTION_ID');
  });

  it('builds correct query body with groupBy', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 50, ResourceGroup: 'rg-prod' }]);

    await queryCostsHandler({ timeframe: 'MonthToDate', groupBy: ['ResourceGroup'] }, config);

    expect(mockQuery).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        type: 'ActualCost',
        timeframe: 'MonthToDate',
      })
    );
  });

  it('returns no-data message when rows are empty', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await queryCostsHandler({ timeframe: 'MonthToDate' }, config);
    expect(result).toContain('No cost data found');
  });

  it('returns JSON when response_format is json', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 50, ServiceName: 'Storage' }]);
    const result = await queryCostsHandler(
      { timeframe: 'MonthToDate', response_format: 'json' },
      config
    );
    expect(JSON.parse(result)).toHaveLength(1);
  });

  it('passes custom time period when timeframe is Custom', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 10, ServiceName: 'Storage' }]);
    await queryCostsHandler(
      { timeframe: 'Custom', startDate: '2026-01-01', endDate: '2026-01-31' },
      config
    );
    expect(mockQuery).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ timePeriod: { from: '2026-01-01', to: '2026-01-31' } })
    );
  });

  it('handles errors by returning error message', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const result = await queryCostsHandler({ timeframe: 'MonthToDate' }, config);
    expect(result).toContain('AZURE_TENANT_ID');
  });
});
