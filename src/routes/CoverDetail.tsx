import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader, Star, ArrowDownToLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc, getCoverDownloadSrc } from '../lib/media';
import { getCoverPath, getCoverPublicIdFromSlug } from '../lib/coverRoutes';
import CoverComments from '../components/CoverComments';

export default function CoverDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const [cover, setCover] = useState<Cover | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [moreByArtist, setMoreByArtist] = useState<Cover[]>([]);

  const publicId = useMemo(() => (slug ? getCoverPublicIdFromSlug(slug) : null), [slug]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!publicId) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
        .eq('public_id', publicId)
        .single();
      if (cancelled) return;
      if (!data) {
        setCover(null);
        setLoading(false);
        return;
      }
      const c = data as Cover;
      setCover(c);
      document.title = `${c.artist} - ${c.title} by ${c.profiles?.username ?? 'unknown'} | covers.cafe`;

      const { data: more } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id,username,display_name,avatar_url)')
        .eq('artist', c.artist)
        .neq('id', c.id)
        .eq('is_public', true)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!cancelled) setMoreByArtist((more as Cover[]) ?? []);

      if (user) {
        const { data: fav } = await supabase
          .from('covers_cafe_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('cover_id', c.id)
          .maybeSingle();
        if (!cancelled) setIsFavorited(Boolean(fav));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [publicId, user?.id]);

  const toggleFavorite = async () => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    if (isFavorited) {
      await supabase.from('covers_cafe_favorites').delete().eq('user_id', user.id).eq('cover_id', cover.id);
    } else {
      await supabase.from('covers_cafe_favorites').insert({ user_id: user.id, cover_id: cover.id });
    }
    setIsFavorited(!isFavorited);
  };

  const download = async () => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    setDownloading(true);
    await supabase.from('covers_cafe_downloads').insert({ cover_id: cover.id, user_id: user.id });
    await supabase.rpc('covers_cafe_increment_downloads', { p_cover_id: cover.id });
    const res = await fetch(getCoverDownloadSrc(cover));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cover.artist} - ${cover.title}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  if (loading) return <p className="text-muted"><Loader size={16} className="upload-spinner" /> Loading cover…</p>;
  if (!cover) return <p className="text-muted">Cover not found.</p>;

  return (
    <div className="cover-page">
      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Back</button>

      <div className="cover-detail-board card">
        <div className="cover-detail-media-wrap">
          <img src={getCoverImageSrc(cover, 600)} alt={`${cover.title} by ${cover.artist}`} className="cover-page-image" />
          <div className="cover-detail-controls">
            <button className="btn" onClick={toggleFavorite}><Star size={14} fill={isFavorited ? 'currentColor' : 'none'} /> {isFavorited ? 'Favorited' : 'Favorite'}</button>
            <button className="btn btn-primary" onClick={download} disabled={downloading}><ArrowDownToLine size={14} /> {downloading ? 'Downloading…' : 'Download'}</button>
          </div>
        </div>

        <div className="cover-detail-meta">
          <h1>{cover.title}</h1>
          <p>{cover.artist}</p>
          <p className="text-muted">by {cover.profiles?.username ?? 'unknown'}</p>
        </div>
      </div>

      <section className="cover-detail-comments card">
        <CoverComments coverId={cover.id} />
      </section>

      <section className="cover-detail-more card">
        <h3>More artworks for {cover.artist}</h3>
        <div className="cover-detail-more-grid">
          {moreByArtist.map((item) => (
            <button key={item.id} className="cover-detail-more-item" onClick={() => navigate(getCoverPath(item))}>
              <img src={getCoverImageSrc(item, 300)} alt={item.title} width={300} height={300} style={{ objectFit: 'cover', borderRadius: 8 }} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
