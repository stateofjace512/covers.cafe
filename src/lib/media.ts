import type { Cover, Profile } from './types';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function storageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url' | 'thumbnail_path'>): string {
  const path = cover.thumbnail_path || cover.storage_path;
  if (path) return storageUrl('covers_cafe_covers', path);
  return cover.image_url;
}

export function getCoverDownloadSrc(cover: Pick<Cover, 'storage_path'>, _size?: number): string {
  return storageUrl('covers_cafe_covers', cover.storage_path);
}

export function getAvatarSrc(profile: Pick<Profile, 'id' | 'avatar_url'>): string | null {
  if (!profile.avatar_url) return null;
  return storageUrl('covers_cafe_avatars', `${profile.id}/avatar.jpg`);
}
