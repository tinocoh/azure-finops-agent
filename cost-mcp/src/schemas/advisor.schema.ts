import { z } from 'zod';

export const AdvisorRecommendationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  properties: z
    .object({
      category: z.string().optional(),
      impact: z.string().optional(),
      impactedField: z.string().optional(),
      impactedValue: z.string().optional(),
      lastUpdated: z.string().optional(),
      shortDescription: z
        .object({ problem: z.string().optional(), solution: z.string().optional() })
        .optional(),
      extendedProperties: z.record(z.string(), z.string()).optional(),
      resourceMetadata: z.object({ resourceId: z.string().optional() }).optional(),
    })
    .optional(),
});

export const AdvisorResponseSchema = z.object({
  value: z.array(AdvisorRecommendationSchema),
  nextLink: z.string().optional(),
});

export type AdvisorResponse = z.infer<typeof AdvisorResponseSchema>;

export interface AdvisorRow {
  category: string;
  impact: string;
  resource: string;
  problem: string;
  solution: string;
  savings?: string;
}

/** Flattens the Advisor REST payload into compact, table-friendly rows. */
export function normalizeAdvisor(resp: AdvisorResponse): AdvisorRow[] {
  return resp.value.map((r) => {
    const p = r.properties ?? {};
    const ext = p.extendedProperties ?? {};
    const resourceId = p.resourceMetadata?.resourceId ?? '';
    const resource = resourceId ? (resourceId.split('/').pop() ?? resourceId) : (p.impactedValue ?? '');
    const amount = ext.savingsAmount ?? ext.annualSavingsAmount;
    const currency = ext.savingsCurrency ?? ext.currency ?? '';
    return {
      category: p.category ?? '',
      impact: p.impact ?? '',
      resource,
      problem: p.shortDescription?.problem ?? '',
      solution: p.shortDescription?.solution ?? '',
      savings: amount ? `${amount} ${currency}`.trim() : undefined,
    };
  });
}
