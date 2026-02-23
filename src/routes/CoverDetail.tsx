import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader, Star, ArrowDownToLine, ArrowLeft, User } from 'lucide-react';
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
      <button className="btn btn-secondary cover-page-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Board: image + controls */}
      <div className="cover-board">
        <img
          src={getCoverImageSrc(cover, 1200)}
          alt={`${cover.title} by ${cover.artist}`}
          className="cover-board-image"
        />
        <div className="cover-board-actions">
          <button className="btn" onClick={toggleFavorite}>
            <Star size={14} fill={isFavorited ? 'currentColor' : 'none'} />
            {isFavorited ? 'Favorited' : 'Favorite'}
          </button>
          <button className="btn btn-primary" onClick={download} disabled={downloading}>
            <ArrowDownToLine size={14} />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="cover-page-meta">
        <h1 className="cover-page-title">{cover.title}</h1>
        <p className="cover-page-artist">{cover.artist}</p>
        {cover.profiles?.username && (
          <button
            className="cover-page-uploader"
            onClick={() => navigate(`/users/${cover.profiles!.username}`)}
          >
            <User size={12} />
            @{cover.profiles.username}
          </button>
        )}
      </div>

      {/* Comments */}
      <div className="cover-page-comments-wrap">
        <CoverComments coverId={cover.id} />
      </div>

      {/* More by artist */}
      {moreByArtist.length > 0 && (
        <section className="cover-more-section">
          <h3 className="cover-more-heading">More artworks for {cover.artist}</h3>
          <div className="cover-more-grid">
            {moreByArtist.map((item) => (
              <button
                key={item.id}
                className="cover-more-item"
                onClick={() => navigate(getCoverPath(item))}
                title={`${item.title} by ${item.artist}`}
              >
                <img
                  src={getCoverImageSrc(item, 300)}
                  alt={item.title}
                  className="cover-more-img"
                />
                <span className="cover-more-label">{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .cover-page { }

        .cover-page-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 22px;
        }

        /* ── Board ── */
        .cover-board {
          max-width: 660px;
          margin: 0 auto 20px;
          background: var(--body-card-bg);
          background-image:
            linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%),
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 22px,
              rgba(100,50,10,0.03) 22px,
              rgba(100,50,10,0.03) 24px
            );
          border: 2px solid var(--body-card-border);
          border-radius: 10px;
          box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.5);
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .cover-board-image {
          width: 100%;
          max-width: 600px;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          border-radius: 6px;
          box-shadow: var(--shadow-md), 0 0 0 1px rgba(0,0,0,0.12);
          display: block;
        }

        .cover-board-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        /* ── Metadata ── */
        .cover-page-meta {
          max-width: 560px;
          margin: 0 auto 28px;
          text-align: center;
        }

        .cover-page-title {
          font-size: 24px;
          font-weight: bold;
          color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.45);
          margin-bottom: 4px;
          line-height: 1.25;
        }

        [data-theme="dark"] .cover-page-title { text-shadow: none; }

        .cover-page-artist {
          font-size: 16px;
          color: var(--body-text-muted);
          margin-bottom: 8px;
        }

        .cover-page-uploader {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: var(--accent);
          padding: 0;
          box-shadow: none;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: bold;
        }

        .cover-page-uploader:hover {
          color: var(--accent-light);
          text-decoration: underline;
        }

        /* ── Comments wrapper ── */
        .cover-page-comments-wrap {
          max-width: 720px;
          margin: 0 auto;
        }

        /* ── More artworks ── */
        .cover-more-section {
          margin-top: 36px;
          padding-top: 28px;
          border-top: 2px solid var(--body-border);
        }

        .cover-more-heading {
          font-size: 18px;
          font-weight: bold;
          color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
          margin-bottom: 16px;
        }

        [data-theme="dark"] .cover-more-heading { text-shadow: none; }

        .cover-more-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }

        .cover-more-item {
          padding: 0;
          border: 1px solid var(--body-card-border);
          border-radius: 6px;
          background: var(--body-card-bg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.12s;
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .cover-more-item:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
        }

        .cover-more-img {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          display: block;
        }

        .cover-more-label {
          font-size: 12px;
          color: var(--body-text);
          padding: 6px 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-top: 1px solid var(--body-card-border);
        }

        @media (max-width: 640px) {
          .cover-board { padding: 12px; }
          .cover-page-title { font-size: 20px; }
          .cover-more-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
        }
      `}</style>
    </div>
  );
}
