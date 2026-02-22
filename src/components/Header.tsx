import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LOGO_URL = `https://mstrjk.com/api/cdn/site-assets/icons/cover_cafe_logo.svg`;

export default function Header() {
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
      <button className="header-logo" onClick={() => navigate('/')} aria-label="covers.cafe home">
        <span className="header-logo-icon">
          <img src={LOGO_URL} alt="covers.cafe logo" width={22} height={22} style={{ display: 'block' }} />
        </span>
        <span className="header-logo-text">covers<span className="header-logo-dot">.</span>cafe</span>
      </button>

      <form className="header-search-wrap" onSubmit={handleSearch}>
        <Search size={14} className="header-search-icon" />
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
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          <span className="header-theme-label">{dark ? 'Light' : 'Dark'}</span>
        </button>

        {user ? (
          <div className="header-user-group">
            <button className="btn btn-ghost header-user-btn" onClick={() => navigate('/profile')}>
              <User size={15} />
              <span className="header-username">
                {profile?.display_name ?? profile?.username ?? user.email?.split('@')[0]}
              </span>
            </button>
            <button className="btn btn-ghost header-signout-btn" onClick={() => signOut()} title="Sign out">
              <LogOut size={15} />
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
        .site-header { display: flex; align-items: center; gap: 14px; padding: 0 20px; }
        .header-logo {
          display: flex; align-items: center; gap: 8px;
          background: none; border: none; cursor: pointer;
          color: var(--header-text); flex-shrink: 0; padding: 0;
          box-shadow: none;
        }
        .header-logo:hover { transform: none; box-shadow: none; }
        .header-logo-icon {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px;
          background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.22); border-radius: 7px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .header-logo-text {
          font-size: 22px; font-weight: bold; letter-spacing: -0.5px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.4); font-family: Arial, Helvetica, sans-serif;
        }
        .header-logo-dot { color: #f0a060; text-shadow: 0 0 8px rgba(240,160,96,0.6); }
        .header-search-wrap {
          flex: 1; max-width: 420px; position: relative; display: flex; align-items: center;
        }
        .header-search-icon { position: absolute; left: 10px; color: var(--header-text-muted); pointer-events: none; }
        .header-search {
          width: 100%;
          padding: 7px 12px 7px 32px !important;
          border-radius: 5px !important;
          border: 1px solid rgba(0,0,0,0.35) !important;
          background: rgba(0,0,0,0.22) !important;
          color: var(--header-text) !important;
          font-size: 13px !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.08) !important;
          outline: none !important;
        }
        .header-search::placeholder { color: var(--header-text-muted); }
        .header-search:focus {
          background: rgba(0,0,0,0.32) !important;
          border-color: rgba(255,190,120,0.5) !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 0 0 2px rgba(240,160,80,0.18) !important;
        }
        .header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
        .header-theme-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: bold; }
        .header-theme-label { font-size: 12px; }
        .header-user-group { display: flex; align-items: center; gap: 4px; }
        .header-user-btn { display: flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 12px; }
        .header-username { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
        .header-signout-btn { padding: 6px 8px; }
        @media (max-width: 640px) {
          .header-theme-label { display: none; }
          .header-search-wrap { max-width: 180px; }
          .header-username { display: none; }
        }
      `}</style>
    </header>
  );
}
