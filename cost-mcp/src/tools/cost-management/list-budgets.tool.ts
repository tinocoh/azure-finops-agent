import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listBudgets } from '../../clients/cost-management.client.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleAuthError } from '../../utils/error-handler.js';
import type { CostManagementConfig } from '../../config/env.js';

const Schema = z.strictObject({
  resourceGroup: z.string().optional(),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

// Forecast-aware status: EXCEEDED already over, CRITICAL ≥90% spent, AT_RISK forecast to
// exceed even though current spend is fine, WARNING ≥75% spent, else OK.
type BudgetStatus = 'EXCEEDED' | 'CRITICAL' | 'AT_RISK' | 'WARNING' | 'OK';

interface BudgetProperties {
  amount?: number;
  timeGrain?: string;
  currentSpend?: { amount?: number; unit?: string };
  forecastSpend?: { amount?: number; unit?: string };
  [key: string]: unknown;
}

interface BudgetEntry {
  name?: string;
  properties?: BudgetProperties;
  [key: string]: unknown;
}

const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs the "Cost Management Reader" role on the subscription.`;

function getBudgetStatus(
  amount: number,
  currentSpend: number,
  forecastSpend: number | null
): BudgetStatus {
  if (amount <= 0) return 'OK';
  if (currentSpend >= amount) return 'EXCEEDED';
  if (currentSpend / amount >= 0.9) return 'CRITICAL';
  if (forecastSpend !== null && forecastSpend >= amount) return 'AT_RISK';
  if (currentSpend / amount >= 0.75) return 'WARNING';
  return 'OK';
}

export async function listBudgetsHandler(
  params: Params,
  config: CostManagementConfig | null
): Promise<string> {
  if (!config) return AUTH_MISSING;

  try {
    const raw = await listBudgets(config, params.resourceGroup);
    if (raw.length === 0) return '_No budgets found._';

    const rows = raw.map((b) => {
      const budget = b as BudgetEntry;
      const name = budget.name ?? 'unknown';
      const amount = budget.properties?.amount ?? 0;
      const currentSpend = budget.properties?.currentSpend?.amount ?? 0;
      const forecastSpend = budget.properties?.forecastSpend?.amount ?? null;
      const timeGrain = budget.properties?.timeGrain ?? '';
      const pct = amount > 0 ? ((currentSpend / amount) * 100).toFixed(1) : 'N/A';
      const status = getBudgetStatus(amount, currentSpend, forecastSpend);

      return {
        name,
        period: timeGrain,
        budget: `$${amount.toFixed(2)}`,
        spent: `$${currentSpend.toFixed(2)}`,
        forecast: forecastSpend !== null ? `$${forecastSpend.toFixed(2)}` : 'N/A',
        pctUsed: `${pct}%`,
        status,
      };
    });

    const count = (s: BudgetStatus) => rows.filter((r) => r.status === s).length;

    if (params.response_format === 'json') return formatAsJSON(rows);
    return formatAsMarkdown(rows, {
      summary:
        `${count('EXCEEDED')} EXCEEDED · ${count('CRITICAL')} CRITICAL · ` +
        `${count('AT_RISK')} AT_RISK · ${count('WARNING')} WARNING · ${count('OK')} OK`,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export function register(server: McpServer, config: CostManagementConfig | null): void {
  server.tool(
    'azure_list_budgets',
    'List Azure budgets with current AND forecast spend, plus a forecast-aware status: EXCEEDED, CRITICAL (≥90% spent), AT_RISK (forecast to exceed), WARNING (≥75% spent), or OK. Read-only; requires Cost Management Reader.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await listBudgetsHandler(params, config) }],
    })
  );
}
