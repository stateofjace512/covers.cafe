import { useState } from 'react';
import { X, Star, Download, User, Calendar, Tag, ArrowDownToLine, Trash2, Flag, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClose: () => void;
  onDeleted?: (coverId: string) => void;
}

type ReportReason = 'inappropriate' | 'copyright' | 'spam' | 'other';
const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'other', label: 'Other' },
];

export default function CoverModal({ cover, isFavorited, onToggleFavorite, onClose, onDeleted }: Props) {
  const { user, openAuthModal } = useAuth();
  const isOwner = user?.id === cover.user_id;

  const [downloading, setDownloading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user?.id ?? null });
      await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
      const res = await fetch(cover.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cover.artist} - ${cover.title}.jpg`;
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

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box cover-modal" role="dialog" aria-modal="true">
        <button className="cover-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="cover-modal-inner">
          <div className="cover-modal-image-wrap">
            <img
              src={cover.image_url}
              alt={`${cover.title} by ${cover.artist}`}
              className="cover-modal-image"
            />
          </div>

          <div className="cover-modal-info">
            {!showReport ? (
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
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download size={15} />
                    {downloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>

                <div className="cover-modal-secondary-actions">
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
                    onClick={() => setShowReport(true)}
                  >
                    <Flag size={14} />
                    Report
                  </button>
                </div>
              </>
            ) : (
              /* ── Report panel ── */
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
                      <button className="btn btn-secondary" onClick={() => setShowReport(false)}>Cancel</button>
                    </div>
                  </>
                )}
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
        .cover-modal-actions { display: flex; gap: 10px; flex-wrap: wrap; }
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
        .cover-modal-download-btn { display: flex; align-items: center; gap: 6px; }
        .cover-modal-download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
        /* Report panel */
        .cover-report-panel { display: flex; flex-direction: column; gap: 14px; }
        .cover-report-title { font-size: 16px; font-weight: bold; color: var(--body-text); }
        .cover-report-done { font-size: 14px; color: var(--body-text-muted); line-height: 1.5; }
        .cover-report-textarea { resize: vertical; min-height: 72px; }
        .cover-report-actions { display: flex; gap: 8px; }
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
