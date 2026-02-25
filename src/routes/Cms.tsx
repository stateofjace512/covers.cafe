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

type BlacklistItem = {
  value: string;
  reason: string | null;
  created_at: string;
};

type CoverLookupResult = {
  cover: { id: string; page_slug: string; title: string; artist: string; is_public: boolean; is_private: boolean; perma_unpublished: boolean; profiles?: { username?: string | null; display_name?: string | null } | null };
  nextByUser: Array<{ id: string; page_slug: string; title: string; artist: string; is_public: boolean; is_private: boolean; perma_unpublished: boolean; created_at: string }>;
};

type DashboardPayload = {
  reports: Report[];
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
  const [data, setData] = useState<DashboardPayload>({ reports: [], bans: [], operators: [] });
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

  // Legal operations
  const [removeTag, setRemoveTag] = useState('');

  // Official spam controls
  const [artistBlacklist, setArtistBlacklist] = useState<BlacklistItem[]>([]);
  const [phraseBlacklist, setPhraseBlacklist] = useState<BlacklistItem[]>([]);
  const [newArtistBlacklist, setNewArtistBlacklist] = useState('');
  const [newPhraseBlacklist, setNewPhraseBlacklist] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');

  // Fast cover lookup
  const [coverLookupInput, setCoverLookupInput] = useState('');
  const [coverLookupResult, setCoverLookupResult] = useState<CoverLookupResult | null>(null);

  // Perma-unpublish reason
  const [permaUnpublishReason, setPermaUnpublishReason] = useState('DMCA/compliance');

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

  async function loadBlacklist() {
    if (!token) return;
    const res = await fetch('/api/cms/official-blacklist', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const payload = await res.json() as { artists: Array<{ artist_name: string; reason: string | null; created_at: string }>; phrases: Array<{ phrase: string; reason: string | null; created_at: string }> };
    setArtistBlacklist((payload.artists ?? []).map((a) => ({ value: a.artist_name, reason: a.reason, created_at: a.created_at })));
    setPhraseBlacklist((payload.phrases ?? []).map((p) => ({ value: p.phrase, reason: p.reason, created_at: p.created_at })));
  }

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  useEffect(() => {
    loadDashboard();
    loadBlacklist();
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

  async function refreshLookupResult() {
    if (!token || !coverLookupInput.trim()) return;
    const res = await fetch(`/api/cms/cover-lookup?q=${encodeURIComponent(coverLookupInput.trim())}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setCoverLookupResult(await res.json() as CoverLookupResult);
  }

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
    await refreshLookupResult();
    setBusyId(null);
  }


  async function setCoverPermaUnpublished(coverId: string, enabled: boolean, reason?: string) {
    if (!token) return;
    setBusyId(`perma-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/perma-unpublish', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ coverId, enabled, reason }),
    });
    if (!res.ok) setError('Could not update perma-unpublish status.');
    else flash(enabled ? 'Cover permanently unpublished.' : 'Perma-unpublish removed.');
    await loadDashboard();
    await refreshLookupResult();
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


  async function addBlacklist(type: 'artist' | 'phrase') {
    if (!token) return;
    const value = (type === 'artist' ? newArtistBlacklist : newPhraseBlacklist).trim();
    if (!value) return;
    setBusyId(`blacklist-add-${type}`);
    const res = await fetch('/api/cms/official-blacklist', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ type, value, reason: blacklistReason.trim() || null }),
    });
    if (!res.ok) setError('Could not add blacklist rule.');
    else {
      if (type === 'artist') setNewArtistBlacklist(''); else setNewPhraseBlacklist('');
      setBlacklistReason('');
      flash('Blacklist updated.');
      await loadBlacklist();
    }
    setBusyId(null);
  }

  async function removeBlacklist(type: 'artist' | 'phrase', value: string) {
    if (!token) return;
    setBusyId(`blacklist-del-${type}-${value}`);
    const res = await fetch('/api/cms/official-blacklist', {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({ type, value }),
    });
    if (!res.ok) setError('Could not remove blacklist rule.');
    else {
      flash('Blacklist updated.');
      await loadBlacklist();
    }
    setBusyId(null);
  }

  async function lookupCoverByUrl() {
    if (!token || !coverLookupInput.trim()) return;
    setBusyId('cover-lookup');
    setCoverLookupResult(null);
    const res = await fetch(`/api/cms/cover-lookup?q=${encodeURIComponent(coverLookupInput.trim())}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError('Could not find that cover URL/slug.');
    } else {
      setCoverLookupResult(await res.json() as CoverLookupResult);
      flash('Cover lookup complete.');
    }
    setBusyId(null);
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in to access CMS.</div>;
  if (operator === false) return <div>You are not an operator.</div>;

  return (
    <div className="route-container">
      <h1 className="route-title">Operator CMS</h1>
      <p className="route-subtitle">Moderate reports, user controls, legal operations, and compliance tools.</p>

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


      {/* ── Official gallery spam controls ─────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">Official gallery spam controls</h2>
        <p className="cms-desc">Blacklist exact artists and loose phrases from official gallery/search results.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Add artist (exact)" value={newArtistBlacklist} onChange={(e) => setNewArtistBlacklist(e.target.value)} style={{ minWidth: 220 }} />
            <input className="form-input" placeholder="Reason (optional)" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} style={{ minWidth: 220 }} />
            <button className="btn btn-primary" onClick={() => addBlacklist('artist')} disabled={busyId === 'blacklist-add-artist'}>Add artist rule</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Add phrase contains" value={newPhraseBlacklist} onChange={(e) => setNewPhraseBlacklist(e.target.value)} style={{ minWidth: 220 }} />
            <button className="btn btn-primary" onClick={() => addBlacklist('phrase')} disabled={busyId === 'blacklist-add-phrase'}>Add phrase rule</button>
          </div>
          <div className="cms-ban-list">
            {artistBlacklist.map((item) => (
              <div key={`artist-${item.value}`} className="cms-ban-row">
                <div className="cms-ban-details">
                  <span className="cms-ban-user">Artist: {item.value}</span>
                  <span className="cms-ban-reason">{item.reason ?? 'No reason provided'}</span>
                </div>
                <button className="btn" onClick={() => removeBlacklist('artist', item.value)}>Remove</button>
              </div>
            ))}
            {phraseBlacklist.map((item) => (
              <div key={`phrase-${item.value}`} className="cms-ban-row">
                <div className="cms-ban-details">
                  <span className="cms-ban-user">Phrase: {item.value}</span>
                  <span className="cms-ban-reason">{item.reason ?? 'No reason provided'}</span>
                </div>
                <button className="btn" onClick={() => removeBlacklist('phrase', item.value)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fast cover lookup ───────────────────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">Fast cover lookup</h2>
        <p className="cms-desc">Paste a fan cover URL to load that cover and the next 10 by the same user.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="https://covers.cafe/covers/fan/..." value={coverLookupInput} onChange={(e) => setCoverLookupInput(e.target.value)} style={{ minWidth: 380, flex: 1 }} />
          <button className="btn btn-primary" onClick={lookupCoverByUrl} disabled={busyId === 'cover-lookup'}>Lookup</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <label className="cms-label">Removal reason:</label>
          <select className="form-input" style={{ width: 'auto' }} value={permaUnpublishReason} onChange={(e) => setPermaUnpublishReason(e.target.value)}>
            <option value="DMCA/compliance">DMCA/compliance</option>
            <option value="Spam/duplicate content">Spam/duplicate content</option>
            <option value="Inappropriate content">Inappropriate content</option>
            <option value="Other violation">Other violation</option>
          </select>
        </div>
        {coverLookupResult && (
          <div className="cms-ban-list" style={{ marginTop: 10 }}>
            <div className="cms-ban-row">
              <div className="cms-ban-details">
                <span className="cms-ban-user">{coverLookupResult.cover.artist} — {coverLookupResult.cover.title}</span>
                <span className="cms-ban-reason">/{coverLookupResult.cover.page_slug}{coverLookupResult.cover.perma_unpublished ? ' · perma-unpublished' : ''}</span>
              </div>
              <button className="btn" onClick={() => setCoverVisibility(coverLookupResult.cover.id, !coverLookupResult.cover.is_public)} disabled={coverLookupResult.cover.perma_unpublished || busyId === `visibility-${coverLookupResult.cover.id}`} title={coverLookupResult.cover.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{coverLookupResult.cover.is_public ? 'Unpublish' : 'Publish'}</button>
              <button className="btn" onClick={() => setCoverPermaUnpublished(coverLookupResult.cover.id, !coverLookupResult.cover.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${coverLookupResult.cover.id}`}>{coverLookupResult.cover.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
            </div>
            {coverLookupResult.nextByUser.map((c) => (
              <div key={c.id} className="cms-ban-row">
                <div className="cms-ban-details">
                  <span className="cms-ban-user">{c.artist} — {c.title}</span>
                  <span className="cms-ban-reason">/{c.page_slug}{c.perma_unpublished ? ' · perma-unpublished' : ''}</span>
                </div>
                <button className="btn" onClick={() => setCoverVisibility(c.id, !c.is_public)} disabled={c.perma_unpublished || busyId === `visibility-${c.id}`} title={c.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{c.is_public ? 'Unpublish' : 'Publish'}</button>
                <button className="btn" onClick={() => setCoverPermaUnpublished(c.id, !c.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${c.id}`}>{c.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
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


      
    </div>
  );
}
