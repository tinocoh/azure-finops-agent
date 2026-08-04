import { z } from 'zod';

export const QueryResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  properties: z.object({
    nextLink: z.string().nullable().optional(),
    columns: z.array(z.object({ name: z.string(), type: z.string() })),
    rows: z.array(z.array(z.unknown())),
  }),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

export interface NormalizedCostRow {
  [key: string]: unknown;
}

export function normalizeQueryResult(result: QueryResult): NormalizedCostRow[] {
  const { columns, rows } = result.properties;
  return rows.map((row) => Object.fromEntries(columns.map((col, i) => [col.name, row[i]])));
}
