import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryUsage } from '../../clients/cost-management.client.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleAuthError } from '../../utils/error-handler.js';
import type { CostManagementConfig } from '../../config/env.js';

const Schema = z.strictObject({
  topN: z.number().int().min(1).max(50).optional().default(10),
  resourceGroup: z.string().optional(),
  timeframe: z.enum(['MonthToDate', 'TheLastMonth', 'Custom']).optional().default('MonthToDate'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs the "Cost Management Reader" role on the subscription.`;

export async function queryCostsByResourceHandler(
  params: Params,
  config: CostManagementConfig | null
): Promise<string> {
  if (!config) return AUTH_MISSING;

  try {
    const timePeriod =
      params.timeframe === 'Custom' && params.startDate && params.endDate
        ? { from: params.startDate, to: params.endDate }
        : undefined;

    const body = {
      type: 'ActualCost',
      timeframe: params.timeframe ?? 'MonthToDate',
      ...(timePeriod && { timePeriod }),
      dataset: {
        granularity: 'None',
        aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
        grouping: [{ type: 'Dimension', name: 'ResourceId' }],
        ...(params.resourceGroup && {
          filter: {
            dimensions: {
              name: 'ResourceGroup',
              operator: 'In',
              values: [params.resourceGroup],
            },
          },
        }),
      },
    };

    const rows = await queryUsage(config, body);
    if (rows.length === 0) return '_No resource cost data found for the specified period._';

    const sorted = [...rows].sort((a, b) => (Number(b.Cost) || 0) - (Number(a.Cost) || 0));
    const topN = params.topN ?? 10;
    const top = sorted.slice(0, topN);
    const totalCost = rows.reduce((sum, r) => sum + (Number(r.Cost) || 0), 0);

    const formatted = top.map((r) => {
      const cost = Number(r.Cost) || 0;
      const pct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : '0.0';
      // Shorten resource ID to last segment for readability
      const resourceId = String(r.ResourceId ?? r.resourceId ?? 'unknown');
      const shortId = resourceId.split('/').pop() ?? resourceId;
      return {
        resource: shortId,
        cost: `$${cost.toFixed(2)}`,
        pctOfTotal: `${pct}%`,
      };
    });

    if (params.response_format === 'json') return formatAsJSON(formatted);
    return formatAsMarkdown(formatted, {
      summary: `Top ${top.length} of ${rows.length} resources · Total: $${totalCost.toFixed(2)}`,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export function register(server: McpServer, config: CostManagementConfig | null): void {
  server.tool(
    'azure_query_costs_by_resource',
    'Show top-N Azure resources by spend with % of total. Requires Cost Management credentials.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await queryCostsByResourceHandler(params, config) }],
    })
  );
}
