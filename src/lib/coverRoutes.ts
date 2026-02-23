import type { Cover } from './types';

function slugifyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug for use in /artists/:slug URLs  e.g. "Taylor Swift" → "taylor-swift" */
export function slugifyArtist(name: string): string {
  return slugifyPart(name);
}

export function buildCoverSlug(cover: Cover): string {
  const publicId = String(cover.public_id ?? '').padStart(6, '0');
  const artist = slugifyPart(cover.artist);
  const title = slugifyPart(cover.title).slice(0, 20).replace(/-+$/g, '');
  return [publicId, artist, title].filter(Boolean).join('-');
}

export function getCoverPath(cover: Cover): string {
  return `/cover/${buildCoverSlug(cover)}`;
}

export function getCoverPublicIdFromSlug(slug: string): number | null {
  const match = slug.match(/^(\d{6})-/);
  if (!match) return null;
  return Number(match[1]);
}
