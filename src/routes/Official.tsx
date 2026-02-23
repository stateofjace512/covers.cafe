import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicIcon from '../components/MusicIcon';
import { slugifyArtist } from '../lib/coverRoutes';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function artistPhotoUrl(artistName: string): string {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_artist_photos/${encodeURIComponent(artistName)}.jpg?width=400&height=400&resize=cover&quality=85`;
}

interface OfficialCover {
  id: string;
  artist_name: string;
  artist_slug: string;
  album_title: string;
  release_year: string | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  country: string;
}

interface ArtistGroup {
  name: string;
  slug: string;
  covers: OfficialCover[];
  photoUrl: string;
}

function ArtistCardImg({ group }: { group: ArtistGroup }) {
  const [src, setSrc] = useState(group.photoUrl);

  return (
    <div className="oa-artist-img-wrap">
      {src ? (
        <img
          src={src}
          alt={group.name}
          className="oa-artist-img"
          loading="lazy"
          onError={() => {
            const first = group.covers[0];
            setSrc(first ? first.album_cover_url : '');
          }}
        />
      ) : (
        <div className="oa-artist-img-placeholder">
          <MusicIcon size={28} style={{ opacity: 0.3 }} />
        </div>
      )}
    </div>
  );
}

interface AlbumModalProps {
  group: ArtistGroup;
  onClose: () => void;
  onNavigateArtist: (slug: string, name: string) => void;
}

function AlbumModal({ group, onClose, onNavigateArtist }: AlbumModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="oa-modal-backdrop" onClick={onClose}>
      <div className="oa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="oa-modal-header">
          <h2 className="oa-modal-title">{group.name}</h2>
          <div className="oa-modal-header-actions">
            <button
              className="btn btn-secondary oa-modal-artist-link"
              onClick={() => onNavigateArtist(group.slug, group.name)}
              title={`Browse community covers for ${group.name}`}
            >
              Community covers &rsaquo;
            </button>
            <button className="oa-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="oa-album-grid">
          {group.covers.map((cover) => (
            <a
              key={cover.id}
              href={cover.album_cover_url}
              target="_blank"
              rel="noopener noreferrer"
              className="oa-album-card"
              title={`${cover.album_title}${cover.release_year ? ` (${cover.release_year})` : ''}`}
            >
              <div className="oa-album-img-wrap">
                <img
                  src={cover.album_cover_url}
                  alt={cover.album_title}
                  className="oa-album-img"
                  loading="lazy"
                />
              </div>
              <div className="oa-album-info">
                <span className="oa-album-title">{cover.album_title}</span>
                {cover.release_year && (
                  <span className="oa-album-year">{cover.release_year}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Official() {
  const [covers, setCovers] = useState<OfficialCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<ArtistGroup | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/official-covers');
      if (res.ok) {
        const data = await res.json() as { covers: OfficialCover[] };
        setCovers(data.covers ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const artistGroups = useMemo(() => {
    const map = new Map<string, ArtistGroup>();
    for (const cover of covers) {
      const key = cover.artist_slug;
      if (!map.has(key)) {
        map.set(key, {
          name: cover.artist_name,
          slug: cover.artist_slug,
          covers: [],
          photoUrl: artistPhotoUrl(cover.artist_name),
        });
      }
      map.get(key)!.covers.push(cover);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [covers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return artistGroups;
    const q = search.toLowerCase();
    return artistGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.covers.some((c) => c.album_title.toLowerCase().includes(q)),
    );
  }, [artistGroups, search]);

  const handleNavigateArtist = (slug: string, name: string) => {
    setSelectedGroup(null);
    navigate(`/artists/${slug}`, { state: { originalName: name } });
  };

  return (
    <div>
      <h1 className="section-title">
        <MusicIcon size={22} />
        Official
      </h1>
      <p className="oa-subtitle">
        Official album artwork sourced from Apple Music / iTunes.
      </p>

      <div className="toolbar mb-4">
        <input
          type="search"
          className="music-artist-search"
          placeholder="Search artists or albums…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!loading && (
          <span className="music-artist-count-label">
            {filtered.length} artist{filtered.length !== 1 ? 's' : ''}
            {filtered.length > 0 && (
              <> &middot; {filtered.reduce((s, g) => s + g.covers.length, 0)} album{filtered.reduce((s, g) => s + g.covers.length, 0) !== 1 ? 's' : ''}</>
            )}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-muted">
          {search ? `No results for "${search}".` : 'No official covers yet.'}
        </p>
      ) : (
        <div className="music-artist-grid">
          {filtered.map((group) => (
            <button
              key={group.slug}
              className="music-artist-card"
              onClick={() => setSelectedGroup(group)}
              title={`View official albums by ${group.name}`}
            >
              <ArtistCardImg group={group} />
              <div className="music-artist-info">
                <span className="music-artist-name">{group.name}</span>
                <span className="music-artist-covers">
                  {group.covers.length} album{group.covers.length !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedGroup && (
        <AlbumModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onNavigateArtist={handleNavigateArtist}
        />
      )}

      <style>{`
        .oa-subtitle { font-size: 19px; color: var(--body-text-muted); margin: -4px 0 20px; }
        .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .music-artist-search {
          padding: 7px 12px; border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 19px;
          box-shadow: var(--shadow-inset-sm); outline: none; width: 260px;
          font-family: var(--font-body); transition: border-color 0.15s, box-shadow 0.15s;
        }
        .music-artist-search:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .music-artist-count-label { font-size: 18px; color: var(--body-text-muted); }
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
        .oa-artist-img-wrap {
          width: 100%; aspect-ratio: 1;
          background: var(--sidebar-bg);
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .oa-artist-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .oa-artist-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--body-text-muted); }
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
        .music-artist-covers { font-size: 20px; color: var(--body-text-muted); font-family: var(--font-body); }

        /* ── Album modal ─────────────────────────────────────────────── */
        .oa-modal-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 40px 16px 16px;
          overflow-y: auto;
        }
        .oa-modal {
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 10px; width: 100%; max-width: 760px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.4);
          padding: 24px;
        }
        .oa-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
        }
        .oa-modal-title { font-size: 26px; margin: 0; color: var(--body-text); font-family: var(--font-header); }
        .oa-modal-header-actions { display: flex; align-items: center; gap: 8px; }
        .oa-modal-artist-link { font-size: 18px; padding: 5px 12px; }
        .oa-modal-close {
          background: none; border: 1px solid var(--body-card-border);
          border-radius: 50%; width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--body-text-muted);
          font-size: 14px; flex-shrink: 0;
          transition: background 0.1s, color 0.1s;
        }
        .oa-modal-close:hover { background: var(--body-card-border); color: var(--body-text); transform: none; box-shadow: none; }
        .oa-album-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 14px;
        }
        .oa-album-card {
          display: flex; flex-direction: column; gap: 0;
          text-decoration: none; border-radius: 6px; overflow: hidden;
          border: 1px solid var(--body-card-border);
          background: var(--body-card-bg);
          box-shadow: var(--shadow-md);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .oa-album-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .oa-album-img-wrap {
          width: 100%; aspect-ratio: 1;
          background: var(--sidebar-bg); overflow: hidden;
        }
        .oa-album-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .oa-album-info {
          padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;
        }
        .oa-album-title {
          font-size: 20px; color: var(--body-text);
          font-family: var(--font-header);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .oa-album-year { font-size: 17px; color: var(--body-text-muted); font-family: var(--font-body); }
      `}</style>
    </div>
  );
}
