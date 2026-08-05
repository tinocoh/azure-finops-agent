import { useEffect, useMemo, useState } from 'react';
import { useParams } from '../router';
import { api } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatCard from '../components/StatCard';

interface Vm {
  name?: string;
  size?: string;
  location?: string;
  powerState?: string;
}

export default function Resources() {
  const { runId } = useParams<{ runId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    if (!runId) return;
    (async () => {
      try {
        setData(await api.getResources(runId));
      } catch (e: any) {
        setError(e?.message || 'Error cargando inventario');
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  const agg = data?.aggregate || {};
  const vms: Vm[] = agg.virtualMachines || [];

  const filteredVms = useMemo(
    () =>
      vms.filter(
        (v) =>
          (!locationFilter || (v.location || '').toLowerCase().includes(locationFilter.toLowerCase())) &&
          (!typeFilter || (v.size || '').toLowerCase().includes(typeFilter.toLowerCase()))
      ),
    [vms, locationFilter, typeFilter]
  );

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <h2>Inventario de recursos</h2>

      <div className="cards section">
        <StatCard label="Total recursos" value={agg.totalResources ?? 0} />
        <StatCard label="Sin tags" value={agg.resourcesWithoutTags ?? 0} />
        <StatCard label="IPs públicas" value={agg.publicIps ?? 0} />
        <StatCard label="Discos sin adjuntar" value={agg.unattachedDisks ?? 0} />
        <StatCard label="Storage accounts" value={agg.storageAccounts ?? 0} />
        <StatCard label="Load balancers" value={agg.loadBalancers ?? 0} />
        <StatCard label="VMs" value={vms.length} />
        <StatCard label="VMs detenidas" value={(agg.stoppedVms || []).length} />
      </div>

      <div className="section">
        <h3>Máquinas virtuales</h3>
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Filtrar por región" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={{ maxWidth: 220 }} />
          <input placeholder="Filtrar por tamaño" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 220 }} />
        </div>
        {filteredVms.length === 0 ? (
          <p className="muted">Sin VMs (o sin permisos de Resource Graph).</p>
        ) : (
          <table>
            <thead><tr><th>Nombre</th><th>Tamaño</th><th>Región</th><th>Estado</th></tr></thead>
            <tbody>
              {filteredVms.map((v, i) => (
                <tr key={i}>
                  <td>{v.name || '—'}</td>
                  <td>{v.size || '—'}</td>
                  <td>{v.location || '—'}</td>
                  <td>{v.powerState || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
