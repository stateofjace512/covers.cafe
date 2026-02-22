import type { Cover, Profile } from './types';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;

function storageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function transformUrl(path: string, width: number): string {
  return `${SUPABASE_URL}/storage/v1/render/image/public/covers_cafe_covers/${path}?width=${width}&height=${width}&resize=cover&quality=80`;
}

export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url' | 'thumbnail_path'>, width = 500): string {
  if (cover.storage_path) return transformUrl(cover.storage_path, width);
  return cover.image_url;
}

export function getCoverDownloadSrc(cover: Pick<Cover, 'storage_path'>, _size?: number): string {
  return storageUrl('covers_cafe_covers', cover.storage_path);
}

export function getAvatarSrc(profile: Pick<Profile, 'id' | 'avatar_url'>): string | null {
  if (!profile.avatar_url) return null;
  return storageUrl('covers_cafe_avatars', `${profile.id}/avatar.jpg`);
}
