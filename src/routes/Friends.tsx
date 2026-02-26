import { useEffect, useState, useCallback } from 'react';
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
  const [pendingReceived, setPendingReceived] = useState<FriendProfile[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchFriends = useCallback(() => {
    if (!user || !session?.access_token) { setLoading(false); return; }
    fetch('/api/friends?userId=' + user.id, {
      headers: { Authorization: 'Bearer ' + session.access_token },
    })
      .then((r) => r.json())
      .then((d: { friends: FriendProfile[]; pendingReceived?: FriendProfile[]; pendingSent?: FriendProfile[] }) => {
        setFriends(d.friends ?? []);
        setPendingReceived(d.pendingReceived ?? []);
        setPendingSent(d.pendingSent ?? []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleAction = useCallback(async (targetId: string, action: 'accept' | 'remove') => {
    if (!session?.access_token) return;
    setActionInProgress(targetId);
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: targetId, action }),
      });
      fetchFriends();
    } catch { /* noop */ }
    setActionInProgress(null);
  }, [session?.access_token, fetchFriends]);

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

  const isEmpty = friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0;

  return (
    <div>
      <h1 className="section-title"><UserIcon size={22} /> Friends</h1>

      {pendingReceived.length > 0 && (
        <div className="friend-requests-section">
          <h2 className="friend-requests-title">
            Friend Requests
            <span className="friend-requests-badge">{pendingReceived.length}</span>
          </h2>
          <div className="friend-requests-list">
            {pendingReceived.map((p) => (
              <div key={p.id} className="friend-request-item card">
                <button
                  className="friend-request-user"
                  onClick={() => navigate('/users/' + p.username)}
                >
                  <div className="friends-page-avatar">
                    {p.avatar_url
                      ? <img src={getAvatarSrc(p as Profile)!} alt={p.display_name ?? p.username} className="friends-page-avatar-img" loading="lazy" />
                      : <UserIcon size={28} style={{ opacity: 0.35 }} />
                    }
                  </div>
                  <div className="friends-page-info">
                    <span className="friends-page-name">{p.display_name ?? p.username}</span>
                    {p.display_name && <span className="friends-page-username">@{p.username}</span>}
                  </div>
                </button>
                <div className="friend-request-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={actionInProgress === p.id}
                    onClick={() => void handleAction(p.id, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={actionInProgress === p.id}
                    onClick={() => void handleAction(p.id, 'remove')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="friend-requests-section">
          <h2 className="friend-requests-title" style={{ color: 'var(--body-text-muted)' }}>
            Pending
            <span className="friend-requests-badge" style={{ background: 'var(--body-text-muted)' }}>{pendingSent.length}</span>
          </h2>
          <div className="friend-requests-list">
            {pendingSent.map((p) => (
              <div key={p.id} className="friend-request-item card">
                <button
                  className="friend-request-user"
                  onClick={() => navigate('/users/' + p.username)}
                >
                  <div className="friends-page-avatar">
                    {p.avatar_url
                      ? <img src={getAvatarSrc(p as Profile)!} alt={p.display_name ?? p.username} className="friends-page-avatar-img" loading="lazy" />
                      : <UserIcon size={28} style={{ opacity: 0.35 }} />
                    }
                  </div>
                  <div className="friends-page-info">
                    <span className="friends-page-name">{p.display_name ?? p.username}</span>
                    {p.display_name && <span className="friends-page-username">@{p.username}</span>}
                    <span className="friends-page-username">Request sent  -  awaiting response</span>
                  </div>
                </button>
                <div className="friend-request-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={actionInProgress === p.id}
                    onClick={() => void handleAction(p.id, 'remove')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="empty-state card">
          <UserSleepIcon size={48} style={{ opacity: 0.25, marginBottom: 14 }} />
          <h2 className="empty-title">No friends yet</h2>
          <p className="empty-body">Visit a user's profile and click "Add Friend" to get started.</p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => navigate('/users')}>
            Browse Users
          </button>
        </div>
      ) : friends.length > 0 ? (
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
      ) : null}
    </div>
  );
}
