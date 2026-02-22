import { useState, useEffect } from 'react';
import { Moon, Sun, Search, Coffee } from 'lucide-react';

export default function Header() {
  const [dark, setDark] = useState(false);

  // Sync with saved preference on mount
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

  return (
    <header className="site-header">
      {/* Logo */}
      <a href="/" className="header-logo" aria-label="covers.cafe home">
        <span className="header-logo-icon">
          <Coffee size={22} />
        </span>
        <span className="header-logo-text">
          covers<span className="header-logo-dot">.</span>cafe
        </span>
      </a>

      {/* Search bar */}
      <div className="header-search-wrap">
        <Search size={14} className="header-search-icon" />
        <input
          type="search"
          className="header-search"
          placeholder="Search albums, artists, covers…"
          aria-label="Search"
        />
      </div>

      {/* Right actions */}
      <div className="header-actions">
        <button
          className="btn btn-ghost header-theme-btn"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          <span className="header-theme-label">{dark ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      <style>{`
        .site-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 0 20px;
        }

        /* Logo */
        .header-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--header-text);
          flex-shrink: 0;
        }

        .header-logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 7px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18);
          color: var(--header-text);
        }

        .header-logo-text {
          font-size: 22px;
          font-weight: bold;
          letter-spacing: -0.5px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 0 20px rgba(255,210,160,0.15);
          color: var(--header-text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .header-logo-dot {
          color: #f0a060;
          text-shadow: 0 0 8px rgba(240,160,96,0.6);
        }

        /* Search */
        .header-search-wrap {
          flex: 1;
          max-width: 420px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .header-search-icon {
          position: absolute;
          left: 10px;
          color: var(--sidebar-text-muted);
          pointer-events: none;
        }

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
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s !important;
        }

        .header-search::placeholder {
          color: var(--header-text-muted);
        }

        .header-search:focus {
          background: rgba(0,0,0,0.32) !important;
          border-color: rgba(255,190,120,0.5) !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 0 0 2px rgba(240,160,80,0.18) !important;
        }

        /* Actions */
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .header-theme-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 0.3px;
        }

        .header-theme-label {
          font-size: 12px;
        }

        @media (max-width: 600px) {
          .header-theme-label { display: none; }
          .header-search-wrap { max-width: 200px; }
        }
      `}</style>
    </header>
  );
}
