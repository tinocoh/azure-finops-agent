import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryUsage } from '../../clients/cost-management.client.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleAuthError } from '../../utils/error-handler.js';
import type { CostManagementConfig } from '../../config/env.js';

const Schema = z.strictObject({
  groupBy: z
    .enum(['None', 'ServiceName', 'ResourceGroupName', 'MeterCategory'])
    .optional()
    .default('None')
    .describe('Break the month-end projection down by a dimension. None = subscription total.'),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs the "Cost Management Reader" role on the subscription.`;

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const money = (n: number): string => `$${n.toFixed(2)}`;

interface Projection {
  actual: number;
  projected: number;
  remaining: number;
  daysElapsed: number;
  daysInMonth: number;
}

/**
 * Linear month-end projection from actual daily MonthToDate spend. We deliberately do NOT
 * use the native Cost Management forecast endpoint: it is heavily throttled and rejects
 * ungrouped subscription-scope requests on MCA/MCAP billing accounts. A transparent linear
 * projection (actual-so-far ÷ days-elapsed × days-in-month) is deterministic and explainable.
 */
export function project(rows: Record<string, unknown>[], now = new Date()): Projection {
  const actual = rows.reduce((s, r) => s + num(r.Cost ?? r.PreTaxCost ?? r.cost), 0);
  const dates = new Set(rows.map((r) => String(r.UsageDate ?? r.Date ?? '')).filter(Boolean));
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const daysElapsed = dates.size > 0 ? dates.size : now.getUTCDate();
  const projected = daysElapsed > 0 ? (actual / daysElapsed) * daysInMonth : actual;
  return { actual, projected, remaining: projected - actual, daysElapsed, daysInMonth };
}

export async function getForecastHandler(
  params: Params,
  config: CostManagementConfig | null,
  now = new Date()
): Promise<string> {
  if (!config) return AUTH_MISSING;

  try {
    const groupBy = params.groupBy ?? 'None';
    const body = {
      type: 'ActualCost',
      timeframe: 'MonthToDate',
      dataset: {
        granularity: 'Daily',
        aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
        ...(groupBy !== 'None' && { grouping: [{ type: 'Dimension', name: groupBy }] }),
      },
    };

    const rows = (await queryUsage(config, body)) as Record<string, unknown>[];
    if (rows.length === 0) return '_No cost data available to project for the current month._';

    const p = project(rows, now);
    const summary =
      `Proyección de cierre de mes (lineal): ${money(p.projected)}  ` +
      `(real al día ${money(p.actual)} · pronóstico restante ${money(p.remaining)} · ` +
      `${p.daysElapsed}/${p.daysInMonth} días)`;

    if (groupBy === 'None') {
      if (params.response_format === 'json') {
        return formatAsJSON({ projection: p, daily: rows });
      }
      return formatAsMarkdown(rows, { summary });
    }

    // Per-dimension projection: scale each group's actual to month-end.
    const factor = p.daysElapsed > 0 ? p.daysInMonth / p.daysElapsed : 1;
    const byGroup = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[groupBy] ?? r.ServiceName ?? r.ResourceGroupName ?? r.MeterCategory ?? '—');
      byGroup.set(key, (byGroup.get(key) ?? 0) + num(r.Cost ?? r.PreTaxCost));
    }
    const grouped = [...byGroup.entries()]
      .map(([name, actual]) => ({
        [groupBy]: name,
        actualMTD: money(actual),
        projectedMonthEnd: money(actual * factor),
      }))
      .sort((a, b) => num(b.actualMTD.slice(1)) - num(a.actualMTD.slice(1)));

    if (params.response_format === 'json') {
      return formatAsJSON({ projection: p, byGroup: grouped });
    }
    return formatAsMarkdown(grouped as Record<string, unknown>[], { summary });
  } catch (err) {
    return handleAuthError(err);
  }
}

export function register(server: McpServer, config: CostManagementConfig | null): void {
  server.tool(
    'azure_get_cost_forecast',
    'Project Azure month-end spend from actual MonthToDate daily costs (transparent linear projection: actual-so-far + forecast-remaining = month-end total), optionally grouped by ServiceName/ResourceGroupName/MeterCategory. Read-only; requires Cost Management Reader.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await getForecastHandler(params, config) }],
    })
  );
}
