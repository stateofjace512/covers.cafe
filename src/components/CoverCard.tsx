import { useState } from 'react';
import { Star, Download, User } from 'lucide-react';
import type { Cover } from '../lib/types';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClick: () => void;
}

export default function CoverCard({ cover, isFavorited, onToggleFavorite, onClick }: Props) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="album-card cover-card" onClick={onClick}>
      <div className="album-card-cover">
        {!imgError && cover.image_url ? (
          <img
            src={cover.image_url}
            alt={`${cover.title} by ${cover.artist}`}
            className="cover-card-img"
            onError={() => setImgError(true)}
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

        {/* Hover overlay */}
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
        .cover-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
          opacity: 0;
          transition: opacity 0.15s;
        }
        .cover-card:hover .cover-card-overlay { opacity: 1; }
        .cover-card-action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(0,0,0,0.2);
          color: var(--accent-dark); cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: transform 0.1s, background 0.1s;
          padding: 0;
        }
        .cover-card-action-btn:hover {
          background: white; transform: scale(1.1);
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        }
        .cover-card-meta {
          display: flex; align-items: center; gap: 6px;
          margin-top: 3px; flex-wrap: wrap;
        }
        .cover-card-year {
          font-size: 11px; color: var(--body-text-muted);
          background: var(--body-border); padding: 1px 5px;
          border-radius: 3px; font-weight: bold;
        }
        .cover-card-uploader {
          display: flex; align-items: center; gap: 3px;
          font-size: 11px; color: var(--body-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .album-card-cover { position: relative; }
      `}</style>
    </div>
  );
}
