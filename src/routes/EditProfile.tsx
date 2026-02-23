import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRoundCog, Loader, CheckCircle, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function EditProfile() {
  const { user, profile, refreshProfile, openAuthModal, updateProfilePicture } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setWebsite(profile.website ?? '');
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
    setSaving(true); setError(null); setSaveMessage(null);
    const avatarUrl = await uploadAvatar();
    const updates: Record<string, string | null> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
    };
    if (avatarUrl) updates.avatar_url = avatarUrl;

    const { error: err } = await supabase
      .from('covers_cafe_profiles')
      .update(updates)
      .eq('id', user.id);
    if (err) {
      setError(err.message);
      setSaveMessage(null);
    } else {
      if (avatarUrl) updateProfilePicture(avatarUrl);
      await refreshProfile();
      setSaved(true);
      setSaveMessage(avatarUrl ? 'Profile saved. Your new profile picture is now live.' : 'Profile saved successfully.');
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <div>
        <h1 className="section-title"><UserRoundCog size={22} /> Edit Profile</h1>
        <div className="card" style={{ maxWidth: 400, padding: 32, textAlign: 'center' }}>
          <p className="text-muted">Sign in to edit your profile.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openAuthModal('login')}>Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title"><UserRoundCog size={22} /> Edit Profile</h1>
      <form onSubmit={handleSave} className="edit-form card">
        <div className="form-row">
          <label className="form-label">Display Name</label>
          <input type="text" className="form-input" placeholder="Your display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Username <span className="form-readonly">(read-only)</span></label>
          <input type="text" className="form-input" value={profile?.username ?? ''} disabled />
        </div>
        <div className="form-row">
          <label className="form-label">Bio</label>
          <textarea className="form-input" rows={4} placeholder="Tell the community about yourself…" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">Website</label>
          <input type="url" className="form-input" placeholder="https://yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>


        <div className="form-row">
          <label className="form-label">Profile Picture</label>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setAvatarPreview(URL.createObjectURL(picked));
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => avatarInputRef.current?.click()}><Upload size={14} /> Upload image</button>
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
            {saving ? <><Loader size={14} className="upload-spinner" /> Saving…</> : saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/profile')}>Cancel</button>
        </div>
      </form>

      <style>{`
        .edit-form { max-width: 520px; display: flex; flex-direction: column; gap: 16px; }
        .form-row { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: 13px; font-weight: bold; color: var(--body-text); text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
        [data-theme="dark"] .form-label { text-shadow: none; }
        .form-readonly { font-weight: normal; color: var(--body-text-muted); font-size: 11px; }
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
        .edit-error { padding: 8px 10px; border-radius: 4px; background: rgba(200,50,30,0.1); border: 1px solid rgba(200,50,30,0.3); color: #c83220; font-size: 13px; }
        .edit-success { padding: 8px 10px; border-radius: 4px; background: rgba(30,126,52,0.1); border: 1px solid rgba(30,126,52,0.35); color: #1e7e34; font-size: 13px; }
        .edit-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
