import { useEffect, useState } from 'react';
import { X, Star, Download, User, Calendar, Tag, ArrowDownToLine, Trash2, Flag, Loader, FolderPlus, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverDownloadUrl, getCoverImageSrc } from '../lib/media';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClose: () => void;
  onDeleted?: (coverId: string) => void;
  initialPanelMode?: PanelMode;
}

type ReportReason = 'inappropriate' | 'copyright' | 'spam' | 'other';
type PanelMode = 'details' | 'report' | 'collection';

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

export default function CoverModal({ cover, isFavorited, onToggleFavorite, onClose, onDeleted, initialPanelMode = 'details' }: Props) {
  const { user, openAuthModal } = useAuth();
  const isOwner = user?.id === cover.user_id;

  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);
  const [downloading, setDownloading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
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
  const [savingCollection, setSavingCollection] = useState(false);

  useEffect(() => {
    setPanelMode(initialPanelMode);
  }, [initialPanelMode, cover.id]);

  useEffect(() => {
    if (panelMode !== 'collection' || !user) return;

    const loadCollections = async () => {
      setCollectionsLoading(true);
      const data = await apiGet<CollectionRow[]>(`/api/my-collections?owner_id=${encodeURIComponent(user.id)}`).catch(() => []);
      setCollections(data);
      setCollectionsLoading(false);
    };

    void loadCollections();
  }, [panelMode, user]);

  const handleDownload = async (size: 'full' | number) => {
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user?.id ?? null });
      await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
      const a = document.createElement('a');
      a.href = getCoverDownloadUrl(cover, size);
      a.download = `${cover.artist} - ${cover.title} (${size === 'full' ? 'full' : `${size}px`}).jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
      await supabase.storage.from('covers_cafe_covers').remove([cover.storage_path]);
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
  };

  const createCollection = async () => {
    if (!user) return;
    const name = newCollectionName.trim();
    if (!name) {
      setCollectionStatus('Name your collection first.');
      return;
    }

    setSavingCollection(true);
    let created: CollectionRow;
    try {
      created = await apiPost<CollectionRow>('/api/collection-create', { owner_id: user.id, name, is_public: newCollectionPublic });
    } catch (err) {
      setCollectionStatus(err instanceof Error ? err.message : 'Could not create collection.');
      setSavingCollection(false);
      return;
    }
    setCollections((prev) => [created, ...prev]);
    setSelectedCollectionId(created.id);
    setNewCollectionName('');
    setCollectionStatus(`Created "${created.name}".`);
    setSavingCollection(false);
  };

  const addToCollection = async (collectionId: string) => {
    if (!user || !collectionId) return;
    setSavingCollection(true);

    try {
      await apiPost('/api/collection-add-item', { collection_id: collectionId, cover_id: cover.id });
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      if (raw.includes('23505')) {
        const again = window.confirm('Are you sure you want to add this image to this collection again?');
        if (again) {
          setCollectionStatus('This image is already in that collection. Keeping existing entry.');
        }
      } else {
        setCollectionStatus(raw || 'Could not add to collection.');
      }
      setSavingCollection(false);
      return;
    }

    const picked = collections.find((item) => item.id === collectionId);
    setCollectionStatus(`Added to ${picked?.name ?? 'collection'}.`);
    setSavingCollection(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box cover-modal" role="dialog" aria-modal="true">
        <button className="cover-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="cover-modal-inner">
          <div className="cover-modal-image-wrap">
            <img
              src={getCoverImageSrc(cover)}
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
                  <p className="cover-modal-artist">{cover.artist}</p>
                </div>

                <div className="cover-modal-meta">
                  {cover.year && (
                    <div className="cover-meta-row">
                      <Calendar size={13} />
                      <span>{cover.year}</span>
                    </div>
                  )}
                  <div className="cover-meta-row">
                    <User size={13} />
                    <span>
                      Uploaded by{' '}
                      <strong>{cover.profiles?.display_name ?? cover.profiles?.username ?? 'unknown'}</strong>
                    </span>
                  </div>
                  {cover.tags && cover.tags.length > 0 && (
                    <div className="cover-meta-row cover-meta-tags">
                      <Tag size={13} />
                      <div className="cover-tags-list">
                        {cover.tags.map((tag) => (
                          <span key={tag} className="cover-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="cover-meta-row">
                    <ArrowDownToLine size={13} />
                    <span>{cover.download_count} download{cover.download_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="cover-modal-actions">
                  <button
                    className={`btn cover-modal-fav-btn${isFavorited ? ' cover-modal-fav-btn--active' : ''}`}
                    onClick={handleFavorite}
                  >
                    <Star size={15} fill={isFavorited ? 'currentColor' : 'none'} />
                    {isFavorited ? 'Favorited' : 'Favorite'}
                  </button>
                  <button
                    className="btn btn-primary cover-modal-download-btn"
                    onClick={() => setShowDownloadMenu((prev) => !prev)}
                    disabled={downloading}
                  >
                    <Download size={15} />
                    {downloading ? 'Downloading…' : 'Download'} <ChevronDown size={14} />
                  </button>
                </div>
                  {showDownloadMenu && !downloading && (
                    <div className="cover-download-menu">
                      {(['full', 3000, 1500, 1000, 800] as const).map((size) => (
                        <button key={String(size)} className="cover-download-menu-item" onClick={() => handleDownload(size)}>{size === 'full' ? 'Full Size' : `${size}px`}</button>
                      ))}
                    </div>
                  )}

                <div className="cover-modal-secondary-actions">
                  <button className="btn cover-modal-collection-btn" onClick={openCollectionPanel}>
                    <FolderPlus size={14} />
                    Add to Collection
                  </button>
                  {isOwner && (
                    <button
                      className={`btn cover-modal-delete-btn${deleteConfirm ? ' cover-modal-delete-btn--confirm' : ''}`}
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      <Trash2 size={14} />
                      {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm Delete' : 'Delete'}
                    </button>
                  )}
                  <button
                    className="btn cover-modal-report-btn"
                    onClick={() => setPanelMode('report')}
                  >
                    <Flag size={14} />
                    Report
                  </button>
                </div>
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
                        {reporting ? <><Loader size={13} className="upload-spinner" /> Submitting…</> : 'Submit Report'}
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
                  <select className="form-input" value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
                    <option value="">Select a collection…</option>
                    {collections.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.is_public ? 'Public' : 'Private'})</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={() => addToCollection(selectedCollectionId)} disabled={!selectedCollectionId || savingCollection || collectionsLoading}>
                    {savingCollection ? 'Saving…' : 'Add to This Collection'}
                  </button>
                </div>

                <div className="form-row">
                  <label className="form-label">Or create a new collection</label>
                  <input className="form-input" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="Name your collection" />
                  <div className="cover-report-actions">
                    <button className="btn btn-secondary" onClick={() => setNewCollectionPublic((prev) => !prev)}>
                      {newCollectionPublic ? 'Public' : 'Private'}
                    </button>
                    <button className="btn btn-primary" onClick={createCollection} disabled={savingCollection || collectionsLoading}>Create</button>
                  </div>
                </div>

                {collectionStatus && <p className="collection-status">{collectionStatus}</p>}
                <div className="cover-report-actions">
                  <button className="btn btn-secondary" onClick={() => setPanelMode('details')}>Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .cover-modal { width: 100%; max-width: 780px; padding: 0; overflow: hidden; }
        .cover-modal-close {
          position: absolute; top: 12px; right: 12px; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);
          color: white; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          padding: 0; transition: background 0.12s;
        }
        .cover-modal-close:hover { background: rgba(0,0,0,0.75); transform: none; }
        .cover-modal-inner { display: flex; min-height: 300px; }
        .cover-modal-image-wrap {
          flex: 0 0 auto; width: 340px; max-width: 50%;
          background: #1a0e08;
          display: flex; align-items: center; justify-content: center;
        }
        .cover-modal-image { width: 100%; height: 100%; object-fit: contain; display: block; max-height: 480px; }
        .cover-modal-info {
          flex: 1; padding: 28px 24px;
          display: flex; flex-direction: column; gap: 16px;
          background: var(--body-card-bg);
          background-image: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 40%);
          overflow-y: auto;
        }
        .cover-modal-titles { border-bottom: 1px solid var(--body-border); padding-bottom: 14px; }
        .cover-modal-title {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4); line-height: 1.2; margin-bottom: 6px;
        }
        [data-theme="dark"] .cover-modal-title { text-shadow: none; }
        .cover-modal-artist { font-size: 16px; color: var(--body-text-muted); font-weight: bold; }
        .cover-modal-meta { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .cover-meta-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--body-text-muted); }
        .cover-meta-row svg { flex-shrink: 0; margin-top: 1px; }
        .cover-meta-tags { align-items: flex-start; }
        .cover-tags-list { display: flex; flex-wrap: wrap; gap: 5px; }
        .cover-tag {
          font-size: 11px; font-weight: bold;
          background: var(--sidebar-bg); color: var(--sidebar-text);
          padding: 2px 7px; border-radius: 3px;
          border: 1px solid var(--sidebar-border); box-shadow: var(--shadow-sm);
        }

        .cover-modal-actions { display: flex; gap: 10px; flex-wrap: wrap; position: relative; }
        .cover-download-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          display: flex; flex-direction: column; min-width: 140px;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 6px; box-shadow: var(--shadow-lg); overflow: hidden; z-index: 5;
        }
        .cover-download-menu-item {
          background: none; border: 0; color: var(--body-text); text-align: left;
          padding: 8px 10px; font-size: 12px; cursor: pointer;
        }
        .cover-download-menu-item:hover { background: var(--sidebar-bg); }
        .cover-modal-secondary-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 4px; border-top: 1px solid var(--body-border); }
        .cover-modal-fav-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, var(--sidebar-bg-light) 0%, var(--sidebar-bg) 55%, var(--sidebar-bg-dark) 100%);
          color: var(--sidebar-text);
        }
        .cover-modal-fav-btn--active {
          background: linear-gradient(180deg, #f0c060 0%, #d4a020 55%, #b08010 100%);
          color: #5a3a00; border-color: #8a6010;
        }
        .cover-modal-download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cover-modal-collection-btn {
          display: flex; align-items: center; gap: 5px; font-size: 12px;
          background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); color: var(--body-text);
          padding: 6px 12px;
        }
        .cover-modal-delete-btn {
          display: flex; align-items: center; gap: 5px; font-size: 12px;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3);
          color: #c83220; padding: 6px 12px;
        }
        .cover-modal-delete-btn:hover { background: rgba(200,50,30,0.2); transform: none; box-shadow: none; }
        .cover-modal-delete-btn--confirm { background: #c83220 !important; color: white !important; border-color: #a02010 !important; }
        .cover-modal-delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cover-modal-report-btn {
          display: flex; align-items: center; gap: 5px; font-size: 12px;
          background: none; border: 1px solid var(--body-card-border);
          color: var(--body-text-muted); padding: 6px 12px;
        }
        .cover-modal-report-btn:hover { background: var(--sidebar-bg); color: var(--body-text); transform: none; box-shadow: none; }
        .cover-report-panel, .cover-collection-panel { display: flex; flex-direction: column; gap: 14px; }
        .cover-report-title { font-size: 16px; font-weight: bold; color: var(--body-text); }
        .cover-report-done { font-size: 14px; color: var(--body-text-muted); line-height: 1.5; }
        .cover-report-textarea { resize: vertical; min-height: 72px; }
        .cover-report-actions { display: flex; gap: 8px; }
        .collection-drop-zone {
          border: 2px dashed var(--body-card-border);
          border-radius: 6px;
          padding: 14px;
          font-size: 12px;
          color: var(--body-text-muted);
          background: var(--sidebar-bg);
        }
        .collection-status { font-size: 12px; color: var(--body-text-muted); }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 13px; font-weight: bold; color: var(--body-text); }
        .form-hint { font-size: 11px; color: var(--body-text-muted); font-weight: normal; }
        .form-input {
          width: 100%; padding: 8px 12px;
          border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 13px;
          box-shadow: var(--shadow-inset-sm); outline: none; font-family: Arial, Helvetica, sans-serif;
        }
        .form-input:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) {
          .cover-modal-inner { flex-direction: column; }
          .cover-modal-image-wrap { width: 100%; max-width: 100%; height: 220px; }
        }
      `}</style>
    </div>
  );
}
