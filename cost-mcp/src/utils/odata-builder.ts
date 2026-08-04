export type ODataOp = 'eq' | 'ne';

export interface FilterClause {
  field: string;
  op: ODataOp;
  value: string;
}

export function buildFilter(clauses: FilterClause[]): string {
  if (clauses.length === 0) return '';
  return clauses.map((c) => `${c.field} ${c.op} '${c.value}'`).join(' and ');
}
