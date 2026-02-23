import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc, getCoverDownloadSrc } from '../lib/media';
import { getCoverPath, getCoverPublicIdFromSlug, slugifyArtist } from '../lib/coverRoutes';
import CoverComments from '../components/CoverComments';

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

  const panelRef = useRef<HTMLDivElement>(null);

  const publicId = useMemo(() => (slug ? getCoverPublicIdFromSlug(slug) : null), [slug]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!publicId) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
        .eq('public_id', publicId)
        .single();
      if (cancelled) return;
      if (!data) { setCover(null); setLoading(false); return; }
      const c = data as Cover;
      setCover(c);
      document.title = `${c.artist} - ${c.title} | covers.cafe`;

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
  }, [publicId, user?.id]);

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
    if (isFavorited) {
      await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', cover.id);
    } else {
      await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: cover.id });
    }
    setIsFavorited(!isFavorited);
  };

  const download = async (size?: number) => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    setDownloading(true);
    setShowSizeMenu(false);
    await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user.id });
    await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
    const src = getCoverDownloadSrc(cover, size);
    const res = await fetch(src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = size ? `_${size}px` : '';
    a.download = `${cover.artist} - ${cover.title}${suffix}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const openCollectionPanel = async () => {
    if (!user) return openAuthModal('login');
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

  return (
    <div className="cover-page">
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
      <div className="cover-page-meta">
        <h1 className="cover-page-title">{cover.title}</h1>
        <button
          className="cover-page-artist-link"
          onClick={() => navigate(`/artists/${slugifyArtist(cover.artist)}`, { state: { originalName: cover.artist } })}
        >
          {cover.artist}
        </button>
        {cover.profiles?.username && (
          <button
            className="cover-page-uploader"
            onClick={() => navigate(`/users/${cover.profiles!.username}`)}
          >
            <UserIcon size={12} /> @{cover.profiles.username}
          </button>
        )}

        {(cover.year || (cover.favorite_count ?? 0) > 0 || (cover.download_count ?? 0) > 0) && (
          <div className="cover-meta-chips">
            {cover.year && <span className="cover-meta-chip"><CalendarIcon size={11} /> {cover.year}</span>}
            {(cover.favorite_count ?? 0) > 0 && <span className="cover-meta-chip"><FavoritesIcon size={11} /> {cover.favorite_count}</span>}
            {(cover.download_count ?? 0) > 0 && <span className="cover-meta-chip"><DownloadIcon size={11} /> {cover.download_count}</span>}
          </div>
        )}

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
                  <option value="">{collections.length === 0 ? 'No collections yet — create one below' : 'Select a collection…'}</option>
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
              <p className="cover-panel-muted">Thanks — your report has been submitted.</p>
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
              <button className={`btn${!editIsPrivate ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setEditIsPrivate(false)}>Published</button>
              <button className={`btn${editIsPrivate ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setEditIsPrivate(true)}>Unpublished</button>
            </div>
          </div>
          {editStatus && <p className="cover-panel-status">{editStatus}</p>}
          <div className="cover-panel-row">
            <button className="btn btn-primary" onClick={() => void saveEdit()} disabled={editSaving}>
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

      <style>{`
        .cover-spinner { animation: cover-spin 0.8s linear infinite; }
        @keyframes cover-spin { to { transform: rotate(360deg); } }

        .cover-page-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 22px; }

        /* Image */
        .cover-board { display: flex; flex-direction: column; align-items: center; gap: 14px; margin: 0 auto 16px; }
        .cover-board-image { width: 100%; max-width: 600px; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px; box-shadow: var(--shadow-md); display: block; }
        .cover-board-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        .cover-fav-btn { background: linear-gradient(180deg, var(--sidebar-bg-light) 0%, var(--sidebar-bg) 55%, var(--sidebar-bg-dark) 100%); color: var(--sidebar-text); }
        .cover-fav-btn--active { background: linear-gradient(180deg, #f0c060 0%, #d4a020 55%, #b08010 100%); color: #5a3a00; border-color: #8a6010; }

        .cover-download-group { position: relative; display: flex; }
        .cover-dl-btn { border-radius: 4px 0 0 4px; display: flex; align-items: center; gap: 6px; }
        .cover-dl-arrow { border-radius: 0 4px 4px 0; border-left: 1px solid rgba(255,255,255,0.25); padding: 0 8px; display: flex; align-items: center; }
        .cover-size-menu {
          position: absolute; top: calc(100% + 4px); right: 0; z-index: 100;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 4px; box-shadow: var(--shadow-md);
          display: flex; flex-direction: column; min-width: 120px; overflow: hidden;
        }
        .cover-size-option { padding: 8px 14px; text-align: left; font-size: 13px; font-weight: bold; background: none; border: none; color: var(--body-text); cursor: pointer; box-shadow: none; font-family: Arial, Helvetica, sans-serif; }
        .cover-size-option:hover { background: var(--accent); color: white; transform: none; }

        /* Metadata */
        .cover-page-meta { max-width: 560px; margin: 0 auto 14px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .cover-page-title { font-size: 24px; font-weight: bold; color: var(--body-text); text-shadow: 0 1px 0 rgba(255,255,255,0.45); margin-bottom: 2px; line-height: 1.25; }
        [data-theme="dark"] .cover-page-title { text-shadow: none; }
        .cover-page-artist-link { font-size: 17px; font-weight: bold; color: var(--body-text-muted); background: none; border: none; cursor: pointer; padding: 0; box-shadow: none; font-family: Arial, Helvetica, sans-serif; }
        .cover-page-artist-link:hover { color: var(--accent); text-decoration: underline; }
        .cover-page-uploader { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--accent); padding: 0; box-shadow: none; font-family: Arial, Helvetica, sans-serif; font-weight: bold; }
        .cover-page-uploader:hover { color: var(--accent-light); text-decoration: underline; }
        .cover-meta-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .cover-meta-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--body-text-muted); background: var(--body-border); padding: 2px 7px; border-radius: 3px; font-weight: bold; }
        .cover-tags { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center; }
        .cover-tags-icon { color: var(--body-text-muted); flex-shrink: 0; }
        .cover-tag { font-size: 11px; font-weight: bold; background: var(--sidebar-bg); color: var(--sidebar-text); padding: 2px 7px; border-radius: 3px; border: 1px solid var(--sidebar-border); box-shadow: var(--shadow-sm); cursor: pointer; transition: background 0.1s, color 0.1s; }
        .cover-tag:hover { background: var(--accent); color: white; border-color: var(--accent); transform: none; box-shadow: none; }

        /* Panel scroll anchor — leaves room for sticky header */
        .cover-panels-anchor { scroll-margin-top: calc(var(--header-h) + 16px); }

        /* Secondary actions */
        .cover-secondary-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px; }
        .cover-action-sm { display: flex; align-items: center; gap: 5px; font-size: 12px; padding: 6px 12px; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); color: var(--body-text); }
        .cover-action-sm:hover { background: var(--sidebar-bg-dark); }
        .cover-delete-btn { background: rgba(200,50,30,0.1); border-color: rgba(200,50,30,0.3); color: #c83220; }
        .cover-delete-btn:hover { background: rgba(200,50,30,0.2); transform: none; box-shadow: none; }
        .cover-delete-btn--confirm { background: #c83220 !important; color: white !important; border-color: #a02010 !important; }

        /* Panels */
        .cover-panel { max-width: 560px; margin: 0 auto 20px; background: var(--body-card-bg); border: 1px solid var(--body-card-border); border-radius: 7px; box-shadow: var(--shadow-sm); padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .cover-panel-title { font-size: 15px; font-weight: bold; color: var(--body-text); display: flex; align-items: center; gap: 7px; }
        .cover-panel-muted { font-size: 13px; color: var(--body-text-muted); }
        .cover-panel-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .cover-panel-form { display: flex; flex-direction: column; gap: 8px; }
        .cover-panel-label { font-size: 13px; font-weight: bold; color: var(--body-text); }
        .cover-panel-hint { font-size: 11px; color: var(--body-text-muted); font-weight: normal; }
        .cover-panel-input { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 4px; border: 1px solid var(--body-card-border); background: var(--body-card-bg); color: var(--body-text); font-size: 13px; font-family: Arial, Helvetica, sans-serif; box-shadow: var(--shadow-inset-sm); outline: none; width: 100%; }
        .cover-panel-input:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .cover-panel-textarea { resize: none; }
        .cover-panel-status { font-size: 12px; color: var(--body-text-muted); padding: 6px 10px; background: var(--body-border); border-radius: 4px; }
        .cover-panel-close-btn { align-self: flex-start; }

        /* Comments */
        .cover-page-comments-wrap { max-width: 720px; margin: 0 auto; }

        /* More */
        .cover-more-section { margin-top: 36px; padding-top: 28px; border-top: 2px solid var(--body-border); }
        .cover-more-heading { font-size: 18px; font-weight: bold; color: var(--body-text); text-shadow: 0 1px 0 rgba(255,255,255,0.4); margin-bottom: 16px; }
        [data-theme="dark"] .cover-more-heading { text-shadow: none; }
        .cover-more-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .cover-more-item { padding: 0; border: 1px solid var(--body-card-border); border-radius: 6px; background: var(--body-card-bg); box-shadow: var(--shadow-sm); overflow: hidden; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; display: flex; flex-direction: column; text-align: left; }
        .cover-more-item:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
        .cover-more-img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
        .cover-more-label { font-size: 12px; color: var(--body-text); padding: 6px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid var(--body-card-border); }

        @media (max-width: 640px) {
          .cover-page-title { font-size: 20px; }
          .cover-more-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
        }
      `}</style>
    </div>
  );
}
