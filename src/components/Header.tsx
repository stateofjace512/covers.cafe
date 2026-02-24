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

      <style>{`
        .site-header { display: flex; align-items: center; gap: 6px; padding: 0 8px; }
        .header-logo {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          color: var(--header-text); flex-shrink: 0; padding: 0;
          box-shadow: none;
        }
        .header-logo:hover { transform: none; box-shadow: none; }
        .header-logo-text {
          font-size: 15px; font-weight: bold; letter-spacing: 0; font-family: var(--font-header);
          color: #ffffff; text-shadow: 1px 1px #5a3620;
        }
        .header-logo-dot { color: #ffffff; }
        .header-search-wrap {
          flex: 1; max-width: 420px; position: relative; display: flex; align-items: center;
        }
        .header-search-icon { position: absolute; left: 6px; color: #c07f55; pointer-events: none; }
        .header-search {
          width: 100%;
          height: 22px !important;
          padding: 2px 8px 2px 24px !important;
          border-radius: 0 !important;
          border: 2px solid !important;
          border-color: #c07f55 #ffffff #ffffff #c07f55 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-size: 12px !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .header-search::placeholder { color: #c07f55; }
        .header-search:focus {
          border-color: #c07f55 #ffffff #ffffff #c07f55 !important;
          box-shadow: none !important;
          outline: 1px dotted #73492a !important;
          outline-offset: 1px !important;
        }
        .header-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; flex-shrink: 0; }
        .header-menu-btn { display: none; padding: 2px 6px; height: 26px; }
        .header-theme-btn {
          display: flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 12px; height: 26px;
        }
        .header-theme-label { font-size: 12px; }
        .header-user-group { display: flex; align-items: center; gap: 4px; }
        .header-user-btn {
          display: flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 12px; height: 26px;
        }
        .header-username { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
        .header-signout-btn { padding: 2px 6px; height: 26px; }
        @media (max-width: 640px) {
          .site-header { gap: 6px; padding: 0 6px; }
          .header-menu-btn { display: inline-flex; }
          .header-logo-text { font-size: 13px; }
          .header-theme-label { display: none; }
          .header-search-wrap { max-width: none; min-width: 0; }
          .header-username { display: none; }
          .header-user-group .btn { padding: 2px 8px; }
        }
      `}</style>
    </header>
  );
}
