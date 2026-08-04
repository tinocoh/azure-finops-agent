import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../clients/retail-prices.client.js', () => ({ fetchPrices: vi.fn() }));
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { compareReservationHandler } from './compare-reservation.tool.js';

const mockFetch = vi.mocked(fetchPrices);

function makeItem(type: string, retailPrice: number) {
  return {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice,
    unitPrice: retailPrice,
    armRegionName: 'eastus',
    location: 'East US',
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'm',
    meterName: 'D2s v5',
    productId: 'p',
    skuId: 's',
    productName: 'VMs',
    skuName: 'D2s v5',
    serviceName: 'Virtual Machines',
    serviceId: 'sv',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type,
    isPrimaryMeterRegion: true,
    armSkuName: 'Standard_D2s_v5',
  };
}

describe('compareReservationHandler', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calculates savings and break-even for 1yr and 3yr reservations', async () => {
    // PAYG = $0.096/hr, 1yr = $0.058/hr effective, 3yr = $0.038/hr effective
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Consumption', 0.096)] }) // PAYG
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.058)] }) // 1yr
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.038)] }); // 3yr

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
    });

    expect(result).toContain('0.096'); // PAYG hourly
    expect(result).toContain('0.058'); // 1yr hourly
    expect(result).toContain('0.038'); // 3yr hourly
  });

  it('returns monthly and annual figures', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Consumption', 0.096)] })
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.058)] })
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.038)] });

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
    });

    // PAYG monthly = 0.096 * 730 = 70.08
    expect(result).toContain('70.08');
  });

  it('handles missing reservation prices gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Consumption', 0.096)] })
      .mockResolvedValueOnce({ items: [] }) // no 1yr
      .mockResolvedValueOnce({ items: [] }); // no 3yr

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
    });

    expect(result).toContain('N/A');
  });

  it('returns an error message when no PAYG price is found', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [] }) // no PAYG
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

    const result = await compareReservationHandler({
      armSkuName: 'Unknown_SKU',
      armRegionName: 'eastus',
    });

    expect(result).toContain('No pay-as-you-go pricing found');
  });

  it('returns JSON when response_format is json', async () => {
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Consumption', 0.096)] })
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.058)] })
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.038)] });

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
      response_format: 'json',
    });

    const parsed = JSON.parse(result);
    expect(parsed[0]).toHaveProperty('option', 'Pay-As-You-Go');
  });

  it('shows N/A break-even when reservation costs more than PAYG', async () => {
    // reservation price higher than PAYG → no savings → break-even = null
    mockFetch
      .mockResolvedValueOnce({ items: [makeItem('Consumption', 0.05)] }) // cheap PAYG
      .mockResolvedValueOnce({ items: [makeItem('Reservation', 0.1)] }) // expensive reservation
      .mockResolvedValueOnce({ items: [] });

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
    });

    expect(result).toContain('N/A');
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));

    const result = await compareReservationHandler({
      armSkuName: 'Standard_D2s_v5',
      armRegionName: 'eastus',
    });

    expect(result).toContain('not found');
  });
});
