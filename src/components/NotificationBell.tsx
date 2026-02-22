import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Star, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  type: 'favorite' | 'comment';
  cover_id: string;
  cover_title: string;
  cover_artist: string;
  actor_name: string;
  actor_username: string | null;
  content: string | null;
  created_at: string;
}

const LS_KEY = 'notifications_last_read';

function getLastRead(): number {
  try {
    return parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setLastRead(ts: number) {
  try {
    localStorage.setItem(LS_KEY, String(ts));
  } catch { /* noop */ }
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
        const lastRead = getLastRead();
        const newCount = data.notifications.filter(
          (n) => new Date(n.created_at).getTime() > lastRead
        ).length;
        setUnreadCount(newCount);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [user, session?.access_token]);

  // Fetch on mount and when user/session changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Periodically re-fetch (every 2 minutes)
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchNotifications, user]);

  // Close on outside click
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

  const handleOpen = () => {
    if (!open) {
      setOpen(true);
      // Mark all as read
      setLastRead(Date.now());
      setUnreadCount(0);
    } else {
      setOpen(false);
    }
  };

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
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" ref={panelRef}>
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            <button className="notif-close-btn" onClick={() => setOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <div className="notif-list">
            {loading && notifications.length === 0 ? (
              <p className="notif-empty">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="notif-empty">No notifications yet. Upload some covers to get started!</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="notif-item">
                  <div className="notif-icon">
                    {n.type === 'favorite'
                      ? <Star size={13} fill="currentColor" className="notif-icon--fav" />
                      : <MessageCircle size={13} className="notif-icon--cmt" />}
                  </div>
                  <div className="notif-body">
                    <p className="notif-text">
                      {n.type === 'favorite' ? (
                        <>
                          {n.actor_username
                            ? <button className="notif-user-link" onClick={() => { navigate(`/users/${n.actor_username}`); setOpen(false); }}>{n.actor_name}</button>
                            : <strong>{n.actor_name}</strong>
                          }
                          {' '}favorited{' '}
                          <em>{n.cover_title}</em>
                        </>
                      ) : (
                        <>
                          {n.actor_username
                            ? <button className="notif-user-link" onClick={() => { navigate(`/users/${n.actor_username}`); setOpen(false); }}>{n.actor_name}</button>
                            : <strong>{n.actor_name}</strong>
                          }
                          {' '}commented on{' '}
                          <em>{n.cover_title}</em>
                        </>
                      )}
                    </p>
                    {n.content && (
                      <p className="notif-comment-preview">"{n.content}{n.content.length >= 100 ? '…' : ''}"</p>
                    )}
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .notif-wrap { position: relative; }
        .notif-bell-btn { position: relative; padding: 6px 8px; }
        .notif-badge {
          position: absolute; top: 2px; right: 2px;
          background: #e03020; color: white;
          font-size: 9px; font-weight: bold;
          border-radius: 8px; padding: 1px 4px;
          min-width: 14px; text-align: center; line-height: 1.4;
          border: 1.5px solid var(--header-bg);
        }
        .notif-panel {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 300px; max-height: 420px;
          background: var(--body-card-bg);
          border: 1px solid var(--body-card-border);
          border-radius: 6px;
          box-shadow: var(--shadow-lg);
          z-index: 200;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .notif-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px 8px;
          border-bottom: 1px solid var(--body-card-border);
          flex-shrink: 0;
        }
        .notif-panel-title { font-size: 13px; font-weight: bold; color: var(--body-text); }
        .notif-close-btn {
          background: none; border: none; cursor: pointer; padding: 2px;
          color: var(--body-text-muted); display: flex; align-items: center;
          box-shadow: none;
        }
        .notif-close-btn:hover { color: var(--body-text); transform: none; box-shadow: none; }
        .notif-list { overflow-y: auto; flex: 1; }
        .notif-empty { font-size: 13px; color: var(--body-text-muted); padding: 20px 14px; text-align: center; line-height: 1.5; }
        .notif-item {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px 14px;
          border-bottom: 1px solid var(--body-border);
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--sidebar-hover-bg); }
        .notif-icon { flex-shrink: 0; margin-top: 2px; }
        .notif-icon--fav { color: #d4a020; }
        .notif-icon--cmt { color: var(--accent); }
        .notif-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .notif-text { font-size: 12px; color: var(--body-text); line-height: 1.4; margin: 0; }
        .notif-text em { font-style: normal; color: var(--accent); }
        .notif-user-link {
          font-weight: bold; color: var(--body-text);
          background: none; border: none; padding: 0; cursor: pointer;
          font-size: 12px; box-shadow: none; font-family: inherit;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .notif-user-link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .notif-comment-preview { font-size: 11px; color: var(--body-text-muted); font-style: italic; margin: 0; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .notif-time { font-size: 10px; color: var(--body-text-muted); }
        @media (max-width: 640px) {
          .notif-panel { width: calc(100vw - 20px); right: -10px; }
        }
      `}</style>
    </div>
  );
}
