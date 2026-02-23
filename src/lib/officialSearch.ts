interface ItunesAlbumResult {
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  collectionName?: string;
  [key: string]: unknown;
}

export interface OfficialUpsertRow {
  artist_name: string | null;
  album_title: string | null;
  release_year: number | null;
  album_cover_url: string;
  pixel_dimensions: string | null;
  country: string;
  search_artist: string;
  search_album: string | null;
  tags: string[];
  source_payload: Record<string, unknown>;
}

interface RankedOfficialRow extends OfficialUpsertRow {
  quality_score: number;
}

function getFullResAppleCover(url: string | undefined): string | undefined {
  if (!url || !url.includes('mzstatic.com')) return url;
  return url
    .replace(/https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\//, 'https://a1.mzstatic.com/r40/')
    .replace(/https:\/\/is\d-ssl\.mzstatic\.com\/image\//, 'https://a1.mzstatic.com/r40/')
    .replace(/\/\d+x\d+[^/]*\.(jpg|webp|png|tif)$/, '');
}

function hasCJK(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7af]/.test(text);
}

async function getImageMetrics(url: string): Promise<{ score: number; dimensions: string | null }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const score = img.naturalWidth * img.naturalHeight;
      resolve({ score, dimensions: `${img.naturalWidth}x${img.naturalHeight}` });
    };
    img.onerror = () => resolve({ score: 0, dimensions: null });
    setTimeout(() => resolve({ score: 0, dimensions: null }), 5000);
  });
}

async function searchOneCountry(artist: string, album: string, country: string): Promise<RankedOfficialRow[]> {
  try {
    const term = encodeURIComponent(`${artist} ${album}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&country=${country}&limit=40`);
    if (!res.ok) return [];
    const payload = await res.json() as { results?: ItunesAlbumResult[] };
    const results = payload.results ?? [];

    const rows = results
      .map((item) => {
        const album_cover_url = getFullResAppleCover(item.artworkUrl100);
        if (!album_cover_url) return null;
        return {
          artist_name: item.artistName ?? null,
          album_title: item.collectionName ?? null,
          release_year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
          album_cover_url,
          pixel_dimensions: null,
          country: country.toUpperCase(),
          search_artist: artist,
          search_album: album || null,
          tags: ['official'],
          source_payload: item as Record<string, unknown>,
          quality_score: 0,
        };
      })
      .filter((row): row is RankedOfficialRow => Boolean(row));

    const imageData = await Promise.all(rows.map((row) => getImageMetrics(row.album_cover_url)));
    return rows.map((row, index) => ({
      ...row,
      quality_score: imageData[index].score,
      pixel_dimensions: imageData[index].dimensions,
    }));
  } catch {
    return [];
  }
}

export async function searchOfficialAssets(
  artist: string,
  album: string,
  countries: string[] = ['us', 'au', 'mx', 'jp'],
): Promise<OfficialUpsertRow[]> {
  const cleanArtist = artist.trim();
  const cleanAlbum = album.trim();
  if (!cleanArtist) return [];

  const normalizedCountries = Array.from(new Set(countries.map((c) => c.toLowerCase()).filter(Boolean)));
  const allResults = (await Promise.all(normalizedCountries.map((country) => searchOneCountry(cleanArtist, cleanAlbum, country)))).flat();

  const groups = new Map<string, RankedOfficialRow[]>();
  for (const item of allResults) {
    const titleKey = (item.album_title ?? '').toLowerCase().trim();
    const yearKey = item.release_year ?? 0;
    let matchKey: string | null = null;

    for (const [key, val] of groups.entries()) {
      const isSameImage = val.some((v) => v.album_cover_url === item.album_cover_url);
      const isSameAlbum = val.some((v) => (v.album_title ?? '').toLowerCase().trim() === titleKey && (v.release_year ?? 0) === yearKey);
      if (isSameImage || isSameAlbum) {
        matchKey = key;
        break;
      }
    }

    const finalKey = matchKey ?? `${titleKey}|${yearKey}|${Math.random()}`;
    if (!groups.has(finalKey)) groups.set(finalKey, []);
    groups.get(finalKey)!.push(item);
  }

  const countryPriority = normalizedCountries.reduce<Record<string, number>>((acc, country, index) => {
    acc[country.toUpperCase()] = normalizedCountries.length - index;
    return acc;
  }, {});

  const uniqueResults: RankedOfficialRow[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      if (b.quality_score !== a.quality_score) return b.quality_score - a.quality_score;
      const aHasCJK = hasCJK(a.artist_name ?? '');
      const bHasCJK = hasCJK(b.artist_name ?? '');
      if (aHasCJK !== bHasCJK) return aHasCJK ? 1 : -1;
      return (countryPriority[b.country] ?? 0) - (countryPriority[a.country] ?? 0);
    });
    uniqueResults.push(group[0]);
  }

  uniqueResults.sort((a, b) => {
    const aYear = a.release_year ?? 0;
    const bYear = b.release_year ?? 0;
    if (bYear !== aYear) return bYear - aYear;
    return (a.album_title ?? '').localeCompare(b.album_title ?? '');
  });

  return uniqueResults.map(({ quality_score: _qualityScore, ...row }) => row);
}
