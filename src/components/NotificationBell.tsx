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

      <style>{`
        .notif-wrap { position: relative; }
        .notif-bell-btn { position: relative; padding: 2px 6px; height: 26px; }
        /* Win95 flat counter badge, no rounding */
        .notif-badge {
          position: absolute; top: 1px; right: 1px;
          background: #800000; color: #ffffff;
          font-size: 10px; padding: 0 3px; min-width: 12px;
          text-align: center; line-height: 1.4;
          border: 1px solid #400000; font-weight: bold;
        }
        /* Win95 popup panel: raised border, no border-radius, no shadow */
        .notif-panel {
          position: absolute; top: calc(100% + 4px); right: 0;
          width: 300px;
          max-height: min(420px, calc(100vh - var(--header-h) - 12px));
          background: #dea77d;
          border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          box-shadow: none; z-index: 200;
          display: flex; flex-direction: column; overflow: hidden;
        }
        [data-theme="dark"] .notif-panel { background: #3d1a05; border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f; }
        /* Win95 title bar */
        .notif-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 3px 4px; height: 22px; flex-shrink: 0;
          background: linear-gradient(90deg, #5a3620 0%, #73492a 35%, #8a5a35 100%);
        }
        .notif-panel-title { font-size: 11px; font-weight: bold; color: #ffffff; display: flex; align-items: center; gap: 5px; }
        .notif-panel-count { font-size: 10px; background: #ffffff; color: #73492a; padding: 0 4px; line-height: 1.4; font-weight: bold; }
        /* Win95 X close button */
        .notif-close-btn {
          background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          cursor: pointer; padding: 0; color: #000000;
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 14px; box-shadow: none; font-size: 10px; font-weight: bold; flex-shrink: 0;
        }
        .notif-close-btn:hover { background: #d0d0d0; transform: none; box-shadow: none; }
        .notif-close-btn:active { border-color: #c07f55 #ffffff #ffffff #c07f55; }
        .notif-list { overflow-y: auto; flex: 1; min-height: 0; background: #dea77d; }
        [data-theme="dark"] .notif-list { background: #3d1a05; }
        .notif-empty { font-size: 12px; color: var(--body-text-muted); padding: 16px 12px; text-align: center; line-height: 1.5; }
        .notif-item { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px 6px 10px; border-bottom: 1px solid var(--body-border); position: relative; }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--accent); }
        .notif-item:hover * { color: #ffffff !important; }
        .notif-item--new { background: #fff3e8; }
        [data-theme="dark"] .notif-item--new { background: #3d2009; }
        .notif-item--new:hover { background: var(--accent); }
        .notif-num { font-size: 10px; color: var(--body-text-muted); min-width: 14px; text-align: right; margin-top: 2px; flex-shrink: 0; }
        .notif-icon { flex-shrink: 0; margin-top: 1px; }
        .notif-icon--fav { color: #806800; }
        .notif-icon--cmt { color: var(--accent); }
        .notif-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .notif-text { font-size: 11px; color: var(--body-text); line-height: 1.4; margin: 0; }
        .notif-user-link { color: var(--body-text); background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; box-shadow: none; font-family: inherit; text-decoration: underline; }
        .notif-user-link:hover { color: inherit; transform: none; box-shadow: none; }
        .notif-cover-link { font-style: italic; color: var(--accent); background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; box-shadow: none; font-family: inherit; text-decoration: underline; }
        .notif-cover-link:hover { opacity: 0.8; transform: none; box-shadow: none; }
        .notif-comment-preview { font-size: 10px; color: var(--body-text-muted); font-style: italic; margin: 0; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .notif-time { font-size: 10px; color: var(--body-text-muted); }
        /* Win95 tiny dismiss button */
        .notif-dismiss-btn {
          flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center;
          width: 18px; height: 16px;
          background: #dea77d; border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          cursor: pointer; color: #000000; opacity: 0;
          transition: opacity 0.1s; box-shadow: none; padding: 0;
        }
        [data-theme="dark"] .notif-dismiss-btn { background: #3d1a05; color: #ffffff; border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f; }
        .notif-item:hover .notif-dismiss-btn { opacity: 1; }
        .notif-dismiss-btn:hover { background: #800000; color: #ffffff; transform: none; box-shadow: none; }
        .notif-dismiss-btn:active { border-color: #c07f55 #ffffff #ffffff #c07f55; }
        @media (max-width: 640px) {
          .notif-panel { width: calc(100vw - 16px); right: -8px; }
          .notif-dismiss-btn { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
