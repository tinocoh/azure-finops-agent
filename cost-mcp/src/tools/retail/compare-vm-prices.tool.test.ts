import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../clients/retail-prices.client.js', () => ({ fetchPrices: vi.fn() }));
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { compareVmPricesHandler } from './compare-vm-prices.tool.js';

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

describe('compareVmPricesHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns comparison matrix with monthly cost', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Standard_D2s_v5', 'eastus', 0.096)] })
      .mockResolvedValueOnce({ items: [makeItem('Standard_D4s_v5', 'eastus', 0.192)] });
    const result = await compareVmPricesHandler({
      skuNames: ['Standard_D2s_v5', 'Standard_D4s_v5'],
      regions: ['eastus'],
    });
    expect(result).toContain('Standard_D2s_v5');
    expect(result).toContain('70.08'); // 0.096 * 730
  });
});
