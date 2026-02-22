import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserRound, ArrowLeft, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import GalleryGrid from '../components/GalleryGrid';
import type { Profile } from '../lib/types';

export default function ArtistDetail() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coverCount, setCoverCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data } = await supabase
        .from('covers_cafe_profiles')
        .select('*')
        .eq('username', decodeURIComponent(username))
        .single();

      if (!data) { setNotFound(true); setLoading(false); return; }
      setProfile(data);

      const { count } = await supabase
        .from('covers_cafe_covers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', data.id)
        .eq('is_public', true);
      setCoverCount(count ?? 0);
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (notFound) return (
    <div>
      <button className="btn btn-secondary" style={{ marginBottom: 20 }} onClick={() => navigate('/artists')}>
        <ArrowLeft size={14} /> Back to Artists
      </button>
      <p className="text-muted">Artist not found.</p>
    </div>
  );

  const isOwnProfile = user?.id === profile?.id;

  return (
    <div>
      <button className="btn btn-secondary artist-back-btn" onClick={() => navigate('/artists')}>
        <ArrowLeft size={14} /> All Artists
      </button>

      <div className="artist-detail-header card">
        <div className="artist-detail-avatar">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.display_name ?? profile.username} className="artist-detail-avatar-img" />
            : <UserRound size={40} style={{ opacity: 0.3 }} />
          }
        </div>
        <div className="artist-detail-info">
          <h1 className="artist-detail-name">
            {profile?.display_name ?? profile?.username}
            {isOwnProfile && <span className="artist-detail-you">you</span>}
          </h1>
          {profile?.display_name && (
            <p className="artist-detail-username">@{profile.username}</p>
          )}
          {profile?.bio && <p className="artist-detail-bio">{profile.bio}</p>}
          {profile?.website && (
            <a
              href={profile.website}
              className="artist-detail-website"
              target="_blank"
              rel="noopener noreferrer"
            >
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <p className="artist-detail-count">
            {coverCount} cover{coverCount !== 1 ? 's' : ''} uploaded
          </p>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 className="section-title">
          <Image size={18} />
          Covers by {profile?.display_name ?? profile?.username}
        </h2>
        {profile && <GalleryGrid filter="artist" artistUserId={profile.id} />}
      </section>

      <style>{`
        .artist-back-btn { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
        .artist-detail-header {
          display: flex; align-items: flex-start; gap: 20px;
          padding: 24px;
        }
        .artist-detail-avatar {
          width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 2px solid var(--body-card-border);
          box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--body-text-muted); overflow: hidden;
        }
        .artist-detail-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .artist-detail-info { display: flex; flex-direction: column; gap: 5px; }
        .artist-detail-name {
          font-size: 22px; font-weight: bold; color: var(--body-text);
          display: flex; align-items: center; gap: 10px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        [data-theme="dark"] .artist-detail-name { text-shadow: none; }
        .artist-detail-you {
          font-size: 11px; font-weight: bold; background: var(--accent);
          color: white; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.3px;
        }
        .artist-detail-username { font-size: 13px; color: var(--body-text-muted); }
        .artist-detail-bio { font-size: 14px; color: var(--body-text); max-width: 480px; line-height: 1.5; }
        .artist-detail-website { font-size: 13px; color: var(--accent); text-decoration: none; }
        .artist-detail-website:hover { text-decoration: underline; }
        .artist-detail-count { font-size: 13px; color: var(--body-text-muted); margin-top: 4px; }
      `}</style>
    </div>
  );
}
