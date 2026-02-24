import type { Cover, Profile } from './types';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;

function cfImageUrl(storagePath: string): string {
  const imageId = storagePath.slice(3); // strip "cf:" prefix
  return `https://imagedelivery.net/${CF_IMAGES_HASH}/${imageId}/public`;
}

/**
 * Returns the display URL for a cover image.
 * All covers are served from Cloudflare Images (storage_path starts with "cf:").
 * Falls back to image_url for any cover not yet on CF.
 */
export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>, _width?: number): string {
  if (cover.storage_path?.startsWith('cf:')) return cfImageUrl(cover.storage_path);
  return cover.image_url;
}

/**
 * Returns the download URL for a cover image.
 * All covers are served directly from Cloudflare Images.
 */
export function getCoverDownloadSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>, _size?: number): string {
  if (cover.storage_path?.startsWith('cf:')) return cfImageUrl(cover.storage_path);
  return cover.image_url;
}

/**
 * Returns the avatar URL for a profile.
 * All avatars are on Cloudflare; stored as full delivery URLs in avatar_url.
 */
export function getAvatarSrc(profile: Pick<Profile, 'avatar_url'>): string | null {
  return profile.avatar_url ?? null;
}
