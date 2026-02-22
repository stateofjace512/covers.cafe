import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCoverImageSrc } from '../lib/media';

interface ArtistEntry {
  name: string;
  coverCount: number;
  sampleCover: { storage_path: string; image_url: string; thumbnail_path: string | null } | null;
}

export default function MusicArtists() {
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // Fetch all public covers with just the fields we need for grouping
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('artist, id, storage_path, image_url, thumbnail_path, favorite_count')
        .eq('is_public', true)
        .order('favorite_count', { ascending: false });

      // Group by artist name — first cover encountered becomes the sample (most favorited)
      const map = new Map<string, ArtistEntry>();
      for (const row of data ?? []) {
        const key = row.artist?.trim();
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, {
            name: key,
            coverCount: 0,
            sampleCover: {
              storage_path: row.storage_path,
              image_url: row.image_url,
              thumbnail_path: row.thumbnail_path,
            },
          });
        }
        map.get(key)!.coverCount++;
      }

      // Sort: most covers first
      const sorted = Array.from(map.values()).sort((a, b) => b.coverCount - a.coverCount);
      setArtists(sorted);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return artists;
    const q = search.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, search]);

  return (
    <div>
      <h1 className="section-title">
        <Music size={22} />
        Artists
      </h1>

      <div className="toolbar mb-4">
        <input
          type="search"
          className="music-artist-search"
          placeholder="Search artists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!loading && (
          <span className="music-artist-count-label">
            {filtered.length} artist{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-muted">No artists found{search ? ` for "${search}"` : ''}.</p>
      ) : (
        <div className="music-artist-grid">
          {filtered.map((artist) => (
            <button
              key={artist.name}
              className="music-artist-card"
              onClick={() => navigate(`/artists/${encodeURIComponent(artist.name)}`)}
              title={`Browse covers by ${artist.name}`}
            >
              <div className="music-artist-img-wrap">
                {artist.sampleCover ? (
                  <img
                    src={getCoverImageSrc(artist.sampleCover, 200)}
                    alt={artist.name}
                    className="music-artist-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="music-artist-img-placeholder">
                    <Music size={28} style={{ opacity: 0.3 }} />
                  </div>
                )}
              </div>
              <div className="music-artist-info">
                <span className="music-artist-name">{artist.name}</span>
                <span className="music-artist-covers">{artist.coverCount} cover{artist.coverCount !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .music-artist-search {
          padding: 7px 12px; border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 13px;
          box-shadow: var(--shadow-inset-sm); outline: none; width: 220px;
          font-family: Arial, Helvetica, sans-serif; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .music-artist-search:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .music-artist-count-label { font-size: 12px; color: var(--body-text-muted); font-weight: bold; }
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
        .music-artist-img-wrap {
          width: 100%; aspect-ratio: 1;
          background: var(--sidebar-bg);
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .music-artist-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .music-artist-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--body-text-muted); }
        .music-artist-info { padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
        .music-artist-name {
          font-size: 13px; font-weight: bold; color: var(--body-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .music-artist-name { text-shadow: none; }
        .music-artist-covers { font-size: 11px; color: var(--body-text-muted); }
      `}</style>
    </div>
  );
}
