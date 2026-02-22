import type { Cover, Profile } from './types';

export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url' | 'thumbnail_path'>): string {
  const path = cover.thumbnail_path || cover.storage_path;
  if (path) return `/api/cover-media?path=${encodeURIComponent(path)}`;
  return cover.image_url;
}

export function getCoverDownloadSrc(cover: Pick<Cover, 'storage_path'>, size?: number): string {
  const base = `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`;
  return size ? `${base}&size=${size}` : base;
}

export function getAvatarSrc(profile: Pick<Profile, 'id' | 'avatar_url'>): string | null {
  if (!profile.avatar_url) return null;
  return `/api/avatar-media?path=${encodeURIComponent(`${profile.id}/avatar.jpg`)}`;
}
