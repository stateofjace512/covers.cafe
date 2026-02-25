import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import UserSleepIcon from '../components/UserSleepIcon';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarSrc } from '../lib/media';
import type { Profile } from '../lib/types';

type FriendProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export default function Friends() {
  const { user, session, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !session?.access_token) { setLoading(false); return; }
    let cancelled = false;
    fetch('/api/friends?userId=' + user.id, {
      headers: { Authorization: 'Bearer ' + session.access_token },
    })
      .then((r) => r.json())
      .then((d: { friends: FriendProfile[] }) => {
        if (!cancelled) { setFriends(d.friends ?? []); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, session?.access_token]);

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><UserIcon size={22} /> Friends</h1>
        <div className="empty-state card">
          <UserSleepIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">Sign in to see your friends</h2>
          <p className="empty-body">Add friends from any user's profile page.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
            <button className="btn btn-secondary" onClick={() => openAuthModal('register')}>Create Account</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="section-title"><UserIcon size={22} /> Friends</h1>
      {friends.length === 0 ? (
        <div className="empty-state card">
          <UserSleepIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">No friends yet</h2>
          <p className="empty-body">Visit a user's profile and click "Add Friend" to get started.</p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => navigate('/users')}>
            Browse Users
          </button>
        </div>
      ) : (
        <div className="friends-page-grid">
          {friends.map((f) => (
            <button
              key={f.id}
              className="friends-page-card card"
              onClick={() => navigate('/users/' + f.username)}
            >
              <div className="friends-page-avatar">
                {f.avatar_url
                  ? <img src={getAvatarSrc(f as Profile)!} alt={f.display_name ?? f.username} className="friends-page-avatar-img" loading="lazy" />
                  : <UserIcon size={32} style={{ opacity: 0.35 }} />
                }
              </div>
              <div className="friends-page-info">
                <span className="friends-page-name">{f.display_name ?? f.username}</span>
                {f.display_name && <span className="friends-page-username">@{f.username}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
