import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCoverImageSrc } from '../lib/media';
import CoverCard from '../components/CoverCard';
import CoverModal from '../components/CoverModal';
import type { Cover } from '../lib/types';

const PAGE_SIZE = 24;

export default function MusicArtistDetail() {
  const { artistName: encodedName } = useParams<{ artistName: string }>();
  const artistName = encodedName ? decodeURIComponent(encodedName) : '';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [headerCover, setHeaderCover] = useState<Cover | null>(null);

  useEffect(() => {
    if (!artistName) return;
    setLoading(true);

    const fetchData = async () => {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .ilike('artist', artistName)
        .eq('is_public', true)
        .order('favorite_count', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      const d = (data as Cover[]) ?? [];
      setCovers(d);
      setHeaderCover(d[0] ?? null);
      setHasMore(d.length === PAGE_SIZE);
      setLoading(false);
    };

    fetchData();
  }, [artistName]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('covers_cafe_favorites')
      .select('cover_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setFavoritedIds(new Set((data ?? []).map((f: { cover_id: string }) => f.cover_id)));
      });
  }, [user]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const from = covers.length;
    const { data } = await supabase
      .from('covers_cafe_covers')
      .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
      .ilike('artist', artistName)
      .eq('is_public', true)
      .order('favorite_count', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    const d = (data as Cover[]) ?? [];
    setCovers((prev) => [...prev, ...d]);
    setHasMore(d.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const handleToggleFavorite = async (coverId: string) => {
    if (!user) return;
    const isFav = favoritedIds.has(coverId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(coverId) : next.add(coverId);
      return next;
    });
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

  return (
    <div>
      <button className="btn btn-secondary ma-back-btn" onClick={() => navigate('/artists')}>
        <ArrowLeft size={14} /> All Artists
      </button>

      {/* Artist header with cover art as backdrop */}
      <div
        className="ma-header"
        style={headerCover ? {
          backgroundImage: `url(${getCoverImageSrc(headerCover, 400)})`,
        } : undefined}
      >
        <div className="ma-header-blur" />
        <div className="ma-header-content">
          <div className="ma-avatar">
            {headerCover ? (
              <img
                src={getCoverImageSrc(headerCover, 200)}
                alt={artistName}
                className="ma-avatar-img"
              />
            ) : (
              <Music size={36} style={{ opacity: 0.4 }} />
            )}
          </div>
          <div className="ma-header-info">
            <h1 className="ma-artist-name">{artistName}</h1>
            {!loading && (
              <p className="ma-cover-count">
                {covers.length}{hasMore ? '+' : ''} cover{covers.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--body-text-muted)' }}>
          <Loader size={22} className="ma-spinner" /> Loading covers…
        </div>
      ) : covers.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 24 }}>No public covers found for "{artistName}".</p>
      ) : (
        <>
          <div className="album-grid" style={{ marginTop: 24 }}>
            {covers.map((cover) => (
              <CoverCard
                key={cover.id}
                cover={cover}
                isFavorited={favoritedIds.has(cover.id)}
                onToggleFavorite={handleToggleFavorite}
                onClick={() => setSelectedCover(cover)}
                onDeleted={(id) => setCovers((prev) => prev.filter((c) => c.id !== id))}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 8px' }}>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 28px', fontSize: 13, fontWeight: 'bold' }}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <><Loader size={14} className="ma-spinner" /> Loading…</> : 'Load more'}
              </button>
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
          onDeleted={(id) => { setCovers((prev) => prev.filter((c) => c.id !== id)); setSelectedCover(null); }}
          onUpdated={(updated) => {
            setCovers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedCover(updated);
          }}
        />
      )}

      <style>{`
        .ma-back-btn { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
        .ma-header {
          position: relative; border-radius: 8px; overflow: hidden;
          background: var(--sidebar-bg-dark);
          background-size: cover; background-position: center;
          margin-bottom: 4px; min-height: 140px;
        }
        .ma-header-blur {
          position: absolute; inset: 0;
          background: rgba(10,5,2,0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ma-header-content {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 20px;
          padding: 28px 24px;
        }
        .ma-avatar {
          width: 90px; height: 90px; border-radius: 6px; flex-shrink: 0;
          overflow: hidden; border: 2px solid rgba(255,255,255,0.25);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          background: rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.5);
        }
        .ma-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-header-info { display: flex; flex-direction: column; gap: 6px; }
        .ma-artist-name {
          font-size: 28px; font-weight: bold; color: #fff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.6); margin: 0; line-height: 1.1;
        }
        .ma-cover-count { font-size: 14px; color: rgba(255,255,255,0.65); margin: 0; }
        .ma-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
