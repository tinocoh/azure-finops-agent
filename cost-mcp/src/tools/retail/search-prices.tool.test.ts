import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../clients/retail-prices.client.js', () => ({
  fetchPrices: vi.fn(),
}));

import { fetchPrices } from '../../clients/retail-prices.client.js';
import { searchPricesHandler } from './search-prices.tool.js';

const mockFetch = vi.mocked(fetchPrices);

const sampleItem = {
  currencyCode: 'USD',
  tierMinimumUnits: 0,
  retailPrice: 0.096,
  unitPrice: 0.096,
  armRegionName: 'eastus',
  location: 'East US',
  effectiveStartDate: '2024-01-01T00:00:00Z',
  meterId: 'm1',
  meterName: 'D2s v5',
  productId: 'p1',
  skuId: 's1',
  productName: 'Virtual Machines D Series',
  skuName: 'D2s v5',
  serviceName: 'Virtual Machines',
  serviceId: 'sv1',
  serviceFamily: 'Compute',
  unitOfMeasure: '1 Hour',
  type: 'Consumption',
  isPrimaryMeterRegion: true,
  armSkuName: 'Standard_D2s_v5',
};

describe('searchPricesHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns markdown table by default', async () => {
    mockFetch.mockResolvedValueOnce({ items: [sampleItem], nextPageLink: undefined });
    const result = await searchPricesHandler({ serviceName: 'Virtual Machines' });
    expect(result).toContain('Standard_D2s_v5');
    expect(result).toContain('|');
  });

  it('returns JSON when response_format is json', async () => {
    mockFetch.mockResolvedValueOnce({ items: [sampleItem], nextPageLink: undefined });
    const result = await searchPricesHandler({
      serviceName: 'Virtual Machines',
      response_format: 'json',
    });
    const parsed = JSON.parse(result);
    expect(parsed.items[0].armSkuName).toBe('Standard_D2s_v5');
  });

  it('returns no-results message when empty', async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });
    const result = await searchPricesHandler({ serviceName: 'Nonexistent' });
    expect(result).toContain('No results');
  });
});
