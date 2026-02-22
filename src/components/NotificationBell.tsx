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
const LS_DISMISSED = 'notifications_dismissed';

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

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DISMISSED);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    // Keep at most 200 dismissed IDs to avoid unbounded growth
    const arr = [...ids].slice(-200);
    localStorage.setItem(LS_DISMISSED, JSON.stringify(arr));
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
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Snapshot the lastRead timestamp at the moment the panel opens so the "new"
  // dots don't disappear while the panel is open.
  const [openedAtRead, setOpenedAtRead] = useState(0);
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
        const dismissed = getDismissed();
        const newCount = data.notifications.filter(
          (n) => !dismissed.has(n.id) && new Date(n.created_at).getTime() > lastRead
        ).length;
        setUnreadCount(newCount);
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

  const handleOpen = () => {
    if (!open) {
      const lastRead = getLastRead();
      setOpenedAtRead(lastRead);
      setOpen(true);
      setLastRead(Date.now());
      setUnreadCount(0);
    } else {
      setOpen(false);
    }
  };

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const visible = notifications.filter((n) => !dismissed.has(n.id));

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
            <span className="notif-panel-title">
              Notifications
              {visible.length > 0 && (
                <span className="notif-panel-count">{visible.length}</span>
              )}
            </span>
            <button className="notif-close-btn" onClick={() => setOpen(false)} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <div className="notif-list">
            {loading && visible.length === 0 ? (
              <p className="notif-empty">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="notif-empty">No notifications yet. Upload some covers to get started!</p>
            ) : (
              visible.map((n, idx) => {
                const isNew = new Date(n.created_at).getTime() > openedAtRead;
                return (
                  <div key={n.id} className={`notif-item${isNew ? ' notif-item--new' : ''}`}>
                    <span className="notif-num">{idx + 1}</span>
                    <div className="notif-icon">
                      {n.type === 'favorite'
                        ? <Star size={13} fill="currentColor" className="notif-icon--fav" />
                        : <MessageCircle size={13} className="notif-icon--cmt" />}
                    </div>
                    <div className="notif-body">
                      <p className="notif-text">
                        {n.actor_username
                          ? <button className="notif-user-link" onClick={() => { navigate(`/users/${n.actor_username}`); setOpen(false); }}>{n.actor_name}</button>
                          : <strong>{n.actor_name}</strong>
                        }
                        {n.type === 'favorite' ? ' favorited ' : ' commented on '}
                        <em>{n.cover_title}</em>
                      </p>
                      {n.content && (
                        <p className="notif-comment-preview">"{n.content}{n.content.length >= 100 ? '…' : ''}"</p>
                      )}
                      <span className="notif-time">{timeAgo(n.created_at)}</span>
                    </div>
                    <button
                      className="notif-dismiss-btn"
                      onClick={() => dismiss(n.id)}
                      title="Dismiss"
                      aria-label="Dismiss notification"
                    >
                      <X size={11} />
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
          width: 320px;
          max-height: min(440px, calc(100vh - var(--header-h) - 16px));
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
        .notif-panel-title {
          font-size: 13px; font-weight: bold; color: var(--body-text);
          display: flex; align-items: center; gap: 7px;
        }
        .notif-panel-count {
          font-size: 11px; font-weight: bold;
          background: var(--accent); color: white;
          border-radius: 10px; padding: 1px 6px; line-height: 1.5;
        }
        .notif-close-btn {
          background: none; border: none; cursor: pointer; padding: 2px;
          color: var(--body-text-muted); display: flex; align-items: center;
          box-shadow: none;
        }
        .notif-close-btn:hover { color: var(--body-text); transform: none; box-shadow: none; }
        /* min-height: 0 is critical — without it flex children won't shrink and overflow-y won't scroll */
        .notif-list { overflow-y: auto; flex: 1; min-height: 0; }
        .notif-empty { font-size: 13px; color: var(--body-text-muted); padding: 20px 14px; text-align: center; line-height: 1.5; }
        .notif-item {
          display: flex; gap: 8px; align-items: flex-start;
          padding: 9px 10px 9px 12px;
          border-bottom: 1px solid var(--body-border);
          position: relative;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--sidebar-hover-bg); }
        .notif-item--new { background: rgba(192,90,26,0.06); }
        .notif-item--new:hover { background: rgba(192,90,26,0.1); }
        .notif-num {
          font-size: 9px; font-weight: bold; color: var(--body-text-muted);
          min-width: 16px; text-align: right; margin-top: 3px; flex-shrink: 0;
          opacity: 0.5;
        }
        .notif-icon { flex-shrink: 0; margin-top: 2px; }
        .notif-icon--fav { color: #d4a020; }
        .notif-icon--cmt { color: var(--accent); }
        .notif-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
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
        .notif-dismiss-btn {
          flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 4px;
          background: none; border: none; cursor: pointer;
          color: var(--body-text-muted); opacity: 0;
          transition: opacity 0.1s, background 0.1s;
          box-shadow: none; padding: 0;
        }
        .notif-item:hover .notif-dismiss-btn { opacity: 1; }
        .notif-dismiss-btn:hover { background: rgba(200,50,30,0.15); color: #c83220; transform: none; box-shadow: none; }
        @media (max-width: 640px) {
          .notif-panel { width: calc(100vw - 20px); right: -10px; }
          .notif-dismiss-btn { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
