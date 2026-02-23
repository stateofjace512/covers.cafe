import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import LoadingIcon from './LoadingIcon';

interface OfficialCoverRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
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

  if (full === smallUrl) {
    full = smallUrl.replace(/100x100bb|60x60bb/, '1400x1400bb');
  }

  return full;
}

function getImageDimensions(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;

    img.onload = () => resolve(`${img.naturalWidth}x${img.naturalHeight}`);
    img.onerror = () => resolve(null);

    setTimeout(() => {
      if (!img.complete) resolve(null);
    }, 8000);
  });
}

export default function OfficialSearchResults({ searchQuery }: { searchQuery: string }) {
  const [covers, setCovers] = useState<OfficialCoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    const q = searchQuery.trim();
    if (!q) {
      setCovers([]);
      setHasMore(false);
      return [] as OfficialCoverRow[];
    }

    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, pixel_dimensions')
      .eq('country', COUNTRY)
      .or(`search_artist.ilike.%${q}%,search_album.ilike.%${q}%,artist_name.ilike.%${q}%,album_title.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(from, to);

    const rows = (data as OfficialCoverRow[] | null) ?? [];
    setHasMore(rows.length === PAGE_SIZE);

    if (pageNumber === 0) setCovers(rows);
    else setCovers((prev) => [...prev, ...rows]);

    return rows;
  }, [searchQuery]);

  const fetchFromItunes = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return [] as OfficialUpsertRow[];

    const term = encodeURIComponent(q);
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&country=${COUNTRY}&limit=20`;

    const res = await fetch(url);
    if (!res.ok) return [] as OfficialUpsertRow[];

    const payload = await res.json() as { results?: ItunesAlbumResult[] };
    const results = payload.results ?? [];

    const rows = await Promise.all(results.map(async (item) => {
      const small = item.artworkUrl100;
      if (!small) return null;
      const albumCoverUrl = getFullResAppleCover(small);
      if (!albumCoverUrl) return null;
      const pixelDimensions = await getImageDimensions(albumCoverUrl);

      return {
        artist_name: item.artistName ?? null,
        album_title: item.collectionName ?? null,
        release_year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
        album_cover_url: albumCoverUrl,
        pixel_dimensions: pixelDimensions,
        country: COUNTRY,
        search_artist: q,
        search_album: null,
        tags: ['official'],
        source_payload: item,
      };
    }));

    return rows.filter((row): row is OfficialUpsertRow => Boolean(row));
  }, [searchQuery]);

  const upsertOfficialRows = useCallback(async (rows: OfficialUpsertRow[]) => {
    if (!rows.length) return;
    const { error } = await supabase
      .from('covers_cafe_official_covers')
      .upsert(rows, { onConflict: 'country,artist_name,album_title,album_cover_url' });

    if (error) {
      // Keep UX responsive even if cache write is blocked by RLS or policy mismatch.
      console.warn('Unable to cache official covers in Supabase:', error.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setPage(0);

      const cachedRows = await loadCachedPage(0);
      if (!cancelled && cachedRows.length > 0) {
        setLoading(false);
      }

      const fetchedRows = await fetchFromItunes();
      if (!cancelled && fetchedRows.length > 0) {
        setCovers(fetchedRows);
        setHasMore(fetchedRows.length === PAGE_SIZE);
        setLoading(false);
      }

      await upsertOfficialRows(fetchedRows);

      if (!cancelled) {
        if (fetchedRows.length === 0 && cachedRows.length === 0) {
          setLoading(false);
        }
        await loadCachedPage(0);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [fetchFromItunes, loadCachedPage, upsertOfficialRows]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    await loadCachedPage(next);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <LoadingIcon size={28} className="gallery-spinner" />
        <span>Loading official covers…</span>
      </div>
    );
  }

  return !covers.length ? (
    <div className="gallery-empty">
      <p>No official covers found for "{searchQuery}".</p>
    </div>
  ) : (
    <>
      <p className="gallery-search-label">
        Official results for <strong>"{searchQuery}"</strong> — {covers.length} loaded
      </p>
      <div className="album-grid">
        {covers.map((cover) => (
          <article className="album-card" key={`${cover.album_cover_url}-${cover.album_title ?? ''}`}>
            <div className="album-card-cover">
              <img
                src={cover.album_cover_url}
                alt={`${cover.album_title ?? 'Album'} by ${cover.artist_name ?? 'Unknown'}`}
                className="cover-card-img cover-card-img--loaded"
                loading="lazy"
              />
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
        ))}
      </div>

      {hasMore && (
        <div className="gallery-load-more">
          <button className="btn btn-secondary gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore
              ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</>
              : 'Load more'}
          </button>
        </div>
      )}

      <style>{`
        .official-badge {
          position: absolute;
          right: 8px;
          top: 8px;
          background: rgba(0,0,0,0.72);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 999px;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
