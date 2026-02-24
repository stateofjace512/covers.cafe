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


function slugifySegment(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function coverPath(publicId: number | null | undefined, artist: string | null, album: string | null): string | null {
  if (!publicId) return null;
  const idPart = String(publicId).padStart(6, '0');
  const a = slugifyArtist(artist ?? 'unknown');
  const t = slugifySegment(album ?? 'untitled').slice(0, 20);
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [mergeCanonical, setMergeCanonical] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState('');

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
    // Fetch one extra to determine if there are more pages without a separate count query
    const { data } = await supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, pixel_dimensions, cover_public_id')
      .or(`search_artist.ilike.%${q}%,search_album.ilike.%${q}%,artist_name.ilike.%${q}%,album_title.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE);
    const raw = (data as OfficialCoverRow[] | null) ?? [];
    const more = raw.length > PAGE_SIZE;
    const rows = await hydrateCoverLinks(more ? raw.slice(0, PAGE_SIZE) : raw);
    setHasMore(more);
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
      const { error: cacheUpsertError } = await supabase
        .from('covers_cafe_official_covers')
        .upsert(fetchedRows, { onConflict: 'country,artist_name,album_title,album_cover_url' });

      if (!cancelled) {
        if (fetchedRows.length === 0 && cachedRows.length === 0) setLoading(false);
        // Prevent "pop in then disappear": only overwrite with cache when write succeeded.
        if (!cacheUpsertError) {
          await loadCachedPage(0);
        }
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

  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleMerge = async () => {
    if (!session?.access_token || !mergeCanonical.trim() || selectedArtists.size < 2) return;
    setMerging(true);
    setMergeMsg('');
    const res = await fetch('/api/official/merge-artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ artistNames: Array.from(selectedArtists), canonicalName: mergeCanonical.trim() }),
    });
    setMerging(false);
    if (res.ok) {
      setCovers((prev) => prev.map((c) => selectedArtists.has(c.artist_name ?? '') ? { ...c, artist_name: mergeCanonical.trim() } : c));
      setMergeMsg('Merged successfully.');
      setSelectedArtists(new Set());
      setMergeCanonical('');
    } else {
      setMergeMsg('Merge failed. Please try again.');
    }
  };

  if (loading) return <div className="gallery-loading"><LoadingIcon size={28} className="gallery-spinner" /><span>Loading official covers…</span></div>;

  return !covers.length ? (
    <div className="gallery-empty"><p>No official covers found for "{searchQuery}".</p></div>
  ) : (
    <>
      <div className="osr-header">
        <p className="gallery-search-label" style={{ margin: 0 }}><strong>{covers.length}</strong> official results for <strong>"{searchQuery}"</strong></p>
        <button
          className={`osr-select-btn${selectMode ? ' osr-select-btn--active' : ''}`}
          onClick={() => { setSelectMode((v) => !v); setSelectedArtists(new Set()); setMergeMsg(''); }}
        >
          Select
        </button>
      </div>

      {selectMode && selectedArtists.size >= 2 && (
        <div className="osr-merge-bar">
          <span className="osr-merge-label">{selectedArtists.size} artists selected</span>
          <input
            className="osr-merge-input"
            placeholder="Canonical artist name…"
            value={mergeCanonical}
            onChange={(e) => setMergeCanonical(e.target.value)}
          />
          <button className="btn btn-primary osr-merge-confirm" onClick={handleMerge} disabled={merging || !mergeCanonical.trim()}>
            {merging ? <><LoadingIcon size={13} className="gallery-spinner" /> Merging…</> : 'Merge'}
          </button>
          {mergeMsg && <span className="osr-merge-msg">{mergeMsg}</span>}
        </div>
      )}

      <div className="album-grid">
        {covers.map((cover) => {
          const path = coverPath(cover.cover_public_id, cover.artist_name, cover.album_title);
          const artistName = cover.artist_name ?? '';
          const isSelected = selectedArtists.has(artistName);
          return (
            <article
              className={`album-card official-card official-card--clickable${isSelected ? ' official-card--selected' : ''}`}
              key={`${cover.album_cover_url}-${cover.album_title ?? ''}`}
              onClick={() => selectMode ? toggleArtist(artistName) : (path ? navigate(path) : window.open(cover.album_cover_url, '_blank', 'noopener,noreferrer'))}
            >
              <div className="album-card-cover">
                <img src={cover.album_cover_url} alt={`${cover.album_title ?? 'Album'} by ${cover.artist_name ?? 'Unknown'}`} className="official-card-img" loading="lazy" />
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
                <div className="cover-card-meta">
                  {cover.release_year && <span className="cover-card-date-badge">{cover.release_year}</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {hasMore && (
        <div className="osr-load-more">
          <button className="btn btn-secondary gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</> : 'Load more'}
          </button>
        </div>
      )}
      <style>{`
        .osr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .osr-select-btn { border: 1px solid var(--body-card-border); border-radius: 6px; background: var(--body-card-bg); color: var(--body-text-muted); padding: 5px 14px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }
        .osr-select-btn--active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .osr-merge-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; background: var(--body-card-bg); border: 1px solid var(--body-card-border); }
        .osr-merge-label { font-size: 15px; color: var(--body-text-muted); flex-shrink: 0; }
        .osr-merge-input { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--body-card-border); background: var(--sidebar-bg); color: var(--body-text); font-size: 15px; font-family: var(--font-body); flex: 1; min-width: 180px; }
        .osr-merge-confirm { font-size: 14px; padding: 6px 18px; }
        .osr-merge-msg { font-size: 14px; color: var(--body-text-muted); }
        .official-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .official-card--clickable { cursor: pointer; }
        .official-card--selected .album-card-cover { outline: 3px solid var(--accent); outline-offset: -3px; border-radius: 4px; }
        .official-badge { position: absolute; right: 8px; top: 8px; background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 999px; pointer-events: none; }
        .official-select-check { position: absolute; left: 8px; top: 8px; width: 20px; height: 20px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.7); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .official-select-check--on { background: var(--accent); border-color: var(--accent); }
        .cover-card-date-badge { display: inline-flex; align-items: center; font-size: 12px; padding: 1px 7px; border-radius: 999px; background: var(--body-card-border); color: var(--body-text-muted); border: 1px solid var(--body-card-border); }
        .osr-load-more { display: flex; justify-content: center; padding: 24px 0 8px; }
        .gallery-load-more-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 28px; font-size: 19px;
          background-image:
            linear-gradient(180deg, rgba(234,187,149,0.7) 0%, rgba(222,167,125,0.7) 55%, rgba(200,147,92,0.7) 100%),
            var(--skeu-hero);
          background-size: 100% 100%, cover;
          background-position: center, center;
        }
        .gallery-load-more-btn::before { display: none; }
        [data-theme="dark"] .gallery-load-more-btn {
          background-image:
            linear-gradient(180deg, rgba(126,90,71,0.7) 0%, rgba(111,78,60,0.7) 55%, rgba(90,61,46,0.7) 100%),
            var(--skeu-hero);
          background-size: 100% 100%, cover;
          background-position: center, center;
        }
      `}</style>
    </>
  );
}
