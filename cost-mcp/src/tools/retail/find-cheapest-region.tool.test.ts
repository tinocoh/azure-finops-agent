import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../clients/retail-prices.client.js', () => ({ fetchPrices: vi.fn() }));
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { findCheapestRegionHandler } from './find-cheapest-region.tool.js';

const mockFetch = vi.mocked(fetchPrices);

function makeItem(armSkuName: string, armRegionName: string, retailPrice: number) {
  return {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice,
    unitPrice: retailPrice,
    armRegionName,
    location: armRegionName,
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'm',
    meterName: armSkuName,
    productId: 'p',
    skuId: 's',
    productName: 'VMs',
    skuName: armSkuName,
    serviceName: 'Virtual Machines',
    serviceId: 'sv',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    armSkuName,
  };
}

describe('findCheapestRegionHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns regions sorted by price ascending', async () => {
    mockFetch.mockResolvedValueOnce({
      items: [
        makeItem('Standard_D2s_v5', 'westeurope', 0.11),
        makeItem('Standard_D2s_v5', 'eastus', 0.096),
        makeItem('Standard_D2s_v5', 'southeastasia', 0.105),
      ],
    });
    const result = await findCheapestRegionHandler({ armSkuName: 'Standard_D2s_v5' });
    const lines = result.split('\n');
    // eastus (cheapest) should appear before westeurope (most expensive)
    const eastusIdx = lines.findIndex((l) => l.includes('eastus'));
    const westeuropeIdx = lines.findIndex((l) => l.includes('westeurope'));
    expect(eastusIdx).toBeLessThan(westeuropeIdx);
  });

  it('respects topN parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      items: [
        makeItem('Standard_D2s_v5', 'westeurope', 0.11),
        makeItem('Standard_D2s_v5', 'eastus', 0.096),
        makeItem('Standard_D2s_v5', 'southeastasia', 0.105),
      ],
    });
    const result = await findCheapestRegionHandler({
      armSkuName: 'Standard_D2s_v5',
      topN: 2,
    });
    expect(result).toContain('eastus');
    expect(result).toContain('southeastasia');
    expect(result).not.toContain('westeurope');
  });

  it('returns no-results message when empty', async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });
    const result = await findCheapestRegionHandler({ armSkuName: 'Unknown_SKU' });
    expect(result).toContain('No pricing data');
  });
});
