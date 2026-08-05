import { useEffect, useState } from 'react';
import { Link, useParams } from '../router';
import { api } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatCard from '../components/StatCard';
import type { AnalysisSummary, CostRow } from '../types';

export default function Results() {
  const { runId } = useParams<{ runId: string }>();
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [costs, setCosts] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;
    (async () => {
      try {
        const [s, c, a] = await Promise.all([
          api.getSummary(runId),
          api.getCosts(runId),
          api.getAiSummary(runId),
        ]);
        setSummary(s);
        setCosts(c);
        setAi(a);
      } catch (e: any) {
        setError(e?.message || 'Error cargando resultados');
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const s = summary?.summary;
  const agg = costs?.aggregate || {};
  const topServices: CostRow[] = agg.topServices || [];
  const topRgs: CostRow[] = agg.topResourceGroups || [];
  const delta = s?.deltaPercent;

  return (
    <div>
      <div className="row">
        <h2>Resultados del análisis</h2>
        <div className="spacer" />
        <Link className="btn secondary" to={`/resources/${runId}`}>Inventario</Link>
        <Link className="btn secondary" to={`/recommendations/${runId}`}>Recomendaciones</Link>
      </div>

      <div className="cards section">
        <StatCard label="Costo mes actual" value={(s?.currentMonthCost ?? 0).toLocaleString()} />
        <StatCard label="Costo mes anterior" value={(s?.previousMonthCost ?? 0).toLocaleString()} />
        <StatCard label="Variación" value={delta != null ? `${delta}%` : '—'} trend={delta == null ? 'flat' : delta > 0 ? 'up' : 'down'} />
        <StatCard label="Recursos" value={s?.totalResources ?? 0} />
        <StatCard label="Sin tags" value={s?.resourcesWithoutTags ?? 0} />
        <StatCard label="Quick wins" value={s?.quickWins ?? 0} />
      </div>

      <div className="section">
        <h3>Resumen ejecutivo (IA)</h3>
        <AiSummaryView ai={ai} />
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 28 }}>
        <div className="section" style={{ flex: 1 }}>
          <h3>Top 10 servicios por costo</h3>
          <CostTable rows={topServices} currency={agg.currency} />
        </div>
        <div className="section" style={{ flex: 1 }}>
          <h3>Top 10 resource groups por costo</h3>
          <CostTable rows={topRgs} currency={agg.currency} />
        </div>
      </div>
    </div>
  );
}

function CostTable({ rows, currency }: { rows: CostRow[]; currency?: string }) {
  if (!rows || rows.length === 0) return <p className="muted">Sin datos de costo (revisa permisos de Cost Management).</p>;
  return (
    <table>
      <thead><tr><th>Nombre</th><th>Costo {currency ? `(${currency})` : ''}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}><td>{r.key}</td><td>{r.cost.toLocaleString()}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function AiSummaryView({ ai }: { ai: any }) {
  if (!ai) return <p className="muted">Sin resumen.</p>;
  if (ai.summary?.text) {
    return (
      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Generado por: {ai.generatedBy}</div>
        <pre className="ai">{ai.summary.text}</pre>
      </div>
    );
  }
  const s = ai.summary || {};
  const section = (title: string, items?: string[]) =>
    items && items.length > 0 ? (
      <div style={{ marginBottom: 12 }}>
        <strong>{title}</strong>
        <ul>{items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
      </div>
    ) : null;
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Generado por: {ai.generatedBy}{ai.aiError ? ' (IA no disponible, se usó reglas)' : ''}
      </div>
      {section('Hallazgos principales', s.hallazgos)}
      {section('Riesgos', s.riesgos)}
      {section('Oportunidades de ahorro', s.oportunidadesAhorro)}
      {section('Acciones recomendadas', s.accionesRecomendadas)}
      {section('Próximos pasos', s.proximosPasos)}
    </div>
  );
}
