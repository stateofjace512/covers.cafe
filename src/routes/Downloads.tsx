import { useState, useEffect } from 'react';
import DownloadIcon from '../components/DownloadIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CoverCard from '../components/CoverCard';
import CoverModal from '../components/CoverModal';
import type { Cover } from '../lib/types';

export default function Downloads() {
  const { user, openAuthModal } = useAuth();
  const [covers, setCovers] = useState<Cover[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('covers_cafe_downloads')
        .select('cover_id, covers_cafe_covers(*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const uniqueCovers = new Map<string, Cover>();
      (data ?? []).forEach((row: { cover_id: string; covers_cafe_covers: Cover }) => {
        if (row.covers_cafe_covers && !uniqueCovers.has(row.cover_id)) {
          uniqueCovers.set(row.cover_id, row.covers_cafe_covers);
        }
      });
      setCovers(Array.from(uniqueCovers.values()));

      const { data: favs } = await supabase.from('covers_cafe_favorites').select('cover_id').eq('user_id', user.id);
      setFavoritedIds(new Set((favs ?? []).map((f: { cover_id: string }) => f.cover_id)));
      setLoading(false);
    })();
  }, [user]);

  const handleToggleFavorite = async (coverId: string) => {
    if (!user) return;
    const isFav = favoritedIds.has(coverId);
    setFavoritedIds((prev) => { const n = new Set(prev); isFav ? n.delete(coverId) : n.add(coverId); return n; });
    if (isFav) {
      await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', coverId);
    } else {
      await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: coverId });
    }
  };

  return (
    <div>
      <h1 className="section-title">
        <DownloadIcon size={22} />
        Downloads
      </h1>

      {!user ? (
        <div className="empty-state card">
          <DownloadIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">Sign in to see your downloads</h2>
          <p className="empty-body">Your download history will appear here.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
          </div>
        </div>
      ) : loading ? (
        <p className="text-muted">Loading…</p>
      ) : !covers.length ? (
        <div className="empty-state card">
          <DownloadIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">No downloads yet</h2>
          <p className="empty-body">Download covers from the gallery and they'll appear here.</p>
        </div>
      ) : (
        <div className="album-grid">
          {covers.map((cover) => (
            <CoverCard
              key={cover.id} cover={cover}
              isFavorited={favoritedIds.has(cover.id)}
              onToggleFavorite={handleToggleFavorite}
              onClick={() => setSelectedCover(cover)}
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
        />
      )}

      <style>{`
        .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 40px; max-width: 440px; }
        .empty-title { font-size: 23px; font-weight: bold; color: var(--body-text); margin-bottom: 10px; }
        .empty-body { font-size: 20px; color: var(--body-text-muted); line-height: 1.6; }
      `}</style>
    </div>
  );
}
