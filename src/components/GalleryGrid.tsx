import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkRateLimit } from '../lib/rateLimit';
import CoverCard from './CoverCard';
import CoverModal from './CoverModal';
import RateLimitModal from './RateLimitModal';
import type { Cover } from '../lib/types';

type SortOption = 'newest' | 'oldest' | 'most_downloaded' | 'title_az' | 'artist_az';

interface Props {
  filter?: 'all' | 'favorites' | 'mine' | 'artist';
  artistUserId?: string;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  most_downloaded: 'Most Downloaded',
  title_az: 'Title A–Z',
  artist_az: 'Artist A–Z',
};

export default function GalleryGrid({ filter = 'all', artistUserId }: Props) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [openCollectionPanel, setOpenCollectionPanel] = useState(false);
  const [sort, setSort] = useState<SortOption>('newest');
  const [rateLimited, setRateLimited] = useState(false);

  const displayed = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    let list = covers;

    if (normalizedSearch) {
      list = covers.filter((cover) => {
        const tagMatch = cover.tags?.some((tag) => tag.toLowerCase().includes(normalizedSearch));
        return cover.title.toLowerCase().includes(normalizedSearch)
          || cover.artist.toLowerCase().includes(normalizedSearch)
          || Boolean(tagMatch);
      });
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_downloaded': return (b.download_count ?? 0) - (a.download_count ?? 0);
        case 'title_az': return a.title.localeCompare(b.title);
        case 'artist_az': return a.artist.localeCompare(b.artist);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [covers, searchQuery, sort]);

  const fetchCovers = useCallback(async () => {
    setLoading(true);

    if (filter === 'favorites') {
      if (!user) { setCovers([]); setLoading(false); return; }
      const { data: favs } = await supabase.from('covers_cafe_favorites').select('cover_id').eq('user_id', user.id);
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
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      setCovers((data as Cover[]) ?? []);
    }

    setLoading(false);
  }, [filter, user, artistUserId]);

  const fetchFavorites = useCallback(async () => {
    if (!user) { setFavoritedIds(new Set()); return; }
    const { data } = await supabase.from('covers_cafe_favorites').select('cover_id').eq('user_id', user.id);
    setFavoritedIds(new Set((data ?? []).map((f: { cover_id: string }) => f.cover_id)));
  }, [user]);

  useEffect(() => {
    fetchCovers();
    fetchFavorites();
  }, [fetchCovers, fetchFavorites]);

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
    if (isFav) await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', coverId);
    else await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: coverId });
  };

  const handleCoverDeleted = (coverId: string) => {
    setCovers((prev) => prev.filter((c) => c.id !== coverId));
    if (selectedCover?.id === coverId) setSelectedCover(null);
  };

  if (loading) return <div className="gallery-loading"><Loader size={28} className="gallery-spinner" /><span>Loading covers…</span></div>;

  return (
    <>
      <div className="gallery-toolbar">
        <div className="gallery-sort-wrap">
          <label className="gallery-sort-label">Sort:</label>
          <select className="gallery-sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
        </div>
      </div>

      {searchQuery && <p className="gallery-search-label">Results for <strong>"{searchQuery}"</strong> — {displayed.length} found</p>}

      {!displayed.length ? (
        <div className="gallery-empty"><p>{searchQuery ? `No covers found for "${searchQuery}".` : filter === 'favorites' ? 'No favorites yet. Star covers to save them here.' : filter === 'mine' ? 'You haven\'t uploaded any covers yet.' : 'No covers yet. Be the first to upload!'}</p></div>
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
          initialPanelMode={openCollectionPanel ? 'collection' : 'details'}
        />
      )}

      {rateLimited && <RateLimitModal action="favorite" onClose={() => setRateLimited(false)} />}

      <style>{`
        .gallery-toolbar { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .gallery-sort-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .gallery-sort-label { font-size: 12px; font-weight: bold; color: var(--body-text-muted); }
        .gallery-sort-select { padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid var(--body-card-border); background: var(--body-card-bg); color: var(--body-text); }
        .gallery-search-label { margin: 4px 0 14px; color: var(--body-text-muted); font-size: 13px; }
        .gallery-loading, .gallery-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: var(--body-text-muted); text-align: center; }
        .gallery-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
