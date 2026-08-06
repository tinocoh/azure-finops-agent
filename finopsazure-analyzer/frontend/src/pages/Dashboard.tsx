import { useEffect, useState } from 'react';
import { Link } from '../router';
import { api } from '../api';
import StatCard from '../components/StatCard';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import type { AnalysisRun, AnalysisSummary, Connection } from '../types';

export default function Dashboard() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [lastSummary, setLastSummary] = useState<AnalysisSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [conns, allRuns] = await Promise.all([api.listConnections(), api.listRuns()]);
        setConnections(conns);
        setRuns(allRuns);
        if (allRuns.length > 0) {
          setLastSummary(await api.getSummary(allRuns[0].id));
        }
      } catch (e: any) {
        setError(e?.message || 'Error loading dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading />;

  const s = lastSummary?.summary;
  const delta = s?.deltaPercent;

  return (
    <div>
      <h2>Dashboard</h2>
      <ErrorMessage message={error} />

      <div className="cards section">
        <StatCard label="Configured subscriptions" value={connections.reduce((n, c) => n + c.subscriptionIds.length, 0)} />
        <StatCard label="Connections" value={connections.length} />
        <StatCard label="Analysis runs" value={runs.length} />
        <StatCard
          label="Estimated current cost"
          value={s?.currentMonthCost != null ? s.currentMonthCost.toLocaleString() : '—'}
          delta={delta != null ? `${delta > 0 ? '+' : ''}${delta}% vs previous month` : undefined}
          trend={delta == null ? 'flat' : delta > 0 ? 'up' : 'down'}
        />
        <StatCard label="Recommendations" value={s?.recommendations ?? '—'} />
        <StatCard label="Untagged resources" value={s?.resourcesWithoutTags ?? '—'} />
      </div>

      <div className="section">
        <div className="row">
          <h3>Recent analyses</h3>
          <div className="spacer" />
          <Link to="/run" className="btn">Run analysis</Link>
        </div>
        {runs.length === 0 ? (
          <p className="muted">No analyses yet. Configure a connection and run the first one.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Status</th><th>Subscriptions</th><th></th></tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.subscriptionIds.length}</td>
                  <td><Link to={`/results/${r.id}`}>View results</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {connections.length === 0 && (
        <div className="card">
          <p>No connections. Start in <Link to="/config">Azure configuration</Link>.</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'ok' : status.includes('error') || status === 'failed' ? 'err' : 'warn';
  return <span className={`badge ${cls}`}>{status}</span>;
}
