import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRecommendations } from '../../clients/advisor.client.js';
import { formatAsMarkdown, formatAsJSON } from '../../utils/formatters.js';
import { handleAuthError } from '../../utils/error-handler.js';
import type { CostManagementConfig } from '../../config/env.js';

const Schema = z.strictObject({
  category: z
    .enum(['Cost', 'Security', 'HighAvailability', 'Performance', 'OperationalExcellence'])
    .optional()
    .describe('Filter by Advisor category. Omit to return recommendations across all categories.'),
  limit: z.number().int().positive().max(100).optional().default(25),
  response_format: z.enum(['markdown', 'json']).optional().default('markdown'),
});

type Params = z.input<typeof Schema>;

const AUTH_MISSING =
  `No Azure subscription configured. Set AZURE_SUBSCRIPTION_ID or run 'az login'.\n` +
  `The account needs at least the "Reader" role to read Azure Advisor recommendations.`;

export async function getAdvisorRecommendationsHandler(
  params: Params,
  config: CostManagementConfig | null
): Promise<string> {
  if (!config) return AUTH_MISSING;

  try {
    const rows = await getRecommendations(config, params.category);
    const limit = params.limit ?? 25;
    const limited = rows.slice(0, limit);

    if (limited.length === 0) {
      return params.category
        ? `_No Azure Advisor recommendations found for category ${params.category}._`
        : '_No Azure Advisor recommendations found._';
    }

    if (params.response_format === 'json') return formatAsJSON(limited);
    return formatAsMarkdown(limited as unknown as Record<string, unknown>[], {
      summary: `${limited.length} recommendation(s)${params.category ? ` · ${params.category}` : ''}`,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export function register(server: McpServer, config: CostManagementConfig | null): void {
  server.tool(
    'azure_get_advisor_recommendations',
    'Azure Advisor optimization recommendations for the subscription — Cost (right-sizing, idle resources, reservations/savings plans), Security, HighAvailability (reliability), Performance, and OperationalExcellence. Read-only; returns category, impact, affected resource, problem, solution, and estimated savings when available.',
    Schema.shape,
    async (params) => ({
      content: [{ type: 'text', text: await getAdvisorRecommendationsHandler(params, config) }],
    })
  );
}
