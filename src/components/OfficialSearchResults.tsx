import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingIcon from './LoadingIcon';
import { useAuth } from '../contexts/AuthContext';
import { slugifyArtist } from '../lib/coverRoutes';

interface OfficialCoverRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  cover_id?: string | null;
  cover_public_id?: number | null;
}

interface OfficialUpsertRow extends OfficialCoverRow {
  country: string;
  search_artist: string;
  search_album: string | null;
  tags: string[];
  source_payload: Record<string, unknown>;
}

interface ItunesAlbumResult {
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  collectionName?: string;
  [key: string]: unknown;
}

const PAGE_SIZE = 24;
const COUNTRY = 'us';

function getFullResAppleCover(smallUrl: string | undefined): string | undefined {
  if (!smallUrl || !smallUrl.includes('mzstatic.com')) return smallUrl;
  let full = smallUrl
    .replace(/https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\//, 'https://a1.mzstatic.com/r40/')
    .replace(/https:\/\/is\d-ssl\.mzstatic\.com\/image\//, 'https://a1.mzstatic.com/r40/');
  full = full.replace(/\/\d+x\d+(bb|w|cc|sr)?\.(jpg|webp|png|tif)$/, '');
  if (full === smallUrl) full = smallUrl.replace(/100x100bb|60x60bb/, '1400x1400bb');
  return full;
}

function getImageDimensions(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(`${img.naturalWidth}x${img.naturalHeight}`);
    img.onerror = () => resolve(null);
    setTimeout(() => { if (!img.complete) resolve(null); }, 8000);
  });
}

