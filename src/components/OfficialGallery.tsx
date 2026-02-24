import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingIcon from './LoadingIcon';
import { useAuth } from '../contexts/AuthContext';
import { searchOfficialAssets, type OfficialUpsertRow } from '../lib/officialSearch';
import { getOfficialCoverPath, slugifyArtist } from '../lib/coverRoutes';

interface OfficialCoverRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  cover_public_id: number | null;
  official_public_id: number | null;
}

const PAGE_SIZE = 24;

export default function OfficialGallery() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [artist, setArtist] = useState('Taylor Swift');
  const [album, setAlbum] = useState('');
  const [covers, setCovers] = useState<OfficialCoverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [mergeCanonical, setMergeCanonical] = useState('');
  const [merging, setMerging] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{ album_cover_url: string; artist_name: string }[] | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalizedArtist = useMemo(() => artist.trim(), [artist]);
  const normalizedAlbum = useMemo(() => album.trim(), [album]);

  const loadCachedPage = useCallback(async (pageNumber: number) => {
    if (!normalizedArtist) { setCovers([]); setHasMore(false); return [] as OfficialCoverRow[]; }
    const from = pageNumber * PAGE_SIZE;
    // Fetch one extra to determine if there are more pages
    let query = supabase
      .from('covers_cafe_official_covers')
      .select('artist_name, album_title, release_year, album_cover_url, cover_public_id, official_public_id')
      .ilike('search_artist', `%${normalizedArtist}%`)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE);
    if (normalizedAlbum) query = query.ilike('search_album', `%${normalizedAlbum}%`);
    const { data } = await query;
    const raw = (data as OfficialCoverRow[] | null) ?? [];
    const more = raw.length > PAGE_SIZE;
    const rows = more ? raw.slice(0, PAGE_SIZE) : raw;
    setHasMore(more);
    if (pageNumber === 0) setCovers(rows); else setCovers((prev) => [...prev, ...rows]);
    return rows;
  }, [normalizedAlbum, normalizedArtist]);

  const fetchFromItunes = useCallback(async () => {
    if (!normalizedArtist) return [] as OfficialUpsertRow[];
    return searchOfficialAssets(normalizedArtist, normalizedAlbum, ['us', 'au', 'mx', 'jp']);
  }, [normalizedAlbum, normalizedArtist]);

  const handleSearch = useCallback(async () => {
    if (!normalizedArtist) return;
    setSearched(true); setLoading(true); setPage(0);
    const cachedRows = await loadCachedPage(0);
    if (cachedRows.length > 0) setLoading(false);
    const fetchedRows = await fetchFromItunes();
    const { error: cacheUpsertError } = await supabase
      .from('covers_cafe_official_covers')
      .upsert(fetchedRows, { onConflict: 'country,artist_name,album_title,album_cover_url' });
    // Prevent "pop in then disappear": only overwrite with cache when write succeeded.
    if (!cacheUpsertError) {
      await loadCachedPage(0);
    }
    if (cachedRows.length === 0 && fetchedRows.length === 0) setLoading(false);
    setLoading(false);
  }, [fetchFromItunes, loadCachedPage, normalizedArtist]);

  useEffect(() => { handleSearch(); }, [handleSearch]);
  const handleLoadMore = async () => { if (loadingMore || !hasMore) return; const nextPage = page + 1; setLoadingMore(true); await loadCachedPage(nextPage); setPage(nextPage); setLoadingMore(false); };

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

  return (
    <div>
      <div className="official-search-bar">
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist (required)" />
        <input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Album (optional)" />
        <button className="btn btn-secondary" onClick={handleSearch} disabled={loading || !normalizedArtist}>{loading ? <><LoadingIcon size={14} className="gallery-spinner" /> Syncing…</> : 'Search Official'}</button>
        {searched && covers.length > 0 && (
          <button
            className={`osg-select-btn${selectMode ? ' osg-select-btn--active' : ''}`}
            onClick={() => { setSelectMode((v) => !v); setSelectedArtists(new Set()); setMergeCanonical(''); }}
          >
            Select
          </button>
        )}
      </div>

      {undoSnapshot && undoCountdown > 0 && (
        <div className="osg-undo-toast">
          <span>Artists merged.</span>
          <button className="osg-undo-btn" onClick={handleUndo}>Undo</button>
          <span className="osg-undo-countdown">{undoCountdown}</span>
        </div>
      )}

      {selectMode && selectedArtists.size >= 2 && (
        <div className="osg-merge-bar">
          <span className="osg-merge-label">{selectedArtists.size} artists selected</span>
          <input
            className="osg-merge-input"
            placeholder="Canonical artist name…"
            value={mergeCanonical}
            onChange={(e) => setMergeCanonical(e.target.value)}
          />
          <button className="btn btn-primary osg-merge-confirm" onClick={handleMerge} disabled={merging || !mergeCanonical.trim()}>
            {merging ? <><LoadingIcon size={13} className="gallery-spinner" /> Merging…</> : 'Merge'}
          </button>
        </div>
      )}

      {!searched || loading ? (
        <div className="gallery-loading"><LoadingIcon size={28} className="gallery-spinner" /><span>Loading official covers…</span></div>
      ) : !covers.length ? (
        <div className="gallery-empty"><p>No official covers found.</p></div>
      ) : (
        <>
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
                  onClick={() => {
                    if (selectMode) { toggleArtist(artistName); return; }
                    if (cover.official_public_id) {
                      navigate(getOfficialCoverPath(cover));
                    } else {
                      navigate(`/artists/${slugifyArtist(cover.artist_name ?? '')}`, { state: { originalName: cover.artist_name, startTab: 'official' } });
                    }
                  }}
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
                    <div className="cover-card-meta">{cover.release_year && <span className="cover-card-date-badge">{cover.release_year}</span>}</div>
                  </div>
                </article>
              );
            })}
          </div>
          {hasMore && (
            <div className="osg-load-more">
              <button className="btn btn-secondary gallery-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <><LoadingIcon size={14} className="gallery-spinner" /> Loading…</> : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .official-search-bar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
        .official-search-bar input, .official-search-bar select { padding:7px 10px; border:1px solid var(--body-card-border); background:var(--body-card-bg); color:var(--body-text); border-radius:0; font-size:16px; font-family:var(--font-body); }
        .osg-select-btn { border:1px solid var(--body-card-border); border-radius:0; background:var(--body-card-bg); color:var(--body-text-muted); padding:5px 14px; font-size:14px; cursor:pointer; font-family:var(--font-body); }
        .osg-select-btn--active { background:var(--accent); border-color:var(--accent); color:#fff; }
        .osg-merge-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; padding:10px 14px; border-radius:0; background:var(--body-card-bg); border:1px solid var(--body-card-border); }
        .osg-merge-label { font-size:15px; color:var(--body-text-muted); flex-shrink:0; }
        .osg-merge-input { padding:6px 10px; border-radius:0; border:1px solid var(--body-card-border); background:var(--sidebar-bg); color:var(--body-text); font-size:15px; font-family:var(--font-body); flex:1; min-width:180px; }
        .osg-merge-confirm { font-size:14px; padding:6px 18px; }
        .osg-undo-toast { display:flex; align-items:center; gap:10px; margin-bottom:12px; padding:10px 16px; border-radius:0; background:var(--body-card-bg); border:1px solid var(--body-card-border); font-size:14px; }
        .osg-undo-btn { background:var(--accent); color:#fff; border:none; border-radius:0; padding:4px 14px; font-size:13px; cursor:pointer; font-family:var(--font-body); }
        .osg-undo-countdown { color:var(--body-text-muted); font-size:13px; margin-left:auto; }
        .official-card-img { width:100%; height:100%; object-fit:cover; display:block; }
        .official-card--clickable { cursor:pointer; }
        .official-card--selected .album-card-cover { outline:3px solid var(--accent); outline-offset:-3px; border-radius:0; }
        .official-badge { position:absolute; right:8px; top:8px; background:rgba(0,0,0,0.72); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:12px; padding:2px 8px; border-radius:0; pointer-events:none; }
        .official-select-check { position:absolute; left:8px; top:8px; width:20px; height:20px; border-radius:0; border:2px solid rgba(255,255,255,0.7); background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; pointer-events:none; }
        .official-select-check--on { background:var(--accent); border-color:var(--accent); }
        .cover-card-date-badge { display:inline-flex; align-items:center; font-size:12px; padding:1px 7px; border-radius:0; background:var(--body-card-border); color:var(--body-text-muted); border:1px solid var(--body-card-border); }
        .osg-load-more { display:flex; justify-content:center; padding:24px 0 8px; }
        .gallery-load-more-btn {
          display:flex; align-items:center; gap:7px;
          padding:9px 28px; font-size:19px;
          background-image:
            linear-gradient(180deg, rgba(234,187,149,0.7) 0%, rgba(222,167,125,0.7) 55%, rgba(200,147,92,0.7) 100%),
            var(--skeu-hero);
          background-size:100% 100%, cover;
          background-position:center, center;
        }
        .gallery-load-more-btn::before { display:none; }
        [data-theme="dark"] .gallery-load-more-btn {
          background-image:
            linear-gradient(180deg, rgba(126,90,71,0.7) 0%, rgba(111,78,60,0.7) 55%, rgba(90,61,46,0.7) 100%),
            var(--skeu-hero);
          background-size:100% 100%, cover;
          background-position:center, center;
        }
      `}</style>
    </div>
  );
}
