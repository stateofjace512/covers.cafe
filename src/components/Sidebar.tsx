import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserIcon from './UserIcon';
import UsersIcon from './UsersIcon';
import DownloadIcon from './DownloadIcon';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarSrc } from '../lib/media';
import { supabase } from '../lib/supabase';
import CastleIcon from './CastleIcon';
import GalleryIcon from './GalleryIcon';
import TrophyIcon from './TrophyIcon';
import ArtistsIcon from './ArtistsIcon';
import FavoritesIcon from './FavoritesIcon';
import UploadDownloadIcon from './UploadDownloadIcon';
import GearIcon from './GearIcon';
import AboutIcon from './AboutIcon';
import ShieldIcon from './ShieldIcon';

const NAV = [
  { section: 'Discover', label: 'Gallery',   icon: <GalleryIcon size={18} />,        path: '/' },
  {                       label: 'ACOTW',     icon: <TrophyIcon size={18} />,         path: '/acotw' },
  {                       label: 'POH',       icon: <CastleIcon size={18} />,         path: '/poh' },
  {                       label: 'Artists',   icon: <ArtistsIcon size={18} />,        path: '/artists' },
  {                       label: 'Users',     icon: <UsersIcon size={18} />,          path: '/users' },
  {                       label: 'Favorites', icon: <FavoritesIcon size={18} />,      path: '/favorites' },
  { section: 'Account',  label: 'Upload',    icon: <UploadDownloadIcon size={18} />, path: '/upload' },
  {                       label: 'Downloads', icon: <DownloadIcon size={18} />,       path: '/downloads' },
  {                       label: 'Profile',   icon: <UserIcon size={18} />,            path: '/profile' },
  { section: 'More',     label: 'Settings',  icon: <GearIcon size={18} />,           path: '/settings' },
  {                       label: 'About',     icon: <AboutIcon size={18} />,          path: '/about' },
] as const;

const OPERATOR_NAV = { label: 'CMS', icon: <ShieldIcon size={18} />, path: '/cms' } as const;

type SidebarProps = {
  isMobileNavOpen: boolean;
  onNavigate: () => void;
};

export default function Sidebar({ isMobileNavOpen, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, openAuthModal } = useAuth();
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadOperator() {
      if (!user) {
        setIsOperator(false);
        return;
      }
      const { data } = await supabase
        .from('covers_cafe_operator_roles')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('role', 'operator')
        .maybeSingle();
      if (active) setIsOperator(Boolean(data));
    }
    loadOperator();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <aside
      id="main-sidebar"
      className={`site-sidebar${isMobileNavOpen ? ' site-sidebar--mobile-open' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* User panel */}
      <div className="sidebar-user-panel">
        <div className="sidebar-avatar">
          {profile && getAvatarSrc(profile)
            ? <img src={getAvatarSrc(profile)!} alt="avatar" className="sidebar-avatar-img" />
            : <UserIcon size={26} />
          }
        </div>
        <div className="sidebar-user-info">
          {user ? (
            <>
              <span className="sidebar-user-name">
                {profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}
              </span>
              <button className="sidebar-user-action" onClick={() => { navigate('/profile'); onNavigate(); }}>
                View Profile &rsaquo;
              </button>
            </>
          ) : (
            <>
              <span className="sidebar-user-name">Guest</span>
              <button className="sidebar-user-action" onClick={() => { openAuthModal('login'); onNavigate(); }}>
                Sign in &rsaquo;
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {[...NAV, ...(isOperator ? [OPERATOR_NAV] : [])].map((item) => {
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
                onClick={() => {
                  navigate(item.path);
                  onNavigate();
                }}
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
          font-size: 17px; font-weight: bold; color: var(--sidebar-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        [data-theme="dark"] .sidebar-user-name { text-shadow: none; }
        .sidebar-user-action {
          font-size: 15px; color: var(--accent); font-weight: bold;
          background: none; border: none; cursor: pointer; padding: 0; text-align: left;
          box-shadow: none;
        }
        .sidebar-user-action:hover { color: var(--accent-light); transform: none; }
        .sidebar-nav { padding: 10px 0; flex: 1; }
        .sidebar-section-label {
          font-size: 13px; font-weight: bold; letter-spacing: 1.2px;
          text-transform: uppercase; color: var(--sidebar-text-muted);
          padding: 14px 16px 4px;
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        }
        [data-theme="dark"] .sidebar-section-label { text-shadow: none; }
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 11px;
          width: 100%; padding: 9px 16px;
          color: var(--sidebar-text); font-size: 17px; font-weight: bold;
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
      `}</style>
    </aside>
  );
}
