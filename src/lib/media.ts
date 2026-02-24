import type { Cover, Profile } from './types';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
// PUBLIC_ prefix makes this available in the browser bundle
const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;

// ── Cloudflare helpers ────────────────────────────────────────────────────────

function isCfPath(storagePath: string | null | undefined): storagePath is string {
  return typeof storagePath === 'string' && storagePath.startsWith('cf:');
}

function cfImageUrl(storagePath: string, variant = 'public'): string {
  const imageId = storagePath.slice(3); // strip "cf:" prefix
  return `https://imagedelivery.net/${CF_IMAGES_HASH}/${imageId}/${variant}`;
}

// ── Supabase helpers (legacy / migration period) ──────────────────────────────

function supabaseTransformUrl(path: string, width: number): string {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_covers/${path}?width=${width}&height=${width}&resize=cover&quality=80`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the best display URL for a cover image.
 * CF images are served directly from the Cloudflare CDN via the "public" variant.
 * Legacy Supabase images continue to use the Supabase transform endpoint.
 */
export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>, width = 500): string {
  if (isCfPath(cover.storage_path)) return cfImageUrl(cover.storage_path, 'public');
  if (cover.storage_path) return supabaseTransformUrl(cover.storage_path, width);
  return cover.image_url;
}

/**
 * Returns the download URL for a cover image (full resolution).
 * CF images are downloaded directly from Cloudflare.
 * Legacy Supabase images route through /api/cover-media (Sharp resize on server).
 */
export function getCoverDownloadSrc(cover: Pick<Cover, 'storage_path'>, size?: number): string {
  if (isCfPath(cover.storage_path)) return cfImageUrl(cover.storage_path, 'public');
  const params = new URLSearchParams({ path: cover.storage_path });
  if (size) params.set('size', String(size));
  return `/api/cover-media?${params.toString()}`;
}

/**
 * Returns the avatar URL for a profile.
 * CF-served avatars need no cache-busting; legacy Supabase URLs get a version param.
 */
export function getAvatarSrc(profile: Pick<Profile, 'avatar_url'> & { updated_at?: string }): string | null {
  if (!profile.avatar_url) return null;
  if (profile.avatar_url.includes('imagedelivery.net')) return profile.avatar_url;
  const sep = profile.avatar_url.includes('?') ? '&' : '?';
  const ts = profile.updated_at ? new Date(profile.updated_at).getTime() : Date.now();
  return `${profile.avatar_url}${sep}v=${ts}`;
}
