import { useState, useEffect, useRef, useCallback } from 'react';
import BellIcon from './BellIcon';
import BellSleepIcon from './BellSleepIcon';
import FavoritesIcon from './FavoritesIcon';
import CommentIcon from './CommentIcon';
import XIcon from './XIcon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  type: 'favorite' | 'comment' | 'comment_like' | 'comment_reply';
  cover_id: string;
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

export default function NotificationBell() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user || !session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json() as { notifications: Notification[] };
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.read_at).length);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [user, session?.access_token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchNotifications, user]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark_read_all' }),
      });
    } catch { /* noop */ }
  }, [session?.access_token]);

  const handleOpen = () => {
    if (!open) {
      setOpen(true);
      setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
      void markAllRead();
    } else {
      setOpen(false);
    }
  };

  const dismiss = useCallback(async (id: string) => {
    if (!session?.access_token) return;
    const prior = notifications;
    const next = prior.filter((n) => n.id !== id);
    setNotifications(next);
    setUnreadCount(next.filter((n) => !n.read_at).length);

    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setNotifications(prior);
        setUnreadCount(prior.filter((n) => !n.read_at).length);
      }
    } catch {
      setNotifications(prior);
      setUnreadCount(prior.filter((n) => !n.read_at).length);
    }
  }, [notifications, session?.access_token]);

  if (!user) return null;

  return (
    <div className="notif-wrap">
      <button
        ref={buttonRef}
        className="btn btn-ghost notif-bell-btn"
        onClick={handleOpen}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`}
      >
        {unreadCount > 0 ? <BellIcon size={16} style={{ color: '#d4a020' }} /> : <BellSleepIcon size={16} />}
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" ref={panelRef}>
          <div className="notif-panel-header">
            <span className="notif-panel-title">
              Notifications
              {notifications.length > 0 && (
                <span className="notif-panel-count">{notifications.length}</span>
              )}
            </span>
            <button className="notif-close-btn" onClick={() => setOpen(false)} aria-label="Close">
              <XIcon size={14} />
            </button>
          </div>

          <div className="notif-list">
            {loading && notifications.length === 0 ? (
              <p className="notif-empty">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="notif-empty">No notifications yet. Upload some covers to get started!</p>
            ) : (
              notifications.map((n, idx) => {
                const isNew = !n.read_at;
                return (
                  <div key={n.id} className={`notif-item${isNew ? ' notif-item--new' : ''}`}>
                    <span className="notif-num">{idx + 1}</span>
                    <span className={`notif-icon ${(n.type === 'favorite' || n.type === 'comment_like') ? 'notif-icon--fav' : 'notif-icon--cmt'}`}>
                      {(n.type === 'favorite' || n.type === 'comment_like') ? <FavoritesIcon size={12} /> : <CommentIcon size={12} />}
                    </span>
                    <div className="notif-body">
                      <p className="notif-text">
                        <button
                          className="notif-user-link"
                          onClick={() => {
                            if (n.actor_username) navigate(`/users/${encodeURIComponent(n.actor_username)}`);
                            setOpen(false);
                          }}
                        >
                          {n.actor_name}
                        </button>{' '}
                        {n.type === 'favorite' && 'favorited'}
                        {n.type === 'comment' && 'commented on'}
                        {n.type === 'comment_like' && 'liked your comment on'}
                        {n.type === 'comment_reply' && 'replied to your comment on'}{' '}
                        <button className="notif-cover-link" onClick={() => { navigate(`/?open=${n.cover_id}`); setOpen(false); }}>
                          {n.cover_title}
                        </button>
                      </p>
                      {n.content && (
                        <p className="notif-comment-preview">"{n.content}{n.content.length >= 100 ? '…' : ''}"</p>
                      )}
                      {n.type === 'comment_reply' && (
                        <p className="notif-comment-preview">
                          <button className="notif-cover-link" onClick={() => { navigate(`/?open=${n.cover_id}`); setOpen(false); }}>
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
                );
              })
            )}
          </div>
        </div>
      )}

      
    </div>
  );
}
