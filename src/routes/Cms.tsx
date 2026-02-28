import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { computePhash } from '../lib/phash';
import '../styles/cms-admin.css';

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
  role: string;
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

type ProfileReport = {
  id: string;
  reason: string;
  details: string | null;
  profile_id: string;
  reported_username: string | null;
  reporter_username: string | null;
  created_at: string;
};

type ReviewQueueItem = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  storage_path: string;
  created_at: string;
  uploader_username: string | null;
  moderation_reason: string | null;
  matched_cover_id: string | null;
  matched_official_id: string | null;
};

type DashboardPayload = {
  reports: Report[];
  profileReports: ProfileReport[];
  bans: Ban[];
  operators: Operator[];
  reviewQueueCount: number;
  myRole: 'operator' | 'moderator' | 'helper';
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
// Section definitions (sidebar nav)
// ---------------------------------------------------------------------------

type Section =
  | 'overview'
  | 'queue' | 'reports' | 'bans'
  | 'users' | 'permissions'
  | 'lookup' | 'browser' | 'legal'
  | 'blog'
  | 'achievements';

type Role = 'operator' | 'moderator' | 'helper';

const ALLOWED_SECTIONS: Record<Role, Section[]> = {
  operator: ['overview', 'queue', 'reports', 'bans', 'users', 'permissions', 'lookup', 'browser', 'legal', 'blog', 'achievements'],
  moderator: ['overview', 'queue', 'reports', 'lookup', 'browser', 'legal'],
  helper:   ['queue', 'reports'],
};

type NavItem = { id: Section; label: string; badge?: (d: DashboardPayload) => number };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Moderation',
    items: [
      { id: 'queue',   label: 'Review Queue', badge: (d) => d.reviewQueueCount },
      { id: 'reports', label: 'Reports',       badge: (d) => d.reports.length + d.profileReports.length },
      { id: 'bans',    label: 'Active Bans',   badge: (d) => d.bans.length || 0 },
    ],
  },
  {
    label: 'Users',
    items: [
      { id: 'users',       label: 'User Ops'    },
      { id: 'permissions', label: 'Permissions' },
    ],
  },
  {
    label: 'Covers',
    items: [
      { id: 'lookup',  label: 'Cover Lookup'  },
      { id: 'browser', label: 'User Browser'  },
      { id: 'legal',   label: 'Legal & Tools' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'blog',         label: 'Blog'         },
      { id: 'achievements', label: 'Achievements' },
    ],
  },
];

