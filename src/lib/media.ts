import type { Cover, Profile } from './types';

/**
 * Returns the display URL for a cover image, routed through our API proxy
 * so the raw Cloudflare imagedelivery.net URL is never sent to the browser.
 * Falls back to image_url for any cover not yet on CF.
 */
export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>, _width?: number): string {
  if (cover.storage_path?.startsWith('cf:')) {
    return `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`;
  }
  return cover.image_url;
}

/**
 * Returns the download API URL for a cover image.
 * Uses /api/download which serves the full-resolution original (or a resized
 * version) directly from Cloudflare's source storage via the server.
 * The `coverId` must be the cover's DB id; `size` is an optional max-dimension.
 */
export function getCoverDownloadUrl(coverId: string, size?: number): string {
  const params = new URLSearchParams({ id: coverId });
  if (size) params.set('size', String(size));
  return `/api/download?${params.toString()}`;
}

/**
 * Returns the avatar URL for a profile, proxied through cover-media if it's
 * a Cloudflare image, otherwise returned as-is.
 * Avatars are stored as full imagedelivery.net URLs in avatar_url.
 */
export function getAvatarSrc(profile: Pick<Profile, 'avatar_url'>): string | null {
  const raw = profile.avatar_url;
  if (!raw) return null;
  // Extract CF image ID from the delivery URL and route through our proxy
  // URL shape: https://imagedelivery.net/<hash>/<imageId>/<variant>
  const match = /imagedelivery\.net\/[^/]+\/([^/]+)\//.exec(raw);
  if (match) {
    return `/api/cover-media?path=cf:${encodeURIComponent(match[1])}`;
  }
  return raw;
}
