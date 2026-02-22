import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkRateLimit } from '../lib/rateLimit';
import CoverCard from './CoverCard';
import CoverModal from './CoverModal';
import RateLimitModal from './RateLimitModal';
import type { Cover } from '../lib/types';
import type { GalleryTab } from '../routes/Gallery';

type SortOption = 'newest' | 'oldest' | 'most_downloaded' | 'most_favorited' | 'title_az' | 'artist_az';

interface Props {
  filter?: 'all' | 'favorites' | 'mine' | 'artist';
  tab?: GalleryTab;
  artistUserId?: string;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  most_downloaded: 'Most Downloaded',
  most_favorited: 'Most Favorited',
  title_az: 'Title A–Z',
  artist_az: 'Artist A–Z',
};

export default function GalleryGrid({ filter = 'all', tab = 'new', artistUserId }: Props) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [openCollectionPanel, setOpenCollectionPanel] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>('newest');
  const [rateLimited, setRateLimited] = useState(false);

  // When tab changes, reset sort to a sensible default
  useEffect(() => {
    if (tab === 'top_rated') setSort('most_favorited');
    else setSort('newest');
  }, [tab]);

  const displayed = useMemo(() => {
    let list = [...covers].sort((a, b) => {
      switch (sort) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_downloaded': return (b.download_count ?? 0) - (a.download_count ?? 0);
        case 'most_favorited': return (b.favorite_count ?? 0) - (a.favorite_count ?? 0);
        case 'title_az': return a.title.localeCompare(b.title);
        case 'artist_az': return a.artist.localeCompare(b.artist);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [covers, sort]);

  const fetchCovers = useCallback(async () => {
    setLoading(true);

    if (filter === 'favorites') {
      if (!user) { setCovers([]); setLoading(false); return; }
      const { data: favs } = await supabase
        .from('covers_cafe_favorites')
        .select('cover_id')
        .eq('user_id', user.id);
      const ids = favs?.map((f: { cover_id: string }) => f.cover_id) ?? [];
      if (!ids.length) { setCovers([]); setLoading(false); return; }
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .in('id', ids)
        .order('created_at', { ascending: false });
      setCovers((data as Cover[]) ?? []);
    } else if (filter === 'mine') {
      if (!user) { setCovers([]); setLoading(false); return; }
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setCovers((data as Cover[]) ?? []);
    } else if (filter === 'artist' && artistUserId) {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('user_id', artistUserId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      setCovers((data as Cover[]) ?? []);
    } else {
      // Public gallery — behaviour varies by tab
      let query = supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('is_public', true);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%,tags.cs.{"${searchQuery.toLowerCase()}"}`);
        query = query.order('created_at', { ascending: false });
      } else if (tab === 'acotw') {
        query = query.eq('is_acotw', true).order('acotw_since', { ascending: false, nullsFirst: false });
      } else if (tab === 'top_rated') {
        query = query.order('favorite_count', { ascending: false });
      } else {
        // 'new' — default
        query = query.order('created_at', { ascending: false });
      }

      const { data } = await query;
      setCovers((data as Cover[]) ?? []);
    }

    setLoading(false);
  }, [filter, tab, user, searchQuery, artistUserId]);

  const fetchFavorites = useCallback(async () => {
    if (!user) { setFavoritedIds(new Set()); return; }
    const { data } = await supabase
      .from('covers_cafe_favorites')
      .select('cover_id')
      .eq('user_id', user.id);
    setFavoritedIds(new Set((data ?? []).map((f: { cover_id: string }) => f.cover_id)));
  }, [user]);

  useEffect(() => {
    fetchCovers();
    fetchFavorites();
  }, [fetchCovers, fetchFavorites]);

  useEffect(() => {
    const onDragEnd = () => setIsDraggingCover(false);
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, []);

  const handleToggleFavorite = async (coverId: string) => {
    if (!user) return;
    if (!checkRateLimit('favorite', 8, 5000)) {
      setRateLimited(true);
      return;
    }
    const isFav = favoritedIds.has(coverId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(coverId) : next.add(coverId);
      return next;
    });
    // Optimistically update favorite_count on the local cover
    setCovers((prev) => prev.map((c) => c.id === coverId
      ? { ...c, favorite_count: Math.max(0, (c.favorite_count ?? 0) + (isFav ? -1 : 1)) }
      : c
    ));
    if (isFav) {
      await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', coverId);
    } else {
      await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: coverId });
    }
  };

  const handleCoverDeleted = (coverId: string) => {
    setCovers((prev) => prev.filter((c) => c.id !== coverId));
    if (selectedCover?.id === coverId) setSelectedCover(null);
  };

  const handleCoverUpdated = (updated: Cover) => {
    setCovers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelectedCover(updated);
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <Loader size={28} className="gallery-spinner" />
        <span>Loading covers…</span>
      </div>
    );
  }

  return (
    <>
      <div className="gallery-toolbar">
        <div className="gallery-sort-wrap">
          <label className="gallery-sort-label">Sort:</label>
          <select
            className="gallery-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </div>

      </div>


      {isDraggingCover && (
        <div
          className="collection-drag-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const coverId = e.dataTransfer.getData('text/cover-id');
            const dropped = covers.find((c) => c.id === coverId);
            if (dropped) {
              setSelectedCover(dropped);
              setOpenCollectionPanel(true);
            }
            setIsDraggingCover(false);
          }}
        >
          Drop cover here to open "Add to Collection"
        </div>
      )}

      {searchQuery && (
        <p className="gallery-search-label">
          Results for <strong>"{searchQuery}"</strong> — {displayed.length} found
        </p>
      )}

      {!displayed.length ? (
        <div className="gallery-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            <circle cx="9" cy="9" r="2"/>
          </svg>
          <p>
            {searchQuery
              ? `No covers found for "${searchQuery}".`
              : filter === 'favorites'
              ? 'No favorites yet. Star covers to save them here.'
              : filter === 'mine'
              ? 'You haven\'t uploaded any covers yet.'
              : tab === 'acotw'
              ? 'No Album Cover Of The Week selected yet.'
              : 'No covers yet. Be the first to upload!'}
          </p>
        </div>
      ) : (
        <div className="album-grid">
          {displayed.map((cover) => (
            <CoverCard
              key={cover.id}
              cover={cover}
              isFavorited={favoritedIds.has(cover.id)}
              onToggleFavorite={handleToggleFavorite}
              onClick={() => { setSelectedCover(cover); setOpenCollectionPanel(false); }}
              onDeleted={handleCoverDeleted}
              onDragForCollection={() => setIsDraggingCover(true)}
            />
          ))}
        </div>
      )}

      {selectedCover && (
        <CoverModal
          cover={selectedCover}
          isFavorited={favoritedIds.has(selectedCover.id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedCover(null)}
          onDeleted={handleCoverDeleted}
          onUpdated={handleCoverUpdated}
          initialPanelMode={openCollectionPanel ? 'collection' : 'details'}
        />
      )}

      {rateLimited && (
        <RateLimitModal action="favorite" onClose={() => setRateLimited(false)} />
      )}

      <style>{`
        .gallery-toolbar {
          display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .gallery-sort-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .gallery-sort-label { font-size: 12px; font-weight: bold; color: var(--body-text-muted); }
        .gallery-sort-select {
          padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold;
          border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text);
          box-shadow: var(--shadow-sm); cursor: pointer; outline: none;
          font-family: Arial, Helvetica, sans-serif;
        }
        .gallery-sort-select:focus { border-color: var(--accent); }

        .gallery-loading, .gallery-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; padding: 60px 20px;
          color: var(--body-text-muted); text-align: center;
        }
        .gallery-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .gallery-empty p { font-size: 14px; max-width: 300px; line-height: 1.6; }
.gallery-search-label { font-size: 13px; color: var(--body-text-muted); margin-bottom: 12px; }
        .collection-drag-zone { margin-bottom: 12px; border: 2px dashed var(--accent); border-radius: 8px; padding: 12px; text-align: center; font-weight: bold; color: var(--accent-dark); background: rgba(192,90,26,0.08); }
      `}</style>
    </>
  );
}
