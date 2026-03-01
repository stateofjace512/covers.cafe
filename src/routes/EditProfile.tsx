import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserIcon from '../components/UserIcon';
import LoadingIcon from '../components/LoadingIcon';
import CheckCircleIcon from '../components/CheckCircleIcon';
import UploadDownloadIcon from '../components/UploadDownloadIcon';
import MilkIcon from '../components/MilkIcon';
import TeaIcon from '../components/TeaIcon';
import MoonIcon from '../components/MoonIcon';
import SunIcon from '../components/SunIcon';
import SettingSlideIcon from '../components/SettingSlideIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── Gradient accessibility check ─────────────────────────────────────────────
function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}
function relativeLuminance(r: number, g: number, b: number): number {
  const c = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
/** Returns error message if the gradient pair is inaccessible, null if ok. */
function gradientAccessibilityError(start: string, end: string): string | null {
  const rgbS = parseHex(start);
  const rgbE = parseHex(end);
  if (!rgbS || !rgbE) return 'Invalid color format.';
  const lumS = relativeLuminance(...rgbS);
  const lumE = relativeLuminance(...rgbE);
  if (Math.abs(lumS - lumE) > 0.5) {
    return 'These colors are too far apart in brightness. Please choose two colors with similar lightness for an accessible gradient.';
  }
  return null;
}

// ── Theme options ─────────────────────────────────────────────────────────────
const THEME_OPTIONS = [
  { id: 'light',     label: 'Frappe',   icon: <MilkIcon size={16} /> },
  { id: 'dark',      label: 'Mocha',    icon: <TeaIcon size={16} /> },
  { id: 'pureblack', label: 'Black',    icon: <MoonIcon size={16} /> },
  { id: 'crisp',     label: 'Crisp',    icon: <SunIcon size={16} /> },
  { id: 'gradient',  label: 'Gradient', icon: <SettingSlideIcon size={16} /> },
  { id: null,        label: 'None',     icon: <span style={{ fontSize: 12, opacity: 0.5 }}> - </span> },
] as const;

export default function EditProfile() {
  const { user, session, profile, refreshProfile, openAuthModal, updateProfilePicture } = useAuth();
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

  const [usernameChangesRemaining, setUsernameChangesRemaining] = useState<number | null>(null);
  const [displayNameChangesRemaining, setDisplayNameChangesRemaining] = useState<number | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Banner
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerZoom, setBannerZoom] = useState(1);
  const [bannerOffsetX, setBannerOffsetX] = useState(0);
  const [bannerOffsetY, setBannerOffsetY] = useState(0);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingBanner = useRef(false);
  const bannerDragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0, zoom: 1 });

  // Profile theme
  const [profileTheme, setProfileTheme] = useState<string | null>(null);
  const [gradientStart, setGradientStart] = useState('#4f46e5');
  const [gradientEnd, setGradientEnd] = useState('#db2777');
  const [gradientError, setGradientError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setWebsite(profile.website ?? '');
      setProfileTheme(profile.profile_theme ?? null);
      if (profile.profile_gradient_start) setGradientStart(profile.profile_gradient_start);
      if (profile.profile_gradient_end) setGradientEnd(profile.profile_gradient_end);

      const now = Date.now();
      const usernameWindowMs = 14 * 24 * 60 * 60 * 1000;
      const displayNameWindowMs = 30 * 24 * 60 * 60 * 1000;

      const rawUsernameLog = (profile as unknown as Record<string, unknown>).username_change_log;
      const usernameLog: string[] = Array.isArray(rawUsernameLog) ? rawUsernameLog : [];
      const recentUsernameChanges = usernameLog.filter((ts) => now - new Date(ts).getTime() < usernameWindowMs);
      setUsernameChangesRemaining(Math.max(0, 2 - recentUsernameChanges.length));

      const rawDisplayLog = (profile as unknown as Record<string, unknown>).display_name_change_log;
      const displayLog: string[] = Array.isArray(rawDisplayLog) ? rawDisplayLog : [];
      const recentDisplayChanges = displayLog.filter((ts) => now - new Date(ts).getTime() < displayNameWindowMs);
      setDisplayNameChangesRemaining(Math.max(0, 5 - recentDisplayChanges.length));
    }
  }, [profile]);

  const uploadAvatar = async () => {
    if (!user || !session || !avatarPreview) return null;
    const img = new Image();
    img.src = avatarPreview;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const canvas = document.createElement('canvas');
    canvas.width = 500; canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const minSide = Math.min(img.width, img.height);
    const cropSide = minSide / Math.max(avatarZoom, 1);
    // Center crop, then apply offset (offset is -1..1 fraction of the remaining space)
    const maxOffsetX = (img.width - cropSide) / 2;
    const maxOffsetY = (img.height - cropSide) / 2;
    const sx = maxOffsetX + avatarOffsetX * maxOffsetX;
    const sy = maxOffsetY + avatarOffsetY * maxOffsetY;
    ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, 500, 500);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return null;
    const form = new FormData();
    form.append('file', blob, 'avatar.jpg');
    const res = await fetch('/api/upload-avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token },
      body: form,
    });
    const json = await res.json() as { ok: boolean; url?: string; message?: string };
    if (!json.ok || !json.url) throw new Error(json.message ?? 'Avatar upload failed');
    return json.url;
  };

  const uploadBanner = async (): Promise<string | null> => {
    if (!user || !session || !bannerPreview) return null;
    const img = new Image();
    img.src = bannerPreview;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const TARGET_W = 1920, TARGET_H = 1080;
    // The desktop profile banner is 3:1. The stored 1920×1080 image is displayed
    // with background-size:cover in a 3:1 container, which clips exactly 220px from
    // top and bottom (20.4%), leaving a 1920×640 center band visible on desktop.
    // We crop a 3:1 region (matching the editor preview) and embed it in that center
    // band. Top/bottom bands are filled with adjacent source pixels for mobile users
    // (mobile shows the full stored height with sides clipped).
    const DISPLAY_ASPECT = 3.0; // 3:1, matches desktop banner container
    const CENTER_H = Math.round(TARGET_W / DISPLAY_ASPECT); // 640px
    const CENTER_Y = Math.round((TARGET_H - CENTER_H) / 2); // 220px
    // Crop a 3:1 region from the source using zoom and offset
    const srcAspect = img.width / img.height;
    let cropW: number, cropH: number;
    if (srcAspect > DISPLAY_ASPECT) {
      cropH = img.height / bannerZoom;
      cropW = cropH * DISPLAY_ASPECT;
    } else {
      cropW = img.width / bannerZoom;
      cropH = cropW / DISPLAY_ASPECT;
    }
    const maxOffsetX = (img.width - cropW) / 2;
    const maxOffsetY = (img.height - cropH) / 2;
    const sx = maxOffsetX + bannerOffsetX * maxOffsetX;
    const sy = maxOffsetY + bannerOffsetY * maxOffsetY;
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    // Draw the 3:1 crop into the center band (what desktop shows)
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, CENTER_Y, TARGET_W, CENTER_H);
    // Fill top band with source content above the 3:1 crop (extra context for mobile)
    const extraSrcH = cropH * CENTER_Y / CENTER_H; // source pixels for each extra band
    const topSrcY = sy - extraSrcH;
    if (topSrcY >= 0) {
      ctx.drawImage(img, sx, topSrcY, cropW, extraSrcH, 0, 0, TARGET_W, CENTER_Y);
    } else if (sy > 0) {
      const availCanvasH = Math.round(sy * CENTER_Y / extraSrcH);
      ctx.drawImage(img, sx, 0, cropW, sy, 0, CENTER_Y - availCanvasH, TARGET_W, availCanvasH);
    }
    // Fill bottom band with source content below the 3:1 crop (extra context for mobile)
    const botSrcY = sy + cropH;
    const botAvail = img.height - botSrcY;
    if (botAvail >= extraSrcH) {
      ctx.drawImage(img, sx, botSrcY, cropW, extraSrcH, 0, CENTER_Y + CENTER_H, TARGET_W, CENTER_Y);
    } else if (botAvail > 0) {
      const availCanvasH = Math.round(botAvail * CENTER_Y / extraSrcH);
      ctx.drawImage(img, sx, botSrcY, cropW, botAvail, 0, CENTER_Y + CENTER_H, TARGET_W, availCanvasH);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Could not encode image');
    const form = new FormData();
    form.append('file', blob, 'banner.jpg');
    const apiRes = await fetch('/api/upload-banner', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token },
      body: form,
    });
    const rawText = await apiRes.text();
    let json: { ok: boolean; url?: string; message?: string };
    try {
      json = JSON.parse(rawText) as typeof json;
    } catch {
      throw new Error(`Banner upload failed (${apiRes.status}): ${rawText.slice(0, 300)}`);
    }
    if (!json.ok || !json.url) throw new Error(json.message ?? 'Banner upload failed');
    return json.url;
  };

  // ── Banner drag-to-reposition ────────────────────────────────────────────────
  // When zoom decreases, re-clamp offsets so the image never shows empty space.
  // At zoom z, the max safe offset is (z - 1) in each axis.
  useEffect(() => {
    const max = Math.max(0, bannerZoom - 1);
    setBannerOffsetX(x => Math.max(-max, Math.min(max, x)));
    setBannerOffsetY(y => Math.max(-max, Math.min(max, y)));
  }, [bannerZoom]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingBanner.current || !bannerContainerRef.current) return;
      const containerW = bannerContainerRef.current.offsetWidth;
      const containerH = bannerContainerRef.current.offsetHeight;
      const dx = e.clientX - bannerDragStart.current.x;
      const dy = e.clientY - bannerDragStart.current.y;
      const max = Math.max(0, bannerDragStart.current.zoom - 1);
      setBannerOffsetX(Math.max(-max, Math.min(max, bannerDragStart.current.offsetX + (2 * dx) / containerW)));
      setBannerOffsetY(Math.max(-max, Math.min(max, bannerDragStart.current.offsetY + (2 * dy) / containerH)));
    };
    const onUp = () => { isDraggingBanner.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleBannerMouseDown = (e: React.MouseEvent) => {
    isDraggingBanner.current = true;
    bannerDragStart.current = { x: e.clientX, y: e.clientY, offsetX: bannerOffsetX, offsetY: bannerOffsetY, zoom: bannerZoom };
    e.preventDefault();
  };

  const handleBannerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setBannerZoom(z => Math.max(1, Math.min(3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  const handleBannerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDraggingBanner.current = true;
    bannerDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, offsetX: bannerOffsetX, offsetY: bannerOffsetY, zoom: bannerZoom };
  };

  const handleBannerTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingBanner.current || !bannerContainerRef.current || e.touches.length !== 1) return;
    e.preventDefault();
    const containerW = bannerContainerRef.current.offsetWidth;
    const containerH = bannerContainerRef.current.offsetHeight;
    const dx = e.touches[0].clientX - bannerDragStart.current.x;
    const dy = e.touches[0].clientY - bannerDragStart.current.y;
    const max = Math.max(0, bannerDragStart.current.zoom - 1);
    setBannerOffsetX(Math.max(-max, Math.min(max, bannerDragStart.current.offsetX + (2 * dx) / containerW)));
    setBannerOffsetY(Math.max(-max, Math.min(max, bannerDragStart.current.offsetY + (2 * dy) / containerH)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate gradient before saving
    if (profileTheme === 'gradient') {
      const err = gradientAccessibilityError(gradientStart, gradientEnd);
      if (err) { setGradientError(err); return; }
    }

    setSaving(true); setError(null); setFieldError(null); setSaveMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please sign in again.'); setSaving(false); return; }

    // Username change
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername !== (profile?.username ?? '')) {
      const res = await fetch('/api/account/update-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ username: trimmedUsername }),
      });
      const json = await res.json() as { ok: boolean; message?: string; remaining?: number };
      if (!json.ok) {
        setFieldError({ field: 'username', message: json.message ?? 'Username change failed.' });
        setSaving(false); return;
      }
      if (json.remaining !== undefined) setUsernameChangesRemaining(json.remaining);
    }

    // Avatar upload
    let avatarUrl: string | null = null;
    try { avatarUrl = await uploadAvatar(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed.');
      setSaving(false); return;
    }

    // Banner upload
    let bannerUrl: string | null = null;
    try { bannerUrl = await uploadBanner(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Banner upload failed.');
      setSaving(false); return;
    }

    // Build profile update body
    const body: Record<string, string | null> = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      profile_theme: profileTheme,
      profile_gradient_start: profileTheme === 'gradient' ? gradientStart : null,
      profile_gradient_end: profileTheme === 'gradient' ? gradientEnd : null,
    };
    if (avatarUrl) body.avatar_url = avatarUrl;
    if (bannerUrl) body.banner_url = bannerUrl;

    const profileRes = await fetch('/api/account/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(body),
    });
    const profileJson = await profileRes.json() as { ok: boolean; message?: string; field?: string; displayNameRemaining?: number };

    if (!profileJson.ok) {
      if (profileJson.field) setFieldError({ field: profileJson.field, message: profileJson.message ?? 'Update failed.' });
      else setError(profileJson.message ?? 'Failed to save profile.');
      setSaving(false); return;
    }

    if (profileJson.displayNameRemaining !== undefined) setDisplayNameChangesRemaining(profileJson.displayNameRemaining);
    if (avatarUrl) updateProfilePicture(avatarUrl);
    await refreshProfile();
    setSaved(true);
    setSaveMessage('Profile saved successfully.');
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
              <span className={'form-change-limit' + (usernameChangesRemaining === 0 ? ' form-change-limit--exhausted' : '')}>
                {usernameChangesRemaining === 0
                  ? 'No changes left (14-day window)'
                  : usernameChangesRemaining + ' change' + (usernameChangesRemaining !== 1 ? 's' : '') + ' left / 14 days'}
              </span>
            )}
          </div>
          <input
            type="text"
            className={'form-input' + (fieldError?.field === 'username' ? ' form-input--error' : '')}
            placeholder="yourname"
            value={username}
            onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); if (fieldError?.field === 'username') setFieldError(null); }}
            disabled={usernameExhausted}
            maxLength={30}
          />
          {fieldError?.field === 'username' && <span className="form-field-error">{fieldError.message}</span>}
          <span className="form-hint">Lowercase letters, numbers, and underscores only.</span>
        </div>

        {/* Display Name */}
        <div className="form-row">
          <div className="form-label-row">
            <label className="form-label">Display Name</label>
            {displayNameChangesRemaining !== null && (
              <span className={'form-change-limit' + (displayNameChangesRemaining === 0 ? ' form-change-limit--exhausted' : '')}>
                {displayNameChangesRemaining === 0
                  ? 'No changes left (30-day window)'
                  : displayNameChangesRemaining + ' change' + (displayNameChangesRemaining !== 1 ? 's' : '') + ' left / 30 days'}
              </span>
            )}
          </div>
          <input
            type="text"
            className={'form-input' + (fieldError?.field === 'display_name' ? ' form-input--error' : '')}
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); if (fieldError?.field === 'display_name') setFieldError(null); }}
            disabled={displayNameExhausted}
            maxLength={50}
          />
          {fieldError?.field === 'display_name' && <span className="form-field-error">{fieldError.message}</span>}
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
            className={'form-input' + (fieldError?.field === 'website' ? ' form-input--error' : '')}
            placeholder="https://yoursite.com"
            value={website}
            onChange={(e) => { setWebsite(e.target.value); if (fieldError?.field === 'website') setFieldError(null); }}
          />
          {fieldError?.field === 'website' && <span className="form-field-error">{fieldError.message}</span>}
        </div>

        {/* Profile Picture */}
        <div className="form-row">
          <label className="form-label">Profile Picture</label>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setAvatarPreview(URL.createObjectURL(picked));
            setAvatarZoom(1);
            setAvatarOffsetX(0);
            setAvatarOffsetY(0);
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => avatarInputRef.current?.click()}><UploadDownloadIcon size={14} /> Upload image</button>
          {avatarPreview && (
            <>
              <div className="avatar-crop-preview">
                <img
                  src={avatarPreview}
                  alt="Avatar crop preview"
                  style={{
                    transform: `scale(${avatarZoom}) translate(${avatarOffsetX * 50 / avatarZoom}%, ${avatarOffsetY * 50 / avatarZoom}%)`,
                  }}
                />
              </div>
              <label className="form-hint">Zoom</label>
              <input type="range" min="1" max="2.5" step="0.1" value={avatarZoom} onChange={(e) => setAvatarZoom(parseFloat(e.target.value))} />
              <label className="form-hint">Position X</label>
              <input type="range" min="-1" max="1" step="0.05" value={avatarOffsetX} onChange={(e) => setAvatarOffsetX(parseFloat(e.target.value))} />
              <label className="form-hint">Position Y</label>
              <input type="range" min="-1" max="1" step="0.05" value={avatarOffsetY} onChange={(e) => setAvatarOffsetY(parseFloat(e.target.value))} />
              <p className="form-hint">Saved as 500×500 square.</p>
            </>
          )}
        </div>

        {/* Banner */}
        <div className="form-row">
          <label className="form-label">Profile Banner</label>
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setBannerPreview(URL.createObjectURL(picked));
            setBannerZoom(1);
            setBannerOffsetX(0);
            setBannerOffsetY(0);
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => bannerInputRef.current?.click()}><UploadDownloadIcon size={14} /> Upload banner</button>
          {bannerPreview && (
            <>
              <div
                ref={bannerContainerRef}
                className="banner-edit-container"
                onMouseDown={handleBannerMouseDown}
                onWheel={handleBannerWheel}
                onTouchStart={handleBannerTouchStart}
                onTouchMove={handleBannerTouchMove}
                onTouchEnd={() => { isDraggingBanner.current = false; }}
              >
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="banner-edit-img"
                  style={{
                    transform: `scale(${bannerZoom}) translate(${bannerOffsetX * 50 / bannerZoom}%, ${bannerOffsetY * 50 / bannerZoom}%)`,
                    transformOrigin: 'center',
                  }}
                />
                <div className="banner-guide banner-guide-mobile">
                  <span className="banner-guide-label">Mobile</span>
                </div>
              </div>
              <p className="form-hint">Preview matches desktop · Mobile crops sides (keep important content inside the guide)</p>
              <div className="banner-zoom-row">
                <label className="form-hint">Zoom</label>
                <input type="range" min="1" max="3" step="0.05" value={bannerZoom} onChange={(e) => setBannerZoom(parseFloat(e.target.value))} />
              </div>
              <p className="form-hint">Drag to reposition · Scroll to zoom</p>
            </>
          )}
          {!bannerPreview && profile?.banner_url && (
            <div className="banner-edit-container" style={{ pointerEvents: 'none', cursor: 'default' }}>
              <img src={profile.banner_url} alt="Current banner" className="banner-edit-img" style={{ objectFit: 'cover' }} />
            </div>
          )}
          <span className="form-hint">Displayed at the top of your profile. Preview matches desktop. Saved as 1920×1080 with extra context for mobile.</span>
        </div>

        {/* Profile Theme */}
        <div className="form-row">
          <label className="form-label">Profile Theme</label>
          <span className="form-hint">Colors your profile banner and header area.</span>
          <div className="profile-theme-picker">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                className={'profile-theme-option' + (profileTheme === opt.id ? ' profile-theme-option--active' : '')}
                onClick={() => { setProfileTheme(opt.id as string | null); setGradientError(null); }}
                title={opt.label}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          {profileTheme === 'gradient' && (
            <div className="profile-gradient-row">
              <div className="form-row">
                <label className="form-hint">Start color</label>
                <div className="gradient-color-row">
                  <input type="color" value={gradientStart} onChange={(e) => { setGradientStart(e.target.value); setGradientError(null); }} className="color-swatch-input" />
                  <input type="text" className="form-input gradient-hex-input" value={gradientStart} maxLength={7}
                    onChange={(e) => { const v = e.target.value; setGradientStart(v); setGradientError(null); }} />
                </div>
              </div>
              <div className="form-row">
                <label className="form-hint">End color</label>
                <div className="gradient-color-row">
                  <input type="color" value={gradientEnd} onChange={(e) => { setGradientEnd(e.target.value); setGradientError(null); }} className="color-swatch-input" />
                  <input type="text" className="form-input gradient-hex-input" value={gradientEnd} maxLength={7}
                    onChange={(e) => { const v = e.target.value; setGradientEnd(v); setGradientError(null); }} />
                </div>
              </div>
              {/* Live gradient preview */}
              <div className="gradient-preview" style={{ background: 'linear-gradient(135deg, ' + gradientStart + ' 0%, ' + gradientEnd + ' 100%)' }} />
              {gradientError && <p className="edit-error" style={{ marginTop: 6 }}>{gradientError}</p>}
            </div>
          )}
        </div>

        {error && <div className="edit-error">{error}</div>}
        {saveMessage && <div className="edit-success">{saveMessage}</div>}

        <div className="edit-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><LoadingIcon size={14} className="upload-spinner" /> Saving…</> : saved ? <><CheckCircleIcon size={14} /> Saved!</> : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
