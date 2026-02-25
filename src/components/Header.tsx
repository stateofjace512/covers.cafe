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

type HeaderProps = {
  isMobileNavOpen: boolean;
  onToggleMobileNav: () => void;
};

export default function Header({ isMobileNavOpen, onToggleMobileNav }: HeaderProps) {
  const { user, profile, openAuthModal, signOut } = useAuth();
  const [dark, setDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
  };
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
          onClick={toggleTheme}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          <span className="header-theme-label">{dark ? 'Light' : 'Dark'}</span>
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
