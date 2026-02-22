import type { Cover } from './types';
import { getSafeImageUrl } from './user';

export function getCoverImageSrc(cover: Pick<Cover, 'storage_path' | 'image_url'>, size = 500): string {
  if (cover.storage_path) {
    return `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}&size=${size}`;
  }
  return getSafeImageUrl(cover.image_url) ?? '';
}

export function getCoverDownloadUrl(cover: Pick<Cover, 'storage_path' | 'image_url'>, size: 'full' | number): string {
  if (cover.storage_path) {
    const qs = size === 'full' ? 'size=full' : `size=${size}`;
    return `/api/cover-media?path=${encodeURIComponent(cover.storage_path)}&${qs}&download=1`;
  }
  return getSafeImageUrl(cover.image_url) ?? '';
}
