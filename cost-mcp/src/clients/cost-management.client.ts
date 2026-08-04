import { COST_MGMT_API_BASE } from '../constants.js';
import { getAccessToken } from '../auth/azure-auth.js';
import { QueryResultSchema, normalizeQueryResult } from '../schemas/cost-management.schema.js';
import type { NormalizedCostRow } from '../schemas/cost-management.schema.js';
import type { CostManagementConfig } from '../config/env.js';

type QueryBody = Record<string, unknown>;

export async function queryUsage(
  config: CostManagementConfig,
  body: QueryBody
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken();
  const url = `${COST_MGMT_API_BASE}/subscriptions/${config.subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const result = QueryResultSchema.parse(await response.json());
  return normalizeQueryResult(result);
}

export async function getForecast(
  config: CostManagementConfig,
  body: QueryBody
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken();
  const url = `${COST_MGMT_API_BASE}/subscriptions/${config.subscriptionId}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const result = QueryResultSchema.parse(await response.json());
  return normalizeQueryResult(result);
}

export async function listBudgets(
  config: CostManagementConfig,
  resourceGroup?: string
): Promise<NormalizedCostRow[]> {
  const token = await getAccessToken();
  const scope = resourceGroup
    ? `subscriptions/${config.subscriptionId}/resourceGroups/${resourceGroup}`
    : `subscriptions/${config.subscriptionId}`;
  const url = `${COST_MGMT_API_BASE}/${scope}/providers/Microsoft.Consumption/budgets?api-version=2023-11-01`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
      status: response.status,
    });
  }
  const data = (await response.json()) as { value: object[] };
  return data.value as NormalizedCostRow[];
}
