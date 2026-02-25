import { useState } from 'react';
import FavoritesIcon from './FavoritesIcon';
import DownloadIcon from './DownloadIcon';
import UserIcon from './UserIcon';
import TrashIcon from './TrashIcon';
import TrophyIcon from './TrophyIcon';
import LockIcon from './LockIcon';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc, getCoverDownloadUrl } from '../lib/media';
import { getCoverPath, parseArtists, slugifyArtist } from '../lib/coverRoutes';

interface Props {
  cover: Cover;
  isFavorited: boolean;
  onToggleFavorite: (coverId: string) => void;
  onClick?: () => void;
  onDeleted?: (coverId: string) => void;
  onDragForCollection?: (cover: Cover) => void;
}

export default function CoverCard({ cover, isFavorited, onToggleFavorite, onClick, onDeleted, onDragForCollection }: Props) {
  const { user, session } = useAuth();
  const navigate = useNavigate();
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
      const res = await fetch('/api/delete-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ cover_id: cover.id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted?.(cover.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className={`album-card cover-card${cover.is_acotw ? ' cover-card--acotw' : ''}`}
      onClick={() => (onClick ? onClick() : navigate(getCoverPath(cover)))}
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
            <FavoritesIcon size={15} />
          </button>
          <button className="cover-card-action-btn" title="Download" onClick={(e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = getCoverDownloadUrl(cover.id);
            a.click();
          }}>
            <DownloadIcon size={15} />
          </button>
          {isOwner && (
            <button
              className={`cover-card-action-btn cover-card-delete-btn${confirmDelete ? ' cover-card-delete-btn--confirm' : ''}`}
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete this cover'}
              disabled={deleting}
            >
              <TrashIcon size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="album-card-info">
        <div className="album-card-title" title={cover.title}>{cover.title}</div>
        <div className="album-card-artist" title={cover.artist}>
          {parseArtists(cover.artist).map((name, i, arr) => (
            <span key={name}>
              <button
                className="cover-card-artist-link"
                onClick={(e) => { e.stopPropagation(); navigate(`/artists/${slugifyArtist(name)}`, { state: { originalName: name } }); }}
              >{name}</button>
              {i < arr.length - 1 && ' & '}
            </span>
          ))}
        </div>
        <div className="cover-card-meta">
          {cover.is_acotw && (
            <span className="cover-card-acotw" title="Album Cover Of The Week">
              <TrophyIcon size={9} />
              ACOTW
            </span>
          )}
          {cover.is_private && (
            <span className="cover-card-private" title="Only visible to you">
              <LockIcon size={9} />
              Private
            </span>
          )}
          {cover.year && <span className="cover-card-year">{cover.year}</span>}
          {(cover.favorite_count ?? 0) > 0 && (
            <span className="cover-card-fav-count" title={`${cover.favorite_count} favorite${cover.favorite_count === 1 ? '' : 's'}`}>
              <FavoritesIcon size={9} />
              {cover.favorite_count}
            </span>
          )}
          {cover.profiles?.username ? (
            <button
              className="cover-card-uploader cover-card-uploader--link"
              onClick={(e) => { e.stopPropagation(); navigate(`/users/${cover.profiles!.username}`); }}
              title={`View ${cover.profiles.username}'s profile`}
            >
              <UserIcon size={10} />
              {cover.profiles.username}
            </button>
          ) : (
            <span className="cover-card-uploader"><UserIcon size={10} />unknown</span>
          )}
        </div>
      </div>

      
    </div>
  );
}
