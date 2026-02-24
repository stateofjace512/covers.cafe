import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import XIcon from './XIcon';
import FavoritesIcon from './FavoritesIcon';
import DownloadIcon from './DownloadIcon';
import UserIcon from './UserIcon';
import CalendarIcon from './CalendarIcon';
import TagIcon from './TagIcon';
import TrashIcon from './TrashIcon';
import FlagIcon from './FlagIcon';
import LoadingIcon from './LoadingIcon';
import FolderIcon from './FolderIcon';
import ChevronDownIcon from './ChevronDownIcon';
import PencilIcon from './PencilIcon';
import ClockIcon from './ClockIcon';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc, getCoverDownloadSrc } from '../lib/media';
import { parseArtists, slugifyArtist } from '../lib/coverRoutes';
import CoverComments from './CoverComments';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClose: () => void;
  onDeleted?: (coverId: string) => void;
  onUpdated?: (cover: Cover) => void;
  initialPanelMode?: PanelMode;
}

type ReportReason = 'inappropriate' | 'copyright' | 'spam' | 'other';
type PanelMode = 'details' | 'report' | 'collection' | 'edit';

interface CollectionRow {
  id: string;
  name: string;
  is_public: boolean;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'other', label: 'Other' },
];

export default function CoverModal({ cover, isFavorited, onToggleFavorite, onClose, onDeleted, onUpdated, initialPanelMode = 'details' }: Props) {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.id === cover.user_id;

  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuOverlayRef = useRef<HTMLDivElement>(null);
  const [downloadMenuPos, setDownloadMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionPublic, setNewCollectionPublic] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionStatus, setCollectionStatus] = useState('');
  const [collectionStatusIsError, setCollectionStatusIsError] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editStatusIsError, setEditStatusIsError] = useState(false);

  useEffect(() => {
    setPanelMode(initialPanelMode);
  }, [initialPanelMode, cover.id]);

  useEffect(() => {
    if (panelMode !== 'collection' || !user) return;

    const loadCollections = async () => {
      setCollectionsLoading(true);
      try {
        const { data, error } = await supabase
          .from('covers_cafe_collections')
          .select('id,name,is_public')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });
        if (error) {
          setCollectionStatus(`Could not load collections: ${error.message}`);
          setCollectionStatusIsError(true);
        }
        setCollections(data ?? []);
      } catch (err) {
        setCollectionStatus(err instanceof Error ? err.message : 'Could not load collections.');
        setCollectionStatusIsError(true);
      } finally {
        setCollectionsLoading(false);
      }
    };

    void loadCollections();
  }, [panelMode, user?.id]);

  const handleDownload = async (size?: number) => {
    if (!user) { openAuthModal('login'); return; }
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user?.id ?? null });
      await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
      const src = getCoverDownloadSrc(cover, size);
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = size ? `_${size}px` : '';
      a.download = `${cover.artist} - ${cover.title}${suffix}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(false);
  };

  const handleFavorite = () => {
    if (!user) { openAuthModal('login'); return; }
    onToggleFavorite(cover.id);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      const paths = [cover.storage_path];
      if (cover.thumbnail_path) paths.push(cover.thumbnail_path);
      await supabase.storage.from('covers_cafe_covers').remove(paths);
      await supabase.from('covers_cafe_covers').delete().eq('id', cover.id);
      onDeleted?.(cover.id);
      onClose();
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleReport = async () => {
    if (!user) { openAuthModal('login'); return; }
    setReporting(true);
    await supabase.from('covers_cafe_reports').insert({
      cover_id: cover.id,
      reporter_id: user.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setReporting(false);
    setReportDone(true);
  };

  const openCollectionPanel = () => {
    if (!user) { openAuthModal('login'); return; }
    setPanelMode('collection');
    setCollectionStatus('');
    setCollectionStatusIsError(false);
  };

  const openEditPanel = () => {
    setEditTitle(cover.title);
    setEditArtist(cover.artist);
    setEditYear(cover.year?.toString() ?? '');
    setEditTags((cover.tags ?? []).join(', '));
    setEditIsPrivate(cover.is_private);
    setEditStatus('');
    setEditStatusIsError(false);
    setPanelMode('edit');
  };

  const saveEdit = async () => {
    const title = editTitle.trim();
    const artist = editArtist.trim();
    if (!title || !artist) {
      setEditStatus('Title and artist are required.');
      setEditStatusIsError(true);
      return;
    }
    setEditSaving(true);
    const year = editYear.trim() ? parseInt(editYear.trim(), 10) : null;
    const tags = editTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const { data: updated, error } = await supabase
      .from('covers_cafe_covers')
      .update({ title, artist, year, tags, is_private: editIsPrivate })
      .eq('id', cover.id)
      .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
      .single();
    if (error) {
      setEditStatus(error.message || 'Could not save changes.');
      setEditStatusIsError(true);
    } else if (updated) {
      setEditStatus('Saved.');
      setEditStatusIsError(false);
      onUpdated?.(updated as Cover);
    }
    setEditSaving(false);
  };

  const createCollection = async () => {
    if (!user) return;
    const name = newCollectionName.trim();
    if (!name) {
      setCollectionStatus('Name your collection first.');
      setCollectionStatusIsError(true);
      return;
    }

    setSavingCollection(true);
    try {
      const { data: created, error: createErr } = await supabase
        .from('covers_cafe_collections')
        .insert({ owner_id: user.id, name, is_public: newCollectionPublic })
        .select('id,name,is_public')
        .single();
      if (createErr || !created) {
        setCollectionStatus(createErr?.message ?? 'Could not create collection.');
        setCollectionStatusIsError(true);
      } else {
        setCollections((prev) => [created, ...prev]);
        setSelectedCollectionId(created.id);
        setNewCollectionName('');
        setCollectionStatus(`Created "${created.name}".`);
        setCollectionStatusIsError(false);
      }
    } catch (err) {
      setCollectionStatus(err instanceof Error ? err.message : 'Could not create collection.');
      setCollectionStatusIsError(true);
    }
    setSavingCollection(false);
  };

  const setAsCoverImage = async (collectionId: string) => {
    if (!user || !collectionId) return;
    setSavingCollection(true);
    try {
      const { error } = await supabase
        .from('covers_cafe_collections')
        .update({ cover_image_id: cover.id })
        .eq('id', collectionId)
        .eq('owner_id', user.id);
      if (error) {
        setCollectionStatus(error.message || 'Could not set cover image.');
        setCollectionStatusIsError(true);
      } else {
        setCollectionStatus('Cover image updated.');
        setCollectionStatusIsError(false);
      }
    } catch (err) {
      setCollectionStatus(err instanceof Error ? err.message : 'Could not set cover image.');
      setCollectionStatusIsError(true);
    }
    setSavingCollection(false);
  };

  const addToCollection = async (collectionId: string) => {
    if (!user || !collectionId) return;
    setSavingCollection(true);

    try {
      const { error: addErr } = await supabase
        .from('covers_cafe_collection_items')
        .insert({ collection_id: collectionId, cover_id: cover.id });
      if (addErr) {
        if (addErr.code === '23505') {
          setCollectionStatus('This image is already in that collection.');
          setCollectionStatusIsError(false);
        } else {
          setCollectionStatus(addErr.message || 'Could not add to collection.');
          setCollectionStatusIsError(true);
        }
      } else {
        const picked = collections.find((item) => item.id === collectionId);
        setCollectionStatus(`Added to ${picked?.name ?? 'collection'}.`);
        setCollectionStatusIsError(false);
      }
    } catch (err) {
      setCollectionStatus(err instanceof Error ? err.message : 'Could not add to collection.');
      setCollectionStatusIsError(true);
    }
    setSavingCollection(false);
  };


  useEffect(() => {
    if (!showDownloadMenu) return;

    const updatePos = () => {
      const rect = downloadMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDownloadMenuPos({ top: rect.bottom + 4, left: rect.right - 130 });
    };

    const handleDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (downloadMenuRef.current?.contains(target)) return;
      if (downloadMenuOverlayRef.current?.contains(target)) return;
      setShowDownloadMenu(false);
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    document.addEventListener('mousedown', handleDocClick);

    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
      document.removeEventListener('mousedown', handleDocClick);
    };
  }, [showDownloadMenu]);

  return (
    <>
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box cover-modal" role="dialog" aria-modal="true">
        <button className="cover-modal-close" onClick={onClose} aria-label="Close">
          <XIcon size={18} />
        </button>

        <div className="cover-modal-inner">
          <div className="cover-modal-image-wrap">
            <img
              src={getCoverImageSrc(cover, 800)}
              alt={`${cover.title} by ${cover.artist}`}
              className="cover-modal-image"
              draggable={panelMode === 'collection'}
              onDragStart={(e) => e.dataTransfer.setData('text/cover-id', cover.id)}
            />
          </div>

          <div className="cover-modal-info">
            {panelMode === 'details' && (
              <>
                <div className="cover-modal-titles">
                  <h2 className="cover-modal-title">{cover.title}</h2>
                  <p className="cover-modal-artist">
                    {parseArtists(cover.artist).map((name, i, arr) => (
                      <span key={name}>
                        <button
                          className="cover-modal-artist-link"
                          onClick={() => { onClose(); navigate(`/artists/${slugifyArtist(name)}`, { state: { originalName: name } }); }}
                        >{name}</button>
                        {i < arr.length - 1 && ' & '}
                      </span>
                    ))}
                  </p>
                </div>

                <div className="cover-modal-meta">
                  {cover.year && (
                    <div className="cover-meta-row">
                      <CalendarIcon size={13} />
                      <span>{cover.year}</span>
                    </div>
                  )}
                  <div className="cover-meta-row">
                    <UserIcon size={13} />
                    <span>
                      Uploaded by{' '}
                      {cover.profiles?.username ? (
                        <button
                          className="cover-meta-user-link"
                          onClick={() => navigate(`/users/${cover.profiles!.username}`)}
                        >
                          {cover.profiles.username}
                        </button>
                      ) : (
                        <strong>unknown</strong>
                      )}
                    </span>
                  </div>
                  {cover.created_at && (
                    <div className="cover-meta-row">
                      <ClockIcon size={13} />
                      <span
                        title={new Date(cover.created_at).toLocaleString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          timeZoneName: 'short',
                        })}
                        className="cover-meta-date"
                      >
                        {new Date(cover.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {cover.tags && cover.tags.length > 0 && (
                    <div className="cover-meta-row cover-meta-tags">
                      <TagIcon size={13} />
                      <div className="cover-tags-list">
                        {cover.tags.map((tag) => (
                          <button
                            key={tag}
                            className="cover-tag cover-tag--clickable"
                            onClick={() => { onClose(); navigate(`/?q=${encodeURIComponent(tag)}`); }}
                            title={`Search for "${tag}"`}
                          >{tag}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="cover-meta-row">
                    <DownloadIcon size={13} />
                    <span>{cover.download_count} download{cover.download_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="cover-modal-actions">
                  <button
                    className={`btn cover-modal-fav-btn${isFavorited ? ' cover-modal-fav-btn--active' : ''}`}
                    onClick={handleFavorite}
                  >
                    <FavoritesIcon size={15} />
                    {isFavorited ? 'Favorited' : 'Favorite'}
                  </button>
                  <div className="cover-download-wrap" ref={downloadMenuRef}>
                    <button
                      className="btn btn-primary cover-modal-download-btn"
                      onClick={() => handleDownload()}
                      disabled={downloading}
                    >
                      <DownloadIcon size={15} />
                      {downloading ? 'Downloading…' : 'Download'}
                    </button>
                    <button
                      className="btn btn-primary cover-download-arrow"
                      onClick={() => {
                        const rect = downloadMenuRef.current?.getBoundingClientRect();
                        if (rect) setDownloadMenuPos({ top: rect.bottom + 4, left: rect.right - 130 });
                        setShowDownloadMenu((v) => !v);
                      }}
                      disabled={downloading}
                      title="More download sizes"
                    >
                      <ChevronDownIcon size={14} />
                    </button>

                  </div>
                </div>

                <div className="cover-modal-secondary-actions">
                  <button className="btn cover-modal-collection-btn" onClick={openCollectionPanel}>
                    <FolderIcon size={14} />
                    Add to Collection
                  </button>
                  {isOwner && (
                    <button className="btn cover-modal-edit-btn" onClick={openEditPanel}>
                      <PencilIcon size={14} />
                      Edit
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className={`btn cover-modal-delete-btn${deleteConfirm ? ' cover-modal-delete-btn--confirm' : ''}`}
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      <TrashIcon size={14} />
                      {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm Delete' : 'Delete'}
                    </button>
                  )}
                  <button
                    className="btn cover-modal-report-btn"
                    onClick={() => setPanelMode('report')}
                  >
                    <FlagIcon size={14} />
                    Report
                  </button>
                </div>

                <CoverComments coverId={cover.id} cover={cover} />
              </>
            )}

            {panelMode === 'report' && (
              <div className="cover-report-panel">
                <h3 className="cover-report-title">Report this cover</h3>
                {reportDone ? (
                  <p className="cover-report-done">
                    Thanks — your report has been submitted and will be reviewed.
                  </p>
                ) : (
                  <>
                    <div className="form-row">
                      <label className="form-label">Reason</label>
                      <select
                        className="form-input"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value as ReportReason)}
                      >
                        {REPORT_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label className="form-label">Additional details <span className="form-hint">(optional)</span></label>
                      <textarea
                        className="form-input cover-report-textarea"
                        placeholder="Describe the issue…"
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="cover-report-actions">
                      <button className="btn btn-primary" onClick={handleReport} disabled={reporting}>
                        {reporting ? <><LoadingIcon size={13} className="upload-spinner" /> Submitting…</> : 'Submit Report'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setPanelMode('details')}>Back</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {panelMode === 'collection' && (
              <div className="cover-collection-panel">
                <h3 className="cover-report-title">Add to Collection</h3>
                <p className="cover-report-done">Any logged-in user can organize any photo into their own collection playlist.</p>

                <div
                  className="collection-drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedCoverId = e.dataTransfer.getData('text/cover-id');
                    if (droppedCoverId === cover.id && selectedCollectionId) {
                      void addToCollection(selectedCollectionId);
                    }
                  }}
                >
                  Drop a dragged cover card here, then choose “This collection”.
                </div>

                <div className="form-row">
                  <label className="form-label">This collection</label>
                  {collectionsLoading ? (
                    <p className="collection-status">Loading collections…</p>
                  ) : (
                    <select className="form-input" value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
                      <option value="">{collections.length === 0 ? 'No collections yet — create one below' : 'Select a collection…'}</option>
                      {collections.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.is_public ? 'Public' : 'Private'})</option>
                      ))}
                    </select>
                  )}
                  <div className="cover-report-actions">
                    <button className="btn btn-primary" onClick={() => addToCollection(selectedCollectionId)} disabled={!selectedCollectionId || savingCollection || collectionsLoading}>
                      {savingCollection ? 'Saving…' : 'Add to This Collection'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setAsCoverImage(selectedCollectionId)} disabled={!selectedCollectionId || savingCollection || collectionsLoading} title="Use this image as the collection thumbnail">
                      Set as cover image
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label">Or create a new collection</label>
                  <input className="form-input" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="Name your collection" />
                  <div className="cover-report-actions">
                    <button className="btn btn-secondary" onClick={() => setNewCollectionPublic((prev) => !prev)}>
                      {newCollectionPublic ? 'Public' : 'Private'}
                    </button>
                    <button className="btn btn-primary" onClick={createCollection} disabled={savingCollection}>Create</button>
                  </div>
                </div>

                {collectionStatus && (
                  <p className={`collection-status${collectionStatusIsError ? ' collection-status--error' : ' collection-status--ok'}`}>
                    {collectionStatus}
                  </p>
                )}
                <div className="cover-report-actions">
                  <button className="btn btn-secondary" onClick={() => setPanelMode('details')}>Back</button>
                </div>
              </div>
            )}

            {panelMode === 'edit' && (
              <div className="cover-collection-panel">
                <h3 className="cover-report-title">Edit Cover</h3>

                <div className="form-row">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Album title" />
                </div>
                <div className="form-row">
                  <label className="form-label">Artist</label>
                  <input className="form-input" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="Artist name" />
                </div>
                <div className="form-row">
                  <label className="form-label">Year <span className="form-hint">(optional)</span></label>
                  <input className="form-input" value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="e.g. 1973" type="number" min="1900" max="2099" />
                </div>
                <div className="form-row">
                  <label className="form-label">Tags <span className="form-hint">(comma-separated)</span></label>
                  <input className="form-input" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="e.g. jazz, vinyl, 70s" />
                </div>
                <div className="form-row">
                  <label className="form-label">Visibility</label>
                  <div className="cover-report-actions">
                    <button
                      className={`btn${!editIsPrivate ? ' btn-primary' : ' btn-secondary'}`}
                      onClick={() => setEditIsPrivate(false)}
                    >Published</button>
                    <button
                      className={`btn${editIsPrivate ? ' btn-primary' : ' btn-secondary'}`}
                      onClick={() => setEditIsPrivate(true)}
                    >Unpublished</button>
                  </div>
                </div>

                {editStatus && (
                  <p className={`collection-status${editStatusIsError ? ' collection-status--error' : ' collection-status--ok'}`}>
                    {editStatus}
                  </p>
                )}
                <div className="cover-report-actions">
                  <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? <><LoadingIcon size={13} className="upload-spinner" /> Saving…</> : 'Save Changes'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setPanelMode('details')}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .cover-modal { width: 100%; max-width: 780px; max-height: min(92vh, 860px); padding: 0; overflow: hidden; display: flex; flex-direction: column; }
        /* Win95 title bar */
        .cover-modal::before {
          content: 'covers.cafe | Cover Details';
          display: flex; align-items: center;
          height: 22px; flex-shrink: 0;
          background: linear-gradient(90deg, #5a3620 0%, #73492a 35%, #8a5a35 100%);
          color: #ffffff; font-size: 11px; font-weight: bold;
          font-family: "MS Sans Serif", Tahoma, Arial, sans-serif;
          padding: 0 24px 0 8px;
        }
        /* Win95 X close button in title bar area */
        .cover-modal-close {
          position: absolute; top: 4px; right: 6px; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 14px; border-radius: 0;
          background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          color: #000000; cursor: pointer; padding: 0;
          font-size: 10px; font-weight: bold; line-height: 1;
        }
        .cover-modal-close:hover { background: #d0d0d0; transform: none; }
        .cover-modal-close:active { border-color: #c07f55 #ffffff #ffffff #c07f55; }
        .cover-modal-inner { display: flex; flex: 1; min-height: 0; overflow: hidden; }
        .cover-modal-image-wrap {
          flex: 0 0 auto; width: 340px; max-width: 50%;
          background: #1a1a1a;
          display: flex; align-items: center; justify-content: center;
        }
        .cover-modal-image { width: 100%; height: 100%; object-fit: contain; display: block; max-height: 460px; }
        .cover-modal-info {
          position: relative; z-index: 1;
          flex: 1; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          background: var(--body-card-bg);
          background-image: none;
          overflow-y: auto;
        }
        .cover-modal-titles { border-bottom: 1px solid var(--body-border); padding-bottom: 6px; }
        .cover-modal-title { font-size: 14px; font-weight: bold; color: var(--body-text); line-height: 1.2; margin-bottom: 3px; }
        .cover-modal-artist { font-size: 12px; color: var(--body-text-muted); }
        .cover-modal-artist-link { display: inline; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; font-size: inherit; color: inherit; box-shadow: none; text-decoration: underline; text-underline-offset: 1px; }
        .cover-modal-artist-link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .cover-modal-meta { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .cover-meta-row { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: var(--body-text-muted); }
        .cover-meta-row svg { flex-shrink: 0; margin-top: 1px; }
        .cover-meta-date { cursor: help; border-bottom: 1px dashed var(--body-border); }
        .cover-meta-user-link { color: var(--body-text); background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; font-family: inherit; box-shadow: none; text-decoration: underline; text-underline-offset: 1px; }
        .cover-meta-user-link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .cover-meta-tags { align-items: flex-start; }
        .cover-tags-list { display: flex; flex-wrap: wrap; gap: 3px; }
        .cover-tag { font-size: 10px; font-family: var(--font-header); background: var(--sidebar-bg); color: var(--body-text); padding: 1px 5px; border: 1px solid var(--sidebar-border); box-shadow: none; }
        .cover-modal-actions { display: flex; gap: 5px; flex-wrap: wrap; }
        .cover-modal-secondary-actions { display: flex; gap: 5px; flex-wrap: wrap; padding-top: 4px; border-top: 1px solid var(--body-border); }
        .cover-modal-fav-btn { display: flex; align-items: center; gap: 4px; background: #dea77d; color: var(--body-text); background-image: none; }
        .cover-modal-fav-btn--active { background: #ffffc0; color: #806800; border-color: #c8a800 #806800 #806800 #c8a800; background-image: none; }
        .cover-modal-download-btn { display: flex; align-items: center; gap: 4px; }
        .cover-modal-download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cover-modal-collection-btn { display: flex; align-items: center; gap: 4px; font-size: 11px; background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; color: var(--body-text); padding: 2px 8px; height: 24px; }
        .cover-modal-delete-btn { display: flex; align-items: center; gap: 4px; font-size: 11px; background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; color: #800000; padding: 2px 8px; height: 24px; }
        .cover-modal-delete-btn:hover { background: #ffd0d0; transform: none; box-shadow: none; }
        .cover-modal-delete-btn--confirm { background: #800000 !important; color: #ffffff !important; }
        .cover-modal-delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cover-modal-edit-btn { display: flex; align-items: center; gap: 4px; font-size: 11px; background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; color: var(--body-text); padding: 2px 8px; height: 24px; }
        .cover-modal-edit-btn:hover { background: #d0d0d0; transform: none; box-shadow: none; }
        .cover-modal-report-btn { display: flex; align-items: center; gap: 4px; font-size: 11px; background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; color: var(--body-text-muted); padding: 2px 8px; height: 24px; }
        .cover-modal-report-btn:hover { background: #d0d0d0; color: var(--body-text); transform: none; box-shadow: none; }
        .cover-report-panel, .cover-collection-panel { display: flex; flex-direction: column; gap: 8px; }
        .cover-report-title { font-size: 12px; font-weight: bold; color: var(--body-text); }
        .cover-report-done { font-size: 11px; color: var(--body-text-muted); line-height: 1.5; }
        .cover-report-textarea { resize: none; min-height: 56px; }
        .cover-report-actions { display: flex; gap: 6px; }
        .collection-drop-zone { border: 2px dashed var(--body-border); padding: 10px; font-size: 11px; color: var(--body-text-muted); background: var(--sidebar-bg); }
        .collection-status { font-size: 11px; padding: 3px 7px; }
        .collection-status--error { color: #800000; background: #fff0f0; border: 1px solid #800000; }
        .collection-status--ok { color: #004000; background: #f0fff0; border: 1px solid #004000; }
        .form-row { display: flex; flex-direction: column; gap: 3px; }
        .form-label { font-size: 11px; font-weight: bold; color: var(--body-text); }
        .form-hint { font-size: 10px; color: var(--body-text-muted); font-weight: normal; }
        .form-input { width: 100%; padding: 2px 6px; border: 2px solid; border-color: #c07f55 #ffffff #ffffff #c07f55; background: #ffffff; color: #000000; font-size: 12px; box-shadow: none; outline: none; font-family: var(--font-body); }
        .form-input:focus { outline: 1px dotted #73492a; outline-offset: 1px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cover-tag--clickable { cursor: pointer; background: var(--sidebar-bg); color: var(--body-text); border: 1px solid var(--sidebar-border); padding: 1px 5px; font-size: 10px; font-family: var(--font-header); box-shadow: none; transition: none; }
        .cover-tag--clickable:hover { background: var(--accent); color: #ffffff; border-color: var(--accent); transform: none; box-shadow: none; }
        .cover-download-wrap { position: relative; z-index: 70; display: flex; }
        .cover-modal-download-btn { border-radius: 0; }
        .cover-download-arrow { border-left: 1px solid #c07f55; padding: 0 6px; display: flex; align-items: center; }
        .cover-download-menu { position: fixed; z-index: 400; background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; display: flex; flex-direction: column; min-width: 130px; overflow: hidden; }
        .cover-download-option { padding: 3px 12px; text-align: left; font-size: 12px; background: none; border: none; color: var(--body-text); cursor: pointer; box-shadow: none; }
        .cover-download-option:hover { background: var(--accent); color: #ffffff; transform: none; }
        .cover-comments { margin-top: 8px; border-top: 1px solid var(--body-border); padding-top: 8px; }
        .cover-comments-title { display: flex; align-items: center; gap: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--body-text-muted); margin-bottom: 5px; font-weight: bold; }
        .cover-comments-composer { display: flex; flex-direction: column; gap: 5px; margin-bottom: 6px; }
        .cover-comments-input { width: 100%; min-height: 52px; resize: none; border: 2px solid; border-color: #c07f55 #ffffff #ffffff #c07f55; background: #ffffff; color: #000000; padding: 3px 6px; font: inherit; font-size: 12px; }
        .cover-comments-status, .cover-comments-muted { font-size: 11px; color: var(--body-text-muted); }
        .cover-comments-list { list-style: none; display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow: auto; padding-right: 2px; }
        .cover-comment-item { border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; background: var(--body-card-bg); padding: 4px 7px; }
        .cover-comment-top { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; color: var(--body-text-muted); margin-bottom: 2px; }
        .cover-comment-top strong, .cover-comment-top span { color: var(--body-text); }
        .cover-comment-author { color: var(--body-text); background: none; border: none; padding: 0; cursor: pointer; font-size: 10px; font-family: inherit; box-shadow: none; text-decoration: underline; text-underline-offset: 1px; }
        .cover-comment-author:hover { color: var(--accent); transform: none; box-shadow: none; }
        .cover-comment-body { white-space: pre-wrap; font-size: 12px; margin-bottom: 3px; color: var(--body-text); }
        .cover-comment-edited { font-size: 10px; color: var(--body-text-muted); margin-bottom: 3px; font-style: italic; }
        .cover-comment-edit-wrap { display: flex; flex-direction: column; gap: 5px; }
        .cover-comment-actions { display: flex; gap: 5px; }
        .cover-comment-action { border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff; background: #dea77d; color: #000000; font-size: 10px; padding: 1px 5px; height: 18px; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
        .cover-comment-action:hover { background: var(--accent); color: #ffffff; }
        .cover-comment-action:active { border-color: #c07f55 #ffffff #ffffff #c07f55; }
        .cover-comment-action--delete { color: #800000; }
        [data-theme="dark"] .cover-comment-action--delete { color: #ff8080; }
        .cover-comment-action--delete:hover { background: #800000; color: #ffffff; }
        @media (max-width: 600px) {
          .cover-modal-inner { flex-direction: column; }
          .cover-modal-image-wrap { width: 100%; max-width: 100%; height: 180px; }
        }
      `}</style>
    </div>
    {showDownloadMenu && downloadMenuPos && createPortal(
      <div
        className="cover-download-menu"
        ref={downloadMenuOverlayRef}
        style={{ top: downloadMenuPos.top, left: downloadMenuPos.left }}
      >
        <button className="cover-download-option" onClick={() => handleDownload()}>Full Size</button>
        <button className="cover-download-option" onClick={() => handleDownload(3000)}>3000px</button>
        <button className="cover-download-option" onClick={() => handleDownload(1500)}>1500px</button>
        <button className="cover-download-option" onClick={() => handleDownload(1000)}>1000px</button>
        <button className="cover-download-option" onClick={() => handleDownload(800)}>800px</button>
      </div>,
      document.body,
    )}
    </>
  );
}
