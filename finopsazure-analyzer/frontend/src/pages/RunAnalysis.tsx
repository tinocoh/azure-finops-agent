import { useEffect, useState } from 'react';
import { useNavigate } from '../router';
import { api } from '../api';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import type { Connection } from '../types';

export default function RunAnalysis() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const conns = await api.listConnections();
        setConnections(conns);
        if (conns.length > 0) {
          setConnectionId(conns[0].id);
          setSelectedSubs(conns[0].subscriptionIds);
        }
      } catch (e: any) {
        setError(e?.message || 'Error cargando conexiones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = connections.find((c) => c.id === connectionId);

  const onConnectionChange = (id: string) => {
    setConnectionId(id);
    const c = connections.find((x) => x.id === id);
    setSelectedSubs(c?.subscriptionIds || []);
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs((prev) => (prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]));
  };

  const run = async () => {
    setError('');
    setRunning(true);
    try {
      const result = await api.runAnalysis({
        connectionId,
        subscriptionIds: selectedSubs.length ? selectedSubs : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      navigate(`/results/${result.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Error ejecutando el análisis');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <Loading />;

  if (connections.length === 0) {
    return (
      <div>
        <h2>Ejecutar análisis</h2>
        <p className="muted">Primero registra una conexión en Configuración Azure.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Ejecutar análisis</h2>
      <ErrorMessage message={error} />

      <div className="card" style={{ maxWidth: 620 }}>
        <div className="field">
          <label>Conexión</label>
          <select value={connectionId} onChange={(e) => onConnectionChange(e.target.value)}>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.connectionName}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Suscripciones a analizar</label>
          {current?.subscriptionIds.map((s) => (
            <label key={s} className="row" style={{ fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={selectedSubs.includes(s)} onChange={() => toggleSub(s)} style={{ width: 'auto' }} />
              <span>{s}</span>
            </label>
          ))}
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Desde (opcional)</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hasta (opcional)</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <button className="btn" onClick={run} disabled={running || selectedSubs.length === 0}>
          {running ? 'Ejecutando análisis…' : 'Ejecutar análisis'}
        </button>
        {running && <p className="muted" style={{ marginTop: 10 }}>Consultando Cost Management, Resource Graph y Advisor…</p>}
      </div>
    </div>
  );
}
