import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingIcon from '../components/LoadingIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import BackIcon from '../components/BackIcon';
import CalendarIcon from '../components/CalendarIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Cover } from '../lib/types';
import { getCoverImageSrc } from '../lib/media';
import { getCoverPath, getCoverPublicIdFromSlug, slugifyArtist } from '../lib/coverRoutes';
import CoverComments from '../components/CoverComments';

interface OfficialCover {
  id: string;
  official_public_id: number;
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  cover_id: string | null;
}

export default function OfficialCoverDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const [cover, setCover] = useState<OfficialCover | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [linkedFanCovers, setLinkedFanCovers] = useState<Cover[]>([]);

  const publicId = useMemo(() => (slug ? getCoverPublicIdFromSlug(slug) : null), [slug]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!publicId) { setLoading(false); return; }
      setLoading(true);

      const { data } = await supabase
        .from('covers_cafe_official_covers')
        .select('id, official_public_id, artist_name, album_title, release_year, album_cover_url, cover_id')
        .eq('official_public_id', publicId)
        .single();

      if (cancelled) return;
      if (!data) { setCover(null); setLoading(false); return; }

      const c = data as OfficialCover;
      setCover(c);
      document.title = `${c.artist_name ?? 'Unknown'} – ${c.album_title ?? 'Unknown'} | covers.cafe`;

      // Favorite count
      const { count } = await supabase
        .from('covers_cafe_official_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('official_cover_id', c.id);
      if (!cancelled) setFavoriteCount(count ?? 0);

      // Linked fan covers for this album (matching by artist + title, ordered by favorites)
      const { data: fanCovers } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .ilike('artist', `%${c.artist_name ?? ''}%`)
        .ilike('title', `%${c.album_title ?? ''}%`)
        .eq('is_public', true)
        .eq('is_private', false)
        .order('favorite_count', { ascending: false })
        .limit(8);
      if (!cancelled) setLinkedFanCovers((fanCovers as Cover[]) ?? []);

      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [publicId]);

  useEffect(() => {
    if (!user || !cover) return;
    let cancelled = false;
    supabase
      .from('covers_cafe_official_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('official_cover_id', cover.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsFavorited(Boolean(data)); });
    return () => { cancelled = true; };
  }, [user?.id, cover?.id]);

  const toggleFavorite = async () => {
    if (!cover) return;
    if (!user) return openAuthModal('login');
    if (isFavorited) {
      await supabase.from('covers_cafe_official_favorites').delete()
        .eq('user_id', user.id).eq('official_cover_id', cover.id);
      setFavoriteCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from('covers_cafe_official_favorites').insert({ user_id: user.id, official_cover_id: cover.id });
      setFavoriteCount((n) => n + 1);
    }
    setIsFavorited(!isFavorited);
  };

  if (loading) return <p className="text-muted"><LoadingIcon size={16} className="cover-spinner" /> Loading…</p>;
  if (!cover) return <p className="text-muted">Official cover not found.</p>;

  const artists = (cover.artist_name ?? '').split(/\s*[&,]\s*|\s+(?:feat\.?|ft\.?)\s+/i).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="cover-page">
      <button className="btn btn-secondary cover-page-back" onClick={() => navigate(-1)}>
        <BackIcon size={14} /> Back
      </button>

      {/* Image */}
      <div className="cover-board">
        <img
          src={cover.album_cover_url}
          alt={`${cover.album_title ?? 'Album'} by ${cover.artist_name ?? 'Unknown'}`}
          className="cover-board-image"
        />
        <div className="cover-board-actions">
          <button
            className={`btn cover-fav-btn${isFavorited ? ' cover-fav-btn--active' : ''}`}
            onClick={toggleFavorite}
          >
            <FavoritesIcon size={14} />
            {isFavorited ? 'Favorited' : 'Favorite'}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="cover-page-meta card">
        <div className="ocd-official-badge">Official</div>
        <h1 className="cover-page-title">{cover.album_title ?? 'Unknown album'}</h1>
        <p className="cover-page-artist-wrap">
          {artists.map((name, i, arr) => (
            <span key={name}>
              <button
                className="cover-page-artist-link"
                onClick={() => navigate(`/artists/${slugifyArtist(name)}`, { state: { originalName: name, startTab: 'official' } })}
              >{name}</button>
              {i < arr.length - 1 && ' & '}
            </span>
          ))}
        </p>
        <div className="cover-meta-stats">
          {cover.release_year && (
            <span className="cover-meta-chip"><CalendarIcon size={11} /> {cover.release_year}</span>
          )}
          {favoriteCount > 0 && (
            <span className="cover-meta-chip"><FavoritesIcon size={11} /> {favoriteCount} favorite{favoriteCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="cover-page-comments-wrap">
        <CoverComments coverId={cover.id} />
      </div>

      {/* Fan covers of this album */}
      {linkedFanCovers.length > 0 && (
        <section className="cover-more-section">
          <h3 className="cover-more-heading">Fan covers for {cover.album_title}</h3>
          <div className="cover-more-grid">
            {linkedFanCovers.map((item) => (
              <button
                key={item.id}
                className="cover-more-item"
                onClick={() => navigate(getCoverPath(item))}
                title={`${item.title} by ${item.artist}`}
              >
                <img src={getCoverImageSrc(item, 300)} alt={item.title} className="cover-more-img" />
                <span className="cover-more-label">{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      
    </div>
  );
}
