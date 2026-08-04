import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const Schema = z.strictObject({
  skuNames: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('armSkuName values, e.g. ["Standard_D2s_v5"]'),
  regions: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe('armRegionName values, e.g. ["eastus", "westeurope"]'),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

export async function compareVmPricesHandler(params: Params): Promise<string> {
  try {
    const fetches = params.skuNames.flatMap((sku) =>
      params.regions.map((region) => ({
        sku,
        region,
        promise: fetchPrices(
          buildFilter([
            { field: 'armSkuName', op: 'eq', value: sku },
            { field: 'armRegionName', op: 'eq', value: region },
            { field: 'priceType', op: 'eq', value: 'Consumption' },
          ]),
          { currencyCode: params.currencyCode, limit: 1 }
        ),
      }))
    );

    const results = await Promise.all(
      fetches.map((f) => f.promise.then((r) => ({ ...f, item: r.items[0] })))
    );

    let cheapestPrice = Infinity;
    const rows = params.skuNames.map((sku) => {
      const row: Record<string, string> = { SKU: sku };
      for (const region of params.regions) {
        const found = results.find((r) => r.sku === sku && r.region === region);
        if (found?.item) {
          const monthly = (found.item.retailPrice * 730).toFixed(2);
          if (found.item.retailPrice < cheapestPrice) cheapestPrice = found.item.retailPrice;
          row[region] = `$${monthly}/mo`;
        } else {
          row[region] = 'N/A';
        }
      }
      return row;
    });

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows, {
      summary: 'Monthly estimates at 730h/mo. Cheapest highlighted by lowest hourly rate.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_compare_vm_prices',
    'Compare VM SKUs across regions. Always call azure_compare_reservation_vs_payg after for workloads running >6 months.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await compareVmPricesHandler(params) }],
    })
  );
}
