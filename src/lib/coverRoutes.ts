import type { Cover } from './types';

const ARTIST_SPLIT_RE = /\s+(?:feat\.?|ft\.?|with)\s+|\s*[&,]\s*/i;

/** Split a compound artist string (e.g. "Taylor Swift & Lana Del Rey") into individual names. */
export function parseArtists(artist: string): string[] {
  const trimmed = artist.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(ARTIST_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 1 ? parts : [trimmed];
}

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
