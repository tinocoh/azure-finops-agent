import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/advisor.client.js', () => ({ getRecommendations: vi.fn() }));
import { getRecommendations } from '../../clients/advisor.client.js';
import { getAdvisorRecommendationsHandler } from './get-recommendations.tool.js';

const mockGet = vi.mocked(getRecommendations);

describe('getAdvisorRecommendationsHandler', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns AUTH_MISSING when config is null', async () => {
    const out = await getAdvisorRecommendationsHandler({}, null);
    expect(out).toContain('No Azure subscription configured');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('formats recommendations as a markdown table', async () => {
    mockGet.mockResolvedValueOnce([
      { category: 'Cost', impact: 'High', resource: 'vm-1', problem: 'p', solution: 's', savings: '120 USD' },
    ]);
    const out = await getAdvisorRecommendationsHandler({ category: 'Cost' }, { subscriptionId: 'sub-1' });
    expect(out).toContain('| category |');
    expect(out).toContain('vm-1');
    expect(mockGet).toHaveBeenCalledWith({ subscriptionId: 'sub-1' }, 'Cost');
  });

  it('returns an empty-state message when there are no recommendations', async () => {
    mockGet.mockResolvedValueOnce([]);
    const out = await getAdvisorRecommendationsHandler({}, { subscriptionId: 'sub-1' });
    expect(out).toContain('No Azure Advisor recommendations');
  });

  it('supports JSON output', async () => {
    mockGet.mockResolvedValueOnce([
      { category: 'Performance', impact: 'Low', resource: 'r', problem: 'p', solution: 's' },
    ]);
    const out = await getAdvisorRecommendationsHandler(
      { response_format: 'json' },
      { subscriptionId: 'sub-1' }
    );
    expect(out.trim().startsWith('[')).toBe(true);
    expect(out).toContain('Performance');
  });
});
