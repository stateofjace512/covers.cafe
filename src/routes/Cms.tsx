import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { computePhash } from '../lib/phash';

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

type CoverListItem = {
  id: string;
  page_slug: string;
  title: string;
  artist: string;
  is_public: boolean;
  is_private: boolean;
  perma_unpublished: boolean;
  created_at: string;
};

type PohPin = {
  id: string;
  comment_id: string;
  comment_content: string;
  author_username: string;
  cover_title: string | null;
  cover_artist: string | null;
  page_slug: string | null;
  pinned_at: string;
};

type RecentComment = {
  id: string;
  content: string;
  author_username: string;
  user_id: string | null;
  page_slug: string;
  created_at: string;
  cover_id: string | null;
  cover_title: string | null;
  cover_artist: string | null;
  cover_storage_path: string | null;
  cover_image_url: string | null;
  is_already_pinned: boolean;
};

type ProfileReport = {
  id: string;
  reason: string;
  details: string | null;
  profile_id: string;
  reported_username: string | null;
  reporter_username: string | null;
  created_at: string;
};

type DashboardPayload = {
  reports: Report[];
  profileReports: ProfileReport[];
  bans: Ban[];
  operators: Operator[];
};

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author_username: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type Tab = 'moderation' | 'users' | 'covers' | 'community' | 'blog' | 'about';

