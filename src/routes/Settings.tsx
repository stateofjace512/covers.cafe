import { Cog, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, signOut, openAuthModal } = useAuth();

  const setTheme = (theme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Force re-render of theme toggle in header by dispatching storage event
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: theme }));
  };

  const currentTheme = typeof document !== 'undefined'
    ? (document.documentElement.getAttribute('data-theme') ?? 'light')
    : 'light';

  return (
    <div>
      <h1 className="section-title"><Cog size={22} /> Settings</h1>

      <div className="settings-layout">
        <section className="card settings-section">
          <h2 className="settings-section-title">Appearance</h2>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Theme</span>
              <span className="settings-row-desc">Choose light or dark mode for the interface.</span>
            </div>
            <div className="settings-row-control">
              <button className={`btn${currentTheme === 'light' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setTheme('light')}>
                <Sun size={14} /> Light
              </button>
              <button className={`btn${currentTheme === 'dark' ? ' btn-primary' : ' btn-secondary'}`} onClick={() => setTheme('dark')}>
                <Moon size={14} /> Dark
              </button>
            </div>
          </div>
        </section>

        <section className="card settings-section">
          <h2 className="settings-section-title">Account</h2>
          {user ? (
            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Signed in as</span>
                <span className="settings-row-desc">{user.email}</span>
              </div>
              <div className="settings-row-control">
                <button className="btn btn-secondary" onClick={() => signOut()}>Sign Out</button>
              </div>
            </div>
          ) : (
            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label">Not signed in</span>
                <span className="settings-row-desc">Sign in to upload covers and save favorites.</span>
              </div>
              <div className="settings-row-control">
                <button className="btn btn-primary" onClick={() => openAuthModal('login')}>Sign In</button>
              </div>
            </div>
          )}
        </section>

        <section className="card settings-section">
          <h2 className="settings-section-title">About</h2>
          <div className="settings-kv"><span className="kv-key">Version</span><span className="kv-val">0.1.0</span></div>
          <div className="settings-kv"><span className="kv-key">Stack</span><span className="kv-val">Astro + React + Supabase</span></div>
        </section>
      </div>

      <style>{`
        .settings-layout { display: flex; flex-direction: column; gap: 20px; max-width: 600px; }
        .settings-section { padding: 20px 22px; }
        .settings-section-title {
          font-size: 15px; font-weight: bold; color: var(--body-text);
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
          margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--body-border);
        }
        [data-theme="dark"] .settings-section-title { text-shadow: none; }
        .settings-row { display: flex; align-items: center; gap: 16px; justify-content: space-between; flex-wrap: wrap; }
        .settings-row-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 180px; }
        .settings-row-label { font-size: 13px; font-weight: bold; color: var(--body-text); }
        .settings-row-desc { font-size: 12px; color: var(--body-text-muted); line-height: 1.5; }
        .settings-row-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .settings-kv { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 13px; }
        .kv-key { font-weight: bold; color: var(--body-text-muted); min-width: 100px; }
        .kv-val { color: var(--body-text); }
      `}</style>
    </div>
  );
}
