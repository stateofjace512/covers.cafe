import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function OfficialGallery() {
  const [artist, setArtist] = useState('Taylor Swift');
  const [album, setAlbum] = useState('');
  const [country, setCountry] = useState('us');
  const [covers, setCovers] = useState<OfficialCoverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const normalizedArtist = useMemo(() => artist.trim(), [artist]);
  const normalizedAlbum = useMemo(() => album.trim(), [album]);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    if (!normalizedArtist) {
      setCovers([]);
      setHasMore(false);
      return [] as OfficialCoverRow[];
    }

    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, pixel_dimensions')
      .eq('country', country)
      .ilike('search_artist', `%${normalizedArtist}%`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (normalizedAlbum) {
      query = query.ilike('search_album', `%${normalizedAlbum}%`);
    }

    const { data } = await query;
    const rows = (data as OfficialCoverRow[] | null) ?? [];
    setHasMore(rows.length === PAGE_SIZE);

    if (pageNumber === 0) {
      setCovers(rows);
    } else {
      setCovers((prev) => [...prev, ...rows]);
    }

    return rows;
  }, [country, normalizedAlbum, normalizedArtist]);

  const fetchFromItunes = useCallback(async () => {
    if (!normalizedArtist) return [] as OfficialUpsertRow[];

    const term = encodeURIComponent(`${normalizedArtist} ${normalizedAlbum}`.trim());
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&country=${country}&limit=20`;

    const res = await fetch(url);
    if (!res.ok) return [] as OfficialUpsertRow[];

    const payload = await res.json() as { results?: ItunesAlbumResult[] };
    const results = payload.results ?? [];

    const rows = await Promise.all(results.map(async (item) => {
      const small = item.artworkUrl100;
      if (!small) return null;
      const fullUrl = getFullResAppleCover(small);
      if (!fullUrl) return null;
      const dimensions = await getImageDimensions(fullUrl);

      return {
        artist_name: item.artistName ?? null,
        release_year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
        album_cover_url: fullUrl,
        album_title: item.collectionName ?? null,
        pixel_dimensions: dimensions,
        country,
        search_artist: normalizedArtist,
        search_album: normalizedAlbum || null,
        tags: ['official'],
        source_payload: item,
      };
    }));

    return rows.filter((row): row is OfficialUpsertRow => Boolean(row));
  }, [country, normalizedAlbum, normalizedArtist]);

  const upsertOfficialRows = useCallback(async (rows: OfficialUpsertRow[]) => {
    if (!rows.length) return;
    const { error } = await supabase
      .from('covers_cafe_official_covers')
      .upsert(rows, { onConflict: 'country,artist_name,album_title,album_cover_url' });

    if (error) {
      // We still show fetched data even if cache writes are rejected.
      console.warn('Unable to cache official covers in Supabase:', error.message);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!normalizedArtist) return;
    setSearched(true);
    setLoading(true);
    setPage(0);

    const cachedRows = await loadCachedPage(0);
    if (cachedRows.length > 0) {
      setLoading(false);
    }

    const fetchedRows = await fetchFromItunes();
    if (fetchedRows.length > 0) {
      setCovers(fetchedRows);
      setHasMore(fetchedRows.length === PAGE_SIZE);
      setLoading(false);
    }

    await upsertOfficialRows(fetchedRows);
    await loadCachedPage(0);

    if (cachedRows.length === 0 && fetchedRows.length === 0) {
      setLoading(false);
    }
  }, [fetchFromItunes, loadCachedPage, normalizedArtist, upsertOfficialRows]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    await loadCachedPage(nextPage);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <div>
      <div className="official-search-bar">
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist (required)"
        />
        <input
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          placeholder="Album (optional)"
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="us">US</option>
          <option value="gb">UK</option>
          <option value="jp">Japan</option>
          <option value="ca">Canada</option>
          <option value="au">Australia</option>
        </select>
        <button className="btn btn-secondary" onClick={handleSearch} disabled={loading || !normalizedArtist}>
          {loading ? <><LoadingIcon size={14} className="gallery-spinner" /> Syncing…</> : 'Search Official'}
        </button>
      </div>

      {!searched || loading ? (
        <div className="gallery-loading">
          <LoadingIcon size={28} className="gallery-spinner" />
          <span>Loading official covers…</span>
        </div>
      ) : !covers.length ? (
        <div className="gallery-empty"><p>No official covers found.</p></div>
      ) : (
        <>
          <div className="album-grid">
            {covers.map((cover) => (
              <article className="album-card" key={`${cover.album_cover_url}-${cover.album_title ?? ''}`}>
                <div className="album-card-cover">
                  <img src={cover.album_cover_url} alt={`${cover.album_title ?? 'Album'} by ${cover.artist_name ?? 'Unknown'}`} className="cover-card-img cover-card-img--loaded" loading="lazy" />
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
        </>
      )}

      <style>{`
        .official-search-bar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
        .official-search-bar input, .official-search-bar select {
          padding: 7px 10px;
          border: 1px solid var(--body-card-border);
          background: var(--body-card-bg);
          color: var(--body-text);
          border-radius: 6px;
          font-size: 16px;
          font-family: var(--font-body);
        }
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
    </div>
  );
}
