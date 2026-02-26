import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LoadingIcon from '../components/LoadingIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import DownloadIcon from '../components/DownloadIcon';
import BackIcon from '../components/BackIcon';
import UserIcon from '../components/UserIcon';
import CalendarIcon from '../components/CalendarIcon';
import TagIcon from '../components/TagIcon';
import FlagIcon from '../components/FlagIcon';
import FolderIcon from '../components/FolderIcon';
import TrashIcon from '../components/TrashIcon';
import PencilIcon from '../components/PencilIcon';
import ChevronDownIcon from '../components/ChevronDownIcon';
import { supabase } from '../lib/supabase';
import { checkRateLimit } from '../lib/rateLimit';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc, getCoverDownloadUrl } from '../lib/media';
import { getCoverPath, parseArtists, slugifyArtist } from '../lib/coverRoutes';
import CoverComments from '../components/CoverComments';
import RateLimitModal from '../components/RateLimitModal';

type PanelMode = null | 'collection' | 'report' | 'edit';
type ReportReason = 'inappropriate' | 'copyright' | 'spam' | 'other';
interface CollectionRow { id: string; name: string; is_public: boolean; }
const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'other', label: 'Other' },
];

export default function CoverDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const [cover, setCover] = useState<Cover | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const downloadBtnRef = useRef<HTMLDivElement>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [moreByArtist, setMoreByArtist] = useState<Cover[]>([]);

  const [activePanel, setActivePanel] = useState<PanelMode>(null);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColPublic, setNewColPublic] = useState(true);
  const [colStatus, setColStatus] = useState('');
  const [colSaving, setColSaving] = useState(false);

  const [reportReason, setReportReason] = useState<ReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editStatus, setEditStatus] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rateLimitedAction, setRateLimitedAction] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);

  // Tracks the cover's updated_at as seen at last load, for the poll below.
  const knownUpdatedAtRef = useRef<string | null>(null);
  // Tracks when the current user wrote to this cover so we advance the baseline
  // instead of showing a spurious "cover updated" banner for their own saves.
  const selfWritePendingRef = useRef(false);
  const selfWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function markSelfWrite() {
    selfWritePendingRef.current = true;
    // Advance the baseline so the next poll doesn't flag our own write.
    knownUpdatedAtRef.current = new Date().toISOString();
    if (selfWriteTimerRef.current) clearTimeout(selfWriteTimerRef.current);
    selfWriteTimerRef.current = setTimeout(() => { selfWritePendingRef.current = false; }, 5000);
  }

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
        .eq('page_slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (!data) { setCover(null); setLoading(false); return; }
      const c = data as Cover;
      const isOwner = Boolean(user?.id && c.user_id === user.id);
      if ((c.perma_unpublished || !c.is_public) && !isOwner) {
        setCover(null);
        setLoading(false);
        return;
      }
      setCover(c);
      knownUpdatedAtRef.current = c.updated_at;
      document.title = `${c.artist} | ${c.title} | covers.cafe`;

      const { data: more } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
        .eq('artist', c.artist)
        .neq('id', c.id)
        .eq('is_public', true)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!cancelled) setMoreByArtist((more as Cover[]) ?? []);

      if (user) {
        const { data: fav } = await supabase
          .from('covers_cafe_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('cover_id', c.id)
          .maybeSingle();
        if (!cancelled) setIsFavorited(Boolean(fav));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [slug, user?.id]);

  // Poll for cover updates every 90 s (replaces Realtime to free up WS connections).
  useEffect(() => {
    if (!cover?.id) return;
    const id = setInterval(async () => {
      if (selfWritePendingRef.current || refreshPending) return;
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('updated_at')
        .eq('id', cover.id)
        .maybeSingle();
      if (data && data.updated_at !== knownUpdatedAtRef.current) {
        setRefreshPending(true);
      }
    }, 90_000);
    return () => clearInterval(id);
  }, [cover?.id, refreshPending]);

  // Open panel from ?panel= query param (drag-to-collection from gallery)
  useEffect(() => {
    const panel = searchParams.get('panel') as PanelMode;
    if (panel === 'collection') void openCollectionPanel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Scroll panel into view whenever it opens.
  // Also depends on `loading` so it retries after the cover finishes loading
  // (the ?panel=collection flow sets activePanel before the cover is in the DOM).
  useEffect(() => {
    if (loading || !activePanel) return;
    const id = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(id);
  }, [activePanel, loading]);

  useEffect(() => {
    if (!showSizeMenu) return;
    const handler = (e: MouseEvent) => {
      if (!downloadBtnRef.current?.contains(e.target as Node)) setShowSizeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSizeMenu]);

  const toggleFavorite = async () => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    if (!checkRateLimit('cover_detail_favorite', 8, 5000)) { setRateLimitedAction('cover_detail_favorite'); return; }
    markSelfWrite();
    const { error } = await supabase.rpc('covers_cafe_toggle_favorite', { p_cover_id: cover.id });
    if (!error) {
      const nowFav = !isFavorited;
      setIsFavorited(nowFav);
      setCover(prev => prev ? { ...prev, favorite_count: Math.max(0, (prev.favorite_count ?? 0) + (nowFav ? 1 : -1)) } : prev);
    }
  };

  const download = async (size?: number) => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    if (!checkRateLimit('cover_detail_download', 5, 10000)) { setRateLimitedAction('cover_detail_download'); return; }
    setDownloading(true);
    setShowSizeMenu(false);
    markSelfWrite();
    await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user.id });
    await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
    const a = document.createElement('a');
    a.href = getCoverDownloadUrl(cover.id, size);
    a.click();
    setDownloading(false);
  };

  const openCollectionPanel = async () => {
    if (!user) return openAuthModal('login');
    if (!checkRateLimit('cover_detail_collection_panel', 10, 10000)) { setRateLimitedAction('cover_detail_collection_panel'); return; }
    setActivePanel('collection');
    setColStatus('');
    setCollectionsLoading(true);
    const { data } = await supabase
      .from('covers_cafe_collections')
      .select('id,name,is_public')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setCollections(data ?? []);
    setCollectionsLoading(false);
  };

  const addToCollection = async (collectionId: string) => {
    if (!user || !collectionId || !cover) return;
    setColSaving(true);
    const { error } = await supabase
      .from('covers_cafe_collection_items')
      .insert({ collection_id: collectionId, cover_id: cover.id });
    if (error?.code === '23505') setColStatus('Already in that collection.');
    else if (error) setColStatus(error.message || 'Could not add to collection.');
    else setColStatus(`Added to "${collections.find((c) => c.id === collectionId)?.name ?? 'collection'}".`);
    setColSaving(false);
  };

  const createCollection = async () => {
    if (!user || !cover) return;
    const name = newColName.trim();
    if (!name) { setColStatus('Name the collection first.'); return; }
    setColSaving(true);
    const { data: created, error } = await supabase
      .from('covers_cafe_collections')
      .insert({ owner_id: user.id, name, is_public: newColPublic })
      .select('id,name,is_public')
      .single();
    if (error || !created) setColStatus(error?.message ?? 'Could not create collection.');
    else {
      setCollections((prev) => [created, ...prev]);
      setSelectedCollectionId(created.id);
      setNewColName('');
      setColStatus(`Created "${created.name}".`);
    }
    setColSaving(false);
  };

  const handleReport = async () => {
    if (!user || !cover) return openAuthModal('login');
    if (!checkRateLimit('cover_detail_report', 3, 30000)) { setRateLimitedAction('cover_detail_report'); return; }
    setReporting(true);
    await supabase.from('covers_cafe_reports').insert({
      cover_id: cover.id, reporter_id: user.id,
      reason: reportReason, details: reportDetails.trim() || null,
    });
    setReporting(false);
    setReportDone(true);
  };

  const openEditPanel = () => {
    if (!cover) return;
    setEditTitle(cover.title);
    setEditArtist(cover.artist);
    setEditYear(cover.year?.toString() ?? '');
    setEditTags((cover.tags ?? []).join(', '));
    setEditIsPrivate(cover.is_private);
    setEditStatus('');
    setActivePanel('edit');
  };

  const saveEdit = async () => {
    if (!cover) return;
    const title = editTitle.trim();
    const artist = editArtist.trim();
    if (!title || !artist) { setEditStatus('Title and artist are required.'); return; }
    setEditSaving(true);
    const year = editYear.trim() ? parseInt(editYear.trim(), 10) : null;
    const tags = editTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    markSelfWrite();
    const { data: updated, error } = await supabase
      .from('covers_cafe_covers')
      .update({ title, artist, year, tags, is_private: editIsPrivate })
      .eq('id', cover.id)
      .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
      .single();
    if (error) setEditStatus(error.message || 'Could not save changes.');
    else if (updated) { setCover(updated as Cover); setEditStatus('Saved.'); }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!cover) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    const paths = [cover.storage_path];
    if (cover.thumbnail_path) paths.push(cover.thumbnail_path);
    await supabase.storage.from('covers_cafe_covers').remove(paths);
    await supabase.from('covers_cafe_covers').delete().eq('id', cover.id);
    navigate(-1);
  };

  if (loading) return <p className="text-muted"><LoadingIcon size={16} className="cover-spinner" /> Loading cover…</p>;
  if (!cover) return <p className="text-muted">Cover not found.</p>;

  const isOwner = user?.id === cover.user_id;
  const createdAt = cover.created_at ? new Date(cover.created_at) : null;
  const createdLabel = createdAt ? createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const createdFullLabel = createdAt ? createdAt.toString() : '';

  return (
    <div className="cover-page">
      {refreshPending && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--body-text-muted)' }}>This cover was updated.</span>
          <button className="btn btn-secondary" onClick={() => { setRefreshPending(false); window.location.reload(); }}>Refresh</button>
        </div>
      )}
      <button className="btn btn-secondary cover-page-back" onClick={() => navigate(-1)}>
        <BackIcon size={14} /> Back
      </button>

      {/* Image */}
      <div className="cover-board">
        <img
          src={getCoverImageSrc(cover, 1200)}
          alt={`${cover.title} by ${cover.artist}`}
          className="cover-board-image"
        />
        <div className="cover-board-actions">
          <button className={`btn cover-fav-btn${isFavorited ? ' cover-fav-btn--active' : ''}`} onClick={toggleFavorite}>
            <FavoritesIcon size={14} />
            {isFavorited ? 'Favorited' : 'Favorite'}
          </button>

          <div className="cover-download-group" ref={downloadBtnRef}>
            <button className="btn btn-primary cover-dl-btn" onClick={() => download()} disabled={downloading}>
              <DownloadIcon size={14} />
              {downloading ? 'Downloading…' : 'Download'}
            </button>
            <button
              className="btn btn-primary cover-dl-arrow"
              onClick={() => setShowSizeMenu((v) => !v)}
              disabled={downloading}
              title="More sizes"
            >
              <ChevronDownIcon size={13} />
            </button>
            {showSizeMenu && (
              <div className="cover-size-menu">
                <button className="cover-size-option" onClick={() => download()}>Full size</button>
                <button className="cover-size-option" onClick={() => download(3000)}>3000 px</button>
                <button className="cover-size-option" onClick={() => download(1500)}>1500 px</button>
                <button className="cover-size-option" onClick={() => download(1000)}>1000 px</button>
                <button className="cover-size-option" onClick={() => download(800)}>800 px</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="cover-page-meta card">
        <h1 className="cover-page-title">{cover.title}</h1>
        <p className="cover-page-artist-wrap">
          {parseArtists(cover.artist).map((name, i, arr) => (
            <span key={name}>
              <button
                className="cover-page-artist-link"
                onClick={() => navigate(`/artists/${slugifyArtist(name)}`, { state: { originalName: name } })}
              >{name}</button>
              {i < arr.length - 1 && ' & '}
            </span>
          ))}
        </p>

        <div className="cover-page-meta-topline">
          {cover.profiles?.username && (
            <button
              className="cover-page-uploader"
              onClick={() => navigate(`/users/${cover.profiles!.username}`)}
            >
              <UserIcon size={12} /> @{cover.profiles.username}
            </button>
          )}
          {cover.year && <span className="cover-meta-chip"><CalendarIcon size={11} /> {cover.year}</span>}
        </div>

        <div className="cover-meta-stats">
          {createdAt && <span className="cover-meta-chip" title={createdFullLabel}><CalendarIcon size={11} /> {createdLabel}</span>}
          <span className="cover-meta-chip"><FavoritesIcon size={11} /> {Math.max(cover.favorite_count ?? 0, isFavorited ? 1 : 0)} favorite{Math.max(cover.favorite_count ?? 0, isFavorited ? 1 : 0) === 1 ? '' : 's'}</span>
          <span className="cover-meta-chip"><DownloadIcon size={11} /> {cover.download_count ?? 0} download{(cover.download_count ?? 0) === 1 ? '' : 's'}</span>
        </div>

        {cover.tags && cover.tags.length > 0 && (
          <div className="cover-tags">
            <TagIcon size={12} className="cover-tags-icon" />
            {cover.tags.map((tag) => (
              <button key={tag} className="cover-tag" onClick={() => navigate(`/?q=${encodeURIComponent(tag)}`)}>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Secondary actions */}
      <div className="cover-secondary-actions">
        <button className="btn cover-action-sm" onClick={() => void openCollectionPanel()}>
          <FolderIcon size={13} /> Add to Collection
        </button>
        <button className="btn cover-action-sm" onClick={() => { setReportDone(false); setActivePanel(activePanel === 'report' ? null : 'report'); }}>
          <FlagIcon size={13} /> Report
        </button>
        {isOwner && (
          <>
            <button className="btn cover-action-sm" onClick={openEditPanel}>
              <PencilIcon size={13} /> Edit
            </button>
            <button
              className={`btn cover-action-sm cover-delete-btn${deleteConfirm ? ' cover-delete-btn--confirm' : ''}`}
              onClick={() => void handleDelete()}
              disabled={deleting}
              onMouseLeave={() => setDeleteConfirm(false)}
            >
              <TrashIcon size={13} /> {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm?' : 'Delete'}
            </button>
          </>
        )}
      </div>

      {/* Inline panels */}
      <div ref={panelRef} className="cover-panels-anchor">
      {activePanel === 'collection' && (
        <div className="cover-panel">
          <h3 className="cover-panel-title"><FolderIcon size={14} /> Add to Collection</h3>
          {collectionsLoading ? (
            <p className="cover-panel-muted">Loading collections…</p>
          ) : (
            <>
              <div className="cover-panel-row">
                <select className="cover-panel-input" value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
                  <option value="">{collections.length === 0 ? 'No collections yet  -  create one below' : 'Select a collection…'}</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.is_public ? 'Public' : 'Private'})</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={() => void addToCollection(selectedCollectionId)} disabled={!selectedCollectionId || colSaving}>
                  Add
                </button>
              </div>
              <div className="cover-panel-row">
                <input className="cover-panel-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="New collection name…" />
                <button className="btn btn-secondary" onClick={() => setNewColPublic((p) => !p)}>{newColPublic ? 'Public' : 'Private'}</button>
                <button className="btn btn-primary" onClick={() => void createCollection()} disabled={colSaving}>Create</button>
              </div>
            </>
          )}
          {colStatus && <p className="cover-panel-status">{colStatus}</p>}
          <button className="btn btn-secondary cover-panel-close-btn" onClick={() => setActivePanel(null)}>Close</button>
        </div>
      )}

      {activePanel === 'report' && (
        <div className="cover-panel">
          <h3 className="cover-panel-title"><FlagIcon size={14} /> Report Cover</h3>
          {reportDone ? (
            <>
              <p className="cover-panel-muted">Thanks  -  your report has been submitted.</p>
              <button className="btn btn-secondary cover-panel-close-btn" onClick={() => setActivePanel(null)}>Close</button>
            </>
          ) : (
            <>
              <div className="cover-panel-row">
                <select className="cover-panel-input" value={reportReason} onChange={(e) => setReportReason(e.target.value as ReportReason)}>
                  {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <textarea className="cover-panel-input cover-panel-textarea" placeholder="Additional details (optional)" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={3} />
              <div className="cover-panel-row">
                <button className="btn btn-primary" onClick={() => void handleReport()} disabled={reporting}>
                  {reporting ? 'Submitting…' : 'Submit Report'}
                </button>
                <button className="btn btn-secondary" onClick={() => setActivePanel(null)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {activePanel === 'edit' && (
        <div className="cover-panel">
          <h3 className="cover-panel-title"><PencilIcon size={14} /> Edit Cover</h3>
          <div className="cover-panel-form">
            <label className="cover-panel-label">Title</label>
            <input className="cover-panel-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <label className="cover-panel-label">Artist</label>
            <input className="cover-panel-input" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} />
            <label className="cover-panel-label">Year <span className="cover-panel-hint">(optional)</span></label>
            <input className="cover-panel-input" value={editYear} onChange={(e) => setEditYear(e.target.value)} type="number" min="1900" max="2099" />
            <label className="cover-panel-label">Tags <span className="cover-panel-hint">(comma-separated)</span></label>
            <input className="cover-panel-input" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="jazz, vinyl, 70s" />
            <label className="cover-panel-label">Visibility</label>
            <div className="cover-panel-row">
              <button className={`btn${!editIsPrivate ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setEditIsPrivate(false)} disabled={Boolean(cover?.perma_unpublished)} title={cover?.perma_unpublished ? 'Permanently unpublished: cannot republish' : ''}>Published</button>
              <button className={`btn${editIsPrivate ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setEditIsPrivate(true)}>Unpublished</button>
            </div>
          </div>
          {cover?.perma_unpublished && <p className="cover-panel-status">Permanently unpublished (DMCA/compliance): public republish disabled.</p>}
          {editStatus && <p className="cover-panel-status">{editStatus}</p>}
          <div className="cover-panel-row">
            <button className="btn btn-primary" onClick={() => void saveEdit()} disabled={editSaving || Boolean(cover?.perma_unpublished && editIsPrivate === false)}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={() => setActivePanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      </div>

      {/* Comments */}
      <div className="cover-page-comments-wrap">
        <CoverComments coverId={cover.id} cover={cover} />
      </div>

      {/* More by artist */}
      {moreByArtist.length > 0 && (
        <section className="cover-more-section">
          <h3 className="cover-more-heading">More artworks for {cover.artist}</h3>
          <div className="cover-more-grid">
            {moreByArtist.map((item) => (
              <button
                key={item.id}
                className="cover-more-item"
                onClick={() => navigate(getCoverPath(item))}
                title={`${item.title} by ${item.artist}`}
              >
                <img src={getCoverImageSrc(item, 300)} alt={item.title} className="cover-more-img" />
                <span className="cover-more-label">{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {rateLimitedAction && (
        <RateLimitModal action={rateLimitedAction} onClose={() => setRateLimitedAction(null)} />
      )}

      
    </div>
  );
}
