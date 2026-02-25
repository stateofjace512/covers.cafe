import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from './SearchIcon';
import MenuIcon from './MenuIcon';
import XIcon from './XIcon';
import UserIcon from './UserIcon';
import TeaIcon from './TeaIcon';
import MilkIcon from './MilkIcon';
import SettingSlideIcon from './SettingSlideIcon';
import LogoutIcon from './LogoutIcon';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import {
  applyGradientColorsToDocument,
  getGradientPreference,
  type ThemeName,
} from '../lib/userPreferences';
import GradientTuner from './GradientTuner';

type HeaderProps = {
  isMobileNavOpen: boolean;
  onToggleMobileNav: () => void;
};

interface ThemeOption {
  id: ThemeName;
  label: string;
  icon: React.ReactNode;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light',      label: 'Frappe',   icon: <MilkIcon size={14} /> },
  { id: 'dark',       label: 'Mocha',    icon: <TeaIcon size={14} /> },
  { id: 'pureblack',  label: 'Black',    icon: <span style={{ fontSize: '11px', lineHeight: 1 }}>◼</span> },
  { id: 'crisp',      label: 'Crisp',    icon: <span style={{ fontSize: '11px', lineHeight: 1 }}>◻</span> },
  { id: 'gradient',   label: 'Gradient', icon: <SettingSlideIcon size={14} /> },
];

function themeIcon(theme: ThemeName) {
  const opt = THEME_OPTIONS.find(o => o.id === theme);
  return opt?.icon ?? <MilkIcon size={16} />;
}
function themeLabel(theme: ThemeName) {
  return THEME_OPTIONS.find(o => o.id === theme)?.label ?? 'Frappe';
}

export default function Header({ isMobileNavOpen, onToggleMobileNav }: HeaderProps) {
  const { user, profile, openAuthModal, signOut } = useAuth();
  const [theme, setTheme]             = useState<ThemeName>('light');
  const [dropdownOpen, setDropdown]   = useState(false);
  const [tunerOpen, setTunerOpen]     = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate  = useNavigate();
  const dropRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeName | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: ThemeName = saved ?? (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    if (initial === 'gradient') {
      const { start, end } = getGradientPreference();
      applyGradientColorsToDocument(start, end);
    }
  }, []);

  // Sync with Settings page changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) setTheme(e.newValue as ThemeName);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [dropdownOpen]);

  function applyTheme(t: ThemeName) {
    setDropdown(false);
    if (t === 'gradient') {
      // Open the tuner; gradient is applied when the user clicks "Apply & Save"
      setTunerOpen(true);
      return;
    }
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: t }));
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <>
      <header className="site-header">
        <button
          className="btn btn-ghost header-menu-btn"
          onClick={onToggleMobileNav}
          title={isMobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileNavOpen}
          aria-controls="main-sidebar"
        >
          {isMobileNavOpen ? <XIcon size={16} /> : <MenuIcon size={16} />}
        </button>

        <span className="header-logo-text">covers<span className="header-logo-dot">.</span>cafe</span>

        <form className="header-search-wrap" onSubmit={handleSearch}>
          <SearchIcon size={14} className="header-search-icon" />
          <input
            type="search"
            className="header-search"
            placeholder="Search albums, artists, covers…"
            aria-label="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="header-actions">
          {/* Theme selector dropdown */}
          <div className="header-theme-btn-wrap" ref={dropRef}>
            <button
              className="btn btn-ghost header-theme-btn"
              onClick={() => setDropdown(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              title="Change theme"
            >
              {themeIcon(theme)}
              <span className="header-theme-label">{themeLabel(theme)}</span>
            </button>

            {dropdownOpen && (
              <div className="header-theme-dropdown" role="listbox" aria-label="Theme">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    role="option"
                    aria-selected={theme === opt.id}
                    className={`header-theme-dropdown-item${theme === opt.id ? ' header-theme-dropdown-item--active' : ''}`}
                    onClick={() => applyTheme(opt.id)}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <NotificationBell />

          {user ? (
            <div className="header-user-group">
              <button className="btn btn-ghost header-user-btn" onClick={() => navigate('/profile')}>
                <UserIcon size={15} />
                <span className="header-username">
                  {profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}
                </span>
              </button>
              <button className="btn btn-ghost header-signout-btn" onClick={() => signOut()} title="Sign out">
                <LogoutIcon size={15} />
              </button>
            </div>
          ) : (
            <div className="header-user-group">
              <button className="btn btn-ghost" onClick={() => openAuthModal('login')}>Sign In</button>
              <button className="btn btn-primary" onClick={() => openAuthModal('register')}>Join</button>
            </div>
          )}
        </div>
      </header>

      {/* Gradient Tuner app window */}
      {tunerOpen && (
        <GradientTuner onClose={() => setTunerOpen(false)} />
      )}
    </>
  );
}
