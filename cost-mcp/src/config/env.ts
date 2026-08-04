import { execSync } from 'child_process';

export interface CostManagementConfig {
  subscriptionId: string;
}

export interface Config {
  retailCurrency: string;
  costManagement: CostManagementConfig | null;
}

function resolveSubscriptionId(): string | null {
  if (process.env.AZURE_SUBSCRIPTION_ID) return process.env.AZURE_SUBSCRIPTION_ID;
  try {
    return execSync('az account show --query id --output tsv', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  const subscriptionId = resolveSubscriptionId();
  const costManagement = subscriptionId ? { subscriptionId } : null;

  if (!costManagement) {
    console.error(
      "[azure-cost-mcp] No Azure subscription found. Set AZURE_SUBSCRIPTION_ID or run 'az login'."
    );
  }

  return {
    retailCurrency: process.env.AZURE_RETAIL_DEFAULT_CURRENCY ?? 'USD',
    costManagement,
  };
}
