import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicIcon from '../components/MusicIcon';
import LoadingIcon from '../components/LoadingIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCoverImageSrc } from '../lib/media';
import { slugifyArtist, parseArtists, splitAndResolveOfficialArtist } from '../lib/coverRoutes';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function artistPhotoUrl(artistName: string): string {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_artist_photos/${encodeURIComponent(artistName)}.jpg?width=400&height=400&resize=cover&quality=85`;
}

type ArtType = 'fan' | 'official';

interface ArtistEntry {
  name: string;
  coverCount: number;
  officialCoverCount: number;
  fanCoverCount: number;
  sampleCover: { storage_path: string; image_url: string } | null;
}

function ArtistCardImg({ artist }: { artist: ArtistEntry }) {
  const [src, setSrc] = useState(() => artistPhotoUrl(artist.name));

  return (
    <div className="music-artist-img-wrap">
      {src ? (
        <img
          src={src}
          alt={artist.name}
          className="music-artist-img"
          loading="lazy"
          onError={() => {
            if (artist.sampleCover) setSrc(getCoverImageSrc(artist.sampleCover, 200));
            else setSrc('');
          }}
        />
      ) : (
        <div className="music-artist-img-placeholder">
          <MusicIcon size={28} style={{ opacity: 0.3 }} />
        </div>
      )}
    </div>
  );
}

export default function MusicArtists() {
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [officialArtists, setOfficialArtists] = useState<ArtistEntry[]>([]);
  const [officialLoading, setOfficialLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [artType, setArtType] = useState<ArtType>('fan');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [mergeCanonical, setMergeCanonical] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [undoSnapshot, setUndoSnapshot] = useState<{ records: { album_cover_url: string; artist_name: string }[]; aliases: string[] } | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('artist, id, storage_path, image_url, favorite_count')
        .eq('is_public', true)
        .order('favorite_count', { ascending: false });

      const map = new Map<string, ArtistEntry>();
      for (const row of data ?? []) {
        const names = parseArtists(row.artist?.trim() ?? '');
        for (const name of names) {
          if (!name) continue;
          if (!map.has(name)) {
            map.set(name, {
              name,
              coverCount: 0,
              officialCoverCount: 0,
              fanCoverCount: 0,
              sampleCover: { storage_path: row.storage_path, image_url: row.image_url },
            });
          }
          const entry = map.get(name)!;
          entry.coverCount++;
          entry.fanCoverCount++;
        }
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.fanCoverCount - a.fanCoverCount);
      setArtists(sorted);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      // Load official covers and alias mappings concurrently.
      const [{ data: coversData }, { data: aliasData }] = await Promise.all([
        supabase.from('covers_cafe_official_covers').select('artist_name, album_cover_url').limit(50000),
        supabase.from('covers_cafe_artist_aliases').select('alias, canonical'),
      ]);

      // Build alias lookup: alias → canonical (e.g. "テイラー・スウィフト" → "Taylor Swift").
      const aliasMap: Record<string, string> = {};
      for (const row of aliasData ?? []) {
        if (row.alias && row.canonical) aliasMap[row.alias] = row.canonical;
      }

      const map = new Map<string, ArtistEntry>();
      for (const row of coversData ?? []) {
        // Split compound names ("テイラー・スウィフト & ILLENIUM") and resolve each token via
        // aliases so co-artists are never merged into each other.
        const names = splitAndResolveOfficialArtist(row.artist_name?.trim() ?? '', aliasMap);
        for (const name of names) {
          if (!name) continue;
          if (!map.has(name)) {
            map.set(name, {
              name,
              coverCount: 0,
              officialCoverCount: 0,
              fanCoverCount: 0,
              sampleCover: { storage_path: '', image_url: row.album_cover_url },
            });
          }
          const entry = map.get(name)!;
          entry.coverCount++;
          entry.officialCoverCount++;
        }
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.officialCoverCount - a.officialCoverCount);
      setOfficialArtists(sorted);
      setOfficialLoading(false);
    })();
  }, []);

  const startUndoCountdown = useCallback((records: { album_cover_url: string; artist_name: string }[], aliases: string[]) => {
    setUndoSnapshot({ records, aliases });
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
    setMergeError('');
    const canonical = mergeCanonical.trim();
    // Fetch all covers for selected artists to build undo snapshot
    const { data: snapData } = await supabase
      .from('covers_cafe_official_covers')
      .select('album_cover_url, artist_name')
      .in('artist_name', Array.from(selectedArtists))
      .limit(50000);
    const snapshot = (snapData ?? []).map((r) => ({ album_cover_url: r.album_cover_url as string, artist_name: (r.artist_name ?? '') as string }));
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
      setOfficialArtists((prev) => {
        const mergedCount = prev.filter((a) => selectedArtists.has(a.name)).reduce((s, a) => s + a.officialCoverCount, 0);
        const sampleCover = prev.find((a) => selectedArtists.has(a.name) && a.sampleCover?.image_url)?.sampleCover ?? null;
        const existing = prev.find((a) => a.name === canonical);
        const canonicalEntry: ArtistEntry = {
          name: canonical,
          coverCount: (existing?.coverCount ?? 0) + mergedCount,
          officialCoverCount: (existing?.officialCoverCount ?? 0) + mergedCount,
          fanCoverCount: existing?.fanCoverCount ?? 0,
          sampleCover: existing?.sampleCover ?? sampleCover,
        };
        return [canonicalEntry, ...prev.filter((a) => !selectedArtists.has(a.name) && a.name !== canonical)];
      });
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
    // Re-fetch covers and aliases to get accurate state after undo.
    const [{ data: coversData }, { data: aliasData }] = await Promise.all([
      supabase.from('covers_cafe_official_covers').select('artist_name, album_cover_url').limit(50000),
      supabase.from('covers_cafe_artist_aliases').select('alias, canonical'),
    ]);
    const aliasMap: Record<string, string> = {};
    for (const row of aliasData ?? []) {
      if (row.alias && row.canonical) aliasMap[row.alias] = row.canonical;
    }
    const map = new Map<string, ArtistEntry>();
    for (const row of coversData ?? []) {
      const names = splitAndResolveOfficialArtist((row.artist_name as string | null)?.trim() ?? '', aliasMap);
      for (const name of names) {
        if (!name) continue;
        if (!map.has(name)) map.set(name, { name, coverCount: 0, officialCoverCount: 0, fanCoverCount: 0, sampleCover: { storage_path: '', image_url: row.album_cover_url as string } });
        map.get(name)!.coverCount++;
        map.get(name)!.officialCoverCount++;
      }
    }
    setOfficialArtists(Array.from(map.values()).sort((a, b) => b.officialCoverCount - a.officialCoverCount));
  };

  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const isLoading = artType === 'official' ? officialLoading : loading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = artType === 'official' ? officialArtists : artists;
    return source.filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [artists, officialArtists, search, artType]);

  return (
    <div>
      <h1 className="section-title">
        <MusicIcon size={22} />
        Artists
      </h1>

      <div className="toolbar mb-4">
        <div className="ma-type-tabs" role="tablist" aria-label="Artist art type">
          <button role="tab" aria-selected={artType === 'fan'} className={`ma-type-tab${artType === 'fan' ? ' ma-type-tab--active' : ''}`} onClick={() => { setArtType('fan'); setSelectMode(false); setSelectedArtists(new Set()); }}>Fan Art</button>
          <button role="tab" aria-selected={artType === 'official'} className={`ma-type-tab${artType === 'official' ? ' ma-type-tab--active' : ''}`} onClick={() => setArtType('official')}>Album Art</button>
        </div>
        <input
          type="search"
          className="music-artist-search"
          placeholder="Search artists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!isLoading && (
          <span className="music-artist-count-label">
            {filtered.length} artist{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        {artType === 'official' && !isLoading && filtered.length > 0 && (
          <button
            className={`ma-select-btn${selectMode ? ' ma-select-btn--active' : ''}`}
            onClick={() => { setSelectMode((v) => !v); setSelectedArtists(new Set()); setMergeCanonical(''); }}
          >Select</button>
        )}
      </div>

      {undoSnapshot && undoCountdown > 0 && (
        <div className="ma-undo-toast">
          <span>Artists merged.</span>
          <button className="ma-undo-btn" onClick={handleUndo}>Undo</button>
          <span className="ma-undo-countdown">{undoCountdown}</span>
        </div>
      )}

      {selectMode && selectedArtists.size >= 2 && (
        <div className="ma-merge-bar">
          <span className="ma-merge-label">{selectedArtists.size} artists selected</span>
          <input
            className="ma-merge-input"
            placeholder="Canonical artist name…"
            value={mergeCanonical}
            onChange={(e) => { setMergeCanonical(e.target.value); setMergeError(''); }}
          />
          <button className="btn btn-primary ma-merge-confirm" onClick={handleMerge} disabled={merging || !mergeCanonical.trim()}>
            {merging ? <><LoadingIcon size={13} className="ma-list-spinner" /> Merging…</> : 'Merge'}
          </button>
          {mergeError && <span className="ma-merge-error">{mergeError}</span>}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-muted">No artists found{search ? ` for "${search}"` : ''}.</p>
      ) : (
        <div className="music-artist-grid">
          {filtered.map((artist) => {
            const isSelected = selectedArtists.has(artist.name);
            const count = artType === 'official' ? artist.officialCoverCount : artist.fanCoverCount;
            return (
              <button
                key={artist.name}
                className={`music-artist-card${isSelected ? ' music-artist-card--selected' : ''}`}
                onClick={() => {
                  if (selectMode && artType === 'official') { toggleArtist(artist.name); return; }
                  navigate(`/artists/${slugifyArtist(artist.name)}`, { state: { originalName: artist.name, startTab: artType } });
                }}
                title={selectMode ? `Select ${artist.name}` : `Browse covers by ${artist.name}`}
              >
                <div style={{ position: 'relative' }}>
                  <ArtistCardImg artist={artist} />
                  {selectMode && artType === 'official' && (
                    <div className={`ma-artist-check${isSelected ? ' ma-artist-check--on' : ''}`}>
                      {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  )}
                </div>
                <div className="music-artist-info">
                  <span className="music-artist-name">{artist.name}</span>
                  <span className="music-artist-covers">{count} cover{count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .music-artist-search {
          padding: 7px 12px; border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 19px;
          box-shadow: var(--shadow-inset-sm); outline: none; width: 220px;
          font-family: var(--font-body); transition: border-color 0.15s, box-shadow 0.15s;
        }
        .music-artist-search:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .music-artist-count-label { font-size: 18px; color: var(--body-text-muted); }
        .ma-type-tabs { display: inline-flex; gap: 6px; }
        .ma-type-tab { border: 1px solid var(--body-card-border); background: var(--body-card-bg); color: var(--body-text-muted); border-radius: 999px; padding: 4px 10px; font-size: 14px; }
        .ma-type-tab--active { background: var(--accent); border-color: var(--accent); color: white; }
        .music-artist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 14px;
        }
        .music-artist-card {
          display: flex; flex-direction: column; gap: 0;
          cursor: pointer; text-align: left; width: 100%;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 6px; overflow: hidden;
          box-shadow: var(--shadow-md);
          transition: box-shadow 0.15s, transform 0.15s;
          padding: 0;
        }
        .music-artist-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .music-artist-card--selected { outline: 3px solid var(--accent); outline-offset: -2px; }
        .ma-select-btn { border: 1px solid var(--body-card-border); border-radius: 6px; background: var(--body-card-bg); color: var(--body-text-muted); padding: 5px 14px; font-size: 14px; cursor: pointer; font-family: var(--font-body); }
        .ma-select-btn--active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .ma-merge-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; background: var(--body-card-bg); border: 1px solid var(--body-card-border); }
        .ma-merge-label { font-size: 15px; color: var(--body-text-muted); flex-shrink: 0; }
        .ma-merge-input { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--body-card-border); background: var(--sidebar-bg); color: var(--body-text); font-size: 15px; font-family: var(--font-body); flex: 1; min-width: 180px; }
        .ma-merge-confirm { font-size: 14px; padding: 6px 18px; }
        .ma-merge-error { font-size: 13px; color: #f87171; flex-basis: 100%; margin-top: 4px; }
        .ma-undo-toast { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px 16px; border-radius: 8px; background: var(--body-card-bg); border: 1px solid var(--body-card-border); font-size: 14px; }
        .ma-undo-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 4px 14px; font-size: 13px; cursor: pointer; font-family: var(--font-body); }
        .ma-undo-countdown { color: var(--body-text-muted); font-size: 13px; margin-left: auto; }
        .ma-artist-check { position: absolute; left: 8px; top: 8px; width: 20px; height: 20px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.7); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .ma-artist-check--on { background: var(--accent); border-color: var(--accent); }
        .ma-list-spinner { animation: ma-spin 0.8s linear infinite; }
        @keyframes ma-spin { to { transform: rotate(360deg); } }
        .music-artist-img-wrap {
          width: 100%; aspect-ratio: 1;
          background: var(--sidebar-bg);
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .music-artist-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .music-artist-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--body-text-muted); }
        .music-artist-info {
          padding: 10px 12px; display: flex; flex-direction: column; gap: 3px;
          background-image:
            linear-gradient(var(--skeu-card-tint), var(--skeu-card-tint)),
            var(--skeu-card);
          background-size: 100% 100%, 100% 100%;
          background-position: 0 0, 0 0;
          background-repeat: no-repeat, no-repeat;
          background-attachment: local, local;
        }
        .music-artist-name {
          font-size: 25px; color: var(--body-text);
          font-family: var(--font-header);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        [data-theme="dark"] .music-artist-name { }
        .music-artist-covers { font-size: 20px; color: var(--body-text-muted); font-family: var(--font-body); }
      `}</style>
    </div>
  );
}
