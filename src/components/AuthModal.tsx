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
      // Need to verify  -  send code then show OTP step
      const token = data.session?.access_token ?? '';
      const sent = await sendVerificationCode(token, email);
      if (sent) {
        setStep('verify');
      }
    } else {
      // Already verified  -  close modal
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

    // Server validates username and sends OTP  -  account is NOT created yet.
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

    // OTP sent  -  show the verify step. No account exists yet.
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
        // Server signed us in  -  just set the session directly
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
      // No session yet  -  resend by hitting the register endpoint again (respects 90s cooldown)
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

      
    </div>
  );
}
