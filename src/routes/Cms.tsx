import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function coverThumbUrl(storagePath: string) {
  if (storagePath.startsWith('cf:')) {
    return `/api/cover-media?path=${encodeURIComponent(storagePath)}`;
  }
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_covers/${storagePath}?width=80&height=80&resize=cover&quality=70`;
}

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
  storage_path: string;
  is_public: boolean;
  is_private: boolean;
  is_banned: boolean;
  is_operator: boolean;
};

type Ban = {
  user_id: string;
  username: string | null;
  reason: string | null;
  banned_at: string;
  expires_at: string | null;
};

type Operator = {
  user_id: string;
  username: string | null;
  can_be_removed: boolean;
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
  operators: Operator[];
};

// ---------------------------------------------------------------------------
// Timed ban helper: build an ISO string N days from now
// ---------------------------------------------------------------------------
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Cms() {
  const { user, session, loading, openAuthModal } = useAuth();
  const [data, setData] = useState<DashboardPayload>({ reports: [], published: [], bans: [], operators: [] });
  const [operator, setOperator] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User operations
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<'permanent' | '1' | '3' | '7' | '30'>('permanent');

  // Published content filter
  const [contentFilter, setContentFilter] = useState('');

  // Legal operations
  const [removeTag, setRemoveTag] = useState('');

  // Cloudflare migration
  const [migrating, setMigrating] = useState(false);
  const [migrateLog, setMigrateLog] = useState<string[]>([]);
  const [migrateDone, setMigrateDone] = useState<{ migrated: number; failed: number; remaining: number } | null>(null);
  const [migrateBatch, setMigrateBatch] = useState(50);
  const [migrateType, setMigrateType] = useState<'all' | 'covers' | 'avatars' | 'artist-photos'>('all');

  const token = session?.access_token;

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const selectedUserBan = selectedUser
    ? data.bans.find((ban) => ban.user_id === selectedUser.id)
    : null;

  const selectedUserIsOperator = selectedUser
    ? data.operators.some((op) => op.user_id === selectedUser.id)
    : false;

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
      setUserOptions(await res.json() as UserOption[]);
    }, 150);
    return () => clearTimeout(handle);
  }, [userQuery, token]);

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  // ── Cover actions ──────────────────────────────────────────────────────────

  async function deleteCover(coverId: string) {
    if (!token) return;
    setBusyId(coverId);
    setError(null);
    const res = await fetch('/api/cms/delete-cover', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ coverId }),
    });
    if (!res.ok) setError('Could not delete cover.');
    else flash('Cover deleted.');
    await loadDashboard();
    setBusyId(null);
  }

  async function setCoverVisibility(coverId: string, isPublic: boolean) {
    if (!token) return;
    setBusyId(`visibility-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/cover-visibility', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ coverId, isPublic }),
    });
    if (!res.ok) setError('Could not update visibility.');
    else flash('Visibility updated.');
    await loadDashboard();
    setBusyId(null);
  }

  async function setCoverPrivacy(coverId: string, isPrivate: boolean) {
    if (!token) return;
    setBusyId(`privacy-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/cover-private', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ coverId, isPrivate }),
    });
    if (!res.ok) setError('Could not update privacy.');
    else flash(isPrivate ? 'Cover set to private.' : 'Cover republished.');
    await loadDashboard();
    setBusyId(null);
  }

  // ── Report actions ─────────────────────────────────────────────────────────

  async function dismissReport(reportId: string) {
    if (!token) return;
    setBusyId(`dismiss-${reportId}`);
    setError(null);
    const res = await fetch('/api/cms/dismiss-report', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ reportId }),
    });
    if (!res.ok) setError('Could not dismiss report.');
    else flash('Report dismissed.');
    await loadDashboard();
    setBusyId(null);
  }

  // ── User / ban actions ─────────────────────────────────────────────────────

  async function banSelectedUser() {
    if (!selectedUser) return;
    setBusyId('ban-user');
    setError(null);
    const expiresAt = banDuration === 'permanent' ? null : daysFromNow(Number(banDuration));
    const res = await fetch('/api/cms/ban-user', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        userId: selectedUser.id,
        reason: banReason.trim() || null,
        expiresAt,
      }),
    });
    if (!res.ok) setError('Could not ban user.');
    else flash(`@${selectedUser.username} banned${banDuration !== 'permanent' ? ` for ${banDuration} day(s)` : ' permanently'}.`);
    await loadDashboard();
    setBusyId(null);
  }

  async function unbanSelectedUser() {
    if (!selectedUser) return;
    setBusyId('unban-user');
    setError(null);
    const res = await fetch('/api/cms/unban-user', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ userId: selectedUser.id }),
    });
    if (!res.ok) setError('Could not unban user.');
    else flash(`@${selectedUser.username} unbanned.`);
    await loadDashboard();
    setBusyId(null);
  }

  async function unbanByUserId(userId: string, username: string | null) {
    setBusyId(`unban-${userId}`);
    setError(null);
    const res = await fetch('/api/cms/unban-user', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ userId }),
    });
    if (!res.ok) setError('Could not unban user.');
    else flash(`@${username ?? userId} unbanned.`);
    await loadDashboard();
    setBusyId(null);
  }

  async function setOperatorRole(userId: string, promote: boolean, username: string | null) {
    setBusyId(`operator-${userId}`);
    setError(null);
    const res = await fetch('/api/cms/set-operator', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ userId, promote }),
    });
    if (!res.ok) setError('Could not update operator role.');
    else flash(`@${username ?? userId} ${promote ? 'promoted to' : 'removed from'} operator.`);
    await loadDashboard();
    setBusyId(null);
  }

  // ── Legal operations ───────────────────────────────────────────────────────

  async function massRemoveByTag() {
    if (!token) return;
    const normalizedTag = removeTag.trim().toLowerCase();
    if (!normalizedTag) { setError('Enter a tag to remove matching covers.'); return; }
    if (!window.confirm(`Delete every cover tagged "${normalizedTag}"? This cannot be undone.`)) return;

    setBusyId('mass-remove-tag');
    setError(null);
    const res = await fetch('/api/cms/delete-by-tag', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ tag: normalizedTag }),
    });

    if (!res.ok) {
      setError((await res.text()) || 'Could not mass remove by tag.');
    } else {
      const payload = await res.json() as { deletedCount?: number };
      flash(`Removed ${payload.deletedCount ?? 0} cover(s) tagged "${normalizedTag}".`);
      setRemoveTag('');
    }
    await loadDashboard();
    setBusyId(null);
  }

  // ── Filtered covers ────────────────────────────────────────────────────────

  const filteredCovers = useMemo(() => {
    const q = contentFilter.trim().toLowerCase();
    if (!q) return data.published;
    return data.published.filter(
      (c) =>
        (c.username ?? '').toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.artist.toLowerCase().includes(q),
    );
  }, [data.published, contentFilter]);

  // Group filtered covers by user
  const coversByUser = useMemo(() => {
    const map = new Map<string, { username: string | null; covers: PublishedCover[] }>();
    for (const cover of filteredCovers) {
      if (!map.has(cover.user_id)) {
        map.set(cover.user_id, { username: cover.username, covers: [] });
      }
      map.get(cover.user_id)!.covers.push(cover);
    }
    return [...map.entries()];
  }, [filteredCovers]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in to access CMS.</div>;
  if (operator === false) return <div>You are not an operator.</div>;

  return (
    <div className="route-container">
      <h1 className="route-title">Operator CMS</h1>
      <p className="route-subtitle">Moderate reports, published content, and users from one panel.</p>

      {error && <p className="cms-msg cms-msg--err">{error}</p>}
      {successMsg && <p className="cms-msg cms-msg--ok">{successMsg}</p>}

      {/* ── User operations ────────────────────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">User operations</h2>

        <div style={{ position: 'relative' }}>
          <input
            className="form-input"
            placeholder="Search username…"
            value={userQuery}
            onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
          />
          {userOptions.length > 0 && !selectedUser && (
            <div className="cms-dropdown">
              {userOptions.map((option) => (
                <button
                  key={option.id}
                  className="btn cms-dropdown-item"
                  onClick={() => { setSelectedUser(option); setUserQuery(option.username); setUserOptions([]); }}
                >
                  @{option.username}{option.display_name ? ` (${option.display_name})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="cms-user-panel">
            <div className="cms-user-header">
              <strong>@{selectedUser.username}</strong>
              {selectedUserBan && <span className="cms-badge cms-badge--banned">Banned</span>}
              {selectedUserIsOperator && <span className="cms-badge cms-badge--op">Operator</span>}
            </div>

            {selectedUserBan && (
              <div className="cms-ban-info">
                <span>Reason: {selectedUserBan.reason ?? 'No reason provided'}</span>
                {selectedUserBan.expires_at && (
                  <span>Expires: {formatDate(selectedUserBan.expires_at)}</span>
                )}
              </div>
            )}

            {/* Ban form */}
            <div className="cms-field-group">
              <textarea
                className="form-input"
                placeholder="Ban reason (optional)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={2}
              />
              <div className="cms-row">
                <label className="cms-label">Duration</label>
                <select
                  className="form-input cms-select"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value as typeof banDuration)}
                >
                  <option value="permanent">Permanent</option>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
            </div>

            <div className="cms-actions">
              <button className="btn btn-primary" disabled={busyId === 'ban-user'} onClick={banSelectedUser}>
                {selectedUserBan ? 'Update ban' : 'Ban user'}
              </button>
              <button
                className="btn"
                disabled={!selectedUserBan || busyId === 'unban-user'}
                onClick={unbanSelectedUser}
              >
                Unban
              </button>
              <button
                className="btn"
                disabled={busyId === `operator-${selectedUser.id}`}
                onClick={() => setOperatorRole(selectedUser.id, !selectedUserIsOperator, selectedUser.username)}
              >
                {selectedUserIsOperator ? 'Remove operator' : 'Make operator'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Published content ──────────────────────────────────────────── */}
      <section className="surface cms-section">
        <div className="cms-section-header">
          <h2 className="cms-h2" style={{ margin: 0 }}>Published content</h2>
          <span className="cms-count">{data.published.length} covers</span>
        </div>

        <input
          className="form-input"
          placeholder="Filter by username, title, or artist…"
          value={contentFilter}
          onChange={(e) => setContentFilter(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {filteredCovers.length === 0 ? (
          <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>
            {contentFilter ? 'No covers match this filter.' : 'No published covers.'}
          </p>
        ) : (
          <div className="cms-covers-list">
            {coversByUser.map(([userId, group]) => (
              <div key={userId} className="cms-user-group">
                <div className="cms-user-group-header">
                  <span>@{group.username ?? userId}</span>
                  <span className="cms-count">{group.covers.length}</span>
                </div>
                {group.covers.map((cover) => (
                  <div key={cover.id} className="cms-cover-row">
                    {cover.storage_path && (
                      <img
                        src={coverThumbUrl(cover.storage_path)}
                        alt=""
                        className="cms-cover-thumb"
                      />
                    )}
                    <div className="cms-cover-meta">
                      <strong>{cover.title}</strong>
                      <span>{cover.artist}</span>
                    </div>
                    <div className="cms-cover-badges">
                      {cover.is_private && <span className="cms-badge cms-badge--private">Private</span>}
                    </div>
                    <div className="cms-actions cms-actions--inline">
                      {cover.is_private ? (
                        <button
                          className="btn"
                          disabled={busyId === `privacy-${cover.id}`}
                          onClick={() => setCoverPrivacy(cover.id, false)}
                        >
                          Republish
                        </button>
                      ) : (
                        <button
                          className="btn"
                          disabled={busyId === `privacy-${cover.id}`}
                          onClick={() => setCoverPrivacy(cover.id, true)}
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        className="btn cms-btn-danger"
                        disabled={busyId === cover.id}
                        onClick={() => deleteCover(cover.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Reports ────────────────────────────────────────────────────── */}
      <section className="surface cms-section">
        <div className="cms-section-header">
          <h2 className="cms-h2" style={{ margin: 0 }}>Reports</h2>
          {data.reports.length > 0 && <span className="cms-badge cms-badge--warn">{data.reports.length}</span>}
        </div>

        {data.reports.length === 0 ? (
          <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>No reports.</p>
        ) : (
          <div className="cms-report-list">
            {data.reports.map((report) => (
              <div key={report.id} className="cms-report-card">
                <div className="cms-report-meta">
                  <span><strong>Reason:</strong> {report.reason}</span>
                  <span><strong>Cover:</strong> {report.cover_title ?? report.cover_id}</span>
                  <span><strong>Reporter:</strong> @{report.reporter_username ?? 'Unknown'}</span>
                  {report.details && <span><strong>Details:</strong> {report.details}</span>}
                </div>
                <div className="cms-actions">
                  <button
                    className="btn"
                    onClick={() => dismissReport(report.id)}
                    disabled={busyId === `dismiss-${report.id}`}
                    title="Disregard this report without removing the cover"
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn cms-btn-danger"
                    onClick={() => deleteCover(report.cover_id)}
                    disabled={busyId === report.cover_id}
                  >
                    Delete cover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Active bans ────────────────────────────────────────────────── */}
      <section className="surface cms-section">
        <div className="cms-section-header">
          <h2 className="cms-h2" style={{ margin: 0 }}>Active bans</h2>
          {data.bans.length > 0 && <span className="cms-count">{data.bans.length}</span>}
        </div>

        {data.bans.length === 0 ? (
          <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>No active bans.</p>
        ) : (
          <div className="cms-ban-list">
            {data.bans.map((ban) => (
              <div key={ban.user_id} className="cms-ban-row">
                <div className="cms-ban-details">
                  <span className="cms-ban-user">@{ban.username ?? ban.user_id}</span>
                  <span className="cms-ban-reason">{ban.reason ?? 'No reason provided'}</span>
                  <span className="cms-ban-date">
                    Banned {formatDate(ban.banned_at)}
                    {ban.expires_at && ` · expires ${formatDate(ban.expires_at)}`}
                  </span>
                </div>
                <button
                  className="btn"
                  disabled={busyId === `unban-${ban.user_id}`}
                  onClick={() => unbanByUserId(ban.user_id, ban.username)}
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Current operators ──────────────────────────────────────────── */}
      <section className="surface cms-section">
        <div className="cms-section-header">
          <h2 className="cms-h2" style={{ margin: 0 }}>Operators</h2>
          <span className="cms-count">{data.operators.length}</span>
        </div>
        {data.operators.length === 0 ? (
          <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>No operators.</p>
        ) : (
          <div className="cms-op-list">
            {data.operators.map((op) => (
              <div key={op.user_id} className="cms-op-row">
                <span>@{op.username ?? op.user_id}</span>
                {op.user_id !== user?.id && op.can_be_removed !== false && (
                  <button
                    className="btn cms-btn-danger"
                    disabled={busyId === `operator-${op.user_id}`}
                    onClick={() => setOperatorRole(op.user_id, false, op.username)}
                  >
                    Remove
                  </button>
                )}
                {op.can_be_removed === false && op.user_id !== user?.id && (
                  <span className="cms-badge cms-badge--locked" title="This operator cannot be removed">Locked</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Legal operations ───────────────────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">Legal operations</h2>
        <p className="cms-desc">Mass remove all covers matching a specific tag.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Tag (e.g. infringing-label)"
            value={removeTag}
            onChange={(e) => setRemoveTag(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <button className="btn btn-primary" disabled={busyId === 'mass-remove-tag'} onClick={massRemoveByTag}>
            Mass remove by tag
          </button>
        </div>
      </section>

      {/* ── Cloudflare Image Migration ──────────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">Cloudflare Image Migration</h2>
        <p className="cms-desc">
          Migrate images from Supabase storage to Cloudflare Images. Process {migrateBatch} items per run.
          {migrateDone && !migrating && (
            <> Last run: <strong>{migrateDone.migrated}</strong> migrated, <strong>{migrateDone.failed}</strong> failed, <strong>{migrateDone.remaining}</strong> remaining.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={migrateType}
            onChange={(e) => setMigrateType(e.target.value as typeof migrateType)}
            disabled={migrating}
          >
            <option value="all">All (covers + avatars + artist photos)</option>
            <option value="covers">Covers only</option>
            <option value="avatars">Avatars only</option>
            <option value="artist-photos">Artist photos only</option>
          </select>
          <input
            type="number"
            className="form-input"
            style={{ width: 90 }}
            min={1}
            max={200}
            value={migrateBatch}
            onChange={(e) => setMigrateBatch(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 50)))}
            disabled={migrating}
            title="Batch size (1–200)"
          />
          <button
            className="btn btn-primary"
            disabled={migrating || !token}
            onClick={async () => {
              if (!token) return;
              setMigrating(true);
              setMigrateLog([]);
              setMigrateDone(null);
              const params = new URLSearchParams({ batch: String(migrateBatch), type: migrateType });
              const es = new EventSource(`/api/cms/migrate-images?${params.toString()}`);
              // SSE doesn't support custom headers; need to append token as query param
              // Actually use fetch-based SSE workaround via a streaming fetch
              es.close();

              // Use fetch streaming instead (EventSource doesn't support Authorization header)
              const res = await fetch(`/api/cms/migrate-images?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok || !res.body) {
                setMigrateLog(['Error: could not start migration.']);
                setMigrating(false);
                return;
              }
              const reader = res.body.getReader();
              const dec = new TextDecoder();
              let buf = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  try {
                    const evt = JSON.parse(line.slice(6)) as { type: string; message?: string; migrated?: number; failed?: number; remaining?: number };
                    if (evt.type === 'log' && evt.message) {
                      setMigrateLog((prev) => [...prev, evt.message!]);
                    } else if (evt.type === 'done') {
                      setMigrateDone({ migrated: evt.migrated ?? 0, failed: evt.failed ?? 0, remaining: evt.remaining ?? 0 });
                    }
                  } catch { /* ignore parse errors */ }
                }
              }
              setMigrating(false);
            }}
          >
            {migrating ? '⏳ Migrating…' : '🚀 Start Migration'}
          </button>
          {migrating && (
            <button className="btn btn-secondary" onClick={() => setMigrating(false)}>
              Stop
            </button>
          )}
        </div>
        {(migrateLog.length > 0 || migrating) && (
          <textarea
            readOnly
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: 15, height: 280, resize: 'vertical', whiteSpace: 'pre' }}
            value={migrateLog.join('\n') + (migrating ? '\n\u2026' : migrateDone ? `\n\n\u2705 Done — ${migrateDone.migrated} migrated, ${migrateDone.failed} failed, ${migrateDone.remaining} still remaining.` : '')}
            ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
          />
        )}
      </section>

      <style>{`
        .cms-section { margin-bottom: 20px; padding: 20px 22px; }
        .cms-h2 { font-size: 21px; margin: 0 0 14px; color: var(--body-text); }
        .cms-desc { font-size: 19px; color: var(--body-text-muted); margin: 0 0 10px; }
        .cms-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .cms-count { font-size: 18px; color: var(--body-text-muted); background: var(--body-border); padding: 2px 7px; border-radius: 10px; }
        .cms-msg { padding: 9px 14px; border-radius: 6px; font-size: 19px; margin-bottom: 12px; }
        .cms-msg--ok { background: rgba(40,160,80,0.1); border: 1px solid rgba(40,160,80,0.35); color: #1a7a40; }
        .cms-msg--err { background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3); color: #b42318; }

        /* Badges */
        .cms-badge { font-size: 17px; padding: 2px 7px; border-radius: 10px; }
        .cms-badge--banned { background: rgba(200,50,30,0.12); color: #b42318; border: 1px solid rgba(200,50,30,0.25); }
        .cms-badge--op { background: rgba(115,73,42,0.12); color: var(--accent); border: 1px solid rgba(115,73,42,0.25); }
        .cms-badge--warn { background: rgba(200,130,0,0.12); color: #a06000; border: 1px solid rgba(200,130,0,0.25); font-size: 18px; padding: 2px 8px; border-radius: 10px; }
        .cms-badge--private { background: rgba(120,100,140,0.12); color: #6a4a8a; border: 1px solid rgba(120,100,140,0.3); }
        .cms-badge--locked { background: rgba(80,80,80,0.12); color: #555; border: 1px solid rgba(80,80,80,0.25); }
        .cms-cover-badges { display: flex; gap: 4px; align-items: center; }

        /* User panel */
        .cms-dropdown { position: absolute; z-index: 10; width: 100%; border: 1px solid var(--border); border-radius: 8px; margin-top: 4px; overflow: hidden; background: var(--body-card-bg); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        .cms-dropdown-item { width: 100%; border-radius: 0; justify-content: flex-start; text-align: left; }
        .cms-user-panel { margin-top: 12px; padding: 14px; border: 1px solid var(--body-border); border-radius: 8px; display: grid; gap: 10px; background: var(--body-card-bg); }
        .cms-user-header { display: flex; align-items: center; gap: 8px; font-size: 20px; }
        .cms-ban-info { font-size: 18px; color: var(--body-text-muted); display: flex; flex-direction: column; gap: 2px; }
        .cms-field-group { display: grid; gap: 8px; }
        .cms-row { display: flex; align-items: center; gap: 8px; }
        .cms-label { font-size: 18px; color: var(--body-text-muted); white-space: nowrap; }
        .cms-select { flex: 1; }
        .cms-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cms-actions--inline { flex-shrink: 0; }

        /* Cover list */
        .cms-covers-list { display: grid; gap: 12px; }
        .cms-user-group { border: 1px solid var(--body-border); border-radius: 8px; overflow: hidden; }
        .cms-user-group-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--body-card-bg); font-size: 19px; border-bottom: 1px solid var(--body-border); }
        .cms-cover-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--body-border); }
        .cms-cover-row:last-child { border-bottom: none; }
        .cms-cover-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 4px; flex-shrink: 0; border: 1px solid var(--body-border); }
        .cms-cover-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 19px; overflow: hidden; }
        .cms-cover-meta strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cms-cover-meta span { color: var(--body-text-muted); font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Reports */
        .cms-report-list { display: grid; gap: 10px; }
        .cms-report-card { border: 1px solid var(--body-border); border-radius: 8px; padding: 12px; display: grid; gap: 10px; }
        .cms-report-meta { display: flex; flex-direction: column; gap: 4px; font-size: 19px; }

        /* Bans */
        .cms-ban-list { display: grid; gap: 8px; }
        .cms-ban-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--body-border); border-radius: 8px; }
        .cms-ban-details { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .cms-ban-user { font-size: 19px; }
        .cms-ban-reason { font-size: 18px; color: var(--body-text-muted); }
        .cms-ban-date { font-size: 17px; color: var(--body-text-muted); }

        /* Operators */
        .cms-op-list { display: grid; gap: 6px; }
        .cms-op-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--body-border); border-radius: 8px; font-size: 19px; }

        /* Danger button */
        .cms-btn-danger {
          background: linear-gradient(180deg, #e04030 0%, #b83020 100%);
          color: #fff; border-color: #a02818;
        }
        .cms-btn-danger:hover { background: linear-gradient(180deg, #e85040 0%, #c03828 100%); transform: translateY(-1px); }
        .cms-btn-danger:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}
