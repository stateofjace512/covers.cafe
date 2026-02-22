import type { Cover } from './types';

export function getCoverImageSrc(cover: Pick<Cover, 'id' | 'storage_path' | 'image_url'>): string {
  if (cover.id) {
    return `/api/cover-media?id=${encodeURIComponent(cover.id)}`;
  }
  if (cover.storage_path) {
    return `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`;
  }
  return cover.image_url;
}
