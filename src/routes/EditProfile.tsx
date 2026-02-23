import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import LoadingIcon from '../components/LoadingIcon';
import CheckCircleIcon from '../components/CheckCircleIcon';
import UploadDownloadIcon from '../components/UploadDownloadIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function EditProfile() {
  const { user, profile, refreshProfile, openAuthModal, updateProfilePicture } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  // Remaining-changes counters derived from the profile change-log columns
  const [usernameChangesRemaining, setUsernameChangesRemaining] = useState<number | null>(null);
  const [displayNameChangesRemaining, setDisplayNameChangesRemaining] = useState<number | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setWebsite(profile.website ?? '');

      const now = Date.now();
      const usernameWindowMs = 14 * 24 * 60 * 60 * 1000;
      const displayNameWindowMs = 30 * 24 * 60 * 60 * 1000;

      const rawUsernameLog = (profile as unknown as Record<string, unknown>).username_change_log;
      const usernameLog: string[] = Array.isArray(rawUsernameLog) ? rawUsernameLog : [];
      const recentUsernameChanges = usernameLog.filter(
        (ts) => now - new Date(ts).getTime() < usernameWindowMs,
      );
      setUsernameChangesRemaining(Math.max(0, 2 - recentUsernameChanges.length));

      const rawDisplayLog = (profile as unknown as Record<string, unknown>).display_name_change_log;
      const displayLog: string[] = Array.isArray(rawDisplayLog) ? rawDisplayLog : [];
      const recentDisplayChanges = displayLog.filter(
        (ts) => now - new Date(ts).getTime() < displayNameWindowMs,
      );
      setDisplayNameChangesRemaining(Math.max(0, 5 - recentDisplayChanges.length));
    }
  }, [profile]);

  const uploadAvatar = async () => {
    if (!user || !avatarPreview) return null;
    const img = new Image();
    img.src = avatarPreview;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const minSide = Math.min(img.width, img.height);
    const cropSide = minSide / Math.max(avatarZoom, 1);
    const sx = (img.width - cropSide) / 2;
    const sy = (img.height - cropSide) / 2;
    ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, 500, 500);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return null;

    const path = `${user.id}/avatar.jpg`;
    const { error: storageError } = await supabase.storage.from('covers_cafe_avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (storageError) throw new Error(storageError.message);
    const { data } = supabase.storage.from('covers_cafe_avatars').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setFieldError(null);
    setSaveMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session expired. Please sign in again.');
      setSaving(false);
      return;
    }

    // ── Step 1: handle username change ────────────────────────────────────
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername !== (profile?.username ?? '')) {
      const res = await fetch('/api/account/update-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: trimmedUsername }),
      });
      const json = await res.json() as { ok: boolean; message?: string; remaining?: number };
      if (!json.ok) {
        setFieldError({ field: 'username', message: json.message ?? 'Username change failed.' });
        setSaving(false);
        return;
      }
      if (json.remaining !== undefined) {
        setUsernameChangesRemaining(json.remaining);
      }
    }

    // ── Step 2: upload avatar if a new one was selected ───────────────────
    let avatarUrl: string | null = null;
    try {
      avatarUrl = await uploadAvatar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed.');
      setSaving(false);
      return;
    }

    // ── Step 3: update display_name, bio, website (+ optional avatar_url) ─
    const body: Record<string, string | null> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
    };
    if (avatarUrl) body.avatar_url = avatarUrl;

    const profileRes = await fetch('/api/account/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const profileJson = await profileRes.json() as {
      ok: boolean;
      message?: string;
      field?: string;
      displayNameRemaining?: number;
    };

    if (!profileJson.ok) {
      if (profileJson.field) {
        setFieldError({ field: profileJson.field, message: profileJson.message ?? 'Update failed.' });
      } else {
        setError(profileJson.message ?? 'Failed to save profile.');
      }
      setSaving(false);
      return;
    }

    if (profileJson.displayNameRemaining !== undefined) {
      setDisplayNameChangesRemaining(profileJson.displayNameRemaining);
    }

    if (avatarUrl) updateProfilePicture(avatarUrl);
    await refreshProfile();
    setSaved(true);
    setSaveMessage(
      avatarUrl
        ? 'Profile saved. Your new profile picture is now live.'
        : 'Profile saved successfully.',
    );
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><UserIcon size={22} /> Edit Profile</h1>
        <div className="card" style={{ maxWidth: 400, padding: 32, textAlign: 'center' }}>
          <p className="text-muted">Sign in to edit your profile.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuthModal('login')}>Sign In</button>
        </div>
      </div>
    );
  }

  const usernameExhausted = usernameChangesRemaining === 0 && username === (profile?.username ?? '');
  const displayNameExhausted = displayNameChangesRemaining === 0 && displayName === (profile?.display_name ?? '');

  return (
    <div>
      <h1 className="section-title"><UserIcon size={22} /> Edit Profile</h1>
      <form onSubmit={handleSave} className="edit-form card">

        {/* Username */}
        <div className="form-row">
          <div className="form-label-row">
            <label className="form-label">Username</label>
            {usernameChangesRemaining !== null && (
              <span className={`form-change-limit${usernameChangesRemaining === 0 ? ' form-change-limit--exhausted' : ''}`}>
                {usernameChangesRemaining === 0
                  ? 'No changes left (14-day window)'
                  : `${usernameChangesRemaining} change${usernameChangesRemaining !== 1 ? 's' : ''} left / 14 days`}
              </span>
            )}
          </div>
          <input
            type="text"
            className={`form-input${fieldError?.field === 'username' ? ' form-input--error' : ''}`}
            placeholder="yourname"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              if (fieldError?.field === 'username') setFieldError(null);
            }}
            disabled={usernameExhausted}
            maxLength={30}
          />
          {fieldError?.field === 'username' && (
            <span className="form-field-error">{fieldError.message}</span>
          )}
          <span className="form-hint">Lowercase letters, numbers, and underscores only.</span>
        </div>

        {/* Display Name */}
        <div className="form-row">
          <div className="form-label-row">
            <label className="form-label">Display Name</label>
            {displayNameChangesRemaining !== null && (
              <span className={`form-change-limit${displayNameChangesRemaining === 0 ? ' form-change-limit--exhausted' : ''}`}>
                {displayNameChangesRemaining === 0
                  ? 'No changes left (30-day window)'
                  : `${displayNameChangesRemaining} change${displayNameChangesRemaining !== 1 ? 's' : ''} left / 30 days`}
              </span>
            )}
          </div>
          <input
            type="text"
            className={`form-input${fieldError?.field === 'display_name' ? ' form-input--error' : ''}`}
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (fieldError?.field === 'display_name') setFieldError(null);
            }}
            disabled={displayNameExhausted}
            maxLength={50}
          />
          {fieldError?.field === 'display_name' && (
            <span className="form-field-error">{fieldError.message}</span>
          )}
        </div>

        {/* Bio */}
        <div className="form-row">
          <label className="form-label">Bio</label>
          <textarea className="form-input" rows={4} placeholder="Tell the community about yourself…" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        {/* Website */}
        <div className="form-row">
          <label className="form-label">Website</label>
          <input
            type="url"
            className={`form-input${fieldError?.field === 'website' ? ' form-input--error' : ''}`}
            placeholder="https://yoursite.com"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              if (fieldError?.field === 'website') setFieldError(null);
            }}
          />
          {fieldError?.field === 'website' && (
            <span className="form-field-error">{fieldError.message}</span>
          )}
        </div>

        {/* Profile Picture */}
        <div className="form-row">
          <label className="form-label">Profile Picture</label>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setAvatarPreview(URL.createObjectURL(picked));
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => avatarInputRef.current?.click()}><UploadDownloadIcon size={14} /> Upload image</button>
          {avatarPreview && (
            <>
              <div className="avatar-crop-preview">
                <img src={avatarPreview} alt="Avatar crop preview" style={{ transform: `scale(${avatarZoom})` }} />
              </div>
              <label className="form-hint">Zoom</label>
              <input type="range" min="1" max="2.5" step="0.1" value={avatarZoom} onChange={(e) => setAvatarZoom(parseFloat(e.target.value))} />
              <p className="form-hint">Saved as 500x500 square.</p>
            </>
          )}
        </div>

        {error && <div className="edit-error">{error}</div>}
        {saveMessage && <div className="edit-success">{saveMessage}</div>}

        <div className="edit-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><LoadingIcon size={14} className="upload-spinner" /> Saving…</> : saved ? <><CheckCircleIcon size={14} /> Saved!</> : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/profile')}>Cancel</button>
        </div>
      </form>

      <style>{`
        .edit-form { max-width: 520px; display: flex; flex-direction: column; gap: 16px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .form-label { font-size: 13px; font-weight: bold; color: var(--body-text); text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
        [data-theme="dark"] .form-label { text-shadow: none; }
        .form-hint { font-size: 11px; color: var(--body-text-muted); margin: 0; }
        .form-change-limit {
          font-size: 11px; color: var(--body-text-muted); white-space: nowrap;
          background: rgba(0,0,0,0.05); border-radius: 10px; padding: 2px 7px;
        }
        .form-change-limit--exhausted {
          color: #c83220;
          background: rgba(200,50,30,0.08);
          border: 1px solid rgba(200,50,30,0.2);
        }
        [data-theme="dark"] .form-change-limit { background: rgba(255,255,255,0.06); }
        [data-theme="dark"] .form-change-limit--exhausted { background: rgba(200,50,30,0.12); }
        .form-field-error { font-size: 12px; color: #c83220; }
        .avatar-crop-preview { width: 180px; height: 180px; border-radius: 8px; overflow: hidden; border: 1px solid var(--body-card-border); background: var(--sidebar-bg); }
        .avatar-crop-preview img { width: 100%; height: 100%; object-fit: cover; transform-origin: center; }

        .form-input {
          width: 100%; padding: 8px 12px; border-radius: 4px;
          border: 1px solid var(--body-card-border); background: var(--body-card-bg);
          color: var(--body-text); font-size: 13px; font-family: Arial, Helvetica, sans-serif;
          box-shadow: var(--shadow-inset-sm); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus { border-color: var(--accent); box-shadow: var(--shadow-inset-sm), 0 0 0 2px rgba(192,90,26,0.2); }
        .form-input:disabled { opacity: 0.55; cursor: not-allowed; }
        .form-input--error { border-color: rgba(200,50,30,0.6) !important; }
        .edit-error { padding: 8px 10px; border-radius: 4px; background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3); color: #c83220; font-size: 13px; }
        .edit-success { padding: 8px 10px; border-radius: 4px; background: rgba(30,126,52,0.1); border: 1px solid rgba(30,126,52,0.35); color: #1e7e34; font-size: 13px; }
        .edit-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
