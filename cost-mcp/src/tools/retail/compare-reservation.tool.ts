import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchPrices } from '../../clients/retail-prices.client.js';
import { buildFilter } from '../../utils/odata-builder.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleApiError } from '../../utils/error-handler.js';

const Schema = z.strictObject({
  armSkuName: z.string(),
  armRegionName: z.string(),
  currencyCode: z.string().optional().default('USD'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

export async function compareReservationHandler(params: Params): Promise<string> {
  try {
    const baseFilter = [
      { field: 'armSkuName', op: 'eq' as const, value: params.armSkuName },
      { field: 'armRegionName', op: 'eq' as const, value: params.armRegionName },
    ];

    const [paygResult, oneYrResult, threeYrResult] = await Promise.all([
      fetchPrices(
        buildFilter([...baseFilter, { field: 'priceType', op: 'eq', value: 'Consumption' }]),
        {
          currencyCode: params.currencyCode,
          limit: 1,
        }
      ),
      fetchPrices(
        buildFilter([
          ...baseFilter,
          { field: 'priceType', op: 'eq', value: 'Reservation' },
          { field: 'reservationTerm', op: 'eq', value: '1 Year' },
        ]),
        { currencyCode: params.currencyCode, limit: 1 }
      ),
      fetchPrices(
        buildFilter([
          ...baseFilter,
          { field: 'priceType', op: 'eq', value: 'Reservation' },
          { field: 'reservationTerm', op: 'eq', value: '3 Years' },
        ]),
        { currencyCode: params.currencyCode, limit: 1 }
      ),
    ]);

    const payg = paygResult.items[0];
    const oneYr = oneYrResult.items[0];
    const threeYr = threeYrResult.items[0];

    if (!payg) {
      return `No pay-as-you-go pricing found for "${params.armSkuName}" in "${params.armRegionName}".`;
    }

    const paygMonthly = payg.retailPrice * 730;
    const paygAnnual = paygMonthly * 12;

    function calcSavings(reserveHourly: number) {
      const reserveMonthly = reserveHourly * 730;
      const reserveAnnual = reserveMonthly * 12;
      const monthlySavings = paygMonthly - reserveMonthly;
      const annualSavings = paygAnnual - reserveAnnual;
      const savingsPct = ((monthlySavings / paygMonthly) * 100).toFixed(1);
      const breakEvenMonths = monthlySavings > 0 ? Math.ceil(reserveAnnual / monthlySavings) : null;
      return {
        reserveHourly,
        reserveMonthly,
        reserveAnnual,
        monthlySavings,
        annualSavings,
        savingsPct,
        breakEvenMonths,
      };
    }

    const rows = [
      {
        option: 'Pay-As-You-Go',
        hourly: `$${payg.retailPrice}`,
        monthly: `$${paygMonthly.toFixed(2)}`,
        annual: `$${paygAnnual.toFixed(2)}`,
        savings: '–',
        breakEven: '–',
      },
    ];

    if (oneYr) {
      const s = calcSavings(oneYr.retailPrice);
      rows.push({
        option: '1-Year Reservation',
        hourly: `$${oneYr.retailPrice}`,
        monthly: `$${s.reserveMonthly.toFixed(2)}`,
        annual: `$${s.reserveAnnual.toFixed(2)}`,
        savings: `${s.savingsPct}% ($${s.annualSavings.toFixed(2)}/yr)`,
        breakEven: s.breakEvenMonths ? `${s.breakEvenMonths} months` : 'N/A',
      });
    } else {
      rows.push({
        option: '1-Year Reservation',
        hourly: 'N/A',
        monthly: 'N/A',
        annual: 'N/A',
        savings: 'N/A',
        breakEven: 'N/A',
      });
    }

    if (threeYr) {
      const s = calcSavings(threeYr.retailPrice);
      rows.push({
        option: '3-Year Reservation',
        hourly: `$${threeYr.retailPrice}`,
        monthly: `$${s.reserveMonthly.toFixed(2)}`,
        annual: `$${s.reserveAnnual.toFixed(2)}`,
        savings: `${s.savingsPct}% ($${s.annualSavings.toFixed(2)}/yr)`,
        breakEven: s.breakEvenMonths ? `${s.breakEvenMonths} months` : 'N/A',
      });
    } else {
      rows.push({
        option: '3-Year Reservation',
        hourly: 'N/A',
        monthly: 'N/A',
        annual: 'N/A',
        savings: 'N/A',
        breakEven: 'N/A',
      });
    }

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows, {
      summary: `${params.armSkuName} in ${params.armRegionName}. Reservations require upfront commitment — consider break-even before committing.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export function register(server: McpServer): void {
  server.tool(
    'azure_compare_reservation_vs_payg',
    'Compare pay-as-you-go vs 1-year and 3-year reservation pricing for a VM SKU. Always call this for workloads expected to run >6 months.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await compareReservationHandler(params) }],
    })
  );
}
