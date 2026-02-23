import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import BackIcon from '../components/BackIcon';
import MusicIcon from '../components/MusicIcon';
import LoadingIcon from '../components/LoadingIcon';
import CameraIcon from '../components/CameraIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCoverImageSrc } from '../lib/media';
import CoverCard from '../components/CoverCard';
import CoverModal from '../components/CoverModal';
import InfoModal from '../components/InfoModal';
import type { Cover } from '../lib/types';
import { getPreferModalOverPagePreference } from '../lib/userPreferences';
import { getCoverPath } from '../lib/coverRoutes';

const PAGE_SIZE = 24;
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const MAX_DIM = 5000;

type ArtistPhotoValidationResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; tooLarge: true };

async function validateArtistPhoto(file: File): Promise<ArtistPhotoValidationResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Please upload an image file.' };
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
        resolve({ ok: false, tooLarge: true });
      } else {
        resolve({ ok: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: 'Could not read image dimensions.' });
    };
    img.src = url;
  });
}

async function resizeToNearestThousand(file: File): Promise<File> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load image for resizing.'));
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
  const targetMaxDim = Math.floor(maxDim / 1000) * 1000;
  if (targetMaxDim <= 0) throw new Error('Invalid dimensions for resize.');
  const scale = targetMaxDim / maxDim;
  const newWidth = Math.round(img.naturalWidth * scale);
  const newHeight = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas resize failed'));
    }, 'image/jpeg', 0.92);
  });

  return new File([blob], file.name.replace(/\.[^.]*$/, '.jpg'), { type: 'image/jpeg' });
}

function artistPhotoTransformUrl(artistName: string, bust?: number): string {
  const path = `${encodeURIComponent(artistName)}.jpg`;
  const t = bust ? `&t=${bust}` : '';
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_artist_photos/${path}?width=850&height=850&resize=cover&quality=85${t}`;
}

export default function MusicArtistDetail() {
  const { artistName: slugParam } = useParams<{ artistName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Prefer the original name passed as router state (set by MusicArtists navigation).
  // Fallback: replace hyphens with spaces for a best-effort ilike lookup.
  const artistName: string = (location.state as { originalName?: string } | null)?.originalName
    ?? (slugParam ? decodeURIComponent(slugParam).replace(/-/g, ' ') : '');
  const { user } = useAuth();

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [headerCover, setHeaderCover] = useState<Cover | null>(null);

  // Artist photo state
  const [avatarSrc, setAvatarSrc] = useState('');
  const [photoBust, setPhotoBust] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pendingResizeFile, setPendingResizeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial avatar src whenever artistName changes
  useEffect(() => {
    if (!artistName) return;
    setAvatarSrc(artistPhotoTransformUrl(artistName, photoBust));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistName]);

  useEffect(() => {
    if (!artistName) return;
    setLoading(true);

    const fetchData = async () => {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
        .contains('artists', [artistName])
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

  const handleAvatarError = () => {
    if (headerCover) setAvatarSrc(getCoverImageSrc(headerCover, 200));
  };

  const handleCoverClick = (cover: Cover) => {
    if (getPreferModalOverPagePreference()) {
      setSelectedCover(cover);
      return;
    }
    navigate(getCoverPath(cover));
  };

  const uploadArtistPhoto = async (file: File) => {
    if (!user || !artistName) return;
    setUploading(true);
    setUploadError('');
    const path = `${encodeURIComponent(artistName)}.jpg`;
    const { error } = await supabase.storage
      .from('covers_cafe_artist_photos')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (error) {
      setUploadError('Upload failed. Check storage bucket permissions.');
    } else {
      const bust = Date.now();
      setPhotoBust(bust);
      setAvatarSrc(artistPhotoTransformUrl(artistName, bust));
    }
    setUploading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !artistName) return;
    const validation = await validateArtistPhoto(file);
    if (!validation.ok) {
      if ('tooLarge' in validation) {
        setPendingResizeFile(file);
      } else {
        setUploadError(validation.error);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    await uploadArtistPhoto(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResizeConfirm = async () => {
    if (!pendingResizeFile) return;
    try {
      const resized = await resizeToNearestThousand(pendingResizeFile);
      setPendingResizeFile(null);
      await uploadArtistPhoto(resized);
    } catch {
      setUploadError('Resize failed. Please try a smaller image.');
      setPendingResizeFile(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResizeCancel = () => {
    setPendingResizeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      {pendingResizeFile && (
        <InfoModal
          emoji="💪"
          title="Woah there!"
          body="That file is too powerful for us. Try uploading a smaller version or we can resize it for you!"
          primaryLabel="Resize for me"
          onPrimary={handleResizeConfirm}
          secondaryLabel="Cancel"
          onSecondary={handleResizeCancel}
          onClose={handleResizeCancel}
        />
      )}
      <button className="btn btn-secondary ma-back-btn" onClick={() => navigate('/artists')}>
        <BackIcon size={14} /> All Artists
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
            {avatarSrc ? (
              <img
                key={avatarSrc}
                src={avatarSrc}
                alt={artistName}
                className="ma-avatar-img"
                onError={handleAvatarError}
              />
            ) : headerCover ? (
              <img
                src={getCoverImageSrc(headerCover, 200)}
                alt={artistName}
                className="ma-avatar-img"
              />
            ) : (
              <MusicIcon size={36} style={{ opacity: 0.4 }} />
            )}
            {user && (
              <button
                className="ma-photo-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload artist photo"
                disabled={uploading}
              >
                {uploading
                  ? <LoadingIcon size={12} className="ma-spinner" />
                  : <CameraIcon size={12} />}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
          </div>
          <div className="ma-header-info">
            <h1 className="ma-artist-name">{artistName}</h1>
            {!loading && (
              <p className="ma-cover-count">
                {covers.length}{hasMore ? '+' : ''} cover{covers.length !== 1 ? 's' : ''}
              </p>
            )}
            {uploadError && <p className="ma-upload-error">{uploadError}</p>}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--body-text-muted)' }}>
          <LoadingIcon size={22} className="ma-spinner" /> Loading covers…
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
                onClick={() => handleCoverClick(cover)}
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
                {loadingMore ? <><LoadingIcon size={14} className="ma-spinner" /> Loading…</> : 'Load more'}
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
          margin-bottom: 4px; min-height: 170px;
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
          width: 130px; height: 130px; border-radius: 8px; flex-shrink: 0;
          overflow: hidden; border: 2px solid rgba(255,255,255,0.25);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          background: rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.5); position: relative;
        }
        .ma-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-photo-upload-btn {
          position: absolute; bottom: 0; right: 0;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(10,5,2,0.8); border: 1px solid rgba(255,255,255,0.3);
          color: rgba(255,255,255,0.85);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; opacity: 0; transition: opacity 0.15s;
          z-index: 2;
        }
        .ma-avatar:hover .ma-photo-upload-btn { opacity: 1; }
        .ma-photo-upload-btn:hover { transform: none; box-shadow: none; background: var(--accent); }
        .ma-header-info { display: flex; flex-direction: column; gap: 6px; }
        .ma-artist-name {
          font-size: 28px; color: #fff; margin: 0; line-height: 1.1;
        }
        .ma-cover-count { font-size: 20px; color: rgba(255,255,255,0.65); margin: 0; }
        .ma-upload-error { font-size: 18px; color: #f87171; margin: 0; }
        .ma-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
