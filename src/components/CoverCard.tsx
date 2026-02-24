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
import { getCoverImageSrc } from '../lib/media';
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
  const { user } = useAuth();
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
      const paths = [cover.storage_path];
      if (cover.thumbnail_path) paths.push(cover.thumbnail_path);
      await supabase.storage.from('covers_cafe_covers').remove(paths);
      await supabase.from('covers_cafe_covers').delete().eq('id', cover.id);
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
          <button className="cover-card-action-btn" title="Download" onClick={(e) => e.stopPropagation()}>
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

      <style>{`
        .cover-card { cursor: pointer; }
        .cover-card--acotw {
          background-image: none;
          /* ACOTW: gold-tinted border to distinguish */
          border-color: #c8a800 #806800 #806800 #c8a800;
        }
        .cover-card-img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.15s ease; }
        .cover-card-img--loaded { opacity: 1; }
        .cover-card-shimmer {
          position: absolute;
          inset: 0;
          background: #a0a0a0;
        }
        .cover-card-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.3);
        }
        .cover-card-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end; justify-content: flex-end;
          gap: 4px; padding: 6px;
          opacity: 0; transition: opacity 0.1s;
        }
        .cover-card:hover .cover-card-overlay { opacity: 1; }
        /* Win95 action buttons: small silver squares */
        .cover-card-action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 0;
          background: #c0c0c0;
          border: 2px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          color: #000000; cursor: pointer;
          box-shadow: none;
          transition: none; padding: 0;
        }
        .cover-card-action-btn:hover { background: #d0d0d0; transform: none; box-shadow: none; }
        .cover-card-action-btn:active { border-color: #808080 #ffffff #ffffff #808080; }
        .cover-card-delete-btn { color: #800000; }
        .cover-card-delete-btn--confirm { background: #800000 !important; color: #ffffff !important; }
        .cover-card-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; flex-wrap: wrap; position: relative; }
        .cover-card-year { font-size: 10px; color: var(--body-text-muted); background: #d4d0c8; padding: 0 4px; border: 1px solid #808080; border-radius: 0; }
        .cover-card-fav-count { display: flex; align-items: center; gap: 2px; font-size: 10px; color: var(--body-text-muted); }
        .cover-card-acotw { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; color: #806800; background: #ffffc0; border: 1px solid #c8a800; padding: 0 4px; border-radius: 0; }
        .cover-card-private { display: inline-flex; align-items: center; gap: 2px; font-size: 10px; color: #404060; background: #e0e0f0; border: 1px solid #8080a0; padding: 0 4px; border-radius: 0; }
        /* display:inline is critical — button defaults to inline-block which breaks
           text-overflow:ellipsis on the parent .album-card-artist container */
        .cover-card-artist-link { display: inline; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; font-size: inherit; color: inherit; box-shadow: none; text-decoration: underline; text-underline-offset: 1px; }
        .cover-card-artist-link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .cover-card-uploader { display: flex; align-items: center; gap: 2px; font-size: 10px; color: var(--body-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .cover-card-uploader--link { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; box-shadow: none; text-decoration: underline; text-underline-offset: 1px; }
        .cover-card-uploader--link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .album-card-cover { position: relative; }
      `}</style>
    </div>
  );
}
