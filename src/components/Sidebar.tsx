import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import UserIcon from './UserIcon';
import UsersIcon from './UsersIcon';
import SearchUserIcon from './SearchUserIcon';
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
import WeatherCanvas, { type WeatherSettings } from './WeatherCanvas';
import WeatherMicroApp from './WeatherMicroApp';
import SettingSlideIcon from './SettingSlideIcon';
import GradientTuner from './GradientTuner';

const NAV = [
  { section: 'Discover', label: 'Gallery',   icon: <GalleryIcon size={18} />,        path: '/' },
  {                       label: 'ACOTW',     icon: <TrophyIcon size={18} />,         path: '/acotw' },
  {                       label: 'Artists',   icon: <ArtistsIcon size={18} />,        path: '/artists' },
  {                       label: 'Users',     icon: <SearchUserIcon size={18} />,     path: '/users' },
  {                       label: 'Friends',   icon: <UserIcon size={18} />,           path: '/friends' },
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

const MICROAPPS = [
  { id: 'weather',  icon: <WeatherIcon size={14} />,       label: 'Weather' },
  { id: 'gradient', icon: <SettingSlideIcon size={14} />,  label: 'Gradient Tuner' },
] as const;

const WEATHER_STORAGE_KEY = 'weatherMicroAppSettings';
const WEATHER_DEFAULTS: WeatherSettings = { mode: 'off', isRising: false, cfg: { density: 400, speed: 25, wind: 0, extra: 50, jitter: 20 } };
const WEATHER_PREVIEW_DEFAULT: WeatherSettings = { mode: 'snow', isRising: false, cfg: { density: 400, speed: 25, wind: 0, extra: 50, jitter: 20 } };

function readSavedWeather(): WeatherSettings {
  try {
    if (typeof window === 'undefined') return WEATHER_DEFAULTS;
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WeatherSettings;
  } catch {}
  return WEATHER_DEFAULTS;
}

export default function Sidebar({ isMobileNavOpen, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, openAuthModal } = useAuth();
  const [isOperator, setIsOperator] = useState(false);
  const [openApps, setOpenApps] = useState<Set<string>>(new Set());

  // ── Weather state ──────────────────────────────────────────────────
  // liveWeather: what WeatherCanvas is currently rendering (null = off)
  // Starts null; initialized from localStorage on mount to avoid SSR mismatch
  const [liveWeather, setLiveWeather] = useState<WeatherSettings | null>(null);
  const [savedWeather, setSavedWeather] = useState<WeatherSettings>(WEATHER_DEFAULTS);

  useEffect(() => {
    const s = readSavedWeather();
    setSavedWeather(s);
    if (s.mode !== 'off') setLiveWeather(s);
  }, []);

  function toggleApp(id: string) {
    setOpenApps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openWeatherControl() {
    // Show a live preview while the control is open
    if (!liveWeather) setLiveWeather(savedWeather.mode !== 'off' ? savedWeather : { ...WEATHER_PREVIEW_DEFAULT });
    setOpenApps(prev => new Set([...prev, 'weather']));
  }

  function handleWeatherSettingsChange(s: WeatherSettings) {
    setLiveWeather(s.mode !== 'off' ? s : null);
  }

  function handleWeatherSaveAndClose(s: WeatherSettings) {
    try { localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(s)); } catch {}
    setSavedWeather(s);
    setLiveWeather(s.mode !== 'off' ? s : null);
    setOpenApps(prev => { const next = new Set(prev); next.delete('weather'); return next; });
  }

  function handleWeatherClose() {
    // Discard unsaved changes  -  revert canvas to last saved state
    setLiveWeather(savedWeather.mode !== 'off' ? savedWeather : null);
    setOpenApps(prev => { const next = new Set(prev); next.delete('weather'); return next; });
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
    <>
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
          {MICROAPPS.map(({ id, icon, label }) => {
            const isActive = id === 'weather'
              ? openApps.has('weather') || liveWeather !== null
              : openApps.has(id);
            return (
              <button
                key={id}
                className={`microapp-cell${isActive ? ' microapp-cell--active' : ''}`}
                onClick={() => id === 'weather' ? (openApps.has('weather') ? handleWeatherClose() : openWeatherControl()) : toggleApp(id)}
                title={label}
                aria-pressed={isActive}
              >
                {icon}
              </button>
            );
          })}
        </div>
      </div>

    </aside>

      {/* Persistent weather canvas  -  survives control window close */}
      {liveWeather !== null && <WeatherCanvas settings={liveWeather} />}

      {/* Microapp windows portalled to document.body */}
      {openApps.has('weather') && createPortal(
        <WeatherMicroApp
          initialSettings={savedWeather.mode !== 'off' ? savedWeather : WEATHER_PREVIEW_DEFAULT}
          onSettingsChange={handleWeatherSettingsChange}
          onSaveAndClose={handleWeatherSaveAndClose}
          onClose={handleWeatherClose}
        />,
        document.body
      )}
      {openApps.has('gradient') && createPortal(
        <GradientTuner onClose={() => toggleApp('gradient')} />,
        document.body
      )}
    </>
  );
}
