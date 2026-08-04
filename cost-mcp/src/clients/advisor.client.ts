import { COST_MGMT_API_BASE } from '../constants.js';
import { getAccessToken } from '../auth/azure-auth.js';
import { AdvisorResponseSchema, normalizeAdvisor } from '../schemas/advisor.schema.js';
import type { AdvisorRow } from '../schemas/advisor.schema.js';
import type { CostManagementConfig } from '../config/env.js';

const ADVISOR_API_VERSION = '2023-01-01';

/**
 * Reads Azure Advisor recommendations for the configured subscription, optionally
 * filtered by category. Read-only — requires the Reader role.
 */
export async function getRecommendations(
  config: CostManagementConfig,
  category?: string
): Promise<AdvisorRow[]> {
  const token = await getAccessToken();
  let url =
    `${COST_MGMT_API_BASE}/subscriptions/${config.subscriptionId}` +
    `/providers/Microsoft.Advisor/recommendations?api-version=${ADVISOR_API_VERSION}`;
  if (category) {
    url += `&$filter=${encodeURIComponent(`Category eq '${category}'`)}`;
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const data = AdvisorResponseSchema.parse(await response.json());
  return normalizeAdvisor(data);
}
