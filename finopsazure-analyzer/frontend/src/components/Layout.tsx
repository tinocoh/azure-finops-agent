import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from '../router';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/config', label: 'Azure configuration' },
  { to: '/run', label: 'Run analysis' },
  { to: '/chat', label: 'Chat FinOps' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    // Azure Container Apps Easy Auth exposes the signed-in user here.
    // Locally this 404s and the badge stays hidden.
    fetch('/.auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const claims = data?.[0]?.user_claims as { typ: string; val: string }[] | undefined;
        const name = claims?.find((c) => c.typ === 'name')?.val || data?.[0]?.user_id || null;
        setUser(name);
      })
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>FinOpsAzure Analyzer</h1>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div style={{ padding: '16px 20px', marginTop: 20, borderTop: '1px solid var(--border)', fontSize: 13 }}>
            <div className="muted">Session</div>
            <div style={{ margin: '4px 0 8px' }}>{user}</div>
            <a href="/.auth/logout" className="btn secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Sign out
            </a>
          </div>
        )}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
