import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchPrices', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env.AZURE_RETAIL_DEFAULT_CURRENCY;
  });

  function makeResponse(items: object[], nextPageLink?: string) {
    return {
      ok: true,
      json: async () => ({
        BillingCurrency: 'USD',
        CustomerEntityId: 'default',
        CustomerEntityType: 'Enterprise',
        Items: items,
        NextPageLink: nextPageLink ?? null,
        Count: items.length,
      }),
    };
  }

  const sampleItem = {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice: 0.096,
    unitPrice: 0.096,
    armRegionName: 'eastus',
    location: 'East US',
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'meter-1',
    meterName: 'D2s v5',
    productId: 'prod-1',
    skuId: 'sku-1',
    productName: 'Virtual Machines D Series',
    skuName: 'D2s v5',
    serviceName: 'Virtual Machines',
    serviceId: 'svc-1',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    armSkuName: 'Standard_D2s_v5',
  };

  it('fetches prices from the retail API', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem]));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].armSkuName).toBe('Standard_D2s_v5');
    expect(result.nextPageLink).toBeUndefined();
  });

  it('returns nextPageLink when present', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem], 'https://next-page'));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'");
    expect(result.nextPageLink).toBe('https://next-page');
  });

  it('respects limit option', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem, sampleItem, sampleItem]));
    const { fetchPrices } = await import('./retail-prices.client.js');
    const result = await fetchPrices("serviceName eq 'Virtual Machines'", { limit: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    const { fetchPrices } = await import('./retail-prices.client.js');
    await expect(fetchPrices("serviceName eq 'Nope'")).rejects.toThrow('HTTP 404');
  });

  it('puts the resolved default currency in the request URL', async () => {
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY = 'EUR';
    mockFetch.mockResolvedValueOnce(makeResponse([sampleItem]));
    const { fetchPrices } = await import('./retail-prices.client.js');
    await fetchPrices("serviceName eq 'Virtual Machines'");
    expect(String(mockFetch.mock.calls[0][0])).toContain('currencyCode=EUR');
  });
});

describe('resolveCurrency', () => {
  beforeEach(() => {
    delete process.env.AZURE_RETAIL_DEFAULT_CURRENCY;
  });

  it('defaults to USD', async () => {
    const { resolveCurrency } = await import('./retail-prices.client.js');
    expect(resolveCurrency()).toBe('USD');
  });

  it('honors AZURE_RETAIL_DEFAULT_CURRENCY when supported (case-insensitive)', async () => {
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY = 'eur';
    const { resolveCurrency } = await import('./retail-prices.client.js');
    expect(resolveCurrency()).toBe('EUR');
  });

  it('falls back to USD for unsupported currency (e.g. MXN)', async () => {
    const { resolveCurrency } = await import('./retail-prices.client.js');
    expect(resolveCurrency('MXN')).toBe('USD');
  });

  it('explicit request overrides the env default', async () => {
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY = 'EUR';
    const { resolveCurrency } = await import('./retail-prices.client.js');
    expect(resolveCurrency('GBP')).toBe('GBP');
  });
});
