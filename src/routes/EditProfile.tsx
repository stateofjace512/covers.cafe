import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRoundCog, Loader, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function EditProfile() {
  const { user, profile, refreshProfile, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setWebsite(profile.website ?? '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setError(null);
    const { error: err } = await supabase
      .from('covers_cafe_profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, website: website.trim() || null })
      .eq('id', user.id);
    if (err) {
      setError(err.message);
    } else {
      await refreshProfile();
      setSaved(true);
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
          <textarea className="form-input" rows={4} placeholder="Tell the community about yourself…" value={bio} onChange={(e) => setBio(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-row">
          <label className="form-label">Website</label>
          <input type="url" className="form-input" placeholder="https://yoursite.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <div className="edit-error">{error}</div>}

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
        .edit-actions { display: flex; gap: 10px; padding-top: 4px; }
        .upload-spinner { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
