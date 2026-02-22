import { useState } from 'react';
import { X, Star, Download, User, Calendar, Tag, ArrowDownToLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClose: () => void;
}

export default function CoverModal({ cover, isFavorited, onToggleFavorite, onClose }: Props) {
  const { user, openAuthModal } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Record the download
      await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user?.id ?? null });
      await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });

      // Trigger browser download
      const res = await fetch(cover.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cover.artist} - ${cover.title}.${blob.type.split('/')[1] || 'jpg'}`;
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

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box cover-modal" role="dialog" aria-modal="true">
        {/* Close */}
        <button className="cover-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="cover-modal-inner">
          {/* Image */}
          <div className="cover-modal-image-wrap">
            <img
              src={cover.image_url}
              alt={`${cover.title} by ${cover.artist}`}
              className="cover-modal-image"
            />
          </div>

          {/* Info panel */}
          <div className="cover-modal-info">
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
        .cover-modal-image {
          width: 100%; height: 100%; object-fit: contain; display: block;
          max-height: 480px;
        }
        .cover-modal-info {
          flex: 1; padding: 28px 24px;
          display: flex; flex-direction: column; gap: 20px;
          background: var(--body-card-bg);
          background-image: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 40%);
        }
        .cover-modal-titles { border-bottom: 1px solid var(--body-border); padding-bottom: 16px; }
        .cover-modal-title {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4); line-height: 1.2;
          margin-bottom: 6px;
        }
        [data-theme="dark"] .cover-modal-title { text-shadow: none; }
        .cover-modal-artist { font-size: 16px; color: var(--body-text-muted); font-weight: bold; }
        .cover-modal-meta { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .cover-meta-row {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 13px; color: var(--body-text-muted);
        }
        .cover-meta-row svg { flex-shrink: 0; margin-top: 1px; }
        .cover-meta-tags { align-items: flex-start; }
        .cover-tags-list { display: flex; flex-wrap: wrap; gap: 5px; }
        .cover-tag {
          font-size: 11px; font-weight: bold;
          background: var(--sidebar-bg);
          color: var(--sidebar-text);
          padding: 2px 7px; border-radius: 3px;
          border: 1px solid var(--sidebar-border);
          box-shadow: var(--shadow-sm);
        }
        .cover-modal-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: auto; }
        .cover-modal-fav-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, var(--sidebar-bg-light) 0%, var(--sidebar-bg) 55%, var(--sidebar-bg-dark) 100%);
          color: var(--sidebar-text);
        }
        .cover-modal-fav-btn--active {
          background: linear-gradient(180deg, #f0c060 0%, #d4a020 55%, #b08010 100%);
          color: #5a3a00;
          border-color: #8a6010;
        }
        .cover-modal-download-btn { display: flex; align-items: center; gap: 6px; }
        .cover-modal-download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 600px) {
          .cover-modal-inner { flex-direction: column; }
          .cover-modal-image-wrap { width: 100%; max-width: 100%; height: 220px; }
        }
      `}</style>
    </div>
  );
}
