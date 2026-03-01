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
import MonitorIcon from '../components/MonitorIcon';
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
  const [avatarTranslateX, setAvatarTranslateX] = useState(0);
  const [avatarTranslateY, setAvatarTranslateY] = useState(0);
  const [avatarCropWindowPct, setAvatarCropWindowPct] = useState(100);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingAvatar = useRef(false);
  const avatarDragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // Banner
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerZoom, setBannerZoom] = useState(1);
  // Pixel translation of the image within the editor (centre-anchored, in container px).
  const [bannerTranslateX, setBannerTranslateX] = useState(0);
  const [bannerTranslateY, setBannerTranslateY] = useState(0);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingBanner = useRef(false);
  const bannerDragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

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
    // Crop size: min(imgW, imgH) / zoom (same square side regardless of orientation)
    const cropSide = Math.min(img.width, img.height) / avatarZoom;
    // Container width drives the pixel scale; height scales proportionally.
    const containerW = avatarContainerRef.current?.offsetWidth ?? 240;
    const pxScale = img.width / (containerW * avatarZoom);
    const sx_center = img.width  / 2 - avatarTranslateX * pxScale;
    const sy_center = img.height / 2 - avatarTranslateY * pxScale;
    const sx = Math.max(0, Math.min(img.width  - cropSide, sx_center - cropSide / 2));
    const sy = Math.max(0, Math.min(img.height - cropSide, sy_center - cropSide / 2));
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
    // Desktop displays a 3:1 center band of the stored 1920×1080 image (clips 220px
    // top+bottom with background-size:cover). We capture the 3:1 region the user
    // positioned using bannerTranslateX/Y + bannerZoom, then embed it in that center
    // band. Top/bottom bands are filled with adjacent source content for mobile.
    const DISPLAY_ASPECT = 3.0;
    const CENTER_H = Math.round(TARGET_W / DISPLAY_ASPECT); // 640px
    const CENTER_Y = Math.round((TARGET_H - CENTER_H) / 2); // 220px
    // Source crop size: zoom=1 → full-width 3:1 crop; zoom>1 → zoomed in.
    const srcCropW = img.width / bannerZoom;
    const srcCropH = srcCropW / DISPLAY_ASPECT;
    // Container dimensions (image is display:block width:100% height:auto so
    // container height = containerW * imgH / imgW — same pixel aspect as the source).
    const containerW = bannerContainerRef.current?.offsetWidth ?? 640;
    // Pixel scale factor: one container pixel = this many source pixels.
    const pxScale = img.width / (containerW * bannerZoom);
    // Center of the crop in source coordinates (derived from CSS scale+translate).
    const sx_center = img.width  / 2 - bannerTranslateX * pxScale;
    const sy_center = img.height / 2 - bannerTranslateY * pxScale;
    const sx = Math.max(0, Math.min(img.width  - srcCropW, sx_center - srcCropW / 2));
    const sy = Math.max(0, Math.min(img.height - srcCropH, sy_center - srcCropH / 2));
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    // Draw the 3:1 crop into the center band (what desktop shows)
    ctx.drawImage(img, sx, sy, srcCropW, srcCropH, 0, CENTER_Y, TARGET_W, CENTER_H);
    // Fill top band: stretch whatever source content exists above the crop to fill the
    // full band. If the crop is already at the top edge, repeat the topmost strip.
    if (sy > 0) {
      ctx.drawImage(img, sx, 0, srcCropW, sy, 0, 0, TARGET_W, CENTER_Y);
    } else {
      const edgeH = Math.max(1, Math.ceil(srcCropH * 0.05));
      ctx.drawImage(img, sx, 0, srcCropW, edgeH, 0, 0, TARGET_W, CENTER_Y);
    }
    // Fill bottom band: stretch whatever source content exists below the crop to fill
    // the full band. If the crop is already at the bottom edge, repeat the bottommost strip.
    const botSrcY = sy + srcCropH;
    const botAvail = img.height - botSrcY;
    if (botAvail > 0) {
      ctx.drawImage(img, sx, botSrcY, srcCropW, botAvail, 0, CENTER_Y + CENTER_H, TARGET_W, CENTER_Y);
    } else {
      const edgeH = Math.max(1, Math.ceil(srcCropH * 0.05));
      const edgeSrcY = Math.max(0, sy + srcCropH - edgeH);
      ctx.drawImage(img, sx, edgeSrcY, srcCropW, edgeH, 0, CENTER_Y + CENTER_H, TARGET_W, CENTER_Y);
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
  // Translations are in container pixels (centre-anchored). The crop window is
  // always 3:1 full-width at the vertical centre; clamping keeps it inside the image.
  function clampBannerTranslate(tx: number, ty: number, zoom: number): { tx: number; ty: number } {
    if (!bannerContainerRef.current) return { tx, ty };
    const cW = bannerContainerRef.current.offsetWidth;
    const cH = bannerContainerRef.current.offsetHeight;
    const maxTx = Math.max(0, cW  * (zoom - 1) / 2);
    const maxTy = Math.max(0, (cH * zoom - cW / 3) / 2);
    return { tx: Math.max(-maxTx, Math.min(maxTx, tx)), ty: Math.max(-maxTy, Math.min(maxTy, ty)) };
  }

  useEffect(() => {
    const { tx, ty } = clampBannerTranslate(bannerTranslateX, bannerTranslateY, bannerZoom);
    setBannerTranslateX(tx);
    setBannerTranslateY(ty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerZoom]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingBanner.current) return;
      const dx = e.clientX - bannerDragStart.current.x;
      const dy = e.clientY - bannerDragStart.current.y;
      const rawTx = bannerDragStart.current.offsetX + dx;
      const rawTy = bannerDragStart.current.offsetY + dy;
      const { tx, ty } = clampBannerTranslate(rawTx, rawTy, bannerZoom);
      setBannerTranslateX(tx);
      setBannerTranslateY(ty);
    };
    const onUp = () => { isDraggingBanner.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerZoom]);

  const handleBannerMouseDown = (e: React.MouseEvent) => {
    isDraggingBanner.current = true;
    bannerDragStart.current = { x: e.clientX, y: e.clientY, offsetX: bannerTranslateX, offsetY: bannerTranslateY };
    e.preventDefault();
  };

  const handleBannerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDraggingBanner.current = true;
    bannerDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, offsetX: bannerTranslateX, offsetY: bannerTranslateY };
  };

  const handleBannerTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingBanner.current || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - bannerDragStart.current.x;
    const dy = e.touches[0].clientY - bannerDragStart.current.y;
    const rawTx = bannerDragStart.current.offsetX + dx;
    const rawTy = bannerDragStart.current.offsetY + dy;
    const { tx, ty } = clampBannerTranslate(rawTx, rawTy, bannerZoom);
    setBannerTranslateX(tx);
    setBannerTranslateY(ty);
  };

  // ── Avatar drag-to-reposition ─────────────────────────────────────────────────
  // Crop window is a circle sized min(containerW, containerH); image pans under it.
  function clampAvatarTranslate(tx: number, ty: number, zoom: number): { tx: number; ty: number } {
    if (!avatarContainerRef.current) return { tx, ty };
    const cW = avatarContainerRef.current.offsetWidth;
    const cH = avatarContainerRef.current.offsetHeight;
    const cropSize = Math.min(cW, cH);
    const maxTx = Math.max(0, (cW * zoom - cropSize) / 2);
    const maxTy = Math.max(0, (cH * zoom - cropSize) / 2);
    return { tx: Math.max(-maxTx, Math.min(maxTx, tx)), ty: Math.max(-maxTy, Math.min(maxTy, ty)) };
  }

  useEffect(() => {
    const { tx, ty } = clampAvatarTranslate(avatarTranslateX, avatarTranslateY, avatarZoom);
    setAvatarTranslateX(tx);
    setAvatarTranslateY(ty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarZoom]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingAvatar.current) return;
      const dx = e.clientX - avatarDragStart.current.x;
      const dy = e.clientY - avatarDragStart.current.y;
      const { tx, ty } = clampAvatarTranslate(avatarDragStart.current.offsetX + dx, avatarDragStart.current.offsetY + dy, avatarZoom);
      setAvatarTranslateX(tx);
      setAvatarTranslateY(ty);
    };
    const onUp = () => { isDraggingAvatar.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarZoom]);

  const handleAvatarMouseDown = (e: React.MouseEvent) => {
    isDraggingAvatar.current = true;
    avatarDragStart.current = { x: e.clientX, y: e.clientY, offsetX: avatarTranslateX, offsetY: avatarTranslateY };
    e.preventDefault();
  };

  const handleAvatarTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDraggingAvatar.current = true;
    avatarDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, offsetX: avatarTranslateX, offsetY: avatarTranslateY };
  };

  const handleAvatarTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingAvatar.current || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - avatarDragStart.current.x;
    const dy = e.touches[0].clientY - avatarDragStart.current.y;
    const { tx, ty } = clampAvatarTranslate(avatarDragStart.current.offsetX + dx, avatarDragStart.current.offsetY + dy, avatarZoom);
    setAvatarTranslateX(tx);
    setAvatarTranslateY(ty);
  };

  const handleAvatarImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nW, naturalHeight: nH } = e.currentTarget;
    // Crop window is min(nW,nH)/nW of container width, expressed as a percentage.
    setAvatarCropWindowPct(Math.min(nW, nH) / nW * 100);
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
            setAvatarTranslateX(0);
            setAvatarTranslateY(0);
            setAvatarCropWindowPct(100);
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => avatarInputRef.current?.click()}><UploadDownloadIcon size={14} /> Upload image</button>
          {avatarPreview && (
            <>
              <div
                ref={avatarContainerRef}
                className="avatar-edit-outer"
                onMouseDown={handleAvatarMouseDown}
                onTouchStart={handleAvatarTouchStart}
                onTouchMove={handleAvatarTouchMove}
                onTouchEnd={() => { isDraggingAvatar.current = false; }}
              >
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="avatar-edit-img"
                  onLoad={handleAvatarImgLoad}
                  style={{
                    transform: `translateX(${avatarTranslateX}px) translateY(${avatarTranslateY}px) scale(${avatarZoom})`,
                    transformOrigin: 'center center',
                  }}
                />
                <div className="avatar-crop-window" style={{ width: `${avatarCropWindowPct}%` }} />
              </div>
              <div className="banner-zoom-row">
                <label className="form-hint">Zoom</label>
                <input type="range" min="1" max="2.5" step="0.1" value={avatarZoom} onChange={(e) => setAvatarZoom(parseFloat(e.target.value))} />
              </div>
              <p className="form-hint">Drag to reposition · Circle = crop · Zoom for detail</p>
            </>
          )}
          {!avatarPreview && profile?.avatar_url && (
            <div className="avatar-edit-outer" style={{ pointerEvents: 'none', cursor: 'default' }}>
              <img src={profile.avatar_url} alt="Current avatar" className="avatar-edit-img" />
              <div className="avatar-crop-window" style={{ width: '100%' }} />
            </div>
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
            setBannerTranslateX(0);
            setBannerTranslateY(0);
          }} />
          <button type="button" className="btn btn-secondary" onClick={() => bannerInputRef.current?.click()}><UploadDownloadIcon size={14} /> Upload banner</button>
          {bannerPreview && (
            <>
              {/* Full-image editor: the white-bordered 3:1 window shows exactly what
                  gets cropped and uploaded for desktop. Drag the image to reposition. */}
              <div
                ref={bannerContainerRef}
                className="banner-edit-outer"
                onMouseDown={handleBannerMouseDown}
                onTouchStart={handleBannerTouchStart}
                onTouchMove={handleBannerTouchMove}
                onTouchEnd={() => { isDraggingBanner.current = false; }}
              >
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="banner-edit-img"
                  style={{
                    transform: `translateX(${bannerTranslateX}px) translateY(${bannerTranslateY}px) scale(${bannerZoom})`,
                    transformOrigin: 'center center',
                  }}
                />
                <div className="banner-crop-window">
                  <div className="banner-desktop-label">
                    <MonitorIcon size={10} />
                    <span>Desktop crop</span>
                  </div>
                  <div className="banner-guide banner-guide-mobile">
                    <span className="banner-guide-label">Mobile</span>
                  </div>
                </div>
              </div>
              <div className="banner-zoom-row">
                <label className="form-hint">Zoom</label>
                <input type="range" min="1" max="3" step="0.05" value={bannerZoom} onChange={(e) => setBannerZoom(parseFloat(e.target.value))} />
              </div>
              <p className="form-hint">Drag to reposition · White border = desktop crop · Zoom for detail</p>
            </>
          )}
          {!bannerPreview && profile?.banner_url && (
            <div className="banner-edit-outer" style={{ pointerEvents: 'none', cursor: 'default' }}>
              <img src={profile.banner_url} alt="Current banner" className="banner-edit-img" style={{ objectFit: 'cover' }} />
            </div>
          )}
          <span className="form-hint">Displayed at the top of your profile. Saved as 1920×1080 with extra context for mobile.</span>
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
