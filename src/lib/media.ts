import type { Cover } from './types';

export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>): string {
  if (cover.storage_path) {
    return `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}`;
  }
  return cover.image_url;
}
