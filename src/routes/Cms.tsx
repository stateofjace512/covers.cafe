import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Report = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  cover_id: string;
  reporter_id: string | null;
  cover_title: string | null;
  reporter_username: string | null;
};

type Ban = {
  user_id: string;
  reason: string | null;
  banned_at: string;
  username: string | null;
};

type DashboardPayload = {
  reports: Report[];
  bans: Ban[];
};

export default function Cms() {
  const { user, session, loading, openAuthModal } = useAuth();
  const [data, setData] = useState<DashboardPayload>({ reports: [], bans: [] });
  const [operator, setOperator] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banUserId, setBanUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const token = session?.access_token;

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  async function loadDashboard() {
    if (!token) return;
    const res = await fetch('/api/cms/dashboard', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) {
      setOperator(false);
      return;
    }
    if (!res.ok) {
      setError('Failed to load CMS data.');
      return;
    }
    setOperator(true);
    const json = await res.json() as DashboardPayload;
    setData(json);
  }

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  useEffect(() => {
    loadDashboard();
  }, [token]);

  async function deleteCover(coverId: string) {
    if (!token) return;
    setBusyId(coverId);
    setError(null);
    const res = await fetch('/api/cms/delete-cover', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ coverId }),
    });
    if (!res.ok) setError('Could not delete cover.');
    await loadDashboard();
    setBusyId(null);
  }

  async function submitBan(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !banUserId.trim()) return;
    setBusyId('ban-user');
    setError(null);
    const res = await fetch('/api/cms/ban-user', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: banUserId.trim(), reason: banReason.trim() || null }),
    });
    if (!res.ok) setError('Could not ban user.');
    else {
      setBanUserId('');
      setBanReason('');
    }
    await loadDashboard();
    setBusyId(null);
  }

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in to access CMS.</div>;
  if (operator === false) return <div>You are not an operator.</div>;

  return (
    <div className="route-container">
      <h1 className="route-title">Operator CMS</h1>
      <p className="route-subtitle">Review reports, remove abusive content, and manage bans.</p>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}

      <section className="surface" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Ban user</h2>
        <form onSubmit={submitBan} style={{ display: 'grid', gap: 10 }}>
          <input className="form-input" placeholder="User UUID" value={banUserId} onChange={(e) => setBanUserId(e.target.value)} />
          <textarea className="form-input" placeholder="Reason (optional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={busyId === 'ban-user'}>
            {busyId === 'ban-user' ? 'Banning…' : 'Ban user'}
          </button>
        </form>
      </section>

      <section className="surface" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Reports</h2>
        {data.reports.length === 0 ? <p>No reports.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.reports.map((report) => (
              <div key={report.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div><strong>Reason:</strong> {report.reason}</div>
                <div><strong>Cover:</strong> {report.cover_title ?? report.cover_id}</div>
                <div><strong>Reporter:</strong> {report.reporter_username ?? report.reporter_id ?? 'Unknown'}</div>
                {report.details && <div><strong>Details:</strong> {report.details}</div>}
                <button
                  className="btn"
                  onClick={() => deleteCover(report.cover_id)}
                  disabled={busyId === report.cover_id}
                  style={{ marginTop: 8 }}
                >
                  {busyId === report.cover_id ? 'Deleting…' : 'Delete cover'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface">
        <h2 style={{ marginTop: 0 }}>Banned users</h2>
        {data.bans.length === 0 ? <p>No bans.</p> : (
          <ul>
            {data.bans.map((ban) => (
              <li key={ban.user_id}>{ban.username ?? ban.user_id} — {ban.reason ?? 'No reason provided'}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
