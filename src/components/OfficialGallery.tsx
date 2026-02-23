import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingIcon from './LoadingIcon';
import { useAuth } from '../contexts/AuthContext';
import { slugifyArtist } from '../lib/coverRoutes';
import { searchOfficialAssets, type OfficialUpsertRow } from '../lib/officialSearch';

interface OfficialCoverRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  cover_id?: string | null;
  cover_public_id?: number | null;
}
const PAGE_SIZE = 24;

function coverPath(publicId: number | null | undefined, artist: string | null, album: string | null): string | null {
  if (!publicId) return null;
  return `/cover/${String(publicId).padStart(6, '0')}-${slugifyArtist(artist ?? 'unknown')}-${(album ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)}`;
}

export default function OfficialGallery() {
  const { session } = useAuth();
  const navigate = useNavigate();
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

  const hydrateCoverLinks = useCallback(async (rows: OfficialCoverRow[]) => {
    const urls = Array.from(new Set(rows.map((r) => r.album_cover_url)));
    if (!urls.length) return rows;
    const { data } = await supabase.from('covers_cafe_covers').select('id, public_id, image_url').in('image_url', urls).contains('tags', ['official']).eq('is_public', true);
    const map = new Map((data ?? []).map((d: { id: string; public_id: number | null; image_url: string }) => [d.image_url, d]));
    return rows.map((r) => {
      const m = map.get(r.album_cover_url);
      return m ? { ...r, cover_id: m.id, cover_public_id: m.public_id } : r;
    });
  }, []);

  const persistAsCovers = useCallback(async (rows: OfficialUpsertRow[]) => {
    if (!rows.length || !session?.access_token) return;
    const res = await fetch('/api/official/mirror', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      console.warn('Unable to mirror official covers into covers table.');
    }
  }, [session?.access_token]);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    if (!normalizedArtist) { setCovers([]); setHasMore(false); return [] as OfficialCoverRow[]; }
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from('covers_cafe_official_covers').select('artist_name, album_title, release_year, album_cover_url, pixel_dimensions, cover_public_id').in('country', [country, country.toUpperCase()]).ilike('search_artist', `%${normalizedArtist}%`).order('created_at', { ascending: false }).range(from, to);
    if (normalizedAlbum) query = query.ilike('search_album', `%${normalizedAlbum}%`);
    const { data } = await query;
    let rows = (data as OfficialCoverRow[] | null) ?? [];
    rows = await hydrateCoverLinks(rows);
    setHasMore(rows.length === PAGE_SIZE);
    if (pageNumber === 0) setCovers(rows); else setCovers((prev) => [...prev, ...rows]);
    return rows;
  }, [country, hydrateCoverLinks, normalizedAlbum, normalizedArtist]);

  const fetchFromItunes = useCallback(async () => {
    if (!normalizedArtist) return [] as OfficialUpsertRow[];
    return searchOfficialAssets(normalizedArtist, normalizedAlbum, [country, 'us', 'au', 'mx', 'jp']);
  }, [country, normalizedAlbum, normalizedArtist]);

  const handleSearch = useCallback(async () => {
    if (!normalizedArtist) return;
    setSearched(true); setLoading(true); setPage(0);
    const cachedRows = await loadCachedPage(0);
    if (cachedRows.length > 0) setLoading(false);
    const fetchedRows = await fetchFromItunes();
    if (fetchedRows.length > 0) {
      await persistAsCovers(fetchedRows);
      const withLinks = await hydrateCoverLinks(fetchedRows);
      setCovers(withLinks);
      setHasMore(withLinks.length === PAGE_SIZE);
      setLoading(false);
    }
    const { error: cacheUpsertError } = await supabase
      .from('covers_cafe_official_covers')
      .upsert(fetchedRows, { onConflict: 'country,artist_name,album_title,album_cover_url' });

    // Prevent "pop in then disappear": only overwrite with cache when write succeeded.
    if (!cacheUpsertError) {
      await loadCachedPage(0);
    }
    if (cachedRows.length === 0 && fetchedRows.length === 0) setLoading(false);
  }, [fetchFromItunes, hydrateCoverLinks, loadCachedPage, normalizedArtist, persistAsCovers]);

  useEffect(() => { handleSearch(); }, [handleSearch]);
  const handleLoadMore = async () => { if (loadingMore || !hasMore) return; const nextPage = page + 1; setLoadingMore(true); await loadCachedPage(nextPage); setPage(nextPage); setLoadingMore(false); };

  return (
    <div>
      <div className="official-search-bar">
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist (required)" />
        <input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Album (optional)" />
        <select value={country} onChange={(e) => setCountry(e.target.value)}><option value="us">US</option><option value="gb">UK</option><option value="jp">Japan</option><option value="ca">Canada</option><option value="au">Australia</option></select>
        <button className="btn btn-secondary" onClick={handleSearch} disabled={loading || !normalizedArtist}>{loading ? <><LoadingIcon size={14} className="gallery-spinner" /> Syncing…</> : 'Search Official'}</button>
      </div>

      {!searched || loading ? (
        <div className="gallery-loading"><LoadingIcon size={28} className="gallery-spinner" /><span>Loading official covers…</span></div>
      ) : !covers.length ? (
        <div className="gallery-empty"><p>No official covers found.</p></div>
      ) : (
        <>
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
                    <div className="cover-card-meta">{cover.release_year && <span className="cover-card-year">{cover.release_year}</span>}{cover.pixel_dimensions && <span className="cover-card-year">{cover.pixel_dimensions}</span>}</div>
                  </div>
                </article>
              );
            })}
          </div>
          {hasMore && <div className="gallery-load-more"><button className="btn btn-secondary gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>{loadingMore ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</> : 'Load more'}</button></div>}
        </>
      )}

      <style>{`
        .official-search-bar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
        .official-search-bar input, .official-search-bar select { padding:7px 10px; border:1px solid var(--body-card-border); background:var(--body-card-bg); color:var(--body-text); border-radius:6px; font-size:16px; font-family:var(--font-body); }
        .official-card-img { width:100%; height:100%; object-fit:cover; display:block; }
        .official-card--clickable { cursor:pointer; }
        .official-badge { position:absolute; right:8px; top:8px; background:rgba(0,0,0,0.72); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:12px; padding:2px 8px; border-radius:999px; pointer-events:none; }
      `}</style>
    </div>
  );
}
