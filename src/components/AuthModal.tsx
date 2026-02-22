import { useState } from 'react';
import { X, Mail, Lock, User, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  tab: 'login' | 'register';
  onClose: () => void;
}

export default function AuthModal({ tab: initialTab, onClose }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError('Username is required.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setError('Username: lowercase letters, numbers, and underscores only.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box auth-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' auth-tab--active' : ''}`}
              onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab${tab === 'register' ? ' auth-tab--active' : ''}`}
              onClick={() => { setTab('register'); setError(null); setSuccess(null); }}
            >
              Create Account
            </button>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {success ? (
            <div className="auth-success">
              <span>✓</span> {success}
            </div>
          ) : (
            <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="auth-form">
              {tab === 'register' && (
                <div className="auth-field">
                  <label className="auth-label">
                    <User size={13} /> Username
                  </label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    autoComplete="username"
                    required
                  />
                </div>
              )}
              <div className="auth-field">
                <label className="auth-label">
                  <Mail size={13} /> Email
                </label>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  <Lock size={13} /> Password
                </label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder={tab === 'register' ? 'Min. 6 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <div className="auth-error">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
                {loading ? (
                  <><Loader size={14} className="auth-spinner" /> {tab === 'login' ? 'Signing in…' : 'Creating account…'}</>
                ) : (
                  tab === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>
          )}

          <div className="auth-switch">
            {tab === 'login' ? (
              <>New here?{' '}
                <button className="auth-switch-btn" onClick={() => { setTab('register'); setError(null); }}>
                  Create a free account
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button className="auth-switch-btn" onClick={() => { setTab('login'); setError(null); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .auth-modal { width: 100%; max-width: 380px; }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; border-bottom: 1px solid var(--body-border);
        }
        .auth-tabs { display: flex; gap: 0; }
        .auth-tab {
          padding: 14px 18px; font-size: 14px; font-weight: bold;
          background: none; border: none; border-bottom: 3px solid transparent;
          cursor: pointer; color: var(--body-text-muted); margin-bottom: -1px;
          transition: color 0.12s, border-color 0.12s; box-shadow: none;
          font-family: Arial, Helvetica, sans-serif;
        }
        .auth-tab:hover { color: var(--body-text); transform: none; box-shadow: none; }
        .auth-tab--active { color: var(--accent); border-bottom-color: var(--accent); }
        .modal-close-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%;
          background: none; border: 1px solid var(--body-border);
          cursor: pointer; color: var(--body-text-muted);
          transition: background 0.12s, color 0.12s; box-shadow: none; padding: 0;
        }
        .modal-close-btn:hover { background: var(--body-border); color: var(--body-text); transform: none; }
        .modal-body { padding: 22px 20px 20px; }
        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-field { display: flex; flex-direction: column; gap: 5px; }
        .auth-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: bold; color: var(--body-text-muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .auth-input {
          width: 100%;
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid var(--body-card-border);
          background: var(--body-card-bg);
          color: var(--body-text);
          font-size: 14px;
          box-shadow: var(--shadow-inset-sm);
          outline: none;
          font-family: Arial, Helvetica, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .auth-input:focus {
          border-color: var(--accent);
          box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2);
        }
        .auth-error {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px; border-radius: 4px;
          background: rgba(200, 50, 30, 0.1);
          border: 1px solid rgba(200, 50, 30, 0.3);
          color: #c83220; font-size: 13px;
        }
        .auth-success {
          padding: 14px; border-radius: 4px; text-align: center;
          background: rgba(40, 160, 80, 0.1);
          border: 1px solid rgba(40, 160, 80, 0.3);
          color: #1a7a40; font-size: 14px; font-weight: bold;
          margin-bottom: 16px;
        }
        .auth-submit-btn {
          width: 100%; justify-content: center;
          padding: 10px 16px; font-size: 14px;
        }
        .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-switch {
          margin-top: 16px; text-align: center;
          font-size: 13px; color: var(--body-text-muted);
        }
        .auth-switch-btn {
          background: none; border: none; color: var(--accent); font-weight: bold;
          cursor: pointer; font-size: 13px; padding: 0; box-shadow: none;
          font-family: Arial, Helvetica, sans-serif;
        }
        .auth-switch-btn:hover { color: var(--accent-light); transform: none; box-shadow: none; }
      `}</style>
    </div>
  );
}
