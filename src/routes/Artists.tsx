import { useState, useEffect } from 'react';
import { UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface ArtistRow extends Profile {
  cover_count: number;
}

export default function Artists() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      // Fetch profiles that have at least one public cover, with count
      const { data } = await supabase
        .from('covers_cafe_profiles')
        .select('*, covers_cafe_covers!inner(id)')
        .order('username');
      // Aggregate counts
      const map = new Map<string, ArtistRow>();
      (data ?? []).forEach((row: Profile & { covers_cafe_covers: { id: string }[] }) => {
        if (!map.has(row.id)) {
          map.set(row.id, { ...row, cover_count: row.covers_cafe_covers?.length ?? 0 });
        }
      });
      setArtists(Array.from(map.values()));
      setLoading(false);
    })();
  }, []);

  const filtered = artists.filter((a) =>
    !search || (a.display_name ?? a.username).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="section-title">
        <UserRound size={22} />
        Artists
      </h1>

      <div className="toolbar mb-4">
        <input
          type="search"
          className="toolbar-search"
          placeholder="Search artists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-muted">No artists found{search ? ` for "${search}"` : ''}.</p>
      ) : (
        <div className="artist-grid">
          {filtered.map((artist) => (
            <div key={artist.id} className="artist-card">
              <div className="artist-avatar">
                {artist.avatar_url
                  ? <img src={artist.avatar_url} alt={artist.display_name ?? artist.username} className="artist-avatar-img" />
                  : <UserRound size={28} style={{ opacity: 0.35 }} />
                }
              </div>
              <div className="artist-info">
                <span className="artist-name">{artist.display_name ?? artist.username}</span>
                <span className="artist-count">{artist.cover_count} cover{artist.cover_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .toolbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .toolbar-search {
          padding: 7px 12px; border-radius: 4px; border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text); font-size: 13px;
          box-shadow: var(--shadow-inset-sm); outline: none; width: 220px;
          font-family: Arial, Helvetica, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .toolbar-search:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .artist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
        .artist-card {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 22px 16px;
          background: var(--body-card-bg); border: 1px solid var(--body-card-border);
          border-radius: 6px;
          box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.4);
          background-image: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 40%);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .artist-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .artist-avatar {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 2px solid var(--body-card-border);
          box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--body-text-muted); overflow: hidden;
        }
        .artist-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .artist-info { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .artist-name {
          font-size: 14px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4); text-align: center;
        }
        [data-theme="dark"] .artist-name { text-shadow: none; }
        .artist-count { font-size: 11px; color: var(--body-text-muted); }
      `}</style>
    </div>
  );
}
