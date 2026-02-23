import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { slugifyArtist } from '../lib/coverRoutes';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function coverThumbUrl(storagePath: string) {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_covers/${storagePath}?width=80&height=80&resize=cover&quality=70`;
}

// ── iTunes helpers ──────────────────────────────────────────────────────────

function getFullResAppleCover(smallUrl: string): string {
  if (!smallUrl || !smallUrl.includes('mzstatic.com')) return smallUrl;
  let full = smallUrl
    .replace(/https:\/\/is\d+-ssl\.mzstatic\.com\/image\/thumb\//, 'https://a1.mzstatic.com/r40/')
    .replace(/https:\/\/is\d+-ssl\.mzstatic\.com\/image\//, 'https://a1.mzstatic.com/r40/');
  full = full.replace(/\/\d+x\d+(bb|w|cc|sr)?\.(jpg|webp|png|tif)$/, '');
  if (full === smallUrl) {
    full = smallUrl.replace(/100x100bb|60x60bb/, '1400x1400bb');
  }
  return full;
}

interface ItunesResult {
  artist_name: string;
  artist_slug: string;
  album_title: string;
  release_year: string | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  country: string;
}

interface SavedOfficialCover {
  id: string;
  artist_name: string;
  artist_slug: string;
  album_title: string;
  release_year: string | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  country: string;
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

  // Official covers
  const [itunesArtist, setItunesArtist] = useState('');
  const [itunesAlbum, setItunesAlbum] = useState('');
  const [itunesCountry, setItunesCountry] = useState('us');
  const [itunesResults, setItunesResults] = useState<ItunesResult[]>([]);
  const [itunesSelected, setItunesSelected] = useState<Set<number>>(new Set());
  const [itunesSearching, setItunesSearching] = useState(false);
  const [itunesSaving, setItunesSaving] = useState(false);
  const [savedCovers, setSavedCovers] = useState<SavedOfficialCover[]>([]);
  const [savedCoversArtistFilter, setSavedCoversArtistFilter] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const savedCoversLoadedRef = useRef(false);

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

  // ── Official covers ────────────────────────────────────────────────────────

  async function loadSavedOfficialCovers() {
    setLoadingSaved(true);
    const res = await fetch('/api/official-covers');
    if (res.ok) {
      const data = await res.json() as { covers: SavedOfficialCover[] };
      setSavedCovers(data.covers ?? []);
    }
    setLoadingSaved(false);
  }

  async function searchItunes() {
    const artist = itunesArtist.trim();
    if (!artist) return;
    setItunesSearching(true);
    setItunesResults([]);
    setItunesSelected(new Set());
    try {
      const term = encodeURIComponent(`${artist} ${itunesAlbum}`.trim());
      const url = `https://itunes.apple.com/search?term=${term}&entity=album&country=${itunesCountry}&limit=25`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('iTunes fetch failed');
      const { results } = await res.json() as { results: Array<{ artworkUrl100?: string; artistName?: string; collectionName?: string; releaseDate?: string }> };

      const items: ItunesResult[] = [];
      for (const item of results) {
        const small = item.artworkUrl100;
        if (!small) continue;
        items.push({
          artist_name: (item.artistName ?? artist).trim(),
          artist_slug: slugifyArtist((item.artistName ?? artist).trim()),
          album_title: (item.collectionName ?? '').trim(),
          release_year: item.releaseDate?.slice(0, 4) ?? null,
          album_cover_url: getFullResAppleCover(small),
          pixel_dimensions: null,
          country: itunesCountry,
        });
      }
      setItunesResults(items);
      setItunesSelected(new Set(items.map((_, i) => i)));
    } catch {
      setError('iTunes search failed. Try again.');
    }
    setItunesSearching(false);
  }

  async function saveSelectedOfficialCovers() {
    if (!token || itunesSelected.size === 0) return;
    setItunesSaving(true);
    setError(null);
    const covers = [...itunesSelected].map((i) => itunesResults[i]).filter(Boolean);
    const res = await fetch('/api/cms/save-official-covers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ covers }),
    });
    if (!res.ok) {
      setError('Could not save official covers.');
    } else {
      const payload = await res.json() as { saved?: number };
      flash(`Saved ${payload.saved ?? covers.length} official cover(s).`);
      setItunesResults([]);
      setItunesSelected(new Set());
      await loadSavedOfficialCovers();
    }
    setItunesSaving(false);
  }

  async function deleteOfficialCover(id: string) {
    if (!token) return;
    setBusyId(`official-del-${id}`);
    setError(null);
    const res = await fetch('/api/cms/delete-official-cover', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id }),
    });
    if (!res.ok) setError('Could not delete official cover.');
    else {
      flash('Official cover deleted.');
      setSavedCovers((prev) => prev.filter((c) => c.id !== id));
    }
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

      {/* ── Official covers ────────────────────────────────────────────── */}
      <section className="surface cms-section">
        <h2 className="cms-h2">Official covers</h2>
        <p className="cms-desc">Search Apple Music / iTunes and save official album artwork to the Official section.</p>

        {/* iTunes search */}
        <div className="cms-itunes-row">
          <input
            className="form-input"
            placeholder="Artist (required)"
            value={itunesArtist}
            onChange={(e) => setItunesArtist(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchItunes(); }}
            style={{ flex: '2 1 160px' }}
          />
          <input
            className="form-input"
            placeholder="Album (optional)"
            value={itunesAlbum}
            onChange={(e) => setItunesAlbum(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchItunes(); }}
            style={{ flex: '2 1 160px' }}
          />
          <select
            className="form-input cms-select"
            value={itunesCountry}
            onChange={(e) => setItunesCountry(e.target.value)}
            style={{ flex: '0 0 auto' }}
          >
            <option value="us">US</option>
            <option value="gb">UK</option>
            <option value="jp">Japan</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={searchItunes}
            disabled={itunesSearching || !itunesArtist.trim()}
          >
            {itunesSearching ? 'Searching…' : 'Search iTunes'}
          </button>
        </div>

        {itunesResults.length > 0 && (
          <>
            <div className="cms-itunes-controls">
              <span className="cms-count">{itunesResults.length} result{itunesResults.length !== 1 ? 's' : ''}</span>
              <button
                className="btn"
                style={{ fontSize: 17, padding: '3px 10px' }}
                onClick={() => setItunesSelected(new Set(itunesResults.map((_, i) => i)))}
              >
                Select all
              </button>
              <button
                className="btn"
                style={{ fontSize: 17, padding: '3px 10px' }}
                onClick={() => setItunesSelected(new Set())}
              >
                Deselect all
              </button>
              <button
                className="btn btn-primary"
                disabled={itunesSaving || itunesSelected.size === 0}
                onClick={saveSelectedOfficialCovers}
              >
                {itunesSaving ? 'Saving…' : `Save ${itunesSelected.size} selected`}
              </button>
            </div>

            <div className="cms-itunes-grid">
              {itunesResults.map((item, i) => (
                <button
                  key={i}
                  className={`cms-itunes-card${itunesSelected.has(i) ? ' cms-itunes-card--selected' : ''}`}
                  onClick={() => setItunesSelected((prev) => {
                    const next = new Set(prev);
                    next.has(i) ? next.delete(i) : next.add(i);
                    return next;
                  })}
                  title={`${item.album_title}${item.release_year ? ` (${item.release_year})` : ''}`}
                >
                  <div className="cms-itunes-img-wrap">
                    <img src={item.album_cover_url} alt={item.album_title} className="cms-itunes-img" loading="lazy" />
                    {itunesSelected.has(i) && <div className="cms-itunes-check">✓</div>}
                  </div>
                  <div className="cms-itunes-meta">
                    <span className="cms-itunes-title">{item.album_title}</span>
                    <span className="cms-itunes-artist">{item.artist_name}{item.release_year ? ` · ${item.release_year}` : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Saved official covers */}
        <div className="cms-section-header" style={{ marginTop: 24, marginBottom: 8 }}>
          <h3 className="cms-h2" style={{ fontSize: 19, margin: 0 }}>Saved official covers</h3>
          <button
            className="btn"
            style={{ fontSize: 17, padding: '3px 10px' }}
            onClick={() => { savedCoversLoadedRef.current = true; loadSavedOfficialCovers(); }}
            disabled={loadingSaved}
          >
            {loadingSaved ? 'Loading…' : savedCoversLoadedRef.current ? 'Refresh' : 'Load'}
          </button>
        </div>

        {savedCoversLoadedRef.current && (
          <>
            <input
              className="form-input"
              placeholder="Filter by artist or album…"
              value={savedCoversArtistFilter}
              onChange={(e) => setSavedCoversArtistFilter(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            {loadingSaved ? (
              <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>Loading…</p>
            ) : savedCovers.length === 0 ? (
              <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>No official covers saved yet.</p>
            ) : (
              <div className="cms-covers-list">
                {savedCovers
                  .filter((c) => {
                    const q = savedCoversArtistFilter.trim().toLowerCase();
                    if (!q) return true;
                    return c.artist_name.toLowerCase().includes(q) || c.album_title.toLowerCase().includes(q);
                  })
                  .map((cover) => (
                    <div key={cover.id} className="cms-cover-row">
                      <img
                        src={cover.album_cover_url}
                        alt={cover.album_title}
                        className="cms-cover-thumb"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="cms-cover-meta">
                        <strong>{cover.album_title}</strong>
                        <span>{cover.artist_name}{cover.release_year ? ` · ${cover.release_year}` : ''}</span>
                      </div>
                      <div className="cms-actions cms-actions--inline">
                        <button
                          className="btn cms-btn-danger"
                          disabled={busyId === `official-del-${cover.id}`}
                          onClick={() => deleteOfficialCover(cover.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
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

        /* Official covers / iTunes */
        .cms-itunes-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .cms-itunes-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .cms-itunes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 6px;
        }
        .cms-itunes-card {
          display: flex; flex-direction: column; gap: 0;
          cursor: pointer; text-align: left; width: 100%; padding: 0;
          background: var(--body-card-bg); border: 2px solid var(--body-card-border);
          border-radius: 6px; overflow: hidden;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .cms-itunes-card:hover { border-color: var(--accent); }
        .cms-itunes-card--selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(192,90,26,0.25); }
        .cms-itunes-img-wrap {
          position: relative; width: 100%; aspect-ratio: 1;
          background: var(--sidebar-bg); overflow: hidden;
        }
        .cms-itunes-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cms-itunes-check {
          position: absolute; top: 5px; right: 5px;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: bold;
        }
        .cms-itunes-meta { padding: 7px 9px; display: flex; flex-direction: column; gap: 2px; }
        .cms-itunes-title {
          font-size: 18px; color: var(--body-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cms-itunes-artist { font-size: 16px; color: var(--body-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </div>
  );
}
