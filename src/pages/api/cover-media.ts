import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getSupabaseServer } from './_supabase';

const CACHE_MAX_AGE = 31 * 24 * 60 * 60;
const CACHE_DIR = path.resolve('.cache/cover-media');
const ALLOWED_SIZES = new Set([500, 800, 1000, 1500, 3000]);

const toFileSafe = (value: string) => createHash('sha1').update(value).digest('hex');

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  const coverId = url.searchParams.get('id');
  let storagePath = url.searchParams.get('path');
  if (!storagePath && coverId) {
    const { data } = await sb.from('covers_cafe_covers').select('storage_path').eq('id', coverId).single();
    storagePath = data?.storage_path ?? null;
  }
  if (!storagePath) return new Response('Missing id/path', { status: 400 });

  const requested = (url.searchParams.get('size') ?? '500').toLowerCase();
  const download = url.searchParams.get('download') === '1';
  const width = requested === 'full' ? 'full' : Number.parseInt(requested, 10);
  const sizeLabel = width === 'full' ? 'full' : String(width);

  if (width !== 'full' && !ALLOWED_SIZES.has(width)) {
    return new Response('Invalid size', { status: 400 });
  }

  const cacheFile = path.join(CACHE_DIR, `${toFileSafe(`${storagePath}:${sizeLabel}`)}.jpg`);

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cached = await fs.readFile(cacheFile).catch(() => null);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
          ...(download ? { 'Content-Disposition': `attachment; filename="cover-${sizeLabel}.jpg"` } : {}),
        },
      });
    }

    const { data, error } = await sb.storage.from('covers_cafe_covers').download(storagePath);
    if (error || !data) return new Response('Not found', { status: 404 });

    const source = Buffer.from(await data.arrayBuffer());
    const rendered = width === 'full'
      ? await sharp(source).jpeg({ quality: 95 }).toBuffer()
      : await sharp(source).resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();

    await fs.writeFile(cacheFile, rendered);

    return new Response(rendered, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        ...(download ? { 'Content-Disposition': `attachment; filename="cover-${sizeLabel}.jpg"` } : {}),
      },
    });
  } catch {
    return new Response('Could not render media', { status: 500 });
  }
};
