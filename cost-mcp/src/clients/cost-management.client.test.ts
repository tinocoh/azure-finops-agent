import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/azure-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('queryUsage', () => {
  beforeEach(() => mockFetch.mockReset());

  const mockQueryResult = {
    id: '/subscriptions/sub-1/providers/Microsoft.CostManagement/query/result',
    name: 'result',
    type: 'Microsoft.CostManagement/query',
    properties: {
      nextLink: null,
      columns: [
        { name: 'Cost', type: 'Number' },
        { name: 'ServiceName', type: 'String' },
      ],
      rows: [
        [12.5, 'Virtual Machines'],
        [3.2, 'Storage'],
      ],
    },
  };

  it('returns normalized rows from query result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueryResult,
    });
    const { queryUsage } = await import('./cost-management.client.js');
    const config = { subscriptionId: 'sub-1' };
    const rows = await queryUsage(config, {
      type: 'ActualCost',
      timeframe: 'MonthToDate',
      dataset: {
        granularity: 'None',
        aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Cost: 12.5, ServiceName: 'Virtual Machines' });
  });
});
