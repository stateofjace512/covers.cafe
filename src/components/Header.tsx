import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchIcon from './SearchIcon';
import LogoutIcon from './LogoutIcon';
import MenuIcon from './MenuIcon';
import XIcon from './XIcon';
import MoonIcon from './MoonIcon';
import SunIcon from './SunIcon';
import UserIcon from './UserIcon';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { applyGradientColorsToDocument, getGradientPreference, type ThemeName } from '../lib/userPreferences';

type HeaderProps = {
  isMobileNavOpen: boolean;
  onToggleMobileNav: () => void;
};

const THEME_CYCLE: ThemeName[] = ['light', 'dark', 'pureblack', 'crisp'];

function themeIcon(theme: ThemeName) {
  if (theme === 'dark') return <MoonIcon size={16} />;
  if (theme === 'pureblack') return <span style={{ fontSize: '13px', lineHeight: 1 }}>◼</span>;
  if (theme === 'crisp') return <span style={{ fontSize: '13px', lineHeight: 1 }}>◻</span>;
  if (theme === 'gradient') return <span style={{ fontSize: '13px', lineHeight: 1 }}>◈</span>;
  return <SunIcon size={16} />;
}

function themeLabel(theme: ThemeName) {
  if (theme === 'dark') return 'Dark';
  if (theme === 'pureblack') return 'Black';
  if (theme === 'crisp') return 'Crisp';
  if (theme === 'gradient') return 'Gradient';
  return 'Light';
}

export default function Header({ isMobileNavOpen, onToggleMobileNav }: HeaderProps) {
  const { user, profile, openAuthModal, signOut } = useAuth();
  const [theme, setTheme] = useState<ThemeName>('light');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

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

  const cycleTheme = () => {
    // Gradient is only set via Settings; clicking the header button cycles the
    // four named themes, or jumps back to 'light' if currently on gradient.
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: next }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Derive the label for what clicking the button will switch TO next
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
  const nextLabel = themeLabel(nextTheme);

   return (
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
        <button
          className="btn btn-ghost header-theme-btn"
          onClick={cycleTheme}
          title={`Switch to ${nextLabel} mode`}
        >
          {themeIcon(theme)}
          <span className="header-theme-label">{themeLabel(theme)}</span>
        </button>

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
  );
}
