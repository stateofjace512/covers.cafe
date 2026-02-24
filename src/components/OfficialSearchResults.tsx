import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import LoadingIcon from './LoadingIcon';
import { useAuth } from '../contexts/AuthContext';
import { searchOfficialAssets, type OfficialUpsertRow } from '../lib/officialSearch';

interface OfficialCoverRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
}

const PAGE_SIZE = 24;

export default function OfficialSearchResults({ searchQuery }: { searchQuery: string }) {
  const { session } = useAuth();
  const [covers, setCovers] = useState<OfficialCoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [mergeCanonical, setMergeCanonical] = useState('');
  const [merging, setMerging] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{ album_cover_url: string; artist_name: string }[] | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    const q = searchQuery.trim();
    if (!q) { setCovers([]); setHasMore(false); return [] as OfficialCoverRow[]; }
    const from = pageNumber * PAGE_SIZE;
    // Fetch one extra to determine if there are more pages
    const { data } = await supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url')
      .or(`search_artist.ilike.%${q}%,search_album.ilike.%${q}%,artist_name.ilike.%${q}%,album_title.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE);
    const raw = (data as OfficialCoverRow[] | null) ?? [];
    const more = raw.length > PAGE_SIZE;
    const rows = more ? raw.slice(0, PAGE_SIZE) : raw;
    setHasMore(more);
    if (pageNumber === 0) setCovers(rows); else setCovers((prev) => [...prev, ...rows]);
    return rows;
  }, [searchQuery]);

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
      const { error: cacheUpsertError } = await supabase
        .from('covers_cafe_official_covers')
        .upsert(fetchedRows, { onConflict: 'country,artist_name,album_title,album_cover_url' });
      if (!cancelled) {
        if (fetchedRows.length === 0 && cachedRows.length === 0) setLoading(false);
        // Prevent "pop in then disappear": only overwrite with cache when write succeeded.
        if (!cacheUpsertError) {
          await loadCachedPage(0);
        }
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fetchFromItunes, loadCachedPage]);

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

  const startUndoCountdown = useCallback((snapshot: { album_cover_url: string; artist_name: string }[]) => {
    setUndoSnapshot(snapshot);
    setUndoCountdown(3);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown((n) => {
        if (n <= 1) { clearInterval(undoTimerRef.current!); setUndoSnapshot(null); return 0; }
        return n - 1;
      });
    }, 1000);
  }, []);

  const handleMerge = async () => {
    if (!session?.access_token || !mergeCanonical.trim() || selectedArtists.size < 2) return;
    const canonical = mergeCanonical.trim();
    const snapshot = covers
      .filter((c) => selectedArtists.has(c.artist_name ?? ''))
      .map((c) => ({ album_cover_url: c.album_cover_url, artist_name: c.artist_name ?? '' }));
    setMerging(true);
    const res = await fetch('/api/official/merge-artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ artistNames: Array.from(selectedArtists), canonicalName: canonical }),
    });
    setMerging(false);
    if (res.ok) {
      setCovers((prev) => prev.map((c) => selectedArtists.has(c.artist_name ?? '') ? { ...c, artist_name: canonical } : c));
      setSelectedArtists(new Set());
      setMergeCanonical('');
      setSelectMode(false);
      startUndoCountdown(snapshot);
    }
  };

  const handleUndo = async () => {
    if (!undoSnapshot || !session?.access_token) return;
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    const snapshot = undoSnapshot;
    setUndoSnapshot(null);
    setUndoCountdown(0);
    await fetch('/api/official/undo-merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ records: snapshot }),
    });
    const urlToName = new Map(snapshot.map((r) => [r.album_cover_url, r.artist_name]));
    setCovers((prev) => prev.map((c) => urlToName.has(c.album_cover_url) ? { ...c, artist_name: urlToName.get(c.album_cover_url)! } : c));
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
          onClick={() => { setSelectMode((v) => !v); setSelectedArtists(new Set()); setMergeCanonical(''); }}
        >
          Select
        </button>
      </div>

      {undoSnapshot && undoCountdown > 0 && (
        <div className="osr-undo-toast">
          <span>Artists merged.</span>
          <button className="osr-undo-btn" onClick={handleUndo}>Undo</button>
          <span className="osr-undo-countdown">{undoCountdown}</span>
        </div>
      )}

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
        </div>
      )}

      <div className="album-grid">
        {covers.map((cover) => {
          const artistName = cover.artist_name ?? '';
          const isSelected = selectedArtists.has(artistName);
          return (
            <article
              className={`album-card official-card official-card--clickable${isSelected ? ' official-card--selected' : ''}`}
              key={`${cover.album_cover_url}-${cover.album_title ?? ''}`}
              data-official-url={cover.album_cover_url}
              data-artist-name={artistName}
              data-album-title={cover.album_title ?? ''}
              onClick={() => selectMode ? toggleArtist(artistName) : window.open(cover.album_cover_url, '_blank', 'noopener,noreferrer')}
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
        .osr-undo-toast { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px 16px; border-radius: 8px; background: var(--body-card-bg); border: 1px solid var(--body-card-border); font-size: 14px; }
        .osr-undo-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 4px 14px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
        .osr-undo-countdown { color: var(--body-text-muted); font-size: 13px; margin-left: auto; }
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
