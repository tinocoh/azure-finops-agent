import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/azure-auth.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('getRecommendations (advisor client)', () => {
  beforeEach(() => mockFetch.mockReset());

  const sample = {
    value: [
      {
        properties: {
          category: 'Cost',
          impact: 'High',
          shortDescription: { problem: 'Underutilized virtual machine', solution: 'Resize or shut down' },
          resourceMetadata: {
            resourceId:
              '/subscriptions/x/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm-1',
          },
          extendedProperties: { savingsAmount: '120.50', savingsCurrency: 'USD' },
        },
      },
    ],
  };

  it('fetches and normalizes advisor recommendations', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => sample });
    const { getRecommendations } = await import('./advisor.client.js');
    const rows = await getRecommendations({ subscriptionId: 'sub-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: 'Cost',
      impact: 'High',
      resource: 'vm-1',
      savings: '120.50 USD',
    });
  });

  it('adds a Category $filter when a category is provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
    const { getRecommendations } = await import('./advisor.client.js');
    await getRecommendations({ subscriptionId: 'sub-1' }, 'Cost');
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('Microsoft.Advisor/recommendations');
    expect(decodeURIComponent(url)).toContain("Category eq 'Cost'");
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    const { getRecommendations } = await import('./advisor.client.js');
    await expect(getRecommendations({ subscriptionId: 'sub-1' })).rejects.toThrow('HTTP 403');
  });
});
