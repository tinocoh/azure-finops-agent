export default function StatCard({
  label,
  value,
  delta,
  trend,
}: {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="card stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${trend || 'flat'}`}>{delta}</div>}
    </div>
  );
}
