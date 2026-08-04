import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const SearchPricesSchema = z.strictObject({
  serviceName: z.string().optional().describe('e.g. "Virtual Machines"'),
  serviceFamily: z.string().optional().describe('e.g. "Compute"'),
  armRegionName: z.string().optional().describe('e.g. "eastus"'),
  skuName: z.string().optional().describe('partial match, e.g. "D2s v5"'),
  armSkuName: z.string().optional().describe('exact SKU, e.g. "Standard_D2s_v5"'),
  priceType: z.enum(['Consumption', 'Reservation', 'DevTest']).optional(),
  currencyCode: z.string().optional().default('USD'),
  limit: z.number().int().min(1).max(200).optional().default(50),
  nextPageLink: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type SearchPricesParams = z.input<typeof SearchPricesSchema>;

export async function searchPricesHandler(params: SearchPricesParams): Promise<string> {
  try {
    const clauses = [
      params.serviceName && { field: 'serviceName', op: 'eq' as const, value: params.serviceName },
      params.serviceFamily && {
        field: 'serviceFamily',
        op: 'eq' as const,
        value: params.serviceFamily,
      },
      params.armRegionName && {
        field: 'armRegionName',
        op: 'eq' as const,
        value: params.armRegionName,
      },
      params.armSkuName && { field: 'armSkuName', op: 'eq' as const, value: params.armSkuName },
      params.priceType && { field: 'priceType', op: 'eq' as const, value: params.priceType },
    ].filter(Boolean) as { field: string; op: 'eq'; value: string }[];

    const filter = buildFilter(clauses);
    const { items, nextPageLink } = await fetchPrices(filter, {
      currencyCode: params.currencyCode,
      limit: params.limit,
      nextPageLink: params.nextPageLink,
    });

    if (items.length === 0) return 'No results found. Try broader filter parameters.';

    const rows = items.map((item) => ({
      armSkuName: item.armSkuName,
      skuName: item.skuName,
      region: item.armRegionName,
      retailPrice: `$${item.retailPrice}`,
      unitOfMeasure: item.unitOfMeasure,
      type: item.type,
    }));

    if (params.response_format === 'json') {
      return formatAsJSON({ items: rows, nextPageLink });
    }

    const summary = nextPageLink
      ? `${items.length} results shown. Pass nextPageLink to fetch more.`
      : `${items.length} results.`;
    return formatAsMarkdown(rows, { summary });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_search_prices',
    'Search Azure retail prices with OData filters. Use for ad-hoc price lookups.',
    SearchPricesSchema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await searchPricesHandler(params) }],
    })
  );
}
