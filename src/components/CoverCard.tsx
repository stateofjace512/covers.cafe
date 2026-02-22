import { useState } from 'react';
import { Star, Download, User, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc } from '../lib/media';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClick: () => void;
  onDeleted?: (coverId: string) => void;
  onDragForCollection?: (cover: Cover) => void;
}

export default function CoverCard({ cover, isFavorited, onToggleFavorite, onClick, onDeleted, onDragForCollection }: Props) {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = user?.id === cover.user_id;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await supabase.storage.from('covers_cafe_covers').remove([cover.storage_path]);
      await supabase.from('covers_cafe_covers').delete().eq('id', cover.id);
      onDeleted?.(cover.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="album-card cover-card"
      onClick={onClick}
      onMouseLeave={() => setConfirmDelete(false)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/cover-id', cover.id);
        onDragForCollection?.(cover);
      }}
    >
      <div className="album-card-cover">
        {!imgError && !imgLoaded && <div className="cover-card-shimmer" aria-hidden="true" />}
        {!imgError && getCoverImageSrc(cover) ? (
          <img
            src={getCoverImageSrc(cover)}
            alt={`${cover.title} by ${cover.artist}`}
            className={`cover-card-img${imgLoaded ? ' cover-card-img--loaded' : ''}`}
            onError={() => setImgError(true)}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        ) : (
          <div className="cover-card-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              <circle cx="9" cy="9" r="2"/>
            </svg>
          </div>
        )}

        <div className="cover-card-overlay">
          <button
            className="cover-card-action-btn"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(cover.id); }}
            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={15} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
          <button className="cover-card-action-btn" title="Download" onClick={(e) => e.stopPropagation()}>
            <Download size={15} />
          </button>
          {isOwner && (
            <button
              className={`cover-card-action-btn cover-card-delete-btn${confirmDelete ? ' cover-card-delete-btn--confirm' : ''}`}
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete this cover'}
              disabled={deleting}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="album-card-info">
        <div className="album-card-title" title={cover.title}>{cover.title}</div>
        <div className="album-card-artist" title={cover.artist}>{cover.artist}</div>
        <div className="cover-card-meta">
          {cover.year && <span className="cover-card-year">{cover.year}</span>}
          <span className="cover-card-uploader">
            <User size={10} />
            {cover.profiles?.display_name ?? cover.profiles?.username ?? 'unknown'}
          </span>
        </div>
      </div>

      <style>{`
        .cover-card { cursor: pointer; }
        .cover-card-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s ease; }
        .cover-card-img--loaded { opacity: 1; }
        .cover-card-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0.22) 18%, rgba(255,255,255,0.08) 33%);
          background-size: 220% 100%;
          animation: cover-shimmer 1.2s linear infinite;
        }
        @keyframes cover-shimmer { to { background-position-x: -220%; } }
        .cover-card-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.2);
        }
        .cover-card-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex; align-items: flex-end; justify-content: flex-end;
          gap: 6px; padding: 8px;
          opacity: 0; transition: opacity 0.15s;
        }
        .cover-card:hover .cover-card-overlay { opacity: 1; }
        .cover-card-action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.9); border: 1px solid rgba(0,0,0,0.2);
          color: var(--accent-dark); cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: transform 0.1s, background 0.1s; padding: 0;
        }
        .cover-card-action-btn:hover { background: white; transform: scale(1.1); box-shadow: 0 3px 6px rgba(0,0,0,0.4); }
        .cover-card-delete-btn { color: #c83220; }
        .cover-card-delete-btn--confirm { background: #c83220 !important; color: white !important; animation: delete-pulse 0.4s ease; }
        @keyframes delete-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .cover-card-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
        .cover-card-year { font-size: 11px; color: var(--body-text-muted); background: var(--body-border); padding: 1px 5px; border-radius: 3px; font-weight: bold; }
        .cover-card-uploader { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--body-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .album-card-cover { position: relative; }
      `}</style>
    </div>
  );
}
