import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CoverCard from './CoverCard';
import CoverModal from './CoverModal';
import type { Cover } from '../lib/types';

interface Props {
  /** 'all' = public gallery, 'favorites' = current user's favorites, 'mine' = user's uploads */
  filter?: 'all' | 'favorites' | 'mine';
}

export default function GalleryGrid({ filter = 'all' }: Props) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);

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
    } else {
      let query = supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,artist.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      setCovers((data as Cover[]) ?? []);
    }

    setLoading(false);
  }, [filter, user, searchQuery]);

  // Fetch user's favorites to show star state
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

  const handleToggleFavorite = async (coverId: string) => {
    if (!user) return;
    const isFav = favoritedIds.has(coverId);
    // Optimistic update
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(coverId) : next.add(coverId);
      return next;
    });

    if (isFav) {
      await supabase
        .from('covers_cafe_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('cover_id', coverId);
    } else {
      await supabase
        .from('covers_cafe_favorites')
        .insert({ user_id: user.id, cover_id: coverId });
    }
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <Loader size={28} className="gallery-spinner" />
        <span>Loading covers…</span>
      </div>
    );
  }

  if (!covers.length) {
    return (
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
            : 'No covers yet. Be the first to upload!'}
        </p>
      </div>
    );
  }

  return (
    <>
      {searchQuery && (
        <p className="gallery-search-label">
          Showing results for <strong>"{searchQuery}"</strong> — {covers.length} found
        </p>
      )}
      <div className="album-grid">
        {covers.map((cover) => (
          <CoverCard
            key={cover.id}
            cover={cover}
            isFavorited={favoritedIds.has(cover.id)}
            onToggleFavorite={handleToggleFavorite}
            onClick={() => setSelectedCover(cover)}
          />
        ))}
      </div>

      {selectedCover && (
        <CoverModal
          cover={selectedCover}
          isFavorited={favoritedIds.has(selectedCover.id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedCover(null)}
        />
      )}

      <style>{`
        .gallery-loading, .gallery-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; padding: 60px 20px;
          color: var(--body-text-muted); text-align: center;
        }
        .gallery-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .gallery-empty p { font-size: 14px; max-width: 300px; line-height: 1.6; }
        .gallery-search-label {
          font-size: 13px; color: var(--body-text-muted);
          margin-bottom: 16px;
        }
      `}</style>
    </>
  );
}
