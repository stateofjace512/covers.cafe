import { supabase } from './supabase';

export type OfficialBlacklist = {
  artists: Set<string>;
  phrases: string[];
};

export async function loadOfficialBlacklist(): Promise<OfficialBlacklist> {
  const [{ data: artistRows }, { data: phraseRows }] = await Promise.all([
    supabase.from('covers_cafe_official_artist_blacklist').select('artist_name'),
    supabase.from('covers_cafe_official_phrase_blacklist').select('phrase'),
  ]);

  return {
    artists: new Set((artistRows ?? [])
      .map((r: { artist_name: string | null }) => (r.artist_name ?? '').trim().toLowerCase())
      .filter(Boolean)),
    phrases: (phraseRows ?? [])
      .map((r: { phrase: string | null }) => (r.phrase ?? '').trim().toLowerCase())
      .filter(Boolean),
  };
}

export function isOfficialRowBlacklisted(
  row: { artist_name?: string | null; album_title?: string | null },
  blacklist: OfficialBlacklist,
): boolean {
  const artist = (row.artist_name ?? '').trim().toLowerCase();
  const title = (row.album_title ?? '').trim().toLowerCase();
  if (artist && blacklist.artists.has(artist)) return true;
  if (blacklist.phrases.length === 0) return false;
  const haystack = `${artist} ${title}`.trim();
  return blacklist.phrases.some((phrase) => phrase && haystack.includes(phrase));
}
