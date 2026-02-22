import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpFromLine, ArrowDownToLine, User, Star, Image, Coffee, Cog, UserRoundCog, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { section: 'Discover', label: 'Gallery',      icon: <Image size={18} />,           path: '/' },
  {                       label: 'Users',      icon: <UserRound size={18} />,        path: '/users' },
  {                       label: 'Favorites',    icon: <Star size={18} />,             path: '/favorites' },
  { section: 'Account',  label: 'Upload',        icon: <ArrowUpFromLine size={18} />,  path: '/upload' },
  {                       label: 'Downloads',    icon: <ArrowDownToLine size={18} />,  path: '/downloads' },
  {                       label: 'Profile',      icon: <User size={18} />,             path: '/profile' },
  {                       label: 'Edit Profile', icon: <UserRoundCog size={18} />,     path: '/profile/edit' },
  { section: 'More',     label: 'Settings',     icon: <Cog size={18} />,              path: '/settings' },
  {                       label: 'Coffee',       icon: <Coffee size={18} />,           path: '/coffee' },
] as const;

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, openAuthModal } = useAuth();

  return (
    <aside className="site-sidebar" role="navigation" aria-label="Main navigation">
      {/* User panel */}
      <div className="sidebar-user-panel">
        <div className="sidebar-avatar">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" className="sidebar-avatar-img" />
            : <User size={26} />
          }
        </div>
        <div className="sidebar-user-info">
          {user ? (
            <>
              <span className="sidebar-user-name">
                {profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}
              </span>
              <button className="sidebar-user-action" onClick={() => navigate('/profile')}>
                View Profile &rsaquo;
              </button>
            </>
          ) : (
            <>
              <span className="sidebar-user-name">Guest</span>
              <button className="sidebar-user-action" onClick={() => openAuthModal('login')}>
                Sign in &rsaquo;
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <div key={item.path}>
              {'section' in item && item.section && (
                <div className="sidebar-section-label">{item.section}</div>
              )}
              <button
                className={`sidebar-nav-item${isActive ? ' sidebar-nav-item--active' : ''}`}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
                {isActive && <span className="sidebar-nav-pip" />}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-footer-text">covers.cafe</span>
        <div className="sidebar-footer-links">
          <button className="sidebar-footer-link" onClick={() => navigate('/privacy')}>Privacy</button>
          <span className="sidebar-footer-sep">·</span>
          <button className="sidebar-footer-link" onClick={() => navigate('/terms')}>Terms</button>
        </div>
      </div>

      <style>{`
        .sidebar-user-panel {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 16px 14px;
          border-bottom: 1px solid var(--sidebar-border);
          background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%);
          box-shadow: 0 2px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.08);
        }
        .sidebar-avatar {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(145deg, var(--sidebar-bg-light), var(--sidebar-bg-dark));
          border: 2px solid var(--sidebar-border);
          box-shadow: 0 2px 5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--sidebar-text-muted); overflow: hidden;
        }
        .sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-user-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sidebar-user-name {
          font-size: 14px; font-weight: bold; color: var(--sidebar-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        [data-theme="dark"] .sidebar-user-name { text-shadow: none; }
        .sidebar-user-action {
          font-size: 12px; color: var(--accent); font-weight: bold;
          background: none; border: none; cursor: pointer; padding: 0; text-align: left;
          box-shadow: none;
        }
        .sidebar-user-action:hover { color: var(--accent-light); transform: none; }
        .sidebar-nav { padding: 10px 0; flex: 1; }
        .sidebar-section-label {
          font-size: 10px; font-weight: bold; letter-spacing: 1.2px;
          text-transform: uppercase; color: var(--sidebar-text-muted);
          padding: 14px 16px 4px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        }
        [data-theme="dark"] .sidebar-section-label { text-shadow: none; }
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 11px;
          width: 100%; padding: 9px 16px;
          color: var(--sidebar-text); font-size: 14px; font-weight: bold;
          background: none; border: none; border-left: 3px solid transparent;
          cursor: pointer; text-align: left;
          transition: background 0.12s, border-color 0.12s;
          box-shadow: none;
        }
        .sidebar-nav-item:hover {
          background: var(--sidebar-hover-bg);
          border-left-color: rgba(115, 73, 42, 0.4);
          transform: none; box-shadow: none;
        }
        .sidebar-nav-item--active {
          background: linear-gradient(90deg, var(--sidebar-active-bg) 0%, rgba(115,73,42,0.85) 100%);
          color: var(--sidebar-active-text) !important;
          border-left-color: #f0a060;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.15) !important;
        }
        .sidebar-nav-item--active:hover {
          background: linear-gradient(90deg, var(--sidebar-active-bg) 0%, rgba(115,73,42,0.9) 100%);
        }
        .sidebar-nav-icon { display: flex; align-items: center; flex-shrink: 0; width: 20px; justify-content: center; }
        .sidebar-nav-label { flex: 1; }
        .sidebar-nav-pip {
          width: 6px; height: 6px; border-radius: 50%;
          background: #f0a060; box-shadow: 0 0 6px rgba(240,160,96,0.6); flex-shrink: 0;
        }
        .sidebar-footer {
          border-top: 1px solid var(--sidebar-border); padding: 10px 16px;
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(0deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 100%);
          position: sticky; bottom: 0;
        }
        .sidebar-footer-text { font-size: 11px; font-weight: bold; color: var(--sidebar-text-muted); letter-spacing: 0.3px; }
        .sidebar-footer-links { display: flex; align-items: center; gap: 5px; }
        .sidebar-footer-link {
          font-size: 10px; color: var(--sidebar-text-muted); background: none;
          border: none; cursor: pointer; padding: 0; box-shadow: none;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .sidebar-footer-link:hover { color: var(--accent); transform: none; box-shadow: none; }
        .sidebar-footer-sep { font-size: 10px; color: var(--sidebar-text-muted); }
      `}</style>
    </aside>
  );
}
