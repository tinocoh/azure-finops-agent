import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import type { Recommendation } from '../types';

export default function Recommendations() {
  const { runId } = useParams<{ runId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [impact, setImpact] = useState('');

  useEffect(() => {
    if (!runId) return;
    (async () => {
      try {
        setData(await api.getRecommendations(runId));
      } catch (e: any) {
        setError(e?.message || 'Error cargando recomendaciones');
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  const agg = data?.aggregate || {};
  const recs: Recommendation[] = agg.recommendations || [];

  const filtered = useMemo(
    () =>
      recs.filter(
        (r) => (!category || r.category === category) && (!impact || r.impact === impact)
      ),
    [recs, category, impact]
  );

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const categories = Array.from(new Set(recs.map((r) => r.category)));

  return (
    <div>
      <h2>Recomendaciones</h2>
      <div className="cards section">
        {Object.entries(agg.byCategory || {}).map(([cat, n]) => (
          <div className="card stat-card" key={cat}>
            <div className="label">{cat}</div>
            <div className="value">{String(n)}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={impact} onChange={(e) => setImpact(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Todo impacto</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">Sin recomendaciones (o Advisor sin permisos de lectura).</p>
      ) : (
        <table>
          <thead>
            <tr><th>Categoría</th><th>Impacto</th><th>Problema</th><th>Solución</th><th>Recurso</th><th>Quick win</th></tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>{r.category}</td>
                <td><span className={`badge ${r.impact === 'High' ? 'err' : r.impact === 'Medium' ? 'warn' : 'ok'}`}>{r.impact}</span></td>
                <td>{r.problem}</td>
                <td>{r.solution}</td>
                <td className="muted">{r.impactedValue || '—'}</td>
                <td>{r.quickWin ? '✔' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
