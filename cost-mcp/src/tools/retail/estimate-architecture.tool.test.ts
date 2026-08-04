import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../clients/retail-prices.client.js', () => ({ fetchPrices: vi.fn() }));
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { estimateArchitectureHandler } from './estimate-architecture.tool.js';

const mockFetch = vi.mocked(fetchPrices);

function makeItem(armSkuName: string, retailPrice: number, unitOfMeasure = '1 Hour') {
  return {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice,
    unitPrice: retailPrice,
    armRegionName: 'eastus',
    location: 'East US',
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
    unitOfMeasure,
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    armSkuName,
  };
}

describe('estimateArchitectureHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calculates per-component and total monthly cost', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Standard_D2s_v5', 0.096)] })
      .mockResolvedValueOnce({ items: [makeItem('Premium_LRS', 0.000135, '1 GB/Month')] });

    const result = await estimateArchitectureHandler({
      components: [
        {
          component: 'App Server',
          armSkuName: 'Standard_D2s_v5',
          armRegionName: 'eastus',
        },
        {
          component: 'OS Disk',
          armSkuName: 'Premium_LRS',
          armRegionName: 'eastus',
          storageGB: 128,
        },
      ],
    });

    // VM: 0.096 * 730 = 70.08
    expect(result).toContain('70.08');
    // Storage: 0.000135 * 128 = 0.0173 (monthly direct from per-GB price)
    expect(result).toContain('App Server');
    expect(result).toContain('OS Disk');
  });

  it('assigns HIGH confidence when exact armSkuName match is returned', async () => {
    mockFetch.mockResolvedValueOnce({ items: [makeItem('Standard_D2s_v5', 0.096)] });

    const result = await estimateArchitectureHandler({
      components: [{ component: 'Server', armSkuName: 'Standard_D2s_v5', armRegionName: 'eastus' }],
    });

    expect(result).toContain('HIGH');
  });

  it('assigns LOW confidence when no pricing data returned', async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });

    const result = await estimateArchitectureHandler({
      components: [{ component: 'Unknown', armSkuName: 'Unknown_SKU', armRegionName: 'eastus' }],
    });

    expect(result).toContain('LOW');
  });

  it('includes total monthly and annual in output', async () => {
    mockFetch.mockResolvedValueOnce({ items: [makeItem('Standard_D2s_v5', 0.096)] });

    const result = await estimateArchitectureHandler({
      components: [{ component: 'Server', armSkuName: 'Standard_D2s_v5', armRegionName: 'eastus' }],
    });

    // Monthly total
    expect(result).toContain('70.08');
    // Annual total = 70.08 * 12 = 840.96
    expect(result).toContain('840.96');
  });
});
