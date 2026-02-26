import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BellIcon from '../components/BellIcon';
import FavoritesIcon from '../components/FavoritesIcon';
import CommentIcon from '../components/CommentIcon';
import XIcon from '../components/XIcon';
import GalleryIcon from '../components/GalleryIcon';
import UserIcon from '../components/UserIcon';

const ACHIEVEMENT_LABELS: Record<string, string> = {
  acotw: 'Album Cover of the Week',
  poh: 'Picture of the Hour',
  milestone_1: 'First Upload',
  milestone_50: '50 Uploads',
  milestone_100: '100 Uploads',
  certified_loner: 'Certified Loner',
};

interface Notification {
  id: string;
  type: 'favorite' | 'comment' | 'comment_like' | 'comment_reply' | 'cover_removed' | 'friend_posted' | 'new_follower' | 'friend_request' | 'achievement';
  cover_id: string | null;
  cover_title: string;
  cover_artist: string;
  actor_name: string;
  actor_username: string | null;
  content: string | null;
  created_at: string;
  read_at: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Notifications() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !session?.access_token) { setLoading(false); return; }
    const token = session.access_token;
    setLoading(true);
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { notifications: Notification[] }) => {
        const now = new Date().toISOString();
        const items = (data.notifications ?? []).map((n) => n.read_at ? n : { ...n, read_at: now });
        setNotifications(items);
        if (items.some((n) => !n.read_at)) {
          void fetch('/api/notifications', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read_all' }),
          });
        }
      })
      .catch(() => { /* noop */ })
      .finally(() => { setLoading(false); });
  }, [user?.id, session?.access_token]);

  const dismiss = useCallback(async (id: string) => {
    if (!session?.access_token) return;
    const prior = notifications;
    setNotifications(prior.filter((n) => n.id !== id));
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setNotifications(prior);
    } catch {
      setNotifications(prior);
    }
  }, [notifications, session?.access_token]);

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><BellIcon size={18} /> Notifications</h1>
        <div className="card" style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--body-text-muted)' }}>Sign in to see your notifications.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title">
        <BellIcon size={18} /> Notifications
        {notifications.length > 0 && (
          <span style={{ fontWeight: 'normal', color: 'var(--body-text-muted)', fontSize: 11, marginLeft: 2 }}>
            ({notifications.length})
          </span>
        )}
      </h1>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--body-text-muted)' }}>Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--body-text-muted)' }}>No notifications yet. Upload some covers to get started!</p>
        </div>
      ) : (
        <div className="card notif-page-list">
          {notifications.map((n, idx) => (
            <div key={n.id} className={`notif-item notif-item--page${!n.read_at ? ' notif-item--new' : ''}`}>
              <span className="notif-num">{idx + 1}</span>
              <span className={`notif-icon ${
                n.type === 'cover_removed' ? 'notif-icon--removed'
                : (n.type === 'new_follower' || n.type === 'friend_request') ? 'notif-icon--follow'
                : n.type === 'friend_posted' ? 'notif-icon--friend'
                : n.type === 'achievement' ? 'notif-icon--achievement'
                : (n.type === 'favorite' || n.type === 'comment_like') ? 'notif-icon--fav'
                : 'notif-icon--cmt'
              }`}>
                {n.type === 'cover_removed' ? <XIcon size={13} />
                  : (n.type === 'new_follower' || n.type === 'friend_request') ? <UserIcon size={13} />
                  : n.type === 'friend_posted' ? <GalleryIcon size={13} />
                  : n.type === 'achievement' ? <span style={{ fontSize: 13 }}>🏆</span>
                  : (n.type === 'favorite' || n.type === 'comment_like') ? <FavoritesIcon size={13} />
                  : <CommentIcon size={13} />}
              </span>
              <div className="notif-body">
                {n.type === 'cover_removed' ? (
                  <p className="notif-text">
                    {n.cover_id ? (
                      <>Your upload{' '}<button className="notif-cover-link" onClick={() => navigate(`/?open=${n.cover_id}`)}>{n.cover_title}</button>{' '}has</>
                    ) : (
                      <><strong>{n.cover_title}</strong> have</>
                    )}{' '}been removed for the following reason(s): <strong>{n.content}</strong>
                  </p>
                ) : n.type === 'new_follower' ? (
                  <p className="notif-text">
                    <button className="notif-user-link" onClick={() => { if (n.actor_username) navigate(`/users/${encodeURIComponent(n.actor_username)}`); }}>
                      {n.actor_name}
                    </button>{' '}started following you
                  </p>
                ) : n.type === 'friend_request' ? (
                  <p className="notif-text">
                    <button className="notif-user-link" onClick={() => { if (n.actor_username) navigate(`/users/${encodeURIComponent(n.actor_username)}`); }}>
                      {n.actor_name}
                    </button>{' '}sent you a friend request —{' '}
                    <button className="notif-cover-link" onClick={() => navigate('/friends')}>
                      view requests
                    </button>
                  </p>
                ) : n.type === 'friend_posted' ? (
                  <p className="notif-text">
                    <button className="notif-user-link" onClick={() => { if (n.actor_username) navigate(`/users/${encodeURIComponent(n.actor_username)}`); }}>
                      {n.actor_name}
                    </button>{' '}posted{' '}
                    <button className="notif-cover-link" onClick={() => navigate(`/?open=${n.cover_id}`)}>
                      {n.cover_title}
                    </button>
                    {n.cover_artist && <> by {n.cover_artist}</>}
                  </p>
                ) : n.type === 'achievement' ? (
                  <p className="notif-text">
                    You earned an achievement:{' '}
                    <strong>{ACHIEVEMENT_LABELS[n.content ?? ''] ?? n.content}</strong>
                  </p>
                ) : (
                  <p className="notif-text">
                    <button
                      className="notif-user-link"
                      onClick={() => { if (n.actor_username) navigate(`/users/${encodeURIComponent(n.actor_username)}`); }}
                    >
                      {n.actor_name}
                    </button>{' '}
                    {n.type === 'favorite' && 'favorited'}
                    {n.type === 'comment' && 'commented on'}
                    {n.type === 'comment_like' && 'liked your comment on'}
                    {n.type === 'comment_reply' && 'replied to your comment on'}{' '}
                    <button className="notif-cover-link" onClick={() => navigate(`/?open=${n.cover_id}`)}>
                      {n.cover_title}
                    </button>
                  </p>
                )}
                {n.content && (n.type === 'comment' || n.type === 'comment_like' || n.type === 'comment_reply') && (
                  <p className="notif-comment-preview">"{n.content}{n.content.length >= 100 ? '…' : ''}"</p>
                )}
                {n.type === 'comment_reply' && (
                  <p className="notif-comment-preview">
                    <button className="notif-cover-link" onClick={() => navigate(`/?open=${n.cover_id}`)}>
                      View thread
                    </button>
                  </p>
                )}
                <span className="notif-time">{timeAgo(n.created_at)}</span>
              </div>
              <button
                className="notif-dismiss-btn"
                onClick={() => void dismiss(n.id)}
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                <XIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
