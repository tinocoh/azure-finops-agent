import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const Schema = z.strictObject({
  armSkuName: z.string(),
  topN: z.number().int().min(1).max(20).optional().default(5),
  priceType: z.enum(['Consumption', 'Reservation']).optional().default('Consumption'),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

export async function findCheapestRegionHandler(params: Params): Promise<string> {
  try {
    const filter = buildFilter([
      { field: 'armSkuName', op: 'eq', value: params.armSkuName },
      { field: 'priceType', op: 'eq', value: params.priceType ?? 'Consumption' },
    ]);

    const { items } = await fetchPrices(filter, {
      currencyCode: params.currencyCode,
      limit: 200,
    });

    if (items.length === 0) {
      return `No pricing data found for SKU "${params.armSkuName}". Check the armSkuName is correct.`;
    }

    const sorted = [...items].sort((a, b) => a.retailPrice - b.retailPrice);
    const topN = params.topN ?? 5;
    const top = sorted.slice(0, topN);
    const cheapest = top[0].retailPrice;

    const rows = top.map((item) => {
      const monthly = (item.retailPrice * 730).toFixed(2);
      const delta =
        item.retailPrice === cheapest
          ? '–'
          : `+${(((item.retailPrice - cheapest) / cheapest) * 100).toFixed(1)}%`;
      return {
        region: item.armRegionName,
        hourlyPrice: `$${item.retailPrice}`,
        monthlyEstimate: `$${monthly}/mo`,
        vsCheapest: delta,
      };
    });

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows, {
      summary: `Top ${top.length} cheapest regions for ${params.armSkuName} (${params.priceType ?? 'Consumption'}).`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_find_cheapest_region',
    'Find the cheapest Azure regions for a given VM SKU. Returns top N sorted by price.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await findCheapestRegionHandler(params) }],
    })
  );
}
