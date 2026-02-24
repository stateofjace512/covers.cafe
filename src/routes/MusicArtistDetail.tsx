import { useState, useEffect, useRef, useCallback } from 'react';
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
import { getCoverPath, getOfficialCoverPath, slugifyArtist } from '../lib/coverRoutes';

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

type ArtType = 'fan' | 'official';

interface OfficialCover {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  cover_public_id: number | null;
  official_public_id: number | null;
}

export default function MusicArtistDetail() {
  const { artistName: slugParam } = useParams<{ artistName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Prefer the original name passed as router state (set by MusicArtists navigation).
  // Fallback: replace hyphens with spaces for a best-effort ilike lookup.
  const locationState = location.state as { originalName?: string; startTab?: ArtType } | null;
  const artistName: string = locationState?.originalName
    ?? (slugParam ? decodeURIComponent(slugParam).replace(/-/g, ' ') : '');
  const { user, session } = useAuth();

  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [headerCover, setHeaderCover] = useState<Cover | null>(null);
  const [artType, setArtType] = useState<ArtType>(locationState?.startTab ?? 'fan');

  const [officialCovers, setOfficialCovers] = useState<OfficialCover[]>([]);
  const [officialLoading, setOfficialLoading] = useState(true);
  const [officialHasMore, setOfficialHasMore] = useState(false);
  const [officialPage, setOfficialPage] = useState(0);
  const [officialLoadingMore, setOfficialLoadingMore] = useState(false);

  // Select/merge state (official tab)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [mergeCanonical, setMergeCanonical] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  // Undo state
  const [undoSnapshot, setUndoSnapshot] = useState<{ records: { album_cover_url: string; artist_name: string }[]; aliases: string[] } | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Known aliases for this artist (alias → this artistName) — used to expand official cover queries.
  const [artistAliases, setArtistAliases] = useState<string[]>([]);

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
        .or(`artists.cs.{${artistName}},artist.ilike.%${artistName}%`)
        .eq('is_public', true)
        .eq('is_private', false)
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
    if (!artistName) return;
    setOfficialLoading(true);
    setOfficialPage(0);

    const fetchOfficial = async () => {
      // Load aliases where this artist is the canonical name (e.g. テイラー・スウィフト for Taylor Swift).
      // These are used to also surface covers recorded under alternate name spellings or localisations.
      const { data: aliasData } = await supabase
        .from('covers_cafe_artist_aliases')
        .select('alias')
        .eq('canonical', artistName);
      const aliases = (aliasData ?? []).map((r) => r.alias as string).filter(Boolean);
      setArtistAliases(aliases);

      // Build an OR filter that matches the canonical name and any known aliases so compound
      // strings like "テイラー・スウィフト & ILLENIUM" appear on Taylor Swift's page.
      const allNames = [artistName, ...aliases];
      const orFilter = allNames.map((n) => `artist_name.ilike.%${n}%`).join(',');

      const { data } = await supabase
        .from('covers_cafe_official_covers')
        .select('artist_name, album_title, release_year, album_cover_url, cover_public_id, official_public_id')
        .or(orFilter)
        .order('created_at', { ascending: true })
        .range(0, PAGE_SIZE);

      const raw = (data as OfficialCover[] | null) ?? [];
      const more = raw.length > PAGE_SIZE;
      setOfficialCovers(more ? raw.slice(0, PAGE_SIZE) : raw);
      setOfficialHasMore(more);
      setOfficialLoading(false);
    };

    fetchOfficial();
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
      .ilike('artist', `%${artistName}%`)
      .eq('is_public', true)
      .eq('is_private', false)
      .order('favorite_count', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    const d = (data as Cover[]) ?? [];
    setCovers((prev) => [...prev, ...d]);
    setHasMore(d.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const handleLoadMoreOfficial = async () => {
    if (officialLoadingMore || !officialHasMore) return;
    setOfficialLoadingMore(true);
    const nextPage = officialPage + 1;
    const from = nextPage * PAGE_SIZE;
    const allNames = [artistName, ...artistAliases];
    const orFilter = allNames.map((n) => `artist_name.ilike.%${n}%`).join(',');
    const { data } = await supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, cover_public_id, official_public_id')
      .or(orFilter)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE);
    const raw = (data as OfficialCover[] | null) ?? [];
    const more = raw.length > PAGE_SIZE;
    setOfficialCovers((prev) => [...prev, ...(more ? raw.slice(0, PAGE_SIZE) : raw)]);
    setOfficialHasMore(more);
    setOfficialPage(nextPage);
    setOfficialLoadingMore(false);
  };

  const startUndoCountdown = useCallback((records: { album_cover_url: string; artist_name: string }[], aliases: string[]) => {
    setUndoSnapshot({ records, aliases });
    setUndoCountdown(3);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((n) => {
        if (n <= 1) {
          clearInterval(undoTimerRef.current!);
          setUndoSnapshot(null);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }, []);

  const handleMerge = async () => {
    if (!session?.access_token) { setMergeError('You must be logged in to merge.'); return; }
    if (!mergeCanonical.trim()) { setMergeError('Enter a canonical name.'); return; }
    if (selectedArtists.size < 2) { setMergeError('Select at least 2 artists.'); return; }
    setMergeError('');
    const canonical = mergeCanonical.trim();
    // Capture snapshot for undo
    const snapshot = officialCovers
      .filter((c) => selectedArtists.has(c.artist_name ?? ''))
      .map((c) => ({ album_cover_url: c.album_cover_url, artist_name: c.artist_name ?? '' }));
    setMerging(true);
    const res = await fetch('/api/official/merge-artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ artistNames: Array.from(selectedArtists), canonicalName: canonical }),
    });
    setMerging(false);
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      setMergeError(msg || 'Merge failed. Please try again.');
      return;
    }
    if (res.ok) {
      const resJson = await res.json().catch(() => ({})) as { aliases?: string[] };
      const createdAliases: string[] = resJson.aliases ?? [];
      setOfficialCovers((prev) => prev.map((c) => selectedArtists.has(c.artist_name ?? '') ? { ...c, artist_name: canonical } : c));
      setSelectedArtists(new Set());
      setMergeCanonical('');
      setSelectMode(false);
      startUndoCountdown(snapshot, createdAliases);
    }
  };

  const handleUndo = async () => {
    if (!undoSnapshot || !session?.access_token) return;
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    const { records, aliases } = undoSnapshot;
    setUndoSnapshot(null);
    setUndoCountdown(0);
    await fetch('/api/official/undo-merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ records, aliases }),
    });
    // Restore state: re-map covers back to original names
    const urlToName = new Map(records.map((r) => [r.album_cover_url, r.artist_name]));
    setOfficialCovers((prev) => prev.map((c) => urlToName.has(c.album_cover_url) ? { ...c, artist_name: urlToName.get(c.album_cover_url)! } : c));
  };

  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
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
    if (headerCover) {
      setAvatarSrc(getCoverImageSrc(headerCover, 200));
    } else if (officialCovers.length > 0) {
      setAvatarSrc(officialCovers[0].album_cover_url);
    } else {
      setAvatarSrc('');
    }
  };

  const handleCoverClick = (cover: Cover) => {
    if (getPreferModalOverPagePreference()) {
      setSelectedCover(cover);
      return;
    }
    navigate(getCoverPath(cover));
  };

  const uploadArtistPhoto = async (file: File) => {
    if (!user || !session || !artistName) return;
    setUploading(true);
    setUploadError('');
    const form = new FormData();
    form.append('file', file);
    form.append('artist_name', artistName);
    try {
      const res = await fetch('/api/upload-artist-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const json = await res.json() as { ok: boolean; url?: string; message?: string };
      if (!json.ok || !json.url) throw new Error(json.message ?? 'Upload failed');
      setAvatarSrc(`${json.url}?t=${Date.now()}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
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
            {!loading && !officialLoading && (() => {
              const count = artType === 'official' ? officialCovers.length : covers.length;
              const more = artType === 'official' ? officialHasMore : hasMore;
              return (
                <p className="ma-cover-count">
                  {count}{more ? '+' : ''} cover{count !== 1 ? 's' : ''}
                </p>
              );
            })()}
            {uploadError && <p className="ma-upload-error">{uploadError}</p>}
          </div>
        </div>
      </div>

      <div className="ma-tab-row">
        <div className="ma-type-tabs" role="tablist" aria-label="Artist cover type">
          <button role="tab" aria-selected={artType === 'fan'} className={`ma-type-tab${artType === 'fan' ? ' ma-type-tab--active' : ''}`} onClick={() => { setArtType('fan'); setSelectMode(false); setSelectedArtists(new Set()); }}>Fan Art</button>
          <button role="tab" aria-selected={artType === 'official'} className={`ma-type-tab${artType === 'official' ? ' ma-type-tab--active' : ''}`} onClick={() => setArtType('official')}>Album Art</button>
        </div>
        {artType === 'official' && !officialLoading && officialCovers.length > 0 && (
          <button
            className={`osr-select-btn${selectMode ? ' osr-select-btn--active' : ''}`}
            onClick={() => { setSelectMode((v) => !v); setSelectedArtists(new Set()); setMergeCanonical(''); }}
          >Select</button>
        )}
      </div>

      {/* Undo toast */}
      {undoSnapshot && undoCountdown > 0 && (
        <div className="ma-undo-toast">
          <span>Artists merged.</span>
          <button className="ma-undo-btn" onClick={handleUndo}>Undo</button>
          <span className="ma-undo-countdown">{undoCountdown}</span>
        </div>
      )}

      {selectMode && selectedArtists.size >= 2 && (
        <div className="osr-merge-bar">
          <span className="osr-merge-label">{selectedArtists.size} artists selected</span>
          <input
            className="osr-merge-input"
            placeholder="Canonical artist name…"
            value={mergeCanonical}
            onChange={(e) => { setMergeCanonical(e.target.value); setMergeError(''); }}
          />
          <button className="btn btn-primary osr-merge-confirm" onClick={handleMerge} disabled={merging || !mergeCanonical.trim()}>
            {merging ? <><LoadingIcon size={13} className="ma-spinner" /> Merging…</> : 'Merge'}
          </button>
          {mergeError && <span className="osr-merge-error">{mergeError}</span>}
        </div>
      )}

      {artType === 'official' ? (
        officialLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--body-text-muted)' }}>
            <LoadingIcon size={22} className="ma-spinner" /> Loading covers…
          </div>
        ) : officialCovers.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 24 }}>No official covers found for "{artistName}".</p>
        ) : (
          <>
            <div className="album-grid" style={{ marginTop: 24 }}>
              {officialCovers.map((cover) => {
                const aName = cover.artist_name ?? '';
                const isSelected = selectedArtists.has(aName);
                return (
                <article
                  className={`album-card official-card official-card--clickable${isSelected ? ' official-card--selected' : ''}`}
                  key={`${cover.album_cover_url}-${cover.album_title ?? ''}`}
                  data-official-url={cover.album_cover_url}
                  data-artist-name={aName}
                  data-album-title={cover.album_title ?? ''}
                  onClick={() => {
                    if (selectMode) { toggleArtist(aName); return; }
                    if (cover.official_public_id) {
                      navigate(getOfficialCoverPath(cover));
                    }
                  }}
                >
                  <div className="album-card-cover">
                    <img src={cover.album_cover_url} alt={`${cover.album_title ?? 'Album'} by ${aName || 'Unknown'}`} className="official-card-img" loading="lazy" />
                    <div className="official-badge">Official</div>
                    {selectMode && (
                      <div className={`official-select-check${isSelected ? ' official-select-check--on' : ''}`}>
                        {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    )}
                  </div>
                  <div className="album-card-info">
                    <div className="album-card-title">{cover.album_title ?? 'Unknown album'}</div>
                    <div className="album-card-artist">{cover.artist_name ?? 'Unknown artist'}</div>
                    <div className="cover-card-meta">{cover.release_year && <span className="cover-card-date-badge">{cover.release_year}</span>}</div>
                  </div>
                </article>
                );
              })}
            </div>
            {officialHasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 28px', fontSize: 13, fontWeight: 'bold' }}
                  onClick={handleLoadMoreOfficial}
                  disabled={officialLoadingMore}
                >
                  {officialLoadingMore ? <><LoadingIcon size={14} className="ma-spinner" /> Loading…</> : 'Load more'}
                </button>
              </div>
            )}
          </>
        )
      ) : (
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--body-text-muted)' }}>
            <LoadingIcon size={22} className="ma-spinner" /> Loading covers…
          </div>
        ) : covers.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 24 }}>No fan covers found for "{artistName}".</p>
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
        )
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
          position: relative; border-radius: 0; overflow: hidden;
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
          width: 130px; height: 130px; border-radius: 0; flex-shrink: 0;
          overflow: hidden; border: 2px solid rgba(255,255,255,0.25);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
          background: rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.5); position: relative;
        }
        .ma-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-photo-upload-btn {
          position: absolute; bottom: 0; right: 0;
          width: 26px; height: 26px; border-radius: 0;
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
.ma-type-tabs { display: inline-flex; gap: 8px; }
        .ma-type-tab { border: 1px solid var(--body-card-border); background: var(--body-card-bg); color: var(--body-text-muted); border-radius: 0; padding: 4px 10px; font-size: 14px; }
        .ma-type-tab--active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .ma-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ma-tab-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
        .osr-select-btn { border: 1px solid var(--body-card-border); border-radius: 0; background: var(--body-card-bg); color: var(--body-text-muted); padding: 5px 14px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }
        .osr-select-btn--active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .osr-merge-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 10px 0 4px; padding: 10px 14px; border-radius: 0; background: var(--body-card-bg); border: 1px solid var(--body-card-border); }
        .osr-merge-label { font-size: 15px; color: var(--body-text-muted); flex-shrink: 0; }
        .osr-merge-input { padding: 6px 10px; border-radius: 0; border: 1px solid var(--body-card-border); background: var(--sidebar-bg); color: var(--body-text); font-size: 15px; font-family: var(--font-body); flex: 1; min-width: 180px; }
        .osr-merge-confirm { font-size: 14px; padding: 6px 18px; }
        .osr-merge-error { font-size: 13px; color: #f87171; flex-basis: 100%; margin-top: 4px; }
        .official-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .official-card--clickable { cursor: pointer; }
        .official-card--selected .album-card-cover { outline: 3px solid var(--accent); outline-offset: -3px; border-radius: 0; }
        .official-badge { position: absolute; right: 8px; top: 8px; background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 0; pointer-events: none; }
        .official-select-check { position: absolute; left: 8px; top: 8px; width: 20px; height: 20px; border-radius: 0; border: 2px solid rgba(255,255,255,0.7); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .official-select-check--on { background: var(--accent); border-color: var(--accent); }
        .cover-card-date-badge { display: inline-flex; align-items: center; font-size: 12px; padding: 1px 7px; border-radius: 0; background: var(--body-card-border); color: var(--body-text-muted); border: 1px solid var(--body-card-border); }
        .ma-undo-toast { display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px 16px; border-radius: 0; background: var(--body-card-bg); border: 1px solid var(--body-card-border); font-size: 14px; }
        .ma-undo-btn { background: var(--accent); color: #fff; border: none; border-radius: 0; padding: 4px 14px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
        .ma-undo-countdown { color: var(--body-text-muted); font-size: 13px; margin-left: auto; }
      `}</style>
    </div>
  );
}
