import { useCallback, useEffect, useState } from 'react';
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
const COUNTRY = 'us';


function coverPath(publicId: number | null | undefined, artist: string | null, album: string | null): string | null {
  if (!publicId) return null;
  const idPart = String(publicId).padStart(6, '0');
  const a = slugifyArtist(artist ?? 'unknown');
  const t = (album ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
  return `/cover/${idPart}-${a}-${t}`;
}

export default function OfficialSearchResults({ searchQuery }: { searchQuery: string }) {
  const { session } = useAuth();
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
    return searchOfficialAssets(q, '', ['us', 'au', 'mx', 'jp']);
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
