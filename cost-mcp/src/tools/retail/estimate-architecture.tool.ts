import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const ComponentSchema = z.strictObject({
  component: z.string().describe('human label, e.g. "App Server"'),
  armSkuName: z.string(),
  armRegionName: z.string(),
  quantity: z.number().int().min(1).optional().default(1),
  usageHoursPerMonth: z.number().min(0).max(744).optional().default(730),
  storageGB: z.number().min(0).optional().default(0),
  priceType: z.enum(['Consumption', 'Reservation']).optional().default('Consumption'),
});

const Schema = z.strictObject({
  components: z.array(ComponentSchema).min(1).max(20),
  includeReservationAlternative: z.boolean().optional().default(false),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;
type Component = z.input<typeof ComponentSchema>;

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface ComponentResult {
  component: string;
  armSkuName: string;
  region: string;
  quantity: number;
  hourlyPrice: number | null;
  monthlyCost: number;
  annualCost: number;
  confidence: Confidence;
}

async function resolveComponent(comp: Component, currencyCode: string): Promise<ComponentResult> {
  const filter = buildFilter([
    { field: 'armSkuName', op: 'eq', value: comp.armSkuName },
    { field: 'armRegionName', op: 'eq', value: comp.armRegionName },
    { field: 'priceType', op: 'eq', value: comp.priceType ?? 'Consumption' },
  ]);

  const { items } = await fetchPrices(filter, { currencyCode, limit: 5 });

  const qty = comp.quantity ?? 1;
  const hours = comp.usageHoursPerMonth ?? 730;
  const storageGB = comp.storageGB ?? 0;

  if (items.length === 0) {
    return {
      component: comp.component,
      armSkuName: comp.armSkuName,
      region: comp.armRegionName,
      quantity: qty,
      hourlyPrice: null,
      monthlyCost: 0,
      annualCost: 0,
      confidence: 'LOW',
    };
  }

  // For storage items (per-GB pricing), use storageGB directly
  const storageItem = items.find((i) => i.unitOfMeasure.includes('GB'));
  const computeItem = items.find((i) => i.unitOfMeasure.includes('Hour')) ?? items[0];

  const monthlyCost =
    storageItem && storageGB > 0
      ? storageItem.retailPrice * storageGB * qty
      : computeItem.retailPrice * hours * qty;

  const exactMatch = items.some((i) => i.armSkuName === comp.armSkuName);
  const confidence: Confidence = exactMatch ? 'HIGH' : 'MEDIUM';

  return {
    component: comp.component,
    armSkuName: comp.armSkuName,
    region: comp.armRegionName,
    quantity: qty,
    hourlyPrice: computeItem.retailPrice,
    monthlyCost,
    annualCost: monthlyCost * 12,
    confidence,
  };
}

export async function estimateArchitectureHandler(params: Params): Promise<string> {
  try {
    const results = await Promise.all(
      params.components.map((c) => resolveComponent(c, params.currencyCode ?? 'USD'))
    );

    const totalMonthly = results.reduce((sum, r) => sum + r.monthlyCost, 0);
    const totalAnnual = totalMonthly * 12;

    const rows = results.map((r) => ({
      component: r.component,
      armSkuName: r.armSkuName,
      region: r.region,
      qty: String(r.quantity),
      monthly: r.monthlyCost > 0 ? `$${r.monthlyCost.toFixed(2)}` : '$0.00',
      annual: r.annualCost > 0 ? `$${r.annualCost.toFixed(2)}` : '$0.00',
      confidence: r.confidence,
    }));

    const summaryLine =
      `Total: $${totalMonthly.toFixed(2)}/mo · $${totalAnnual.toFixed(2)}/yr · ` +
      `${results.filter((r) => r.confidence === 'LOW').length} LOW confidence components`;

    if (params.response_format === 'json') {
      return formatAsJSON({ components: rows, totalMonthly, totalAnnual });
    }

    return formatAsMarkdown(rows, { summary: summaryLine });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_estimate_architecture_cost',
    'Estimate monthly and annual cost for a multi-component Azure architecture. Resolves prices in parallel.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await estimateArchitectureHandler(params) }],
    })
  );
}
