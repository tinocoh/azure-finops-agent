import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/cost-management.client.js', () => ({
  queryUsage: vi.fn(),
}));

import { queryUsage } from '../../clients/cost-management.client.js';
import { getForecastHandler } from './get-forecast.tool.js';

const mockQuery = vi.mocked(queryUsage);
const config = { subscriptionId: 'sub-1' };
// Fixed "now" in February 2026 (28 days) for deterministic projections.
const now = new Date(Date.UTC(2026, 1, 2));

describe('getForecastHandler', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns setup instructions when config is null', async () => {
    const result = await getForecastHandler({}, null);
    expect(result).toContain('AZURE_SUBSCRIPTION_ID');
  });

  it('returns no-data message when there are no rows', async () => {
    mockQuery.mockResolvedValueOnce([]);
    const result = await getForecastHandler({}, config, now);
    expect(result).toContain('No cost data available to project');
  });

  it('projects month-end spend linearly from daily actuals', async () => {
    mockQuery.mockResolvedValueOnce([
      { Cost: 100, UsageDate: 20260201 },
      { Cost: 100, UsageDate: 20260202 },
    ]);
    const result = await getForecastHandler({}, config, now);
    // actual 200 over 2 of 28 days -> projected 2800, remaining 2600
    expect(result).toContain('Projected month-end spend');
    expect(result).toContain('$2800.00');
    expect(result).toContain('actual to date $200.00');
    expect(result).toContain('$2600.00');
    expect(result).toContain('2/28');
  });

  it('groups the projection by the requested dimension', async () => {
    mockQuery.mockResolvedValueOnce([
      { Cost: 100, ServiceName: 'Virtual Machines', UsageDate: 20260201 },
      { Cost: 40, ServiceName: 'Storage', UsageDate: 20260201 },
    ]);
    const result = await getForecastHandler({ groupBy: 'ServiceName' }, config, now);
    expect(mockQuery).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        dataset: expect.objectContaining({
          grouping: [{ type: 'Dimension', name: 'ServiceName' }],
        }),
      })
    );
    expect(result).toContain('Virtual Machines');
    expect(result).toContain('projectedMonthEnd');
  });

  it('returns JSON with projection and daily data', async () => {
    mockQuery.mockResolvedValueOnce([{ Cost: 50, UsageDate: 20260201 }]);
    const result = await getForecastHandler({ response_format: 'json' }, config, now);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('projection');
    expect(parsed.projection).toHaveProperty('projected');
  });

  it('handles errors by returning error message', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const result = await getForecastHandler({}, config, now);
    expect(result).toContain('AZURE_TENANT_ID');
  });
});
