import { useEffect, useState } from 'react';
import { api } from '../api';
import SecureTextInput from '../components/SecureTextInput';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import type { Connection, ValidationResult } from '../types';

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface FormState {
  connectionName: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionIds: string;
  defaultCurrency: string;
}

const empty: FormState = {
  connectionName: '',
  tenantId: '',
  clientId: '',
  clientSecret: '',
  subscriptionIds: '',
  defaultCurrency: '',
};

export default function AzureConfig() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<Record<string, ValidationResult>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      setConnections(await api.listConnections());
    } catch (e: any) {
      setApiError(e?.message || 'Error loading connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.connectionName.trim()) errs.connectionName = 'Required';
    if (!GUID_RE.test(form.tenantId)) errs.tenantId = 'Must be a valid GUID';
    if (!GUID_RE.test(form.clientId)) errs.clientId = 'Must be a valid GUID';
    const subs = form.subscriptionIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (subs.length === 0) errs.subscriptionIds = 'Add at least one subscription';
    else if (subs.some((s) => !GUID_RE.test(s))) errs.subscriptionIds = 'All values must be valid GUIDs';
    if (!editingId && !form.clientSecret) errs.clientSecret = 'Required when creating';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setSaving(true);
    const subs = form.subscriptionIds.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      if (editingId) {
        await api.updateConnection(editingId, {
          connectionName: form.connectionName,
          subscriptionIds: subs,
          defaultCurrency: form.defaultCurrency || undefined,
        });
        if (form.clientSecret) await api.rotateSecret(editingId, form.clientSecret);
      } else {
        await api.createConnection({
          connectionName: form.connectionName,
          tenantId: form.tenantId,
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          subscriptionIds: subs,
          defaultCurrency: form.defaultCurrency || undefined,
          enabled: true,
        });
      }
      setForm(empty);
      setEditingId(null);
      await refresh();
    } catch (e: any) {
      setApiError(e?.response?.data?.detail || e?.message || 'Error saving connection');
    } finally {
      setSaving(false);
    }
  };

  const edit = (c: Connection) => {
    setEditingId(c.id);
    setForm({
      connectionName: c.connectionName,
      tenantId: c.tenantId,
      clientId: c.clientId,
      clientSecret: '',
      subscriptionIds: c.subscriptionIds.join(', '),
      defaultCurrency: c.defaultCurrency || '',
    });
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this connection?')) return;
    await api.deleteConnection(id);
    await refresh();
  };

  const runValidation = async (id: string) => {
    setValidation((v) => ({ ...v, [id]: { ...(v[id] as any), status: 'validating' } as any }));
    try {
      const result = await api.validateConnection(id);
      setValidation((v) => ({ ...v, [id]: result }));
    } catch (e: any) {
      setApiError(e?.response?.data?.detail || 'Error validating connection');
    }
  };

  return (
    <div>
      <h2>Azure configuration</h2>
      <p className="muted">
        Register a least-privilege service principal (Reader + Cost Management Reader).
        The <code>clientSecret</code> is encrypted in the backend and never returned.
      </p>
      <ErrorMessage message={apiError} />

      <div className="row" style={{ alignItems: 'flex-start', gap: 28 }}>
        <form onSubmit={submit} className="card" style={{ flex: '1 1 360px', maxWidth: 460 }}>
          <h3>{editingId ? 'Edit connection' : 'New connection'}</h3>

          <div className="field">
            <label>Connection name *</label>
            <input value={form.connectionName} onChange={(e) => setForm({ ...form, connectionName: e.target.value })} />
            {errors.connectionName && <div className="error">{errors.connectionName}</div>}
          </div>

          <div className="field">
            <label>Tenant ID *</label>
            <input value={form.tenantId} disabled={!!editingId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
            {errors.tenantId && <div className="error">{errors.tenantId}</div>}
          </div>

          <div className="field">
            <label>Client ID *</label>
            <input value={form.clientId} disabled={!!editingId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
            {errors.clientId && <div className="error">{errors.clientId}</div>}
          </div>

          <SecureTextInput
            label={editingId ? 'Client Secret (leave blank to keep unchanged)' : 'Client Secret'}
            value={form.clientSecret}
            onChange={(v) => setForm({ ...form, clientSecret: v })}
            error={errors.clientSecret}
            required={!editingId}
            placeholder={editingId ? '•••••• (unchanged)' : ''}
          />

          <div className="field">
            <label>Subscription IDs (comma-separated) *</label>
            <textarea rows={3} value={form.subscriptionIds}
              onChange={(e) => setForm({ ...form, subscriptionIds: e.target.value })}
              placeholder="sub-guid-1, sub-guid-2" />
            {errors.subscriptionIds && <div className="error">{errors.subscriptionIds}</div>}
          </div>

          <div className="field">
            <label>Default currency (optional)</label>
            <input value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })} placeholder="MXN" />
          </div>

          <div className="row">
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            {editingId && (
              <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setForm(empty); setErrors({}); }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={{ flex: '2 1 480px' }}>
          <h3>Connections</h3>
          {loading ? (
            <Loading />
          ) : connections.length === 0 ? (
            <p className="muted">No registered connections.</p>
          ) : (
            connections.map((c) => (
              <div className="card section" key={c.id}>
                <div className="row">
                  <strong>{c.connectionName}</strong>
                  <span className={`badge ${c.enabled ? 'ok' : 'warn'}`}>{c.enabled ? 'active' : 'disabled'}</span>
                  <div className="spacer" />
                  <button className="btn secondary" onClick={() => runValidation(c.id)}>Validate</button>
                  <button className="btn secondary" onClick={() => edit(c)}>Edit</button>
                  <button className="btn danger" onClick={() => remove(c.id)}>Delete</button>
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                  Tenant: {c.tenantId} · Client: {c.clientId} · Secret: {c.secretSet ? c.secretHint : 'not set'}
                </div>
                <div style={{ marginTop: 8 }}>
                  {c.subscriptionIds.map((s) => <span className="tag" key={s}>{s}</span>)}
                </div>
                {validation[c.id] && <ValidationView result={validation[c.id]} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ValidationView({ result }: { result: ValidationResult }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div>
        Credentials:{' '}
        <span className={`badge ${result.credentialsValid ? 'ok' : 'err'}`}>
          {result.credentialsValid ? 'valid' : result.status}
        </span>
        {result.message && <span className="muted"> — {result.message}</span>}
      </div>
      {result.subscriptions?.length > 0 && (
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Subscription</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            {result.subscriptions.map((s) => (
              <tr key={s.subscriptionId}>
                <td>{s.subscriptionId}</td>
                <td><span className={`badge ${s.status === 'ok' ? 'ok' : 'err'}`}>{s.status}</span></td>
                <td className="muted">{s.message || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
