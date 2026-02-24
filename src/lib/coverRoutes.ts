import type { Cover } from './types';

const ARTIST_SPLIT_RE = /\s+(?:feat\.?|ft\.?|with)\s+|\s*[&,]\s*/i;

/** Split a compound artist string (e.g. "Taylor Swift & Lana Del Rey") into individual names. */
export function parseArtists(artist: string): string[] {
  const trimmed = artist.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(ARTIST_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 1 ? parts : [trimmed];
}

/**
 * Split a compound official artist_name and resolve each token via the provided alias map.
 *
 * Example: "テイラー・スウィフト & ILLENIUM" with aliases {"テイラー・スウィフト": "Taylor Swift"}
 *   → ["Taylor Swift", "ILLENIUM"]
 *
 * This is only applied to official art — fan art uses parseArtists without alias resolution.
 */
export function splitAndResolveOfficialArtist(
  artistName: string,
  aliases: Record<string, string>,
): string[] {
  return parseArtists(artistName).map((part) => aliases[part] ?? part);
}

function slugifyPart(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

/** Slug for use in /artists/:slug URLs  e.g. "Taylor Swift" → "taylor-swift" */
export function slugifyArtist(name: string): string {
  return slugifyPart(name);
}

export function buildCoverSlug(cover: Cover): string {
  const publicId = String(cover.public_id ?? '');
  const artist = slugifyPart(cover.artist);
  const title = slugifyPart(cover.title).slice(0, 20).replace(/-+$/g, '');
  return [publicId, artist, title].filter(Boolean).join('-');
}

export function getCoverPath(cover: Cover): string {
  return `/covers/fan/${cover.page_slug}`;
}

export interface OfficialCoverSlugParts {
  official_public_id: number | null;
  artist_name: string | null;
  album_title: string | null;
}

export function buildOfficialCoverSlug(cover: OfficialCoverSlugParts): string {
  const publicId = String(cover.official_public_id ?? '');
  const artist = slugifyPart(cover.artist_name ?? '');
  const title = slugifyPart(cover.album_title ?? '').slice(0, 20).replace(/-+$/g, '');
  return [publicId, artist, title].filter(Boolean).join('-');
}

export function getOfficialCoverPath(cover: OfficialCoverSlugParts): string {
  return `/covers/official/${buildOfficialCoverSlug(cover)}`;
}

export function getCoverPublicIdFromSlug(slug: string): number | null {
  const match = slug.match(/^(\d{6,})-/);
  if (!match) return null;
  return Number(match[1]);
}
