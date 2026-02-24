import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicIcon from '../components/MusicIcon';
import { supabase } from '../lib/supabase';
import { getCoverImageSrc } from '../lib/media';
import { slugifyArtist, parseArtists } from '../lib/coverRoutes';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function artistPhotoUrl(artistName: string): string {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_artist_photos/${encodeURIComponent(artistName)}.jpg?width=400&height=400&resize=cover&quality=85`;
}

type ArtType = 'all' | 'fan' | 'official';

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
  const [search, setSearch] = useState('');
  const [artType, setArtType] = useState<ArtType>('all');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('covers_cafe_covers')
        .select('artist, id, storage_path, image_url, favorite_count, tags')
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
          const isOfficial = Boolean(row.tags?.includes('official'));
          entry.coverCount++;
          if (isOfficial) entry.officialCoverCount++;
          else entry.fanCoverCount++;
        }
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.coverCount - a.coverCount);
      setArtists(sorted);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return artists;
    const q = search.toLowerCase();
    return artists.filter((a) => {
      if (!a.name.toLowerCase().includes(q)) return false;
      if (artType === 'official') return a.officialCoverCount > 0;
      if (artType === 'fan') return a.fanCoverCount > 0;
      return true;
    });
  }, [artists, search, artType]);

  return (
    <div>
      <h1 className="section-title">
        <MusicIcon size={22} />
        Artists
      </h1>

      <div className="toolbar mb-4">
        <div className="ma-type-tabs" role="tablist" aria-label="Artist art type">
          <button role="tab" aria-selected={artType === 'all'} className={`ma-type-tab${artType === 'all' ? ' ma-type-tab--active' : ''}`} onClick={() => setArtType('all')}>All</button>
          <button role="tab" aria-selected={artType === 'fan'} className={`ma-type-tab${artType === 'fan' ? ' ma-type-tab--active' : ''}`} onClick={() => setArtType('fan')}>Fan Art</button>
          <button role="tab" aria-selected={artType === 'official'} className={`ma-type-tab${artType === 'official' ? ' ma-type-tab--active' : ''}`} onClick={() => setArtType('official')}>Album Art</button>
        </div>
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
              onClick={() => navigate(`/artists/${slugifyArtist(artist.name)}`, { state: { originalName: artist.name } })}
              title={`Browse covers by ${artist.name}`}
            >
              <ArtistCardImg artist={artist} />
              <div className="music-artist-info">
                <span className="music-artist-name">{artist.name}</span>
                <span className="music-artist-covers">{artType === 'official' ? artist.officialCoverCount : artType === 'fan' ? artist.fanCoverCount : artist.coverCount} cover{(artType === 'official' ? artist.officialCoverCount : artType === 'fan' ? artist.fanCoverCount : artist.coverCount) !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
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
