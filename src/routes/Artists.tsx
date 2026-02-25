import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import LoadingIcon from '../components/LoadingIcon';
import { supabase } from '../lib/supabase';
import { getAvatarSrc } from '../lib/media';
import { useAuth } from '../contexts/AuthContext';
import type { Profile } from '../lib/types';

interface ArtistRow extends Profile {
  cover_count: number;
}

export default function Artists() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('covers_cafe_profiles')
        .select('*, covers_cafe_covers!inner(id)')
        .order('username');

      const map = new Map<string, ArtistRow>();
      (data ?? []).forEach((row: Profile & { covers_cafe_covers?: { id: string }[] }) => {
        if (!map.has(row.id)) map.set(row.id, { ...row, cover_count: row.covers_cafe_covers?.length ?? 0 });
      });

      setArtists(Array.from(map.values()));
      setLoading(false);
    })();
  }, []);

  const filtered = artists.filter((a) =>
    !search || (a.display_name ?? a.username).toLowerCase().includes(search.toLowerCase())
  );

  // Pin the logged-in user first
  const sorted = user
    ? [
        ...filtered.filter((a) => a.id === user.id),
        ...filtered.filter((a) => a.id !== user.id),
      ]
    : filtered;

  return (
    <div>
      <h1 className="section-title">
        <UserIcon size={22} />
        Users
      </h1>

      <div className="toolbar mb-4">
        <input
          type="search"
          className="toolbar-search"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LoadingIcon size={16} className="gallery-spinner" /> Loading…</p>
      ) : !sorted.length ? (
        <p className="text-muted">No users found{search ? ` for "${search}"` : ''}.</p>
      ) : (
        <div className="artist-grid">
          {sorted.map((artist) => {
            const avatarSrc = getAvatarSrc(artist);
            const isMe = user?.id === artist.id;
            return (
              <button
                key={artist.id}
                className={`artist-card${isMe ? ' artist-card--me' : ''}`}
                onClick={() => navigate(`/users/${encodeURIComponent(artist.username)}`)}
                title={`View covers by ${artist.display_name ?? artist.username}`}
              >
                <div className="artist-avatar">
                  {avatarSrc
                    ? <img src={avatarSrc} alt={artist.display_name ?? artist.username} className="artist-avatar-img" loading="lazy" />
                    : <UserIcon size={28} style={{ opacity: 0.35 }} />
                  }
                </div>
                <div className="artist-info">
                  <span className="artist-name">
                    {artist.display_name ?? artist.username}
                    {isMe && <span className="artist-you-badge">you</span>}
                  </span>
                  <span className="artist-count">{artist.cover_count} cover{artist.cover_count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      
    </div>
  );
}
