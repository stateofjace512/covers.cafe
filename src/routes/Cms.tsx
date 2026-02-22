import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Report = {
  id: string;
  reason: string;
  details: string | null;
  cover_id: string;
  cover_title: string | null;
  reporter_username: string | null;
};

type PublishedCover = {
  id: string;
  title: string;
  artist: string;
  user_id: string;
  username: string | null;
  is_public: boolean;
  is_acotw: boolean;
  is_banned: boolean;
};

type Ban = {
  user_id: string;
  username: string | null;
  reason: string | null;
  banned_at: string;
};

type UserOption = {
  id: string;
  username: string;
  display_name: string | null;
};

type DashboardPayload = {
  reports: Report[];
  published: PublishedCover[];
  bans: Ban[];
};

export default function Cms() {
  const { user, session, loading, openAuthModal } = useAuth();
  const [data, setData] = useState<DashboardPayload>({ reports: [], published: [], bans: [] });
  const [operator, setOperator] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [banReason, setBanReason] = useState('');

  const token = session?.access_token;

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const selectedUserBan = selectedUser
    ? data.bans.find((ban) => ban.user_id === selectedUser.id)
    : null;

  async function loadDashboard() {
    if (!token) return;
    const res = await fetch('/api/cms/dashboard', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) return setOperator(false);
    if (!res.ok) return setError('Failed to load CMS data.');
    setOperator(true);
    setData(await res.json() as DashboardPayload);
  }

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  useEffect(() => {
    loadDashboard();
  }, [token]);

  useEffect(() => {
    if (!token || userQuery.trim().length < 1) {
      setUserOptions([]);
      return;
    }

    const handle = setTimeout(async () => {
      const res = await fetch(`/api/cms/users?q=${encodeURIComponent(userQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const found = await res.json() as UserOption[];
      setUserOptions(found);
    }, 150);

    return () => clearTimeout(handle);
  }, [userQuery, token]);

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

  async function setCoverVisibility(coverId: string, isPublic: boolean) {
    if (!token) return;
    setBusyId(`visibility-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/cover-visibility', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ coverId, isPublic }),
    });
    if (!res.ok) setError('Could not update visibility.');
    await loadDashboard();
    setBusyId(null);
  }

  async function toggleAcotw(coverId: string, isAcotw: boolean) {
    if (!token) return;
    setBusyId(`acotw-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/set-acotw', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ coverId, isAcotw }),
    });
    if (!res.ok) setError('Could not update ACOTW status.');
    await loadDashboard();
    setBusyId(null);
  }

  async function banSelectedUser() {
    if (!selectedUser) return;
    setBusyId('ban-user');
    setError(null);
    const res = await fetch('/api/cms/ban-user', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: selectedUser.id, reason: banReason.trim() || null }),
    });
    if (!res.ok) setError('Could not ban user.');
    await loadDashboard();
    setBusyId(null);
  }

  async function unbanSelectedUser() {
    if (!selectedUser) return;
    setBusyId('unban-user');
    setError(null);
    const res = await fetch('/api/cms/unban-user', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: selectedUser.id }),
    });
    if (!res.ok) setError('Could not unban user.');
    await loadDashboard();
    setBusyId(null);
  }

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in to access CMS.</div>;
  if (operator === false) return <div>You are not an operator.</div>;

  return (
    <div className="route-container">
      <h1 className="route-title">Operator CMS</h1>
      <p className="route-subtitle">Moderate reports, published content, and users from one panel.</p>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}

      <section className="surface" style={{ marginBottom: 20, position: 'relative' }}>
        <h2 style={{ marginTop: 0 }}>User operations</h2>
        <input
          className="form-input"
          placeholder="Search username"
          value={userQuery}
          onChange={(e) => {
            setUserQuery(e.target.value);
            setSelectedUser(null);
          }}
        />
        {userOptions.length > 0 && !selectedUser && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6, overflow: 'hidden' }}>
            {userOptions.map((option) => (
              <button
                key={option.id}
                className="btn"
                style={{ width: '100%', borderRadius: 0, justifyContent: 'flex-start' }}
                onClick={() => {
                  setSelectedUser(option);
                  setUserQuery(option.username);
                  setUserOptions([]);
                }}
              >
                @{option.username}{option.display_name ? ` (${option.display_name})` : ''}
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div><strong>Selected:</strong> @{selectedUser.username}</div>
            <textarea
              className="form-input"
              placeholder="Ban reason (optional)"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={busyId === 'ban-user'} onClick={banSelectedUser}>Ban user</button>
              <button className="btn" disabled={!selectedUserBan || busyId === 'unban-user'} onClick={unbanSelectedUser}>Unban user</button>
            </div>
            {selectedUserBan && <p style={{ margin: 0 }}>Currently banned: {selectedUserBan.reason ?? 'No reason provided'}.</p>}
          </div>
        )}
      </section>

      <section className="surface" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Published content</h2>
        {data.published.length === 0 ? <p>No published covers.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.published.map((cover) => (
              <div key={cover.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div><strong>{cover.title}</strong> — {cover.artist}</div>
                <div>By: @{cover.username ?? cover.user_id}{cover.is_banned ? ' (banned user)' : ''}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn" disabled={busyId === `visibility-${cover.id}`} onClick={() => setCoverVisibility(cover.id, false)}>Unpublish</button>
                  <button className="btn" disabled={busyId === cover.id} onClick={() => deleteCover(cover.id)}>Delete</button>
                  <button
                    className="btn"
                    disabled={busyId === `acotw-${cover.id}`}
                    onClick={() => toggleAcotw(cover.id, !cover.is_acotw)}
                    style={cover.is_acotw ? { color: '#b8860b', borderColor: '#b8860b' } : {}}
                  >
                    {cover.is_acotw ? '★ Remove ACOTW' : '☆ Set as ACOTW'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Reports</h2>
        {data.reports.length === 0 ? <p>No reports.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.reports.map((report) => (
              <div key={report.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div><strong>Reason:</strong> {report.reason}</div>
                <div><strong>Cover:</strong> {report.cover_title ?? report.cover_id}</div>
                <div><strong>Reporter:</strong> {report.reporter_username ?? 'Unknown'}</div>
                {report.details && <div><strong>Details:</strong> {report.details}</div>}
                <button className="btn" onClick={() => deleteCover(report.cover_id)} disabled={busyId === report.cover_id} style={{ marginTop: 8 }}>
                  Delete cover
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface">
        <h2 style={{ marginTop: 0 }}>Active bans</h2>
        {data.bans.length === 0 ? <p>No bans.</p> : (
          <ul>
            {data.bans.map((ban) => (
              <li key={ban.user_id}>@{ban.username ?? ban.user_id} — {ban.reason ?? 'No reason provided'}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
