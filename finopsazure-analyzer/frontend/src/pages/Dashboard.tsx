import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
        setError(e?.message || 'Error cargando el dashboard');
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
        <StatCard label="Suscripciones configuradas" value={connections.reduce((n, c) => n + c.subscriptionIds.length, 0)} />
        <StatCard label="Conexiones" value={connections.length} />
        <StatCard label="Análisis ejecutados" value={runs.length} />
        <StatCard
          label="Costo actual estimado"
          value={s?.currentMonthCost != null ? s.currentMonthCost.toLocaleString() : '—'}
          delta={delta != null ? `${delta > 0 ? '+' : ''}${delta}% vs mes anterior` : undefined}
          trend={delta == null ? 'flat' : delta > 0 ? 'up' : 'down'}
        />
        <StatCard label="Recomendaciones" value={s?.recommendations ?? '—'} />
        <StatCard label="Recursos sin tags" value={s?.resourcesWithoutTags ?? '—'} />
      </div>

      <div className="section">
        <div className="row">
          <h3>Últimos análisis</h3>
          <div className="spacer" />
          <Link to="/run" className="btn">Ejecutar análisis</Link>
        </div>
        {runs.length === 0 ? (
          <p className="muted">Aún no hay análisis. Configura una conexión y ejecuta el primero.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Estado</th><th>Suscripciones</th><th></th></tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.subscriptionIds.length}</td>
                  <td><Link to={`/results/${r.id}`}>Ver resultados</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {connections.length === 0 && (
        <div className="card">
          <p>No hay conexiones. Empieza en <Link to="/config">Configuración Azure</Link>.</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'ok' : status.includes('error') || status === 'failed' ? 'err' : 'warn';
  return <span className={`badge ${cls}`}>{status}</span>;
}
