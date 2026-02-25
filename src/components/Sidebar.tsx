import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserIcon from './UserIcon';
import UsersIcon from './UsersIcon';
import DownloadIcon from './DownloadIcon';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarSrc } from '../lib/media';
import { supabase } from '../lib/supabase';
import GalleryIcon from './GalleryIcon';
import TrophyIcon from './TrophyIcon';
import ArtistsIcon from './ArtistsIcon';
import FavoritesIcon from './FavoritesIcon';
import UploadDownloadIcon from './UploadDownloadIcon';
import GearIcon from './GearIcon';
import ShieldIcon from './ShieldIcon';
import WeatherIcon from './WeatherIcon';
import WeatherMicroApp from './WeatherMicroApp';

const NAV = [
  { section: 'Discover', label: 'Gallery',   icon: <GalleryIcon size={18} />,        path: '/' },
  {                       label: 'ACOTW',     icon: <TrophyIcon size={18} />,         path: '/acotw' },
  {                       label: 'Artists',   icon: <ArtistsIcon size={18} />,        path: '/artists' },
  {                       label: 'Users',     icon: <UsersIcon size={18} />,          path: '/users' },
  {                       label: 'Favorites', icon: <FavoritesIcon size={18} />,      path: '/favorites' },
  { section: 'Account',  label: 'Upload',    icon: <UploadDownloadIcon size={18} />, path: '/upload' },
  {                       label: 'Downloads', icon: <DownloadIcon size={18} />,       path: '/downloads' },
  {                       label: 'Profile',   icon: <UserIcon size={18} />,            path: '/profile' },
  { section: 'More',     label: 'Settings',  icon: <GearIcon size={18} />,           path: '/settings' },
] as const;

const OPERATOR_NAV = { label: 'CMS', icon: <ShieldIcon size={18} />, path: '/cms' } as const;

type SidebarProps = {
  isMobileNavOpen: boolean;
  onNavigate: () => void;
};

// Each microapp entry: { id, icon, label, component }
const MICROAPPS = [
  { id: 'weather', icon: <WeatherIcon size={14} />, label: 'Weather' },
] as const;

export default function Sidebar({ isMobileNavOpen, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, openAuthModal } = useAuth();
  const [isOperator, setIsOperator] = useState(false);
  const [openApps, setOpenApps] = useState<Set<string>>(new Set());

  function toggleApp(id: string) {
    setOpenApps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      {/* Microapps grid */}
      <div className="sidebar-microapps">
        <div className="sidebar-section-label">Apps</div>
        <div className="microapp-grid">
          {MICROAPPS.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`microapp-cell${openApps.has(id) ? ' microapp-cell--active' : ''}`}
              onClick={() => toggleApp(id)}
              title={label}
              aria-pressed={openApps.has(id)}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Rendered microapp windows */}
      {openApps.has('weather') && (
        <WeatherMicroApp onClose={() => toggleApp('weather')} />
      )}

      
    </aside>
  );
}