const SECTION_TITLES: Record<Section, string> = {
  overview:     'Overview',
  queue:        'Review Queue',
  reports:      'Reports',
  bans:         'Active Bans',
  users:        'User Operations',
  permissions:  'Permissions',
  lookup:       'Cover Lookup',
  browser:      'User Cover Browser',
  legal:        'Legal & Tools',
  blog:         'Blog',
  achievements: 'Achievement Awards',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Cms() {
  const { user, session, loading, openAuthModal } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('s') ?? 'overview') as Section;

  const [data, setData] = useState<DashboardPayload>({ reports: [], profileReports: [], bans: [], operators: [], reviewQueueCount: 0, myRole: 'operator' });
  const [myRole, setMyRole] = useState<Role | null | false>(null);
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

  // ── Review queue ──────────────────────────────────────────────────────────
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);

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

  // ── Review queue handlers ─────────────────────────────────────────────────

  async function loadReviewQueue() {
    if (!token) return;
    setReviewQueueLoading(true);
    const res = await fetch('/api/cms/review-queue', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const payload = await res.json() as { covers: ReviewQueueItem[] };
      setReviewQueue(payload.covers ?? []);
    }
    setReviewQueueLoading(false);
  }

  async function reviewCover(coverId: string, decision: 'approve' | 'deny') {
    setBusyId(`review-${coverId}`);
    setError(null);
    const res = await fetch('/api/cms/review-cover', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ coverId, decision }),
    });
    if (!res.ok) {
      setError(`Could not ${decision} cover.`);
    } else {
      flash(`Cover ${decision === 'approve' ? 'approved and published' : 'denied and removed'}.`);
      setReviewQueue((q) => q.filter((c) => c.id !== coverId));
      setData((d) => ({ ...d, reviewQueueCount: Math.max(0, d.reviewQueueCount - 1) }));
    }
    setBusyId(null);
  }

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
    if (res.status === 403) return setMyRole(false);
    if (!res.ok) return setError('Failed to load CMS data.');
    const payload = await res.json() as DashboardPayload;
    setMyRole(payload.myRole);
    setData(payload);
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

  useEffect(() => {
    if (!loading && !user) openAuthModal('login');
  }, [loading, user, openAuthModal]);

  useEffect(() => {
    loadDashboard();
    loadBlacklist();
  }, [token]);

  // Load section-specific data when switching sections
  useEffect(() => {
    if (!token || !myRole) return;
    if (visibleSection === 'queue') loadReviewQueue();
    if (visibleSection === 'blog') loadBlogPosts();
  }, [activeSection, token, myRole]);

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

  function setSection(s: Section) {
    setSearchParams({ s });
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

  async function setOperatorRole(userId: string, promote: boolean, username: string | null, role = 'operator') {
    setBusyId(`operator-${userId}`);
    setError(null);
    const res = await fetch('/api/cms/set-operator', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ userId, promote, role }),
    });
    if (!res.ok) setError('Could not update role.');
    else flash(`@${username ?? userId} ${promote ? `assigned ${role} role` : 'removed from staff'}.`);
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

  // ── Guards ────────────────────────────────────────────────────────────────

  const guardStyle: CSSProperties = {
    display: 'grid', placeItems: 'center', height: '100vh',
    fontFamily: 'system-ui, sans-serif', fontSize: 15, color: '#64748b',
  };
  if (loading) return <div style={guardStyle}>Loading…</div>;
  if (!user) return <div style={guardStyle}>Sign in to access the CMS.</div>;
  if (myRole === false) return <div style={guardStyle}>You are not authorized to view this page.</div>;

  // ── Render ────────────────────────────────────────────────────────────────

  const currentRole: Role = myRole || 'helper';
  const allowed = ALLOWED_SECTIONS[currentRole];

  // Redirect to first allowed section if current one is not permitted
  const visibleSection: Section = allowed.includes(activeSection) ? activeSection : allowed[0];

  // ── Role badge helper ─────────────────────────────────────────────────────
  function roleBadge(role: string) {
    const cls = role === 'operator' ? 'operator' : role === 'moderator' ? 'moderator' : 'helper';
    return <span className={`admin-role-badge admin-role-badge--${cls}`}>{role}</span>;
  }

  return (
    <div className="admin-wrap">
      {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-sidebar-logo-icon">cc</span>
          <div>
            <div className="admin-sidebar-logo-text">covers.cafe</div>
            <div className="admin-sidebar-logo-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="admin-nav">
          {/* Overview — only for operator and moderator */}
          {allowed.includes('overview') && (
            <div className="admin-nav-group" style={{ marginTop: 10 }}>
              <button
                className={`admin-nav-item${visibleSection === 'overview' ? ' active' : ''}`}
                onClick={() => setSection('overview')}
              >
                Overview
              </button>
            </div>
          )}

          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => allowed.includes(item.id));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="admin-nav-group">
                <div className="admin-nav-group-label">{group.label}</div>
                {visibleItems.map((item) => {
                  const badge = item.badge?.(data) ?? 0;
                  return (
                    <button
                      key={item.id}
                      className={`admin-nav-item${visibleSection === item.id ? ' active' : ''}`}
                      onClick={() => setSection(item.id)}
                    >
                      {item.label}
                      {badge > 0 && <span className="admin-nav-badge">{badge}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">@{(user as { email?: string })?.email?.split('@')[0] ?? 'admin'}</div>
          <a href="/" className="admin-exit-link">Back to site</a>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════ */}
      <main className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-row">
            <h1 className="admin-topbar-title">{SECTION_TITLES[visibleSection]}</h1>
            {visibleSection === 'queue' && (
              <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadReviewQueue} disabled={reviewQueueLoading}>
                {reviewQueueLoading ? 'Loading…' : 'Refresh'}
              </button>
            )}
            {visibleSection === 'blog' && (
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={openNewBlogForm} disabled={blogFormOpen}>
                + New post
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {(error || successMsg) && (
          <div className="admin-alerts">
            {error    && <div className="admin-alert admin-alert--error">{error}</div>}
            {successMsg && <div className="admin-alert admin-alert--success">{successMsg}</div>}
          </div>
        )}

        <div className="admin-content">

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* OVERVIEW                                                          */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'overview' && (
            <>
              <div className="admin-stats-grid">
                <div className={`admin-stat-card${data.reviewQueueCount > 0 ? ' admin-stat-card--warn' : ''}`}>
                  <div className="admin-stat-label">Review Queue</div>
                  <div className="admin-stat-value">{data.reviewQueueCount}</div>
                </div>
                <div className={`admin-stat-card${data.reports.length > 0 ? ' admin-stat-card--danger' : ''}`}>
                  <div className="admin-stat-label">Cover Reports</div>
                  <div className="admin-stat-value">{data.reports.length}</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Profile Reports</div>
                  <div className="admin-stat-value">{data.profileReports.length}</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Active Bans</div>
                  <div className="admin-stat-value">{data.bans.length}</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Operators</div>
                  <div className="admin-stat-value">{data.operators.length}</div>
                </div>
              </div>
              <div className="admin-card" style={{ marginTop: 16 }}>
                <h3 className="admin-card-title">Quick Links</h3>
                <div className="admin-list">
                  <button className="admin-list-row admin-btn-link" onClick={() => setSection('queue')}>Review Queue</button>
                  <button className="admin-list-row admin-btn-link" onClick={() => setSection('reports')}>Reports</button>
                  {currentRole === 'operator' && <button className="admin-list-row admin-btn-link" onClick={() => setSection('users')}>User Operations</button>}
                  {currentRole !== 'helper' && <button className="admin-list-row admin-btn-link" onClick={() => setSection('legal')}>Legal & Tools</button>}
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REVIEW QUEUE                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'queue' && (
            <div className="admin-card">
              <p className="admin-card-desc">Covers flagged by the auto-duplicate detector. Approve to publish, deny to remove.</p>
              {reviewQueueLoading ? (
                <p className="admin-empty">Loading…</p>
              ) : reviewQueue.length === 0 ? (
                <p className="admin-empty">No covers pending review.</p>
              ) : (
                <div className="admin-review-list">
                  {reviewQueue.map((item) => (
                    <div key={item.id} className="admin-review-card">
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <img
                          src={coverThumbUrl(item.storage_path)}
                          alt=""
                          className="admin-review-thumb"
                        />
                        <div className="admin-review-meta">
                          <span><strong>{item.artist} — {item.title}</strong>{item.year ? ` (${item.year})` : ''}</span>
                          <span>Uploader: @{item.uploader_username ?? 'unknown'}</span>
                          {item.moderation_reason && <span>Flagged: {item.moderation_reason}</span>}
                          {item.matched_cover_id && <span className="admin-muted">Matched cover ID: {item.matched_cover_id}</span>}
                          {item.matched_official_id && <span className="admin-muted">Matched official ID: {item.matched_official_id}</span>}
                          <span className="admin-muted">{formatDate(item.created_at)}</span>
                        </div>
                      </div>
                      <div className="admin-row-actions" style={{ marginTop: 10 }}>
                        <button
                          className="admin-btn admin-btn-success"
                          onClick={() => reviewCover(item.id, 'approve')}
                          disabled={busyId === `review-${item.id}`}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-btn admin-btn-danger"
                          onClick={() => reviewCover(item.id, 'deny')}
                          disabled={busyId === `review-${item.id}`}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* REPORTS                                                           */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'reports' && (
            <>
              {/* Cover reports */}
              <div className="admin-card">
                <h3 className="admin-card-title">
                  Cover Reports
                  {data.reports.length > 0 && <span className="admin-nav-badge" style={{ marginLeft: 8 }}>{data.reports.length}</span>}
                </h3>
                {data.reports.length === 0 ? (
                  <p className="admin-empty">No cover reports.</p>
                ) : (
                  <div className="admin-list">
                    {data.reports.map((report) => (
                      <div key={report.id} className="admin-list-row">
                        <div className="admin-list-meta">
                          <span><strong>Reason:</strong> {report.reason}</span>
                          <span><strong>Cover:</strong> {report.cover_title ?? report.cover_id}</span>
                          <span><strong>Reporter:</strong> @{report.reporter_username ?? 'Unknown'}</span>
                          {report.details && <span><strong>Details:</strong> {report.details}</span>}
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-btn" onClick={() => dismissReport(report.id)} disabled={busyId === `dismiss-${report.id}`} title="Disregard this report without removing the cover">Dismiss</button>
                          <button className="admin-btn admin-btn-danger" onClick={() => deleteCover(report.cover_id)} disabled={busyId === report.cover_id}>Delete cover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile reports */}
              <div className="admin-card" style={{ marginTop: 16 }}>
                <h3 className="admin-card-title">
                  Profile Reports
                  {data.profileReports.length > 0 && <span className="admin-nav-badge" style={{ marginLeft: 8 }}>{data.profileReports.length}</span>}
                </h3>
                {data.profileReports.length === 0 ? (
                  <p className="admin-empty">No profile reports.</p>
                ) : (
                  <div className="admin-list">
                    {data.profileReports.map((report) => (
                      <div key={report.id} className="admin-list-row">
                        <div className="admin-list-meta">
                          <span><strong>Reason:</strong> {report.reason}</span>
                          <span><strong>Profile:</strong> <a href={'/users/' + report.reported_username} target="_blank" rel="noopener noreferrer">@{report.reported_username ?? report.profile_id}</a></span>
                          <span><strong>Reporter:</strong> @{report.reporter_username ?? 'Unknown'}</span>
                          {report.details && <span><strong>Details:</strong> {report.details}</span>}
                          <span className="admin-muted">{formatDate(report.created_at)}</span>
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-btn" onClick={() => dismissProfileReport(report.id)} disabled={busyId === `dismiss-pr-${report.id}`}>Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* BANS                                                              */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'bans' && (
            <div className="admin-card">
              <h3 className="admin-card-title">
                Active Bans
                {data.bans.length > 0 && <span className="admin-nav-badge" style={{ marginLeft: 8 }}>{data.bans.length}</span>}
              </h3>
              {data.bans.length === 0 ? (
                <p className="admin-empty">No active bans.</p>
              ) : (
                <div className="admin-list">
                  {data.bans.map((ban) => (
                    <div key={ban.user_id} className="admin-list-row">
                      <div className="admin-list-meta">
                        <span className="admin-list-primary">@{ban.username ?? ban.user_id}</span>
                        <span>{ban.reason ?? 'No reason provided'}</span>
                        <span className="admin-muted">
                          Banned {formatDate(ban.banned_at)}
                          {ban.expires_at && ` – expires ${formatDate(ban.expires_at)}`}
                        </span>
                      </div>
                      <div className="admin-row-actions">
                        <button className="admin-btn" disabled={busyId === `unban-${ban.user_id}`} onClick={() => unbanByUserId(ban.user_id, ban.username)}>Unban</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* USERS                                                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'users' && (
            <div className="admin-card">
              <h3 className="admin-card-title">User Operations</h3>
              <div style={{ position: 'relative' }}>
                <input
                  className="admin-input"
                  placeholder="Search username…"
                  value={userQuery}
                  onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
                />
                {userOptions.length > 0 && !selectedUser && (
                  <div className="admin-dropdown">
                    {userOptions.map((option) => (
                      <button
                        key={option.id}
                        className="admin-dropdown-item"
                        onClick={() => { setSelectedUser(option); setUserQuery(option.username); setUserOptions([]); }}
                      >
                        @{option.username}{option.display_name ? ` (${option.display_name})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="admin-user-panel">
                  <div className="admin-user-header">
                    <strong>@{selectedUser.username}</strong>
                    {selectedUserBan && <span className="admin-badge admin-badge--banned">Banned</span>}
                    {selectedUserIsOperator && <span className="admin-badge admin-badge--op">Operator</span>}
                  </div>

                  {selectedUserBan && (
                    <div className="admin-ban-info">
                      <span>Reason: {selectedUserBan.reason ?? 'No reason provided'}</span>
                      {selectedUserBan.expires_at && <span>Expires: {formatDate(selectedUserBan.expires_at)}</span>}
                    </div>
                  )}

                  <div className="admin-field-group">
                    <textarea
                      className="admin-input"
                      placeholder="Ban reason (optional)"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      rows={2}
                    />
                    <div className="admin-form-row">
                      <label className="admin-label">Duration</label>
                      <select className="admin-input admin-select" value={banDuration} onChange={(e) => setBanDuration(e.target.value as typeof banDuration)}>
                        <option value="permanent">Permanent</option>
                        <option value="1">1 day</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-row-actions">
                    <button className="admin-btn admin-btn-primary" disabled={busyId === 'ban-user'} onClick={banSelectedUser}>
                      {selectedUserBan ? 'Update ban' : 'Ban user'}
                    </button>
                    <button className="admin-btn" disabled={!selectedUserBan || busyId === 'unban-user'} onClick={unbanSelectedUser}>Unban</button>
                    <button className="admin-btn" disabled={busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, !selectedUserIsOperator, selectedUser.username)}>
                      {selectedUserIsOperator ? 'Remove operator' : 'Make operator'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PERMISSIONS                                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'permissions' && (
            <div className="admin-card">
              <h3 className="admin-card-title">Operators &amp; Roles</h3>
              {data.operators.length === 0 ? (
                <p className="admin-empty">No operators — no role management available.</p>
              ) : (
                <div className="admin-list">
                  {data.operators.map((op) => (
                    <div key={op.user_id} className="admin-list-row">
                      <div className="admin-list-meta">
                        <span className="admin-list-primary">@{op.username ?? op.user_id}</span>
                        {roleBadge(op.role)}
                      </div>
                      <div className="admin-row-actions">
                        {op.user_id !== user?.id && op.can_be_removed && (
                          <button className="admin-btn admin-btn-danger" disabled={busyId === `operator-${op.user_id}`} onClick={() => setOperatorRole(op.user_id, false, op.username)}>Remove</button>
                        )}
                        {op.can_be_removed === false && op.user_id !== user?.id && (
                          <span className="admin-badge" title="This operator cannot be removed">Locked</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="admin-card-subtitle">Assign role to @{selectedUser.username}</h4>
                  <div className="admin-row-actions">
                    <button className="admin-btn admin-btn-primary" disabled={busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, true, selectedUser.username, 'operator')}>Assign Operator</button>
                    <button className="admin-btn" disabled={busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, true, selectedUser.username, 'moderator')}>Assign Moderator</button>
                    <button className="admin-btn" disabled={busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, true, selectedUser.username, 'helper')}>Assign Helper</button>
                    <button className="admin-btn admin-btn-danger" disabled={!selectedUserIsOperator || busyId === `operator-${selectedUser.id}`} onClick={() => setOperatorRole(selectedUser.id, false, selectedUser.username)}>Remove from Staff</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* COVER LOOKUP                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'lookup' && (
            <div className="admin-card">
              <p className="admin-card-desc">Paste a fan cover URL to load that cover and the next 10 by the same user.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="admin-input" placeholder="https://covers.cafe/covers/fan/…" value={coverLookupInput} onChange={(e) => setCoverLookupInput(e.target.value)} style={{ minWidth: 380, flex: 1 }} />
                <button className="admin-btn admin-btn-primary" onClick={lookupCoverByUrl} disabled={busyId === 'cover-lookup'}>Lookup</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <label className="admin-label">Removal reason:</label>
                <select className="admin-input admin-select" value={permaUnpublishReason} onChange={(e) => setPermaUnpublishReason(e.target.value)}>
                  <option value="DMCA/compliance">DMCA/compliance</option>
                  <option value="Spam/duplicate content">Spam/duplicate content</option>
                  <option value="Inappropriate content">Inappropriate content</option>
                  <option value="Other violation">Other violation</option>
                </select>
              </div>
              {coverLookupResult && (
                <div className="admin-list" style={{ marginTop: 12 }}>
                  <div className="admin-list-row">
                    <div className="admin-list-meta">
                      <span className="admin-list-primary">{coverLookupResult.cover.artist} — {coverLookupResult.cover.title}</span>
                      <span className="admin-muted">/{coverLookupResult.cover.page_slug}{coverLookupResult.cover.perma_unpublished ? ' – perma-unpublished' : ''}</span>
                    </div>
                    <div className="admin-row-actions">
                      <button className="admin-btn" onClick={() => setCoverVisibility(coverLookupResult.cover.id, !coverLookupResult.cover.is_public)} disabled={coverLookupResult.cover.perma_unpublished || busyId === `visibility-${coverLookupResult.cover.id}`} title={coverLookupResult.cover.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{coverLookupResult.cover.is_public ? 'Unpublish' : 'Publish'}</button>
                      <button className="admin-btn" onClick={() => setCoverPermaUnpublished(coverLookupResult.cover.id, !coverLookupResult.cover.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${coverLookupResult.cover.id}`}>{coverLookupResult.cover.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                    </div>
                  </div>
                  {coverLookupResult.nextByUser.map((c) => (
                    <div key={c.id} className="admin-list-row">
                      <div className="admin-list-meta">
                        <span className="admin-list-primary">{c.artist} — {c.title}</span>
                        <span className="admin-muted">/{c.page_slug}{c.perma_unpublished ? ' – perma-unpublished' : ''}</span>
                      </div>
                      <div className="admin-row-actions">
                        <button className="admin-btn" onClick={() => setCoverVisibility(c.id, !c.is_public)} disabled={c.perma_unpublished || busyId === `visibility-${c.id}`} title={c.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>{c.is_public ? 'Unpublish' : 'Publish'}</button>
                        <button className="admin-btn" onClick={() => setCoverPermaUnpublished(c.id, !c.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${c.id}`}>{c.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* USER BROWSER                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'browser' && (
            <div className="admin-card">
              <p className="admin-card-desc">Search a user to browse and bulk-manage all their covers.</p>
              <div style={{ position: 'relative' }}>
                <input
                  className="admin-input"
                  placeholder="Search username…"
                  value={userBrowserQuery}
                  onChange={(e) => { setUserBrowserQuery(e.target.value); setUserBrowserSelected(null); setUserBrowserCovers([]); }}
                />
                {userBrowserOptions.length > 0 && !userBrowserSelected && (
                  <div className="admin-dropdown">
                    {userBrowserOptions.map((option) => (
                      <button
                        key={option.id}
                        className="admin-dropdown-item"
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
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <strong>@{userBrowserSelected.username}</strong>
                    <span className="admin-badge">{userBrowserTotal} covers</span>
                    <button className="admin-btn admin-btn-danger" disabled={busyId === `bulk-perma-${userBrowserSelected.id}` || userBrowserTotal === 0} onClick={() => { if (!window.confirm(`Perma-unpublish ALL ${userBrowserTotal} covers by @${userBrowserSelected.username}? This notifies the user.`)) return; void bulkPermaUnpublish(userBrowserSelected.id, true); }}>
                      Perma-unpublish all ({permaUnpublishReason})
                    </button>
                    <button className="admin-btn" disabled={busyId === `bulk-perma-${userBrowserSelected.id}` || userBrowserTotal === 0} onClick={() => { if (!window.confirm(`Allow republish for ALL covers by @${userBrowserSelected.username}?`)) return; void bulkPermaUnpublish(userBrowserSelected.id, false); }}>
                      Allow republish all
                    </button>
                  </div>

                  {userBrowserLoading ? (
                    <p className="admin-empty">Loading…</p>
                  ) : (
                    <>
                      <div className="admin-list">
                        {userBrowserCovers.map((c) => (
                          <div key={c.id} className="admin-list-row">
                            <div className="admin-list-meta">
                              <span className="admin-list-primary">{c.artist} — {c.title}</span>
                              <span className="admin-muted">/{c.page_slug}{c.perma_unpublished ? ' – perma-unpublished' : c.is_public ? '' : ' – private'}</span>
                            </div>
                            <div className="admin-row-actions">
                              <button className="admin-btn" onClick={() => setCoverVisibility(c.id, !c.is_public)} disabled={c.perma_unpublished || busyId === `visibility-${c.id}`} title={c.perma_unpublished ? 'Permanently unpublished' : ''}>{c.is_public ? 'Unpublish' : 'Publish'}</button>
                              <button className="admin-btn" onClick={() => setCoverPermaUnpublished(c.id, !c.perma_unpublished, permaUnpublishReason)} disabled={busyId === `perma-${c.id}`}>{c.perma_unpublished ? 'Allow republish' : 'Perma-unpublish'}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {userBrowserTotal > 50 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                          <button className="admin-btn" disabled={userBrowserPage <= 1} onClick={() => { const p = userBrowserPage - 1; setUserBrowserPage(p); void loadUserBrowserCovers(userBrowserSelected.id, p); }}>← Prev</button>
                          <span className="admin-muted">Page {userBrowserPage} of {Math.ceil(userBrowserTotal / 50)}</span>
                          <button className="admin-btn" disabled={userBrowserPage >= Math.ceil(userBrowserTotal / 50)} onClick={() => { const p = userBrowserPage + 1; setUserBrowserPage(p); void loadUserBrowserCovers(userBrowserSelected.id, p); }}>Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* LEGAL & TOOLS                                                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'legal' && (
            <>
              {/* Mass remove by tag */}
              <div className="admin-card">
                <h3 className="admin-card-title">Mass Remove by Tag</h3>
                <p className="admin-card-desc">Delete every cover that has been tagged with a specific label.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="admin-input" placeholder="Tag (e.g. infringing-label)" value={removeTag} onChange={(e) => setRemoveTag(e.target.value)} style={{ minWidth: 260 }} />
                  <button className="admin-btn admin-btn-primary" disabled={busyId === 'mass-remove-tag'} onClick={massRemoveByTag}>Mass remove by tag</button>
                </div>
              </div>

              {/* Official gallery blacklist */}
              <div className="admin-card" style={{ marginTop: 16 }}>
                <h3 className="admin-card-title">Official Gallery Blacklist</h3>
                <p className="admin-card-desc">Blacklist exact artists and loose phrases from official gallery/search results.</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="admin-input" placeholder="Add artist (exact)" value={newArtistBlacklist} onChange={(e) => setNewArtistBlacklist(e.target.value)} style={{ minWidth: 220 }} />
                    <input className="admin-input" placeholder="Reason (optional)" value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} style={{ minWidth: 220 }} />
                    <button className="admin-btn admin-btn-primary" onClick={() => addBlacklist('artist')} disabled={busyId === 'blacklist-add-artist'}>Add artist rule</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="admin-input" placeholder="Add phrase contains" value={newPhraseBlacklist} onChange={(e) => setNewPhraseBlacklist(e.target.value)} style={{ minWidth: 220 }} />
                    <button className="admin-btn admin-btn-primary" onClick={() => addBlacklist('phrase')} disabled={busyId === 'blacklist-add-phrase'}>Add phrase rule</button>
                  </div>
                  <div className="admin-list">
                    {artistBlacklist.map((item) => (
                      <div key={`artist-${item.value}`} className="admin-list-row">
                        <div className="admin-list-meta">
                          <span className="admin-list-primary">Artist: {item.value}</span>
                          <span className="admin-muted">{item.reason ?? 'No reason provided'}</span>
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-btn" onClick={() => removeBlacklist('artist', item.value)}>Remove</button>
                        </div>
                      </div>
                    ))}
                    {phraseBlacklist.map((item) => (
                      <div key={`phrase-${item.value}`} className="admin-list-row">
                        <div className="admin-list-meta">
                          <span className="admin-list-primary">Phrase: {item.value}</span>
                          <span className="admin-muted">{item.reason ?? 'No reason provided'}</span>
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-btn" onClick={() => removeBlacklist('phrase', item.value)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phash tools */}
              <div className="admin-card" style={{ marginTop: 16 }}>
                <h3 className="admin-card-title">Phash Tools</h3>
                <p className="admin-card-desc">
                  Backfill computes perceptual hashes for covers that are missing one (up to 500 at a time).
                  Force-recompute updates all CF-backed covers' stored phash from the Cloudflare-served image.
                </p>
                <div className="admin-row-actions">
                  <button className="admin-btn admin-btn-primary" onClick={runPhashBackfill} disabled={phashBackfillRunning}>
                    {phashBackfillRunning ? 'Running…' : 'Backfill phash'}
                  </button>
                  <button className="admin-btn" onClick={runPhashForceRecompute} disabled={phashForceRunning}>
                    {phashForceRunning ? 'Running…' : 'Force-recompute phash'}
                  </button>
                </div>
                {phashBackfillMsg && <p className="admin-muted" style={{ marginTop: 8 }}>{phashBackfillMsg}</p>}
                {phashForceMsg && <p className="admin-muted" style={{ marginTop: 4 }}>{phashForceMsg}</p>}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* BLOG                                                              */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'blog' && (
            <div className="admin-card">
              <p className="admin-card-desc">Write and publish blog posts visible at <a href="/blog" target="_blank" rel="noopener noreferrer">/blog</a>. Only operators can post.</p>

              {blogFormOpen && (
                <div className="admin-blog-form" style={{ marginBottom: 20 }}>
                  <h3 className="admin-card-subtitle">{blogEditingId ? 'Edit post' : 'New post'}</h3>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <input
                      className="admin-input"
                      placeholder="Title"
                      value={blogTitle}
                      onChange={(e) => setBlogTitle(e.target.value)}
                    />
                    <textarea
                      className="admin-input"
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
                    <div className="admin-row-actions">
                      <button className="admin-btn admin-btn-primary" onClick={saveBlogPost} disabled={busyId === 'blog-save'}>
                        {busyId === 'blog-save' ? 'Saving…' : blogEditingId ? 'Update post' : 'Create post'}
                      </button>
                      <button className="admin-btn" onClick={closeBlogForm}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {blogLoading ? (
                <p className="admin-empty">Loading…</p>
              ) : blogPosts.length === 0 ? (
                <p className="admin-empty">No posts yet. Hit "New post" to write one.</p>
              ) : (
                <div className="admin-list">
                  {blogPosts.map((post) => (
                    <div key={post.id} className="admin-list-row">
                      <div className="admin-list-meta">
                        <span className="admin-list-primary">
                          {post.title}
                          {post.published
                            ? <span className="admin-badge admin-badge--published" style={{ marginLeft: 8 }}>Published</span>
                            : <span className="admin-badge" style={{ marginLeft: 8 }}>Draft</span>}
                        </span>
                        <span className="admin-muted">
                          /blog/{post.slug}
                          {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}
                          {post.author_username ? ` · @${post.author_username}` : ''}
                        </span>
                        <span className="admin-muted" style={{ fontStyle: 'italic' }}>
                          {post.body.slice(0, 120)}{post.body.length > 120 ? '…' : ''}
                        </span>
                      </div>
                      <div className="admin-row-actions" style={{ flexShrink: 0 }}>
                        <button className="admin-btn" onClick={() => openEditBlogForm(post)}>Edit</button>
                        <a className="admin-btn" href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">View</a>
                        <button className="admin-btn admin-btn-danger" onClick={() => deleteBlogPost(post.id, post.title)} disabled={busyId === `blog-del-${post.id}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ACHIEVEMENTS                                                      */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {visibleSection === 'achievements' && (
            <div className="admin-card">
              <p className="admin-card-desc">Grant or revoke any achievement badge for any user.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="admin-input"
                    placeholder="Search user…"
                    value={achQuery}
                    onChange={(e) => { setAchQuery(e.target.value); setAchSelectedUser(null); }}
                    style={{ minWidth: 220 }}
                  />
                  {achOptions.length > 0 && (
                    <div className="admin-dropdown">
                      {achOptions.map((opt) => (
                        <button key={opt.id} className="admin-dropdown-item" onClick={() => { setAchSelectedUser(opt); setAchQuery(opt.username); setAchOptions([]); }}>
                          @{opt.username}{opt.display_name ? ` (${opt.display_name})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select className="admin-input admin-select" value={achType} onChange={(e) => setAchType(e.target.value)}>
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
                <input className="admin-input" placeholder="Note (optional)" value={achNote} onChange={(e) => setAchNote(e.target.value)} style={{ minWidth: 200 }} />
                <button className="admin-btn admin-btn-primary" disabled={!achSelectedUser || busyId === 'ach-grant'} onClick={() => awardAchievement('grant')}>Grant</button>
                <button className="admin-btn" disabled={!achSelectedUser || busyId === 'ach-revoke'} onClick={() => awardAchievement('revoke')}>Revoke</button>
              </div>
              {achSelectedUser && <p className="admin-muted" style={{ marginTop: 8 }}>Selected: @{achSelectedUser.username}</p>}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
