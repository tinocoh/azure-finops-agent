import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryUsage } from '../../clients/cost-management.client.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleAuthError } from '../../utils/error-handler.js';
import type { CostManagementConfig } from '../../config/env.js';

const Schema = z.strictObject({
  timeframe: z.enum([
    'MonthToDate',
    'BillingMonthToDate',
    'TheLastMonth',
    'TheLastBillingMonth',
    'Custom',
  ]),
  startDate: z.string().optional().describe('ISO date, required when timeframe=Custom'),
  endDate: z.string().optional().describe('ISO date, required when timeframe=Custom'),
  granularity: z.enum(['Daily', 'Monthly', 'None']).optional().default('None'),
  groupBy: z
    .array(z.enum(['ResourceGroup', 'ServiceName', 'Location', 'ResourceType']))
    .optional()
    .default(['ServiceName']),
  costType: z.enum(['ActualCost', 'AmortizedCost']).optional().default('ActualCost'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs the "Cost Management Reader" role on the subscription.`;

export async function queryCostsHandler(
  params: Params,
  config: CostManagementConfig | null
): Promise<string> {
  if (!config) return AUTH_MISSING;

  try {
    const groupByDimensions = (params.groupBy ?? ['ServiceName']).map((name) => ({
      type: 'Dimension',
      name,
    }));

    const timePeriod =
      params.timeframe === 'Custom' && params.startDate && params.endDate
        ? { from: params.startDate, to: params.endDate }
        : undefined;

    const body = {
      type: params.costType ?? 'ActualCost',
      timeframe: params.timeframe,
      ...(timePeriod && { timePeriod }),
      dataset: {
        granularity: params.granularity ?? 'None',
        aggregation: {
          totalCost: { name: 'Cost', function: 'Sum' },
        },
        grouping: groupByDimensions,
      },
    };

    const rows = await queryUsage(config, body);
    if (rows.length === 0) return '_No cost data found for the specified period._';

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows as Record<string, unknown>[], {
      summary: `${rows.length} rows · ${params.timeframe}`,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export function register(server: McpServer, config: CostManagementConfig | null): void {
  server.tool(
    'azure_query_costs',
    'Query actual Azure subscription spend. Requires Cost Management credentials.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await queryCostsHandler(params, config) }],
    })
  );
}
