import { useState } from 'react';
import { Cog, Moon, Sun, Lock, Mail, Trash2, AlertTriangle, CheckCircle, Loader, ShieldCheck, MonitorSmartphone, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ActiveForm = null | 'password' | 'email' | 'delete';

// ---------------------------------------------------------------------------
// Change Password
// ---------------------------------------------------------------------------
function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    if (next.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);

    // Re-auth with current password to confirm identity
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: current,
    });
    if (signInErr) {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(onDone, 1800);
  }

  if (success) return (
    <div className="settings-inline-success">
      <CheckCircle size={15} /> Password updated.
    </div>
  );

  return (
    <form className="settings-inline-form" onSubmit={handleSubmit}>
      <input className="settings-input" type="password" placeholder="Current password"
        value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      <input className="settings-input" type="password" placeholder="New password (min 6 chars)"
        value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
      <input className="settings-input" type="password" placeholder="Confirm new password"
        value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      {error && <div className="settings-inline-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="settings-inline-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Loader size={13} className="settings-spinner" /> Saving…</> : 'Update Password'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={loading}>Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Change Email
// ---------------------------------------------------------------------------
function ChangeEmailForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Re-auth with current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });
    if (signInErr) {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please sign in again.'); setLoading(false); return; }

    const res = await fetch('/api/account/send-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ newEmail }),
    });
    const json = await res.json() as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? 'Failed to send verification code.');
      setLoading(false);
      return;
    }

    setStep('verify');
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please sign in again.'); setLoading(false); return; }

    const res = await fetch('/api/account/complete-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ newEmail, code }),
    });
    const json = await res.json() as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? 'Invalid or expired code.');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    // Refresh auth session so user object reflects the new email
    await supabase.auth.refreshSession();
    setTimeout(onDone, 2000);
  }

  if (success) return (
    <div className="settings-inline-success">
      <CheckCircle size={15} /> Email updated. You may need to sign in again.
    </div>
  );

  if (step === 'verify') return (
    <form className="settings-inline-form" onSubmit={handleVerify}>
      <div className="settings-inline-hint">
        <ShieldCheck size={14} />
        A 6-digit code was sent to <strong>{newEmail}</strong>. Enter it below to confirm the change.
      </div>
      <input className="settings-input settings-code-input" type="text" placeholder="000000"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      {error && <div className="settings-inline-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="settings-inline-actions">
        <button type="submit" className="btn btn-primary" disabled={loading || code.length !== 6}>
          {loading ? <><Loader size={13} className="settings-spinner" /> Verifying…</> : 'Confirm Change'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={loading}>Cancel</button>
      </div>
    </form>
  );

  return (
    <form className="settings-inline-form" onSubmit={handleRequest}>
      <input className="settings-input" type="password" placeholder="Current password"
        value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password" required />
      <input className="settings-input" type="email" placeholder="New email address"
        value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
        autoComplete="email" required />
      {error && <div className="settings-inline-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="settings-inline-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><Loader size={13} className="settings-spinner" /> Sending code…</> : 'Send Verification Code'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={loading}>Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete Account
// ---------------------------------------------------------------------------
function DeleteAccountForm({ onDone }: { onDone: () => void }) {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (confirm !== 'delete my account') {
      setError('Type "delete my account" exactly to confirm.');
      return;
    }
    setLoading(true);

    // Re-auth to confirm identity
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password,
    });
    if (signInErr) {
      setError('Password is incorrect.');
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please sign in again.'); setLoading(false); return; }

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json() as { ok: boolean; message?: string };
    if (!json.ok) {
      setError(json.message ?? 'Failed to delete account.');
      setLoading(false);
      return;
    }

    await signOut();
  }

  return (
    <form className="settings-inline-form" onSubmit={handleDelete}>
      <div className="settings-delete-warning">
        <AlertTriangle size={15} />
        <span>
          This will permanently delete your account and <strong>all covers you've uploaded</strong>.
          This cannot be undone.
        </span>
      </div>
      <input className="settings-input" type="password" placeholder="Your password"
        value={password} onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password" required />
      <input className="settings-input" type="text" placeholder='Type "delete my account" to confirm'
        value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      {error && <div className="settings-inline-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="settings-inline-actions">
        <button type="submit" className="btn btn-danger" disabled={loading}>
          {loading ? <><Loader size={13} className="settings-spinner" /> Deleting…</> : 'Delete My Account'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={loading}>Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Settings page
// ---------------------------------------------------------------------------
export default function Settings() {
  const { user, signOut, openAuthModal } = useAuth();
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [signOutOthersMsg, setSignOutOthersMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSignOutOtherDevices = async () => {
    setSigningOutOthers(true);
    setSignOutOthersMsg(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) {
        setSignOutOthersMsg({ ok: false, text: error.message });
      } else {
        setSignOutOthersMsg({ ok: true, text: 'All other sessions have been signed out.' });
      }
    } catch {
      setSignOutOthersMsg({ ok: false, text: 'Could not sign out other devices.' });
    }
    setSigningOutOthers(false);
  };

  const setTheme = (theme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: theme }));
  };

  const currentTheme = typeof document !== 'undefined'
    ? (document.documentElement.getAttribute('data-theme') ?? 'light')
    : 'light';

  return (
    <div>
      <h1 className="section-title"><Cog size={22} /> Settings</h1>

      <div className="settings-layout">

        {/* ── Appearance ─────────────────────────────────────── */}
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

        {/* ── Account ────────────────────────────────────────── */}
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

        {/* ── Security (only shown when signed in) ───────────── */}
        {user && (
          <section className="card settings-section">
            <h2 className="settings-section-title">Security</h2>

            {/* Change Password */}
            <div className="settings-row settings-row--expandable">
              <div className="settings-row-info">
                <span className="settings-row-label"><Lock size={13} /> Password</span>
                <span className="settings-row-desc">Update your sign-in password.</span>
              </div>
              {activeForm !== 'password' && (
                <div className="settings-row-control">
                  <button className="btn btn-secondary"
                    onClick={() => setActiveForm(activeForm === 'password' ? null : 'password')}>
                    Change
                  </button>
                </div>
              )}
            </div>
            {activeForm === 'password' && (
              <div className="settings-inline-expand">
                <ChangePasswordForm onDone={() => setActiveForm(null)} />
              </div>
            )}

            <div className="settings-divider" />

            {/* Change Email */}
            <div className="settings-row settings-row--expandable">
              <div className="settings-row-info">
                <span className="settings-row-label"><Mail size={13} /> Email address</span>
                <span className="settings-row-desc">{user.email}</span>
              </div>
              {activeForm !== 'email' && (
                <div className="settings-row-control">
                  <button className="btn btn-secondary"
                    onClick={() => setActiveForm(activeForm === 'email' ? null : 'email')}>
                    Change
                  </button>
                </div>
              )}
            </div>
            {activeForm === 'email' && (
              <div className="settings-inline-expand">
                <ChangeEmailForm onDone={() => setActiveForm(null)} />
              </div>
            )}

            <div className="settings-divider" />

            {/* Sessions */}
            <div className="settings-row">
              <div className="settings-row-info">
                <span className="settings-row-label"><MonitorSmartphone size={13} /> Active Sessions</span>
                <span className="settings-row-desc">Sign out all other devices except this one.</span>
              </div>
              <div className="settings-row-control">
                <button
                  className="btn btn-secondary"
                  onClick={handleSignOutOtherDevices}
                  disabled={signingOutOthers}
                >
                  {signingOutOthers
                    ? <><Loader size={13} className="settings-spinner" /> Signing out…</>
                    : <><LogOut size={13} /> Sign Out Others</>}
                </button>
              </div>
            </div>
            {signOutOthersMsg && (
              <div className={`settings-session-msg${signOutOthersMsg.ok ? ' settings-session-msg--ok' : ' settings-session-msg--err'}`}>
                {signOutOthersMsg.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                {signOutOthersMsg.text}
              </div>
            )}
          </section>
        )}

        {/* ── Danger Zone (only shown when signed in) ────────── */}
        {user && (
          <section className="card settings-section settings-danger-section">
            <h2 className="settings-section-title settings-danger-title">
              <Trash2 size={15} /> Danger Zone
            </h2>

            <div className="settings-row settings-row--expandable">
              <div className="settings-row-info">
                <span className="settings-row-label">Delete account</span>
                <span className="settings-row-desc">
                  Permanently removes your account and all uploaded covers. Cannot be undone.
                </span>
              </div>
              {activeForm !== 'delete' && (
                <div className="settings-row-control">
                  <button className="btn btn-danger"
                    onClick={() => setActiveForm(activeForm === 'delete' ? null : 'delete')}>
                    Delete Account
                  </button>
                </div>
              )}
            </div>
            {activeForm === 'delete' && (
              <div className="settings-inline-expand">
                <DeleteAccountForm onDone={() => setActiveForm(null)} />
              </div>
            )}
          </section>
        )}

        {/* ── About ──────────────────────────────────────────── */}
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
          display: flex; align-items: center; gap: 6px;
        }
        [data-theme="dark"] .settings-section-title { text-shadow: none; }
        .settings-row { display: flex; align-items: center; gap: 16px; justify-content: space-between; flex-wrap: wrap; }
        .settings-row--expandable { padding-bottom: 4px; }
        .settings-row-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 180px; }
        .settings-row-label {
          font-size: 13px; font-weight: bold; color: var(--body-text);
          display: flex; align-items: center; gap: 5px;
        }
        .settings-row-desc { font-size: 12px; color: var(--body-text-muted); line-height: 1.5; }
        .settings-row-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .settings-divider { height: 1px; background: var(--body-border); margin: 14px 0; }
        .settings-kv { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 13px; }
        .kv-key { font-weight: bold; color: var(--body-text-muted); min-width: 100px; }
        .kv-val { color: var(--body-text); }

        /* Danger section */
        .settings-danger-section {
          border-color: rgba(200, 50, 30, 0.25);
          background: rgba(200, 50, 30, 0.03);
        }
        [data-theme="dark"] .settings-danger-section { background: rgba(200, 50, 30, 0.06); }
        .settings-danger-title { color: #c83220 !important; }

        /* Inline expand form area */
        .settings-inline-expand {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--body-border);
        }
        .settings-inline-form {
          display: flex; flex-direction: column; gap: 10px;
        }
        .settings-input {
          width: 100%; padding: 8px 12px; border-radius: 4px;
          border: 1px solid var(--body-card-border);
          background: var(--body-card-bg); color: var(--body-text);
          font-size: 13px; font-family: Arial, Helvetica, sans-serif;
          box-shadow: var(--shadow-inset-sm); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .settings-input:focus {
          border-color: var(--accent);
          box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2);
        }
        .settings-code-input {
          font-size: 22px; letter-spacing: 6px; text-align: center; font-weight: bold; padding: 10px;
        }
        .settings-inline-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .settings-inline-error {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 4px; font-size: 12px;
          background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3); color: #c83220;
        }
        .settings-inline-success {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 12px; border-radius: 4px; font-size: 13px; font-weight: bold;
          background: rgba(40,160,80,0.1); border: 1px solid rgba(40,160,80,0.3); color: #1a7a40;
        }
        .settings-inline-hint {
          display: flex; align-items: flex-start; gap: 6px;
          font-size: 12px; color: var(--body-text-muted); line-height: 1.5;
          padding: 8px 10px; border-radius: 4px; background: var(--body-card-bg);
          border: 1px solid var(--body-border);
        }
        .settings-delete-warning {
          display: flex; align-items: flex-start; gap: 7px;
          padding: 10px 12px; border-radius: 4px; font-size: 12px; line-height: 1.5;
          background: rgba(200,50,30,0.08); border: 1px solid rgba(200,50,30,0.25); color: #c83220;
        }
        .settings-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .settings-session-msg {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 4px; font-size: 12px; margin-top: 8px;
        }
        .settings-session-msg--ok { background: rgba(40,160,80,0.1); border: 1px solid rgba(40,160,80,0.3); color: #1a7a40; }
        .settings-session-msg--err { background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3); color: #c83220; }

        /* Danger button */
        .btn-danger {
          background: linear-gradient(180deg, #e04030 0%, #b83020 100%);
          color: #fff; border-color: #a02818;
          text-shadow: 0 1px 1px rgba(0,0,0,0.3);
        }
        .btn-danger:hover { background: linear-gradient(180deg, #e85040 0%, #c03828 100%); transform: translateY(-1px); }
        .btn-danger:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}
