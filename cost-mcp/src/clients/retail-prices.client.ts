import { RETAIL_API_BASE, RETAIL_API_VERSION, DEFAULT_RETAIL_CURRENCY, SUPPORTED_RETAIL_CURRENCIES } from '../constants.js';
import type { PriceItem } from '../schemas/retail-prices.schema.js';
import { RetailPricesResponseSchema } from '../schemas/retail-prices.schema.js';

export interface FetchOptions {
  currencyCode?: string;
  limit?: number;
  nextPageLink?: string;
}

/**
 * Resolves the retail currency to use: explicit request > AZURE_RETAIL_DEFAULT_CURRENCY > USD.
 * Unsupported currencies (e.g. MXN, which the Retail Prices API does not accept) fall back to
 * USD so a localized deployment never silently fails on retail pricing lookups.
 */
export function resolveCurrency(requested?: string): string {
  const candidate = (
    requested ??
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY ??
    DEFAULT_RETAIL_CURRENCY
  ).toUpperCase();
  return SUPPORTED_RETAIL_CURRENCIES.has(candidate) ? candidate : DEFAULT_RETAIL_CURRENCY;
}

export async function fetchPrices(
  filter: string,
  options?: FetchOptions
): Promise<{ items: PriceItem[]; nextPageLink?: string }> {
  const url = options?.nextPageLink ?? buildUrl(filter, resolveCurrency(options?.currencyCode));
  const response = await fetchWithRetry(url);
  const data = RetailPricesResponseSchema.parse(await response.json());
  const items = options?.limit ? data.Items.slice(0, options.limit) : data.Items;
  return { items, nextPageLink: data.NextPageLink ?? undefined };
}

function buildUrl(filter: string, currencyCode: string): string {
  const params = new URLSearchParams({
    'api-version': RETAIL_API_VERSION,
    $filter: filter,
    currencyCode,
  });
  return `${RETAIL_API_BASE}?${params}`;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(url);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
      await sleep(retryAfter * 1000 * Math.pow(2, i));
      continue;
    }
    if (!response.ok) {
      const err = Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
        status: response.status,
      });
      throw err;
    }
    return response;
  }
  throw new Error(`Failed after ${attempts} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
