export const RETAIL_API_BASE = 'https://prices.azure.com/api/retail/prices';
export const RETAIL_API_VERSION = '2023-01-01-preview';
export const COST_MGMT_API_BASE = 'https://management.azure.com';
export const CHARACTER_LIMIT = 25_000;

export const DEFAULT_RETAIL_CURRENCY = 'USD';

// Currencies accepted by the Azure Retail Prices API. NOTE: MXN is NOT supported by the
// API — Mexican deployments receive retail/list prices in USD, while ACTUAL tenant
// spend from Cost Management is already returned in the native billing currency (MXN).
export const SUPPORTED_RETAIL_CURRENCIES = new Set([
  'USD', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'DKK', 'EUR', 'GBP', 'INR',
  'JPY', 'KRW', 'NOK', 'NZD', 'RUB', 'SEK', 'TWD',
]);
