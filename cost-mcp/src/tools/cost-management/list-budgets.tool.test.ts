import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/cost-management.client.js', () => ({
  listBudgets: vi.fn(),
}));

import { listBudgets } from '../../clients/cost-management.client.js';
import { listBudgetsHandler } from './list-budgets.tool.js';

const mockList = vi.mocked(listBudgets);
const config = { subscriptionId: 'sub-1' };

function makeBudget(name: string, amount: number, currentSpend: number) {
  return {
    name,
    properties: {
      amount,
      currentSpend: { amount: currentSpend, unit: 'USD' },
    },
  };
}

function makeBudgetWithForecast(
  name: string,
  amount: number,
  currentSpend: number,
  forecastSpend: number
) {
  return {
    name,
    properties: {
      amount,
      timeGrain: 'Monthly',
      currentSpend: { amount: currentSpend, unit: 'USD' },
      forecastSpend: { amount: forecastSpend, unit: 'USD' },
    },
  };
}

describe('listBudgetsHandler', () => {
  beforeEach(() => mockList.mockReset());

  it('marks budget as CRITICAL when spend >= 90%', async () => {
    mockList.mockResolvedValueOnce([makeBudget('prod-budget', 1000, 920)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('CRITICAL');
  });

  it('marks budget as WARNING when spend >= 75%', async () => {
    mockList.mockResolvedValueOnce([makeBudget('dev-budget', 500, 400)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('WARNING');
  });

  it('marks budget as OK when spend < 75%', async () => {
    mockList.mockResolvedValueOnce([makeBudget('test-budget', 200, 50)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('OK');
  });

  it('marks budget AT_RISK when forecast exceeds amount but current spend is fine', async () => {
    mockList.mockResolvedValueOnce([makeBudgetWithForecast('prod', 1000, 300, 1200)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('AT_RISK');
    expect(result).toContain('$1200.00');
  });

  it('marks budget EXCEEDED when current spend is over the amount', async () => {
    mockList.mockResolvedValueOnce([makeBudgetWithForecast('over', 500, 600, 700)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('EXCEEDED');
  });

  it('returns setup instructions when config is null', async () => {
    const result = await listBudgetsHandler({}, null);
    expect(result).toContain('AZURE_SUBSCRIPTION_ID');
  });

  it('returns no-budgets message when list is empty', async () => {
    mockList.mockResolvedValueOnce([]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('No budgets found');
  });

  it('shows N/A percentage and OK status when budget amount is zero', async () => {
    mockList.mockResolvedValueOnce([makeBudget('zero-budget', 0, 0)]);
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('N/A%');
    expect(result).toContain('OK');
  });

  it('returns JSON when response_format is json', async () => {
    mockList.mockResolvedValueOnce([makeBudget('prod', 1000, 500)]);
    const result = await listBudgetsHandler({ response_format: 'json' }, config);
    const parsed = JSON.parse(result);
    expect(parsed[0]).toHaveProperty('status', 'OK');
  });

  it('handles errors by returning error message', async () => {
    mockList.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const result = await listBudgetsHandler({}, config);
    expect(result).toContain('AZURE_TENANT_ID');
  });
});
