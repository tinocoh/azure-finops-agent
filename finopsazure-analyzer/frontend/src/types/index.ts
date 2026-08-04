// Type definitions shared across the app.

export interface Connection {
  id: string;
  connectionName: string;
  tenantId: string;
  clientId: string;
  subscriptionIds: string[];
  defaultCurrency?: string | null;
  enabled: boolean;
  secretSet: boolean;
  secretHint: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionCreate {
  connectionName: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionIds: string[];
  defaultCurrency?: string;
  enabled: boolean;
}

export interface SubscriptionStatus {
  subscriptionId: string;
  status: 'ok' | 'no_permission' | 'not_accessible' | 'error';
  message?: string | null;
}

export interface ValidationResult {
  connectionId: string;
  credentialsValid: boolean;
  status: string;
  message?: string | null;
  subscriptions: SubscriptionStatus[];
}

export interface AnalysisRun {
  id: string;
  connectionId: string;
  status: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  subscriptionIds: string[];
  createdAt: string;
  completedAt?: string | null;
}

export interface CostRow {
  key: string;
  cost: number;
}

export interface AnalysisSummary {
  runId: string;
  status: string;
  summary: {
    subscriptions?: number;
    currentMonthCost?: number;
    previousMonthCost?: number;
    deltaPercent?: number | null;
    totalResources?: number;
    resourcesWithoutTags?: number;
    recommendations?: number;
    quickWins?: number;
  };
  errors: unknown[];
}

export interface Recommendation {
  id: string;
  category: string;
  impact: string;
  problem: string;
  solution: string;
  impactedField: string;
  impactedValue: string;
  quickWin: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  generatedBy: string;
  aiError?: string | null;
}