function coverPath(publicId: number | null | undefined, artist: string | null, album: string | null): string | null {
  if (!publicId) return null;
  const idPart = String(publicId).padStart(6, '0');
  const a = slugifyArtist(artist ?? 'unknown');
  const t = (album ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
  return `/cover/${idPart}-${a}-${t}`;
}

export default function OfficialSearchResults({ searchQuery }: { searchQuery: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [covers, setCovers] = useState<OfficialCoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const hydrateCoverLinks = useCallback(async (rows: OfficialCoverRow[]) => {
    const urls = Array.from(new Set(rows.map((r) => r.album_cover_url)));
    if (!urls.length) return rows;
    const { data } = await supabase
      .from('covers_cafe_covers')
      .select('id, public_id, image_url')
      .in('image_url', urls)
      .contains('tags', ['official'])
      .eq('is_public', true);
    const map = new Map((data ?? []).map((d: { id: string; public_id: number | null; image_url: string }) => [d.image_url, d]));
    return rows.map((r) => {
      const m = map.get(r.album_cover_url);
      return m ? { ...r, cover_id: m.id, cover_public_id: m.public_id } : r;
    });
  }, []);

  const persistAsCovers = useCallback(async (rows: OfficialUpsertRow[]) => {
    if (!rows.length || !user) return;
    const urls = Array.from(new Set(rows.map((r) => r.album_cover_url)));
    const { data: existing } = await supabase
      .from('covers_cafe_covers')
      .select('image_url')
      .in('image_url', urls)
      .contains('tags', ['official']);
    const existingSet = new Set((existing ?? []).map((r: { image_url: string }) => r.image_url));
    const inserts = rows
      .filter((r) => !existingSet.has(r.album_cover_url))
      .map((r) => ({
        user_id: user.id,
        title: r.album_title ?? 'Unknown album',
        artist: r.artist_name ?? 'Unknown artist',
        year: r.release_year,
        tags: ['official'],
        storage_path: '',
        image_url: r.album_cover_url,
        is_public: true,
        is_private: false,
      }));
    if (!inserts.length) return;
    const { error } = await supabase.from('covers_cafe_covers').insert(inserts);
    if (error) console.warn('Unable to mirror official covers into covers table:', error.message);
  }, [user]);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    const q = searchQuery.trim();
    if (!q) { setCovers([]); setHasMore(false); return [] as OfficialCoverRow[]; }
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, pixel_dimensions')
      .eq('country', COUNTRY)
      .or(`search_artist.ilike.%${q}%,search_album.ilike.%${q}%,artist_name.ilike.%${q}%,album_title.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(from, to);
    let rows = (data as OfficialCoverRow[] | null) ?? [];
    rows = await hydrateCoverLinks(rows);
    setHasMore(rows.length === PAGE_SIZE);
    if (pageNumber === 0) setCovers(rows); else setCovers((prev) => [...prev, ...rows]);
    return rows;
  }, [hydrateCoverLinks, searchQuery]);

  const fetchFromItunes = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return [] as OfficialUpsertRow[];
    const term = encodeURIComponent(q);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&country=${COUNTRY}&limit=20`);
    if (!res.ok) return [] as OfficialUpsertRow[];
    const payload = await res.json() as { results?: ItunesAlbumResult[] };
    const rows = await Promise.all((payload.results ?? []).map(async (item) => {
      const small = item.artworkUrl100;
      if (!small) return null;
      const albumCoverUrl = getFullResAppleCover(small);
      if (!albumCoverUrl) return null;
      return {
        artist_name: item.artistName ?? null,
        album_title: item.collectionName ?? null,
        release_year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
        album_cover_url: albumCoverUrl,
        pixel_dimensions: await getImageDimensions(albumCoverUrl),
        country: COUNTRY,
        search_artist: q,
        search_album: null,
        tags: ['official'],
        source_payload: item,
      };
    }));
    return rows.filter((row): row is OfficialUpsertRow => Boolean(row));
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setPage(0);
      const cachedRows = await loadCachedPage(0);
      if (!cancelled && cachedRows.length > 0) setLoading(false);
      const fetchedRows = await fetchFromItunes();
      if (!cancelled && fetchedRows.length > 0) {
        await persistAsCovers(fetchedRows);
        const withLinks = await hydrateCoverLinks(fetchedRows);
        setCovers(withLinks);
        setHasMore(withLinks.length === PAGE_SIZE);
        setLoading(false);
      }
      await supabase.from('covers_cafe_official_covers').upsert(fetchedRows, { onConflict: 'country,artist_name,album_title,album_cover_url' });
      if (!cancelled) {
        if (fetchedRows.length === 0 && cachedRows.length === 0) setLoading(false);
        await loadCachedPage(0);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fetchFromItunes, hydrateCoverLinks, loadCachedPage, persistAsCovers]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    await loadCachedPage(next);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) return <div className="gallery-loading"><LoadingIcon size={28} className="gallery-spinner" /><span>Loading official covers…</span></div>;

  return !covers.length ? (
    <div className="gallery-empty"><p>No official covers found for "{searchQuery}".</p></div>
  ) : (
    <>
      <p className="gallery-search-label">Official results for <strong>"{searchQuery}"</strong> — {covers.length} loaded</p>
      <div className="album-grid">
        {covers.map((cover) => {
          const path = coverPath(cover.cover_public_id, cover.artist_name, cover.album_title);
          return (
            <article className={`album-card official-card${path ? ' official-card--clickable' : ''}`} key={`${cover.album_cover_url}-${cover.album_title ?? ''}`} onClick={() => path && navigate(path)}>
              <div className="album-card-cover">
                <img src={cover.album_cover_url} alt={`${cover.album_title ?? 'Album'} by ${cover.artist_name ?? 'Unknown'}`} className="official-card-img" loading="lazy" />
                <div className="official-badge">Official</div>
              </div>
              <div className="album-card-info">
                <div className="album-card-title">{cover.album_title ?? 'Unknown album'}</div>
                <div className="album-card-artist">{cover.artist_name ?? 'Unknown artist'}</div>
                <div className="cover-card-meta">
                  {cover.release_year && <span className="cover-card-year">{cover.release_year}</span>}
                  {cover.pixel_dimensions && <span className="cover-card-year">{cover.pixel_dimensions}</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {hasMore && <div className="gallery-load-more"><button className="btn btn-secondary gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>{loadingMore ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</> : 'Load more'}</button></div>}
      <style>{`
        .official-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .official-card--clickable { cursor: pointer; }
        .official-badge { position: absolute; right: 8px; top: 8px; background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 999px; pointer-events: none; }
      `}</style>
    </>
  );
}