const TABS: { id: Tab; label: string; badge?: (d: DashboardPayload) => number }[] = [
  { id: 'moderation', label: 'Moderation', badge: (d) => d.reports.length + d.profileReports.length },
  { id: 'users',      label: 'Users' },
  { id: 'covers',     label: 'Covers' },
  { id: 'community',  label: 'Community' },
  { id: 'blog',       label: 'Blog' },
  { id: 'about',      label: 'About Editor' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Cms() {
  const { user, session, loading, openAuthModal } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') ?? 'moderation') as Tab;

  const [data, setData] = useState<DashboardPayload>({ reports: [], profileReports: [], bans: [], operators: [] });
  const [operator, setOperator] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── User operations ──────────────────────────────────────────────────────
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<'permanent' | '1' | '3' | '7' | '30'>('permanent');

  // ── Legal operations ─────────────────────────────────────────────────────
  const [removeTag, setRemoveTag] = useState('');

  // ── Official spam controls ────────────────────────────────────────────────
  const [artistBlacklist, setArtistBlacklist] = useState<BlacklistItem[]>([]);
  const [phraseBlacklist, setPhraseBlacklist] = useState<BlacklistItem[]>([]);
  const [newArtistBlacklist, setNewArtistBlacklist] = useState('');
  const [newPhraseBlacklist, setNewPhraseBlacklist] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');

  // ── Fast cover lookup ─────────────────────────────────────────────────────
  const [coverLookupInput, setCoverLookupInput] = useState('');
  const [coverLookupResult, setCoverLookupResult] = useState<CoverLookupResult | null>(null);
  const [permaUnpublishReason, setPermaUnpublishReason] = useState('DMCA/compliance');

  // ── User cover browser ────────────────────────────────────────────────────
  const [userBrowserQuery, setUserBrowserQuery] = useState('');
  const [userBrowserOptions, setUserBrowserOptions] = useState<UserOption[]>([]);
  const [userBrowserSelected, setUserBrowserSelected] = useState<UserOption | null>(null);
  const [userBrowserCovers, setUserBrowserCovers] = useState<CoverListItem[]>([]);
  const [userBrowserTotal, setUserBrowserTotal] = useState(0);
  const [userBrowserPage, setUserBrowserPage] = useState(1);
  const [userBrowserLoading, setUserBrowserLoading] = useState(false);

  // ── POH pins ──────────────────────────────────────────────────────────────
  const [pohPins, setPohPins] = useState<PohPin[]>([]);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [pohLoading, setPohLoading] = useState(false);

  // ── Achievement awards ────────────────────────────────────────────────────
  const [achQuery, setAchQuery] = useState('');
  const [achOptions, setAchOptions] = useState<UserOption[]>([]);
  const [achSelectedUser, setAchSelectedUser] = useState<UserOption | null>(null);
  const [achType, setAchType] = useState('og');
  const [achNote, setAchNote] = useState('');

  // ── Blog ──────────────────────────────────────────────────────────────────
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogEditingId, setBlogEditingId] = useState<string | null>(null);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogBody, setBlogBody] = useState('');
  const [blogPublished, setBlogPublished] = useState(false);
  const [blogFormOpen, setBlogFormOpen] = useState(false);

  // ── About editor ──────────────────────────────────────────────────────────
  const [aboutBody, setAboutBody] = useState('');
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);

  // ── Phash backfill ────────────────────────────────────────────────────────
  const [phashBackfillRunning, setPhashBackfillRunning] = useState(false);
  const [phashBackfillMsg, setPhashBackfillMsg] = useState<string | null>(null);
  const [phashForceRunning, setPhashForceRunning] = useState(false);
  const [phashForceMsg, setPhashForceMsg] = useState<string | null>(null);

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

  // ── Phash backfill handler ────────────────────────────────────────────────

  async function runPhashBackfill() {
    if (!token || phashBackfillRunning) return;
    setPhashBackfillRunning(true);
    setPhashBackfillMsg('Fetching covers without phash…');
    try {
      const listRes = await fetch('/api/cms/phash-backfill?limit=500', { headers: { Authorization: `Bearer ${token}` } });
      const listJson = await listRes.json() as { ok: boolean; covers?: Array<{ id: string; storage_path: string }>; message?: string };
      if (!listJson.ok || !listJson.covers) throw new Error(listJson.message ?? 'Failed to fetch covers');
      const covers = listJson.covers.filter((c) => c.storage_path?.startsWith('cf:'));
      if (covers.length === 0) { setPhashBackfillMsg('All covers already have phash — nothing to do.'); return; }
      setPhashBackfillMsg(`Processing 0 / ${covers.length}…`);
      let done = 0;
      let failed = 0;
      for (const cover of covers) {
        try {
          const imgRes = await fetch(`/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`);
          if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
          const blob = await imgRes.blob();
          const file = new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' });
          const phash = await computePhash(file);
          if (phash) {
            await fetch('/api/cms/phash-backfill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ coverId: cover.id, phash }),
            });
          }
          done++;
        } catch {
          failed++;
        }
        setPhashBackfillMsg(`Processing ${done + failed} / ${covers.length}… (${failed} failed)`);
      }
      setPhashBackfillMsg(`Done. ${done} updated, ${failed} failed.`);
    } catch (err) {
      setPhashBackfillMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPhashBackfillRunning(false);
    }
  }

  async function runPhashForceRecompute() {
    if (!token || phashForceRunning) return;
    setPhashForceRunning(true);
    setPhashForceMsg('Fetching all CF-backed covers…');
    try {
      const listRes = await fetch('/api/cms/phash-backfill?limit=500&force=true', { headers: { Authorization: `Bearer ${token}` } });
      const listJson = await listRes.json() as { ok: boolean; covers?: Array<{ id: string; storage_path: string }>; message?: string };
      if (!listJson.ok || !listJson.covers) throw new Error(listJson.message ?? 'Failed to fetch covers');
      const covers = listJson.covers.filter((c) => c.storage_path?.startsWith('cf:'));
      if (covers.length === 0) { setPhashForceMsg('No CF-backed covers found.'); return; }
      setPhashForceMsg(`Recomputing 0 / ${covers.length}…`);
      let done = 0;
      let failed = 0;
      for (const cover of covers) {
        try {
          const imgRes = await fetch(`/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`);
          if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
          const blob = await imgRes.blob();
          const file = new File([blob], 'cover.jpg', { type: blob.type || 'image/jpeg' });
          const phash = await computePhash(file);
          if (phash) {
            await fetch('/api/cms/phash-backfill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ coverId: cover.id, phash }),
            });
          }
          done++;
        } catch {
          failed++;
        }
        setPhashForceMsg(`Recomputing ${done + failed} / ${covers.length}… (${failed} failed)`);
      }
      setPhashForceMsg(`Done. ${done} recomputed, ${failed} failed.`);
    } catch (err) {
      setPhashForceMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPhashForceRunning(false);
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

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

  async function loadBlogPosts() {
    if (!token) return;
    setBlogLoading(true);
    const res = await fetch('/api/cms/blog', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setBlogPosts(await res.json() as BlogPost[]);
    setBlogLoading(false);
  }

  async function loadAboutContent() {
    setAboutLoading(true);
    const res = await fetch('/api/cms/site-content?key=about_body');
    if (res.ok) {
      const data = await res.json() as { value: string | null };
      setAboutBody(data.value ?? '');
    }
    setAboutLoading(false);
  }

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  useEffect(() => {
    loadDashboard();
    loadBlacklist();
  }, [token]);

  // Load tab-specific data when switching tabs
  useEffect(() => {
    if (!token || operator !== true) return;
    if (activeTab === 'blog') loadBlogPosts();
    if (activeTab === 'about') loadAboutContent();
  }, [activeTab, token, operator]);

  // ── Autocomplete effects ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token || userQuery.trim().length < 1) { setUserOptions([]); return; }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/cms/users?q=${encodeURIComponent(userQuery.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setUserOptions(await res.json() as UserOption[]);
    }, 150);
    return () => clearTimeout(handle);
  }, [userQuery, token]);

  useEffect(() => {
    if (!token || userBrowserQuery.trim().length < 1) { setUserBrowserOptions([]); return; }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/cms/users?q=${encodeURIComponent(userBrowserQuery.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setUserBrowserOptions(await res.json() as UserOption[]);
    }, 150);
    return () => clearTimeout(handle);
  }, [userBrowserQuery, token]);

  useEffect(() => {
    if (!token || achQuery.trim().length < 1) { setAchOptions([]); return; }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/cms/users?q=${encodeURIComponent(achQuery.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setAchOptions(await res.json() as UserOption[]);
    }, 150);
    return () => clearTimeout(handle);
  }, [achQuery, token]);

  // ── Utilities ─────────────────────────────────────────────────────────────

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function setTab(tab: Tab) {
    setSearchParams({ tab });
    setError(null);
    setSuccessMsg(null);
  }

  // ── Achievement award ─────────────────────────────────────────────────────

  async function awardAchievement(action: 'grant' | 'revoke') {
    if (!achSelectedUser) return setError('Select a user first.');
    setBusyId(`ach-${action}`);
    setError(null);
    const res = await fetch('/api/cms/award-achievement', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: achSelectedUser.id, type: achType, action, note: achNote || undefined }),
    });
    setBusyId(null);
    if (!res.ok) { setError(await res.text()); return; }
    flash(`${action === 'grant' ? 'Granted' : 'Revoked'} ${achType} for @${achSelectedUser.username}`);
  }

  // ── Cover actions ─────────────────────────────────────────────────────────

  async function refreshLookupResult() {
    if (!token || !coverLookupInput.trim()) return;
    const res = await fetch(`/api/cms/cover-lookup?q=${encodeURIComponent(coverLookupInput.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCoverLookupResult(await res.json() as CoverLookupResult);
  }

  async function loadUserBrowserCovers(userId: string, page = 1) {
    if (!token) return;
    setUserBrowserLoading(true);
    const res = await fetch(`/api/cms/user-covers?userId=${encodeURIComponent(userId)}&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const payload = await res.json() as { covers: CoverListItem[]; total: number; page: number };
      setUserBrowserCovers(payload.covers);
      setUserBrowserTotal(payload.total);
      setUserBrowserPage(payload.page);
    }
    setUserBrowserLoading(false);
  }

  async function refreshUserBrowserCovers() {
    if (!userBrowserSelected || !token) return;
    await loadUserBrowserCovers(userBrowserSelected.id, userBrowserPage);
  }

  async function bulkPermaUnpublish(userId: string, enabled: boolean) {
    if (!token) return;
    setBusyId(`bulk-perma-${userId}`);
    setError(null);
    const res = await fetch('/api/cms/bulk-perma-unpublish', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId, enabled, reason: permaUnpublishReason }),
    });
    if (!res.ok) {
      setError('Could not bulk update covers.');
    } else {
      const payload = await res.json() as { count?: number };
      flash(`${payload.count ?? 0} cover(s) ${enabled ? 'perma-unpublished' : 'restored'}.`);
      await loadUserBrowserCovers(userId, userBrowserPage);
    }
    setBusyId(null);
  }

  // ── POH pins ──────────────────────────────────────────────────────────────

  async function loadPohData() {
    if (!token) return;
    setPohLoading(true);
    const [pinsRes, commentsRes] = await Promise.all([
      fetch('/api/poh/pins', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/cms/recent-comments', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (pinsRes.ok) {
      const payload = await pinsRes.json() as { pins: PohPin[] };
      setPohPins(payload.pins ?? []);
    }
    if (commentsRes.ok) setRecentComments(await commentsRes.json() as RecentComment[]);
    setPohLoading(false);
  }

  async function pinComment(comment: RecentComment) {
    if (!token) return;
    setBusyId(`pin-${comment.id}`);
    setError(null);
    const res = await fetch('/api/cms/pin-comment', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        commentId: comment.id,
        commentContent: comment.content,
        authorUsername: comment.author_username,
        authorUserId: comment.user_id,
        coverId: comment.cover_id,
        coverTitle: comment.cover_title,
        coverArtist: comment.cover_artist,
        coverStoragePath: comment.cover_storage_path,
        coverImageUrl: comment.cover_image_url,
        pageType: 'music',
        pageSlug: comment.page_slug,
      }),
    });
    if (!res.ok) setError('Could not pin comment.');
    else flash('Comment pinned to POH!');
    await loadPohData();
    setBusyId(null);
  }

  async function unpinComment(pinId: string) {
    if (!token) return;
    setBusyId(`unpin-${pinId}`);
    setError(null);
    const res = await fetch('/api/cms/unpin-comment', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pinId }),
    });
    if (!res.ok) setError('Could not unpin comment.');
    else flash('Comment unpinned.');
    await loadPohData();
    setBusyId(null);
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
    await refreshUserBrowserCovers();
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
    await refreshUserBrowserCovers();
    setBusyId(null);
  }

  // ── Report actions ────────────────────────────────────────────────────────

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

  async function dismissProfileReport(reportId: string) {
    if (!token) return;
    setBusyId(`dismiss-pr-${reportId}`);
    setError(null);
    const res = await fetch('/api/cms/dismiss-profile-report', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ reportId }),
    });
    if (!res.ok) setError('Could not dismiss report.');
    else flash('Profile report dismissed.');
    await loadDashboard();
    setBusyId(null);
  }

  // ── User / ban actions ────────────────────────────────────────────────────

  async function banSelectedUser() {
    if (!selectedUser) return;
    setBusyId('ban-user');
    setError(null);
    const expiresAt = banDuration === 'permanent' ? null : daysFromNow(Number(banDuration));
    const res = await fetch('/api/cms/ban-user', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: selectedUser.id, reason: banReason.trim() || null, expiresAt }),
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

  // ── Legal operations ──────────────────────────────────────────────────────

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
    const res = await fetch(`/api/cms/cover-lookup?q=${encodeURIComponent(coverLookupInput.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setError('Could not find that cover URL/slug.');
    } else {
      setCoverLookupResult(await res.json() as CoverLookupResult);
      flash('Cover lookup complete.');
    }
    setBusyId(null);
  }

  // ── Blog actions ──────────────────────────────────────────────────────────

  function openNewBlogForm() {
    setBlogEditingId(null);
    setBlogTitle('');
    setBlogBody('');
    setBlogPublished(false);
    setBlogFormOpen(true);
  }

  function openEditBlogForm(post: BlogPost) {
    setBlogEditingId(post.id);
    setBlogTitle(post.title);
    setBlogBody(post.body);
    setBlogPublished(post.published);
    setBlogFormOpen(true);
  }

  function closeBlogForm() {
    setBlogFormOpen(false);
    setBlogEditingId(null);
    setBlogTitle('');
    setBlogBody('');
    setBlogPublished(false);
  }

  async function saveBlogPost() {
    if (!blogTitle.trim()) { setError('Title is required.'); return; }
    setBusyId('blog-save');
    setError(null);
    const method = blogEditingId ? 'PUT' : 'POST';
    const body: Record<string, unknown> = { title: blogTitle, body: blogBody, published: blogPublished };
    if (blogEditingId) body.id = blogEditingId;
    const res = await fetch('/api/cms/blog', { method, headers: authHeaders, body: JSON.stringify(body) });
    setBusyId(null);
    if (!res.ok) { setError(await res.text()); return; }
    flash(blogEditingId ? 'Post updated.' : 'Post created.');
    closeBlogForm();
    await loadBlogPosts();
  }

  async function deleteBlogPost(id: string, title: string) {
    if (!window.confirm(`Delete post "${title}"? This cannot be undone.`)) return;
    setBusyId(`blog-del-${id}`);
    setError(null);
    const res = await fetch('/api/cms/blog', {
      method: 'DELETE', headers: authHeaders, body: JSON.stringify({ id }),
    });
    setBusyId(null);
    if (!res.ok) { setError('Could not delete post.'); return; }
    flash('Post deleted.');
    await loadBlogPosts();
  }

  // ── About editor ──────────────────────────────────────────────────────────

  async function saveAboutContent() {
    setAboutSaving(true);
    setError(null);
    const res = await fetch('/api/cms/site-content', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ key: 'about_body', value: aboutBody }),
    });
    setAboutSaving(false);
    if (!res.ok) { setError('Could not save About content.'); return; }
    flash('About page updated.');
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) return <div>Loading…</div>;
  if (!user) return <div>Please sign in to access CMS.</div>;
  if (operator === false) return <div>You are not an operator.</div>;

  // ── Render ────────────────────────────────────────────────────────────────

  const totalReports = data.reports.length + data.profileReports.length;

  return (
    <div className="route-container">
      <h1 className="route-title">Operator CMS</h1>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <nav className="cms-tabs">
        {TABS.map((t) => {
          const badge = t.badge?.(data) ?? 0;
          return (
            <button
              key={t.id}
              className={`cms-tab${activeTab === t.id ? ' cms-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {badge > 0 && <span className="cms-tab-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>

      {error && <p className="cms-msg cms-msg--err">{error}</p>}
      {successMsg && <p className="cms-msg cms-msg--ok">{successMsg}</p>}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODERATION TAB                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'moderation' && (
        <>
          {/* ── Reports ──────────────────────────────────────────────────── */}
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
                      <button className="btn" onClick={() => dismissReport(report.id)} disabled={busyId === `dismiss-${report.id}`} title="Disregard this report without removing the cover">Dismiss</button>
                      <button className="btn cms-btn-danger" onClick={() => deleteCover(report.cover_id)} disabled={busyId === report.cover_id}>Delete cover</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Profile Reports ───────────────────────────────────────────── */}
          <section className="surface cms-section">
            <div className="cms-section-header">
              <h2 className="cms-h2" style={{ margin: 0 }}>Profile Reports</h2>
              {data.profileReports.length > 0 && <span className="cms-badge cms-badge--warn">{data.profileReports.length}</span>}
            </div>

            {data.profileReports.length === 0 ? (
              <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>No profile reports.</p>
            ) : (
              <div className="cms-report-list">
                {data.profileReports.map((report) => (
                  <div key={report.id} className="cms-report-card">
                    <div className="cms-report-meta">
                      <span><strong>Reason:</strong> {report.reason}</span>
                      <span><strong>Profile:</strong> <a href={'/users/' + report.reported_username} target="_blank" rel="noopener noreferrer">@{report.reported_username ?? report.profile_id}</a></span>
                      <span><strong>Reporter:</strong> @{report.reporter_username ?? 'Unknown'}</span>
                      {report.details && <span><strong>Details:</strong> {report.details}</span>}
                      <span style={{ color: 'var(--body-text-muted)', fontSize: 12 }}>{formatDate(report.created_at)}</span>
                    </div>
                    <div className="cms-actions">
                      <button className="btn" onClick={() => dismissProfileReport(report.id)} disabled={busyId === `dismiss-pr-${report.id}`} title="Dismiss this profile report">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Active bans ───────────────────────────────────────────────── */}
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
                        {ban.expires_at && ` – expires ${formatDate(ban.expires_at)}`}
                      </span>
                    </div>
                    <button className="btn" disabled={busyId === `unban-${ban.user_id}`} onClick={() => unbanByUserId(ban.user_id, ban.username)}>Unban</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* USERS TAB                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <>
          {/* ── User operations ───────────────────────────────────────────── */}
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
                    {selectedUserBan.expires_at && <span>Expires: {formatDate(selectedUserBan.expires_at)}</span>}
                  </div>
                )}

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
                    <select className="form-input cms-select" value={banDuration} onChange={(e) => setBanDuration(e.target.value as typeof banDuration)}>
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
                  <button className="btn" disabled={!selectedUserBan || busyId === 'unban-user'} onClick={unbanSelectedUser}>Unban</button>
                  <button className="btn" disabled={busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, !selectedUserIsOperator, selectedUser.username)}>
                    {selectedUserIsOperator ? 'Remove operator' : 'Make operator'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Current operators ─────────────────────────────────────────── */}
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
                      <button className="btn cms-btn-danger" disabled={busyId === `operator-${op.user_id}`} onClick={() => setOperatorRole(op.user_id, false, op.username)}>Remove</button>
                    )}
                    {op.can_be_removed === false && op.user_id !== user?.id && (
                      <span className="cms-badge cms-badge--locked" title="This operator cannot be removed">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* COVERS TAB                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'covers' && (
        <>
          {/* ── Fast cover lookup ─────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Fast cover lookup</h2>
            <p className="cms-desc">Paste a fan cover URL to load that cover and the next 10 by the same user.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="https://covers.cafe/covers/fan/…" value={coverLookupInput} onChange={(e) => setCoverLookupInput(e.target.value)} style={{ minWidth: 380, flex: 1 }} />
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
                    <span className="cms-ban-user">{coverLookupResult.cover.artist}  -  {coverLookupResult.cover.title}</span>
                    <span className="cms-ban-reason">/{coverLookupResult.cover.page_slug}{coverLookupResult.cover.perma_unpublished ? ' – perma-unpublished' : ''}</span>
                  </div>
                  <button className="btn" onClick={() => setCoverVisibility(coverLookupResult.cover.id, !coverLookupResult.cover.is_public)} disabled={coverLookupResult.cover.perma_unpublished || busyId === `visibility-${coverLookupResult.cover.id}`} title={coverLookupResult.cover.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{coverLookupResult.cover.is_public ? 'Unpublish' : 'Publish'}</button>
                  <button className="btn" onClick={() => setCoverPermaUnpublished(coverLookupResult.cover.id, !coverLookupResult.cover.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${coverLookupResult.cover.id}`}>{coverLookupResult.cover.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                </div>
                {coverLookupResult.nextByUser.map((c) => (
                  <div key={c.id} className="cms-ban-row">
                    <div className="cms-ban-details">
                      <span className="cms-ban-user">{c.artist}  -  {c.title}</span>
                      <span className="cms-ban-reason">/{c.page_slug}{c.perma_unpublished ? ' – perma-unpublished' : ''}</span>
                    </div>
                    <button className="btn" onClick={() => setCoverVisibility(c.id, !c.is_public)} disabled={c.perma_unpublished || busyId === `visibility-${c.id}`} title={c.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{c.is_public ? 'Unpublish' : 'Publish'}</button>
                    <button className="btn" onClick={() => setCoverPermaUnpublished(c.id, !c.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${c.id}`}>{c.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── User cover browser ────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">User cover browser</h2>
            <p className="cms-desc">Search a user to browse and bulk-manage all their covers.</p>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="Search username…"
                value={userBrowserQuery}
                onChange={(e) => { setUserBrowserQuery(e.target.value); setUserBrowserSelected(null); setUserBrowserCovers([]); }}
              />
              {userBrowserOptions.length > 0 && !userBrowserSelected && (
                <div className="cms-dropdown">
                  {userBrowserOptions.map((option) => (
                    <button
                      key={option.id}
                      className="btn cms-dropdown-item"
                      onClick={() => {
                        setUserBrowserSelected(option);
                        setUserBrowserQuery(option.username);
                        setUserBrowserOptions([]);
                        setUserBrowserPage(1);
                        void loadUserBrowserCovers(option.id, 1);
                      }}
                    >
                      @{option.username}{option.display_name ? ` (${option.display_name})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {userBrowserSelected && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <strong>@{userBrowserSelected.username}</strong>
                  <span className="cms-count">{userBrowserTotal} covers</span>
                  <button className="btn cms-btn-danger" disabled={busyId === `bulk-perma-${userBrowserSelected.id}` || userBrowserTotal === 0} onClick={() => { if (!window.confirm(`Perma-unpublish ALL ${userBrowserTotal} covers by @${userBrowserSelected.username}? This notifies the user.`)) return; void bulkPermaUnpublish(userBrowserSelected.id, true); }}>
                    Perma-unpublish all ({permaUnpublishReason})
                  </button>
                  <button className="btn" disabled={busyId === `bulk-perma-${userBrowserSelected.id}` || userBrowserTotal === 0} onClick={() => { if (!window.confirm(`Allow republish for ALL covers by @${userBrowserSelected.username}?`)) return; void bulkPermaUnpublish(userBrowserSelected.id, false); }}>
                    Allow republish all
                  </button>
                </div>

                {userBrowserLoading ? (
                  <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>Loading…</p>
                ) : (
                  <>
                    <div className="cms-ban-list">
                      {userBrowserCovers.map((c) => (
                        <div key={c.id} className="cms-ban-row">
                          <div className="cms-ban-details">
                            <span className="cms-ban-user">{c.artist}  -  {c.title}</span>
                            <span className="cms-ban-reason">/{c.page_slug}{c.perma_unpublished ? ' – perma-unpublished' : c.is_public ? '' : ' – private'}</span>
                          </div>
                          <button className="btn" onClick={() => setCoverVisibility(c.id, !c.is_public)} disabled={c.perma_unpublished || busyId === `visibility-${c.id}`} title={c.perma_unpublished ? 'Permanently unpublished' : ''}>{c.is_public ? 'Unpublish' : 'Publish'}</button>
                          <button className="btn" onClick={() => setCoverPermaUnpublished(c.id, !c.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${c.id}`}>{c.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                        </div>
                      ))}
                    </div>
                    {userBrowserTotal > 50 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <button className="btn" disabled={userBrowserPage <= 1} onClick={() => { const p = userBrowserPage - 1; setUserBrowserPage(p); void loadUserBrowserCovers(userBrowserSelected.id, p); }}>← Prev</button>
                        <span style={{ fontSize: 13 }}>Page {userBrowserPage} of {Math.ceil(userBrowserTotal / 50)}</span>
                        <button className="btn" disabled={userBrowserPage >= Math.ceil(userBrowserTotal / 50)} onClick={() => { const p = userBrowserPage + 1; setUserBrowserPage(p); void loadUserBrowserCovers(userBrowserSelected.id, p); }}>Next →</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Legal operations ──────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Legal operations</h2>
            <p className="cms-desc">Mass remove all covers matching a specific tag.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="form-input" placeholder="Tag (e.g. infringing-label)" value={removeTag} onChange={(e) => setRemoveTag(e.target.value)} style={{ minWidth: 260 }} />
              <button className="btn btn-primary" disabled={busyId === 'mass-remove-tag'} onClick={massRemoveByTag}>Mass remove by tag</button>
            </div>
          </section>

          {/* ── Official gallery spam controls ────────────────────────────── */}
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

          {/* ── Phash backfill ────────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Backfill missing phash</h2>
            <p className="cms-desc">
              Covers uploaded before phash tracking was added have no stored perceptual hash.
              Without it, the duplicate-upload guard can't detect re-uploads of those covers.
              Click below to compute and store phash for all affected covers (runs client-side,
              processes up to 500 at a time).
            </p>
            <button className="btn btn-primary" onClick={runPhashBackfill} disabled={phashBackfillRunning}>
              {phashBackfillRunning ? 'Running…' : 'Backfill phash'}
            </button>
            {phashBackfillMsg && <p className="cms-desc" style={{ marginTop: 8 }}>{phashBackfillMsg}</p>}
          </section>

          {/* ── Phash force-recompute ──────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Force-recompute all phash</h2>
            <p className="cms-desc">
              Recomputes the perceptual hash for <strong>every</strong> CF-backed cover from the
              Cloudflare-served image. Run this if duplicate detection is missing re-uploads —
              CF re-encodes images on ingest, so the stored phash (computed from the original file)
              may differ from what re-uploaders compute when downloading from the gallery.
              Processes up to 500 covers at a time.
            </p>
            <button className="btn btn-secondary" onClick={runPhashForceRecompute} disabled={phashForceRunning}>
              {phashForceRunning ? 'Running…' : 'Force-recompute phash'}
            </button>
            {phashForceMsg && <p className="cms-desc" style={{ marginTop: 8 }}>{phashForceMsg}</p>}
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* COMMUNITY TAB                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'community' && (
        <>
          {/* ── Achievement awards ────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Award achievements</h2>
            <p className="cms-desc">Grant or revoke any achievement badge for any user.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="Search user…"
                  value={achQuery}
                  onChange={(e) => { setAchQuery(e.target.value); setAchSelectedUser(null); }}
                  style={{ minWidth: 220 }}
                />
                {achOptions.length > 0 && (
                  <div className="cms-dropdown">
                    {achOptions.map((opt) => (
                      <button key={opt.id} className="btn cms-dropdown-item" onClick={() => { setAchSelectedUser(opt); setAchQuery(opt.username); setAchOptions([]); }}>
                        @{opt.username}{opt.display_name ? ` (${opt.display_name})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select className="form-input" value={achType} onChange={(e) => setAchType(e.target.value)}>
                <optgroup label="Special">
                  <option value="og">og</option>
                  <option value="staff">staff</option>
                  <option value="verified">verified</option>
                </optgroup>
                <optgroup label="Community">
                  <option value="acotw">acotw — Album Cover of the Week</option>
                  <option value="poh">poh — Picture of the Hour</option>
                  <option value="contributor">contributor</option>
                  <option value="certified_loner">certified_loner</option>
                </optgroup>
                <optgroup label="Milestones">
                  <option value="milestone_1">milestone_1 — 1 upload</option>
                  <option value="milestone_50">milestone_50 — 50 uploads</option>
                  <option value="milestone_100">milestone_100 — 100 uploads</option>
                  <option value="milestone_250">milestone_250 — 250 uploads</option>
                  <option value="milestone_500">milestone_500 — 500 uploads</option>
                  <option value="milestone_1000">milestone_1000 — 1000 uploads</option>
                </optgroup>
                <optgroup label="Social">
                  <option value="first_friend">first_friend</option>
                  <option value="friends_5">friends_5 — 5 friends</option>
                  <option value="friends_25">friends_25 — 25 friends</option>
                  <option value="first_collection">first_collection</option>
                </optgroup>
              </select>
              <input className="form-input" placeholder="Note (optional)" value={achNote} onChange={(e) => setAchNote(e.target.value)} style={{ minWidth: 200 }} />
              <button className="btn btn-primary" disabled={!achSelectedUser || busyId === 'ach-grant'} onClick={() => awardAchievement('grant')}>Grant</button>
              <button className="btn" disabled={!achSelectedUser || busyId === 'ach-revoke'} onClick={() => awardAchievement('revoke')}>Revoke</button>
            </div>
            {achSelectedUser && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--body-text-muted)' }}>Selected: @{achSelectedUser.username}</p>}
          </section>

          {/* ── Hall of Fame pins ─────────────────────────────────────────── */}
          <section className="surface cms-section">
            <h2 className="cms-h2">Hall of Fame pins (POH)</h2>
            <p className="cms-desc">Pin standout comments to the Hall of Fame. Awards the author a POH achievement badge.</p>
            <button className="btn btn-primary" onClick={loadPohData} disabled={pohLoading}>
              {pohLoading ? 'Loading…' : 'Load / refresh'}
            </button>

            {(pohPins.length > 0 || recentComments.length > 0) && (
              <div style={{ marginTop: 12, display: 'grid', gap: 16 }}>
                {pohPins.length > 0 && (
                  <div>
                    <h3 className="cms-h3">Current pins ({pohPins.length})</h3>
                    <div className="cms-ban-list">
                      {pohPins.map((pin) => (
                        <div key={pin.id} className="cms-ban-row">
                          <div className="cms-ban-details">
                            <span className="cms-ban-user">@{pin.author_username}</span>
                            <span className="cms-ban-reason" style={{ fontStyle: 'italic' }}>"{pin.comment_content.slice(0, 80)}{pin.comment_content.length > 80 ? '…' : ''}"</span>
                            {pin.cover_title && <span className="cms-ban-reason">{pin.cover_title}{pin.cover_artist ? `  -  ${pin.cover_artist}` : ''}</span>}
                          </div>
                          <button className="btn" disabled={busyId === `unpin-${pin.id}`} onClick={() => unpinComment(pin.id)}>Unpin</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recentComments.length > 0 && (
                  <div>
                    <h3 className="cms-h3">Recent comments</h3>
                    <div className="cms-ban-list">
                      {recentComments.map((c) => (
                        <div key={c.id} className="cms-ban-row">
                          <div className="cms-ban-details">
                            <span className="cms-ban-user">@{c.author_username}</span>
                            <span className="cms-ban-reason" style={{ fontStyle: 'italic' }}>"{c.content.slice(0, 100)}{c.content.length > 100 ? '…' : ''}"</span>
                            {c.cover_title && <span className="cms-ban-reason">{c.cover_title}{c.cover_artist ? `  -  ${c.cover_artist}` : ''}</span>}
                          </div>
                          {c.is_already_pinned ? (
                            <span className="cms-badge cms-badge--op">Pinned</span>
                          ) : (
                            <button className="btn btn-primary" disabled={busyId === `pin-${c.id}`} onClick={() => pinComment(c)}>Pin to POH</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BLOG TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'blog' && (
        <section className="surface cms-section">
          <div className="cms-section-header">
            <h2 className="cms-h2" style={{ margin: 0 }}>Blog posts</h2>
            <button className="btn btn-primary" onClick={openNewBlogForm} disabled={blogFormOpen}>New post</button>
          </div>
          <p className="cms-desc">Write and publish blog posts visible at <a href="/blog" target="_blank" rel="noopener noreferrer">/blog</a>. Only operators can post.</p>

          {blogFormOpen && (
            <div className="cms-blog-form surface" style={{ marginTop: 16 }}>
              <h3 className="cms-h3" style={{ marginTop: 0 }}>{blogEditingId ? 'Edit post' : 'New post'}</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                <input
                  className="form-input"
                  placeholder="Title"
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                />
                <textarea
                  className="form-input"
                  placeholder="Write your post… (plain text, line breaks preserved)"
                  value={blogBody}
                  onChange={(e) => setBlogBody(e.target.value)}
                  rows={14}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={blogPublished} onChange={(e) => setBlogPublished(e.target.checked)} />
                  Publish immediately
                </label>
                <div className="cms-actions">
                  <button className="btn btn-primary" onClick={saveBlogPost} disabled={busyId === 'blog-save'}>
                    {busyId === 'blog-save' ? 'Saving…' : blogEditingId ? 'Update post' : 'Create post'}
                  </button>
                  <button className="btn" onClick={closeBlogForm}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {blogLoading ? (
            <p style={{ color: 'var(--body-text-muted)', fontSize: 13, marginTop: 12 }}>Loading…</p>
          ) : blogPosts.length === 0 ? (
            <p style={{ color: 'var(--body-text-muted)', fontSize: 13, marginTop: 12 }}>No posts yet. Hit "New post" to write one.</p>
          ) : (
            <div className="cms-blog-list cms-ban-list" style={{ marginTop: 16 }}>
              {blogPosts.map((post) => (
                <div key={post.id} className="cms-ban-row">
                  <div className="cms-ban-details">
                    <span className="cms-ban-user">
                      {post.title}
                      {post.published
                        ? <span className="cms-badge cms-badge--op" style={{ marginLeft: 8 }}>Published</span>
                        : <span className="cms-badge" style={{ marginLeft: 8 }}>Draft</span>}
                    </span>
                    <span className="cms-ban-reason">
                      /blog/{post.slug}
                      {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
                      {post.author_username ? ` · @${post.author_username}` : ''}
                    </span>
                    <span className="cms-ban-reason" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                      {post.body.slice(0, 120)}{post.body.length > 120 ? '…' : ''}
                    </span>
                  </div>
                  <div className="cms-actions" style={{ flexShrink: 0 }}>
                    <button className="btn" onClick={() => openEditBlogForm(post)}>Edit</button>
                    <a className="btn" href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">View</a>
                    <button className="btn cms-btn-danger" onClick={() => deleteBlogPost(post.id, post.title)} disabled={busyId === `blog-del-${post.id}`}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ABOUT EDITOR TAB                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'about' && (
        <section className="surface cms-section">
          <h2 className="cms-h2">About page editor</h2>
          <p className="cms-desc">Edit the text shown on the <a href="/about" target="_blank" rel="noopener noreferrer">/about</a> page. Plain text — line breaks are preserved.</p>

          {aboutLoading ? (
            <p style={{ color: 'var(--body-text-muted)', fontSize: 13 }}>Loading…</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <textarea
                className="form-input"
                value={aboutBody}
                onChange={(e) => setAboutBody(e.target.value)}
                rows={20}
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder="About page content…"
              />
              <div className="cms-actions">
                <button className="btn btn-primary" onClick={saveAboutContent} disabled={aboutSaving}>
                  {aboutSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button className="btn" onClick={loadAboutContent} disabled={aboutLoading || aboutSaving}>
                  Reset to saved
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
