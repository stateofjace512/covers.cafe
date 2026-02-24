import { useState, useEffect } from 'react';
import XIcon from './XIcon';
import EmailIcon from './EmailIcon';
import LockIcon from './LockIcon';
import UserIcon from './UserIcon';
import AlertCircleIcon from './AlertCircleIcon';
import LoadingIcon from './LoadingIcon';
import ShieldIcon from './ShieldIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  tab: 'login' | 'register' | 'verify';
  onClose: () => void;
}

type Step = 'form' | 'verify';

export default function AuthModal({ tab: initialTab, onClose }: Props) {
  const { refreshProfile, closeAuthModal } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab === 'verify' ? 'login' : initialTab);
  const [step, setStep] = useState<Step>(initialTab === 'verify' ? 'verify' : 'form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Track whether we just created a new account so "start over" can delete it
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  // When opened directly at the verify step (e.g. reload with unverified session),
  // pull the email from the live session and send a fresh code automatically.
  useEffect(() => {
    if (initialTab !== 'verify') return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const userEmail = session.user.email ?? '';
      setEmail(userEmail);
      sendVerificationCode(session.access_token, userEmail);
    });
  }, []); // run once on mount; sendVerificationCode is a hoisted function declaration

  // Send a verification code via our SMTP API.
  // The user must already have an active session (token) so verify-code can auth them.
  async function sendVerificationCode(_token: string, userEmail: string): Promise<boolean> {
    try {
      const res = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? '';
        const msg = contentType.includes('application/json')
          ? ((await res.json()) as { message?: string }).message
          : null;
        setError(msg ?? 'Could not send verification email. Please try again.');
        return false;
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      return false;
    }
    return true;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Check whether this user's profile is verified
    const { data: profileData } = await supabase
      .from('covers_cafe_profiles')
      .select('email_verified')
      .eq('id', data.user.id)
      .single();

    if (profileData?.email_verified === false) {
      // Need to verify — send code then show OTP step
      const token = data.session?.access_token ?? '';
      const sent = await sendVerificationCode(token, email);
      if (sent) {
        setStep('verify');
      }
    } else {
      // Already verified — close modal
      closeAuthModal();
    }

    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError('Username is required.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (username.length > 30) { setError('Username must be 30 characters or fewer.'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setError('Username: lowercase letters, numbers, and underscores only.'); return; }
    setLoading(true);

    // Server validates username and sends OTP — account is NOT created yet.
    // The email is only stored after the user proves ownership in the verify step.
    let registerJson: { ok: boolean; message?: string; field?: string };
    try {
      const registerRes = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email, password }),
      });
      registerJson = await registerRes.json() as { ok: boolean; message?: string; field?: string };
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
      return;
    }

    if (!registerJson.ok) {
      setError(registerJson.message ?? 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    // OTP sent — show the verify step. No account exists yet.
    setIsNewRegistration(true);
    setStep('verify');
    setLoading(false);
  };

  // "Wrong email / start over"
  // - New registration: no account exists yet, just reset the form.
  // - Existing user login: sign out and return to the sign-in form.
  const handleStartOver = async () => {
    setError(null);
    if (!isNewRegistration) {
      await supabase.auth.signOut();
    }
    setStep('form');
    setCode('');
    setError(null);
    setSuccess(null);
    setIsNewRegistration(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isNewRegistration) {
      // Complete-registration path: create account now that email is verified.
      // The server also signs in and returns session tokens so we never have to
      // call signInWithPassword on the client (avoids "Invalid login credentials" race).
      let json: { ok: boolean; message?: string; session?: { access_token: string; refresh_token: string } | null };
      try {
        const res = await fetch('/api/account/complete-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password, code }),
        });
        json = await res.json() as typeof json;
      } catch {
        setError('Network error. Please check your connection and try again.');
        setLoading(false);
        return;
      }

      if (!json.ok) {
        setError(json.message ?? 'Verification failed. Try again.');
        setLoading(false);
        return;
      }

      if (json.session) {
        // Server signed us in — just set the session directly
        await supabase.auth.setSession({
          access_token: json.session.access_token,
          refresh_token: json.session.refresh_token,
        });
      } else {
        // Fallback: server couldn't sign in (rare), ask the user to sign in manually
        setSuccess('Account created! Please sign in with your credentials.');
        setStep('form');
        setTab('login');
        setLoading(false);
        return;
      }

      await refreshProfile();
      closeAuthModal();
      setLoading(false);
      return;
    }

    // Existing-user login verification path (unchanged)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session expired. Please sign in again.');
      setStep('form');
      setLoading(false);
      return;
    }

    let json: { ok: boolean; error?: string };
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, code }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError('Verification service unavailable. Please try again later.');
        setLoading(false);
        return;
      }
      json = await res.json() as { ok: boolean; error?: string };
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
      return;
    }

    if (!json.ok) {
      setError(json.error ?? 'Verification failed. Try again.');
      setLoading(false);
      return;
    }

    await refreshProfile();
    closeAuthModal();
    setLoading(false);
  };

  const handleResend = async () => {
    setError(null);
    if (isNewRegistration) {
      // No session yet — resend by hitting the register endpoint again (respects 90s cooldown)
      try {
        const res = await fetch('/api/account/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password }),
        });
        const json = await res.json() as { ok: boolean; message?: string };
        if (json.ok) {
          setSuccess('A new code has been sent to your email.');
        } else {
          setError(json.message ?? 'Could not resend code. Please try again.');
        }
      } catch {
        setError('Network error. Please check your connection and try again.');
      }
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please sign in again.'); return; }
    const sent = await sendVerificationCode(session.access_token, email);
    if (sent) setSuccess('A new code has been sent to your email.');
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (step !== 'verify' && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box auth-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          {step === 'form' ? (
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
          ) : (
            <div className="auth-tabs">
              <span className="auth-tab auth-tab--active">Verify Email</span>
            </div>
          )}
          {step !== 'verify' && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body">
          {success && step === 'form' ? (
            <div className="auth-success">
              <span>✓</span> {success}
            </div>
          ) : step === 'verify' ? (
            /* OTP verification step */
            <form onSubmit={handleVerify} className="auth-form">
              <div className="auth-verify-info">
                <ShieldIcon size={32} className="auth-verify-icon" />
                <p>We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify your account.</p>
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  <ShieldIcon size={13} /> Verification Code
                </label>
                <input
                  type="text"
                  className="auth-input auth-code-input"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <div className="auth-error">
                  <AlertCircleIcon size={14} /> {error}
                </div>
              )}
              {success && (
                <div className="auth-success" style={{ marginBottom: 0 }}>
                  <span>✓</span> {success}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading || code.length !== 6}>
                {loading ? (
                  <><LoadingIcon size={14} className="auth-spinner" /> Verifying…</>
                ) : (
                  'Verify'
                )}
              </button>

              <button type="button" className="auth-switch-btn" style={{ marginTop: 8 }} onClick={handleResend}>
                Didn't receive it? Resend code
              </button>

              <button type="button" className="auth-switch-btn auth-back-btn" onClick={handleStartOver} disabled={loading}>
                {isNewRegistration ? 'Wrong email? Start over' : 'Wrong account? Sign out'}
              </button>
            </form>
          ) : (
            <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="auth-form">
              {tab === 'register' && (
                <div className="auth-field">
                  <label className="auth-label">
                    <UserIcon size={13} /> Username
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
                  <EmailIcon size={13} /> Email
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
                  <LockIcon size={13} /> Password
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
                  <AlertCircleIcon size={14} /> {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
                {loading ? (
                  <><LoadingIcon size={14} className="auth-spinner" /> {tab === 'login' ? 'Signing in…' : 'Creating account…'}</>
                ) : (
                  tab === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>
          )}

          {step === 'form' && (
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
          )}
        </div>
      </div>

      <style>{`
        .auth-modal { width: 100%; max-width: 360px; overflow: hidden; }
        /* Win95 title bar */
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 3px 4px 3px 8px; height: 22px;
          background: linear-gradient(90deg, #5a3620 0%, #73492a 35%, #8a5a35 100%);
          color: #ffffff; border-bottom: none; flex-shrink: 0;
        }
        .auth-tabs { display: flex; gap: 0; }
        .auth-tab {
          padding: 2px 10px; font-size: 11px;
          background: none; border: none; border-bottom: 2px solid transparent;
          cursor: pointer; color: rgba(255,255,255,0.7);
          font-family: var(--font-body); box-shadow: none; height: auto;
        }
        .auth-tab:hover { color: #ffffff; transform: none; box-shadow: none; }
        .auth-tab--active { color: #ffffff; border-bottom-color: #ffffff; font-weight: bold; }
        /* Win95 X close button */
        .modal-close-btn {
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 14px; border-radius: 0;
          background: #dea77d;
          border: 2px solid; border-color: #ffffff #c07f55 #c07f55 #ffffff;
          cursor: pointer; color: #000000;
          padding: 0; box-shadow: none; font-size: 10px; font-weight: bold; line-height: 1;
          flex-shrink: 0; margin-left: auto;
        }
        .modal-close-btn:hover { background: #d0d0d0; transform: none; }
        .modal-close-btn:active { border-color: #c07f55 #ffffff #ffffff #c07f55; }
        .modal-body { padding: 14px 14px 12px; }
        .auth-form { display: flex; flex-direction: column; gap: 10px; }
        .auth-field { display: flex; flex-direction: column; gap: 3px; }
        .auth-label {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--body-text);
          font-weight: bold;
        }
        .auth-input {
          width: 100%;
          padding: 3px 6px;
          border-radius: 0;
          border: 2px solid; border-color: #c07f55 #ffffff #ffffff #c07f55;
          background: #ffffff;
          color: #000000;
          font-size: 12px;
          box-shadow: none; outline: none;
          font-family: var(--font-body);
          transition: none;
        }
        .auth-input:focus {
          outline: 1px dotted #73492a;
          outline-offset: 1px;
          border-color: #c07f55 #ffffff #ffffff #c07f55;
          box-shadow: none;
        }
        [data-theme="dark"] .auth-input {
          background: #1a0d04;
          color: #f5e6dc;
          border-color: #6b3d1f #2a1505 #2a1505 #6b3d1f;
        }
        [data-theme="dark"] .auth-input::placeholder { color: #c7a690; opacity: 1; }
        [data-theme="dark"] .auth-input:focus {
          outline: 1px dotted #c8935c;
          border-color: #8a4f2a #2a1505 #2a1505 #8a4f2a;
        }
        .auth-code-input {
          font-size: 16px; letter-spacing: 6px; text-align: center;
          padding: 6px;
        }
        .auth-verify-info {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          text-align: center; color: var(--body-text-muted); font-size: 12px;
          padding: 4px 0;
        }
        .auth-verify-icon { color: var(--accent); }
        .auth-back-btn { margin-top: 4px; opacity: 0.6; font-size: 11px; }
        .auth-back-btn:hover { opacity: 1; }
        .auth-back-btn:disabled { cursor: not-allowed; opacity: 0.35; }
        /* Win95 flat error/success messages */
        .auth-error {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px;
          border: 1px solid #800000;
          background: #fff0f0;
          color: #800000; font-size: 11px;
        }
        .auth-success {
          padding: 8px; text-align: center;
          border: 1px solid #008000;
          background: #f0fff0;
          color: #004000; font-size: 11px;
          margin-bottom: 8px;
        }
        .auth-submit-btn {
          width: 100%; justify-content: center;
          padding: 4px 12px; font-size: 12px; height: 26px;
        }
        .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-switch {
          margin-top: 10px; text-align: center;
          font-size: 11px; color: var(--body-text-muted);
        }
        .auth-switch-btn {
          background: none; border: none; color: var(--accent);
          cursor: pointer; font-size: 11px; padding: 0; box-shadow: none;
          font-family: var(--font-body); text-decoration: underline;
        }
        .auth-switch-btn:hover { color: var(--accent-light); transform: none; box-shadow: none; }
      `}</style>
    </div>
  );
}
