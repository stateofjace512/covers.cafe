import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LoadingIcon from './LoadingIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { checkRateLimit, checkWeightedRateLimit } from '../lib/rateLimit';
import CoverCard from './CoverCard';
import CoverModal from './CoverModal';
import RateLimitModal from './RateLimitModal';
import type { Cover } from '../lib/types';
import { getCoverPath } from '../lib/coverRoutes';
import { getPreferModalOverPagePreference } from '../lib/userPreferences';
import type { GalleryTab } from '../routes/Gallery';

type SortOption = 'newest' | 'oldest' | 'most_downloaded' | 'most_favorited' | 'title_az' | 'artist_az';

interface Props {
  filter?: 'all' | 'favorites' | 'mine' | 'artist';
  tab?: GalleryTab;
  artistUserId?: string;
  onPin?: (coverId: string, isPinned: boolean) => void;
  pinnedCoverIds?: Set<string>;
  maxPinsReached?: boolean;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  most_downloaded: 'Most Downloaded',
  most_favorited: 'Most Favorited',
  title_az: 'Title A–Z',
  artist_az: 'Artist A–Z',
};

const PAGE_SIZE = 24;

export default function GalleryGrid({ filter = 'all', tab = 'new', artistUserId, onPin, pinnedCoverIds, maxPinsReached }: Props) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>('newest');
  const [rateLimited, setRateLimited] = useState(false);
  const [loadMoreRateLimited, setLoadMoreRateLimited] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const latestCoverCreatedAtRef = useRef<string | null>(null);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);

  const favIdsRef = useRef<string[]>([]);
  const loadingMoreRef = useRef(false);
  const currentPageRef = useRef(0);
  const handledOpenRef = useRef<string | null>(null);

  // Handle ?open=<cover_id> — e.g. links from notification bell
  const openCoverId = searchParams.get('open');
  useEffect(() => {
    if (!openCoverId || handledOpenRef.current === openCoverId) return;
    handledOpenRef.current = openCoverId;

    // Remove the param from the URL immediately so it doesn't re-trigger
    const params = new URLSearchParams(searchParams);
    params.delete('open');
    navigate(`?${params.toString()}`, { replace: true });

    void supabase
      .from('covers_cafe_covers')
      .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
      .eq('id', openCoverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const cover = data as Cover;
        if (getPreferModalOverPagePreference()) {
          setSelectedCover(cover);
        } else {
          navigate(getCoverPath(cover));
        }
      });
  }, [openCoverId, navigate, searchParams]);

  // When tab changes, reset sort to a sensible default
  useEffect(() => {
    if (tab === 'top_rated') setSort('most_favorited');
    else setSort('newest');
  }, [tab]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applySort(q: any, currentSort: SortOption): any {
    switch (currentSort) {
      case 'oldest': return q.order('created_at', { ascending: true });
      case 'most_downloaded': return q.order('download_count', { ascending: false });
      case 'most_favorited': return q.order('favorite_count', { ascending: false });
      case 'title_az': return q.order('title', { ascending: true });
      case 'artist_az': return q.order('artist', { ascending: true });
      default: return q.order('created_at', { ascending: false });
    }
  }

  async function fetchPage(
    pageNum: number,
    currentFilter: typeof filter,
    currentTab: typeof tab,
    currentUser: typeof user,
    currentSearchQuery: string,
    currentArtistUserId: typeof artistUserId,
    currentSort: SortOption,
  ): Promise<{ data: Cover[]; more: boolean }> {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (currentFilter === 'favorites') {
      if (!currentUser) return { data: [], more: false };

      if (pageNum === 0) {
        const { data: favs } = await supabase
          .from('covers_cafe_favorites')
          .select('cover_id')
          .eq('user_id', currentUser.id);
        favIdsRef.current = favs?.map((f: { cover_id: string }) => f.cover_id) ?? [];
      }

      const ids = favIdsRef.current;
      if (!ids.length) return { data: [], more: false };

      const pageIds = ids.slice(from, from + PAGE_SIZE);
      if (!pageIds.length) return { data: [], more: false };

      const { data } = await applySort(
        supabase
          .from('covers_cafe_covers')
          .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
          .in('id', pageIds)
          .eq('is_private', false),
        currentSort,
      );
      return { data: (data as Cover[]) ?? [], more: from + PAGE_SIZE < ids.length };

    } else if (currentFilter === 'mine') {
      if (!currentUser) return { data: [], more: false };
      const { data } = await applySort(
        supabase
          .from('covers_cafe_covers')
          .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
          .eq('user_id', currentUser.id)
          .not('tags', 'cs', '{"official"}'),
        currentSort,
      ).range(from, to);
      const d = (data as Cover[]) ?? [];
      return { data: d, more: d.length === PAGE_SIZE };

    } else if (currentFilter === 'artist' && currentArtistUserId) {
      const isOwner = currentUser?.id === currentArtistUserId;
      let q = supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('user_id', currentArtistUserId)
        .not('tags', 'cs', '{"official"}');
      if (!isOwner) q = q.eq('is_public', true).eq('is_private', false);
      const { data } = await applySort(q, currentSort).range(from, to);
      const d = (data as Cover[]) ?? [];
      return { data: d, more: d.length === PAGE_SIZE };

    } else {
      let query = supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .eq('is_public', true)
        .eq('is_private', false);

      if (currentSearchQuery) {
        query = query.or(`title.ilike.%${currentSearchQuery}%,artist.ilike.%${currentSearchQuery}%,tags.cs.{"${currentSearchQuery.toLowerCase()}"}`);
        query = applySort(query, currentSort);
      } else if (currentTab === 'acotw') {
        query = query.eq('is_acotw', true).order('acotw_since', { ascending: false, nullsFirst: false });
      } else {
        query = applySort(query, currentSort);
      }

      const { data } = await query.range(from, to);
      const d = (data as Cover[]) ?? [];
      return { data: d, more: d.length === PAGE_SIZE };
    }
  }

  const fetchFavorites = useCallback(async (userId: string | undefined) => {
    if (!userId) { setFavoritedIds(new Set()); return; }
    const { data } = await supabase
      .from('covers_cafe_favorites')
      .select('cover_id')
      .eq('user_id', userId);
    setFavoritedIds(new Set((data ?? []).map((f: { cover_id: string }) => f.cover_id)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    currentPageRef.current = 0;
    favIdsRef.current = [];
    setLoading(true);
    setHasMore(false);

    const capturedFilter = filter;
    const capturedTab = tab;
    const capturedUser = user;
    const capturedSearchQuery = searchQuery;
    const capturedArtistUserId = artistUserId;
    const capturedSort = sort;

    fetchPage(0, capturedFilter, capturedTab, capturedUser, capturedSearchQuery, capturedArtistUserId, capturedSort)
      .then(({ data, more }) => {
        if (cancelled) return;
        setCovers(data);
        setHasMore(more);
        setLoading(false);
        // Seed the poll baseline with the newest cover we just loaded
        if (data.length > 0 && data[0].created_at) {
          latestCoverCreatedAtRef.current = data[0].created_at as string;
        }
      });

    fetchFavorites(capturedUser?.id);

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tab, user?.id, searchQuery, artistUserId, sort]);

  const handleLoadMore = async () => {
    if (loadingMoreRef.current || !hasMore) return;
    if (!checkRateLimit('load_more_clicks', 5, 10_000) || !checkWeightedRateLimit('load_more_items', 500, 30_000, PAGE_SIZE)) {
      setLoadMoreRateLimited(true);
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = currentPageRef.current + 1;
    currentPageRef.current = nextPage;
    const { data, more } = await fetchPage(nextPage, filter, tab, user, searchQuery, artistUserId, sort);
    setCovers((prev) => [...prev, ...data]);
    setHasMore(more);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  };

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
    // Optimistic update
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(coverId) : next.add(coverId);
      return next;
    });
    setCovers((prev) => prev.map((c) => c.id === coverId
      ? { ...c, favorite_count: Math.max(0, (c.favorite_count ?? 0) + (isFav ? -1 : 1)) }
      : c
    ));
    const { error } = await supabase.rpc('covers_cafe_toggle_favorite', { p_cover_id: coverId });
    if (error) {
      // Revert optimistic update on failure
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(coverId) : next.delete(coverId);
        return next;
      });
      setCovers((prev) => prev.map((c) => c.id === coverId
        ? { ...c, favorite_count: Math.max(0, (c.favorite_count ?? 0) + (isFav ? 1 : -1)) }
        : c
      ));
    }
  };

  const handleCoverDeleted = (coverId: string) => {
    setCovers((prev) => prev.filter((c) => c.id !== coverId));
  };

  // Poll for new public covers every 90 s (replaces Realtime to free up WS connections).
  // Only runs on the global "all covers" view — no need to poll for personal/filtered views.
  useEffect(() => {
    if (filter !== 'all') return;
    const id = setInterval(async () => {
      if (refreshPending) return; // already flagged, no need to re-check
      const baseline = latestCoverCreatedAtRef.current;
      if (!baseline) return;
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('created_at')
        .eq('is_public', true)
        .eq('is_private', false)
        .gt('created_at', baseline)
        .limit(1);
      if (data && data.length > 0) setRefreshPending(true);
    }, 90_000);
    return () => clearInterval(id);
  }, [filter, refreshPending]);

  const handleManualRefresh = async () => {
    setLoading(true);
    currentPageRef.current = 0;
    const { data, more } = await fetchPage(0, filter, tab, user, searchQuery, artistUserId, sort);
    setCovers(data);
    setHasMore(more);
    setLoading(false);
    setRefreshPending(false);
    if (data.length > 0 && data[0].created_at) {
      latestCoverCreatedAtRef.current = data[0].created_at as string;
    }
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <LoadingIcon size={28} className="gallery-spinner" />
        <span>Loading covers…</span>
      </div>
    );
  }

  return (
    <>
      {refreshPending && (
        <div className="gallery-refresh-banner">
          <span>New covers are available.</span>
          <button className="btn btn-secondary" onClick={handleManualRefresh}>Refresh</button>
        </div>
      )}

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
              navigate(`${getCoverPath(dropped)}?panel=collection`);
            }
            setIsDraggingCover(false);
          }}
        >
          Drop cover here to open "Add to Collection"
        </div>
      )}

      {searchQuery && (
        <p className="gallery-search-label">
          <strong>{covers.length}</strong> results for <strong>"{searchQuery}"</strong>
        </p>
      )}

      {!covers.length ? (
        <div className="gallery-empty">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48" style={{ opacity: 0.3 }}>
            <path d="m30.48 16.76 -1.53 0 0 1.52 1.53 0 0 7.62 1.52 0 0 -19.81 -1.52 0 0 10.67z" fill="currentColor"></path>
            <path d="M28.95 25.9h1.53v1.53h-1.53Z" fill="currentColor"></path>
            <path d="M28.95 4.57h1.53v1.52h-1.53Z" fill="currentColor"></path>
            <path d="M27.43 12.19h1.52v1.52h-1.52Z" fill="currentColor"></path>
            <path d="m13.72 27.43 0 -1.53 -3.05 0 0 1.53 -7.62 0 0 1.52 25.9 0 0 -1.52 -15.23 0z" fill="currentColor"></path>
            <path d="m25.91 16.76 -1.53 0 0 -1.52 -4.57 0 0 1.52 -1.52 0 0 1.52 -3.05 0 0 1.53 3.05 0 0 1.52 1.52 0 0 1.52 3.05 0 0 -1.52 3.05 0 0 -1.52 3.04 0 0 -1.53 -3.04 0 0 -1.52z" fill="currentColor"></path>
            <path d="M25.91 13.71h1.52v1.53h-1.52Z" fill="currentColor"></path>
            <path d="M21.34 10.66h1.52v3.05h-1.52Z" fill="currentColor"></path>
            <path d="M16.76 22.85h3.05v1.53h-3.05Z" fill="currentColor"></path>
            <path d="M16.76 13.71h1.53v1.53h-1.53Z" fill="currentColor"></path>
            <path d="M15.24 12.19h1.52v1.52h-1.52Z" fill="currentColor"></path>
            <path d="M13.72 24.38h3.04v1.52h-3.04Z" fill="currentColor"></path>
            <path d="M12.19 16.76h3.05v1.52h-3.05Z" fill="currentColor"></path>
            <path d="M7.62 15.24h4.57v1.52H7.62Z" fill="currentColor"></path>
            <path d="M4.57 16.76h3.05v1.52H4.57Z" fill="currentColor"></path>
            <path d="M3.05 3.05h25.9v1.52H3.05Z" fill="currentColor"></path>
            <path d="M3.05 18.28h1.52v1.53H3.05Z" fill="currentColor"></path>
            <path d="M1.53 25.9h1.52v1.53H1.53Z" fill="currentColor"></path>
            <path d="M1.53 4.57h1.52v1.52H1.53Z" fill="currentColor"></path>
            <path d="m1.53 21.33 1.52 0 0 -1.52 -1.52 0 0 -13.72 -1.53 0L0 25.9l1.53 0 0 -4.57z" fill="currentColor"></path>
          </svg>
          <p>
            {searchQuery
              ? `No covers found for "${searchQuery}".`
              : filter === 'favorites'
              ? 'No favorites yet. Star covers to save them here.'
              : filter === 'mine'
              ? "You haven't uploaded any covers yet."
              : filter === 'artist'
              ? (artistUserId === user?.id ? "You haven't uploaded any covers yet." : 'This user has not uploaded any images yet. Check back later!')
              : tab === 'acotw'
              ? 'No Album Cover Of The Week selected yet.'
              : 'No covers yet. Be the first to upload!'}
          </p>
        </div>
      ) : (
        <>
          <div className="album-grid">
            {covers.map((cover) => (
              <CoverCard
                key={cover.id}
                cover={cover}
                isFavorited={favoritedIds.has(cover.id)}
                onToggleFavorite={handleToggleFavorite}
                onDeleted={handleCoverDeleted}
                onDragForCollection={() => setIsDraggingCover(true)}
                onClick={() => {
                  if (getPreferModalOverPagePreference()) {
                    setSelectedCover(cover);
                    return;
                  }
                  navigate(getCoverPath(cover));
                }}
                onPin={onPin}
                isPinned={pinnedCoverIds?.has(cover.id)}
                canPin={!maxPinsReached || pinnedCoverIds?.has(cover.id)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="gallery-load-more">
              <button
                className="btn btn-secondary gallery-load-more-btn gallery-load-more-btn--compact"
                onClick={handleLoadMore}
                disabled={loadingMore}
>
                {loadingMore
                  ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</>
                  : 'Load more'}
              </button>
              <p className="gallery-load-more-hint">Tip: use search to jump to specific covers faster.</p>
            </div>
          )}
        </>
      )}

      {selectedCover && (
        <CoverModal
          cover={selectedCover}
          isFavorited={favoritedIds.has(selectedCover.id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedCover(null)}
          onDeleted={(id) => {
            handleCoverDeleted(id);
            setSelectedCover(null);
          }}
          onUpdated={(updated) => {
            setCovers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setSelectedCover(updated);
          }}
        />
      )}

      {rateLimited && (
        <RateLimitModal action="favorite" onClose={() => setRateLimited(false)} />
      )}

      {loadMoreRateLimited && (
        <RateLimitModal action="load_more_clicks" onClose={() => setLoadMoreRateLimited(false)} />
      )}

      
    </>
  );
}
