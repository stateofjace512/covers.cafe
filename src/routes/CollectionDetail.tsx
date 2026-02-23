import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BackIcon from '../components/BackIcon';
import LockIcon from '../components/LockIcon';
import LoadingIcon from '../components/LoadingIcon';
import PencilIcon from '../components/PencilIcon';
import CheckIcon from '../components/CheckIcon';
import XIcon from '../components/XIcon';
import ImagePlusIcon from '../components/ImagePlusIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCoverImageSrc } from '../lib/media';
import CoverCard from '../components/CoverCard';
import CoverModal from '../components/CoverModal';
import type { Cover } from '../lib/types';

export default function CollectionDetail() {
  const { username, collectionId } = useParams<{ username: string; collectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [collection, setCollection] = useState<{ id: string; name: string; is_public: boolean; owner_id: string; cover_image_id: string | null } | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [setCoverLoading, setSetCoverLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionId) return;
    setLoading(true);
    (async () => {
      const { data: col, error: colErr } = await supabase
        .from('covers_cafe_collections')
        .select('id,name,is_public,owner_id,cover_image_id')
        .eq('id', collectionId)
        .single();

      if (colErr || !col) { setNotFound(true); setLoading(false); return; }
      setCollection(col);

      const { data: items } = await supabase
        .from('covers_cafe_collection_items')
        .select('cover_id, covers_cafe_covers(*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url))')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false });

      const fetchedCovers = (items ?? [])
        .map((item: { covers_cafe_covers: Cover | null }) => item.covers_cafe_covers)
        .filter((c): c is Cover => c !== null);
      setCovers(fetchedCovers);

      if (user) {
        const { data: favs } = await supabase
          .from('covers_cafe_favorites')
          .select('cover_id')
          .eq('user_id', user.id);
        setFavoritedIds(new Set((favs ?? []).map((f: { cover_id: string }) => f.cover_id)));
      }

      setLoading(false);
    })();
  }, [collectionId, user?.id]);

  const handleToggleFavorite = async (coverId: string) => {
    if (!user) return;
    const isFav = favoritedIds.has(coverId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(coverId) : next.add(coverId);
      return next;
    });
    if (isFav) {
      await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', coverId);
    } else {
      await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: coverId });
    }
  };

  const startEdit = () => {
    setEditName(collection?.name ?? '');
    setEditPublic(collection?.is_public ?? true);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handleSetCover = async (coverId: string) => {
    if (!collection || !user) return;
    const newCoverId = collection.cover_image_id === coverId ? null : coverId;
    setSetCoverLoading(coverId);
    const { data: updated, error } = await supabase
      .from('covers_cafe_collections')
      .update({ cover_image_id: newCoverId })
      .eq('id', collection.id)
      .eq('owner_id', user.id)
      .select('id,name,is_public,owner_id,cover_image_id')
      .single();
    if (!error && updated) setCollection(updated);
    setSetCoverLoading(null);
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name || !collection) return;
    setEditSaving(true);
    const { data: updated, error } = await supabase
      .from('covers_cafe_collections')
      .update({ name, is_public: editPublic })
      .eq('id', collection.id)
      .eq('owner_id', user!.id)
      .select('id,name,is_public,owner_id,cover_image_id')
      .single();
    if (!error && updated) {
      setCollection(updated);
      setEditing(false);
    }
    setEditSaving(false);
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <LoadingIcon size={28} className="col-spinner" />
        <span>Loading collection…</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <button className="btn btn-secondary col-back-btn" onClick={() => navigate(`/users/${username}`)}>
          <BackIcon size={14} /> Back to {username}
        </button>
        <p className="text-muted">Collection not found.</p>
      </div>
    );
  }

  const isOwner = user?.id === collection?.owner_id;

  return (
    <div>
      <button className="btn btn-secondary col-back-btn" onClick={() => navigate(`/users/${username}`)}>
        <BackIcon size={14} /> {username}
      </button>

      <div className="col-detail-header card">
        {editing ? (
          <div className="col-edit-form">
            <input
              className="col-edit-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Collection name"
              autoFocus
            />
            <div className="col-edit-actions">
              <button
                className={`btn col-visibility-btn${editPublic ? ' col-visibility-btn--active' : ''}`}
                onClick={() => setEditPublic(true)}
              >Public</button>
              <button
                className={`btn col-visibility-btn${!editPublic ? ' col-visibility-btn--active' : ''}`}
                onClick={() => setEditPublic(false)}
              >Private</button>
              <button className="btn btn-primary col-save-btn" onClick={saveEdit} disabled={editSaving || !editName.trim()}>
                <CheckIcon size={14} /> Save
              </button>
              <button className="btn btn-secondary" onClick={cancelEdit} disabled={editSaving}>
                <XIcon size={14} />
              </button>
            </div>

            {/* Cover picker */}
            <div className="col-edit-cover-section">
              <span className="col-edit-cover-label">Collection cover</span>
              {covers.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--body-text-muted)', margin: 0 }}>Add covers to this collection first.</p>
              ) : (
                <div className="col-edit-cover-grid">
                  {covers.map((cover) => {
                    const isActive = collection?.cover_image_id === cover.id;
                    return (
                      <button
                        key={cover.id}
                        className={`col-edit-cover-thumb${isActive ? ' col-edit-cover-thumb--active' : ''}`}
                        onClick={() => handleSetCover(cover.id)}
                        disabled={setCoverLoading === cover.id}
                        title={isActive ? 'Remove as cover' : cover.title}
                      >
                        <img src={getCoverImageSrc(cover, 120)} alt={cover.title} />
                        {isActive && <div className="col-edit-cover-check"><CheckIcon size={12} /></div>}
                        {setCoverLoading === cover.id && <div className="col-edit-cover-check"><LoadingIcon size={12} className="col-spinner" /></div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <h1 className="col-detail-name">
              {collection?.name}
              {!collection?.is_public && (
                <span className="col-detail-private">
                  <LockIcon size={12} /> Private
                </span>
              )}
              {isOwner && (
                <button className="btn col-edit-btn" onClick={startEdit} title="Edit collection">
                  <PencilIcon size={13} />
                </button>
              )}
            </h1>
            <p className="col-detail-count">{covers.length} cover{covers.length !== 1 ? 's' : ''}</p>
          </>
        )}
      </div>

      {covers.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 24 }}>This collection has no covers yet.</p>
      ) : (
        <div className="album-grid" style={{ marginTop: 24 }}>
          {covers.map((cover) => (
            <div key={cover.id} className="col-cover-wrap">
              <CoverCard
                cover={cover}
                isFavorited={favoritedIds.has(cover.id)}
                onToggleFavorite={handleToggleFavorite}
                onClick={() => setSelectedCover(cover)}
                onDeleted={(id) => setCovers((prev) => prev.filter((c) => c.id !== id))}
              />
              {isOwner && (
                <button
                  className={`col-set-cover-btn${collection?.cover_image_id === cover.id ? ' col-set-cover-btn--active' : ''}`}
                  title={collection?.cover_image_id === cover.id ? 'Remove as collection cover' : 'Set as collection cover'}
                  onClick={() => handleSetCover(cover.id)}
                  disabled={setCoverLoading === cover.id}
                >
                  {setCoverLoading === cover.id
                    ? <LoadingIcon size={11} className="col-spinner" />
                    : <ImagePlusIcon size={11} />
                  }
                  {collection?.cover_image_id === cover.id ? 'Cover' : 'Set cover'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedCover && (
        <CoverModal
          cover={selectedCover}
          isFavorited={favoritedIds.has(selectedCover.id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedCover(null)}
          onDeleted={(id) => { setCovers((prev) => prev.filter((c) => c.id !== id)); setSelectedCover(null); }}
          onUpdated={(updated) => {
            setCovers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedCover(updated);
          }}
        />
      )}

      <style>{`
        .col-back-btn { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
        .col-detail-header { padding: 20px 24px; margin-bottom: 4px; }
        .col-detail-name {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .col-detail-name { text-shadow: none; }
        .col-detail-private {
          font-size: 11px; font-weight: bold;
          background: var(--sidebar-bg); color: var(--body-text-muted);
          padding: 2px 8px; border-radius: 10px;
          border: 1px solid var(--body-card-border);
          display: flex; align-items: center; gap: 4px;
        }
        .col-edit-btn {
          background: none; border: 1px solid var(--body-card-border);
          color: var(--body-text-muted); padding: 4px 8px; border-radius: 4px;
          display: flex; align-items: center;
        }
        .col-edit-btn:hover { background: var(--sidebar-bg); color: var(--body-text); transform: none; box-shadow: none; }
        .col-detail-count { font-size: 13px; color: var(--body-text-muted); margin-top: 6px; }
        .col-edit-form { display: flex; flex-direction: column; gap: 10px; }
        .col-edit-name-input {
          font-size: 20px; font-weight: bold; color: var(--body-text);
          background: var(--body-card-bg); border: 1px solid var(--accent);
          border-radius: 4px; padding: 6px 10px; outline: none;
          box-shadow: 0 0 0 2px rgba(192,90,26,0.2);
          font-family: inherit;
        }
        .col-edit-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .col-visibility-btn {
          font-size: 12px; padding: 5px 12px;
          background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); color: var(--body-text-muted);
        }
        .col-visibility-btn--active { background: var(--accent); color: white; border-color: var(--accent); }
        .col-visibility-btn:hover { transform: none; box-shadow: none; }
        .col-save-btn { display: flex; align-items: center; gap: 5px; font-size: 12px; }
        .col-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .gallery-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: var(--body-text-muted); }
        .col-cover-wrap { position: relative; }
        .col-set-cover-btn {
          position: absolute; bottom: 6px; left: 6px;
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: bold;
          padding: 3px 7px; border-radius: 3px;
          background: rgba(10,5,2,0.75); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.15);
          backdrop-filter: blur(4px);
          opacity: 0; transition: opacity 0.15s;
          cursor: pointer; z-index: 2;
        }
        .col-cover-wrap:hover .col-set-cover-btn { opacity: 1; }
        .col-set-cover-btn--active {
          background: var(--accent); color: white;
          border-color: var(--accent); opacity: 1;
        }
        .col-set-cover-btn:hover { transform: none; box-shadow: none; }
        .col-edit-cover-section { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--body-card-border); }
        .col-edit-cover-label { font-size: 11px; font-weight: bold; color: var(--body-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .col-edit-cover-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .col-edit-cover-thumb {
          width: 56px; height: 56px; border-radius: 4px; overflow: hidden;
          border: 2px solid transparent; padding: 0; cursor: pointer;
          position: relative; flex-shrink: 0;
          transition: border-color 0.12s, opacity 0.12s;
        }
        .col-edit-cover-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .col-edit-cover-thumb:hover { border-color: rgba(255,255,255,0.4); }
        .col-edit-cover-thumb--active { border-color: var(--accent); }
        .col-edit-cover-check {
          position: absolute; inset: 0;
          background: rgba(192,90,26,0.55);
          display: flex; align-items: center; justify-content: center;
          color: white;
        }
      `}</style>
    </div>
  );
}
