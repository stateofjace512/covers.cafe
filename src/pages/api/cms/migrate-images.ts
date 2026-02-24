/**
 * GET /api/cms/migrate-images
 * Operator-only SSE endpoint. Streams live progress as it migrates images from
 * Supabase storage to Cloudflare Images in batches.
 *
 * Query params:
 *   batch — number of images per run (default 50, max 200)
 *   type  — "covers" | "avatars" | "artist-photos" | "all" (default "all")
 *
 * Event format (newline-delimited JSON in the SSE data field):
 *   { type: "log",      message: string }
 *   { type: "progress", done: number, total: number }
 *   { type: "done",     migrated: number, failed: number, remaining: number }
 *   { type: "error",    message: string }
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { createClient } from '@supabase/supabase-js';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
const CLOUDFLARE_API = import.meta.env.CLOUDFLARE_API as string;
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.CLOUDFLARE_ACCOUNT_ID as string;

// ── CF helpers ────────────────────────────────────────────────────────────────

async function cfUpload(
  fileBuffer: ArrayBuffer,
  filename: string,
  customId?: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  if (customId) form.append('id', customId);
  if (metadata) form.append('metadata', JSON.stringify(metadata));

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    { method: 'POST', headers: { Authorization: `Bearer ${CLOUDFLARE_API}` }, body: form },
  );
  const json = (await res.json()) as { success: boolean; result?: { id: string }; errors?: Array<{ message: string }> };
  if (!json.success || !json.result?.id) {
    throw new Error(json.errors?.[0]?.message ?? 'CF upload failed');
  }
  return json.result.id;
}

async function cfDelete(imageId: string): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(imageId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${CLOUDFLARE_API}` } },
  );
}

function artistPhotoCustomId(artistName: string): string {
  return 'artist-photo-' + artistName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 220);
}

// ── SSE stream ────────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ request, url: reqUrl }) => {
  // Auth check
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  // Use service-role client for migration (bypass RLS)
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!supabaseUrl || !serviceKey) {
    return new Response('Server misconfigured (missing Supabase env)', { status: 503 });
  }
  if (!CLOUDFLARE_API || !CLOUDFLARE_ACCOUNT_ID || !CF_IMAGES_HASH) {
    return new Response('Server misconfigured (missing Cloudflare env)', { status: 503 });
  }
  const sb = createClient(supabaseUrl, serviceKey);

  const batchParam = parseInt(reqUrl.searchParams.get('batch') ?? '50', 10);
  const batch = Math.min(Math.max(batchParam, 1), 200);
  const typeParam = (reqUrl.searchParams.get('type') ?? 'all') as 'covers' | 'avatars' | 'artist-photos' | 'all';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      let migrated = 0;
      let failed = 0;

      // ── Cover images ──────────────────────────────────────────────────────
      if (typeParam === 'covers' || typeParam === 'all') {
        const { data: covers, error: coversErr } = await sb
          .from('covers_cafe_covers')
          .select('id, storage_path, thumbnail_path')
          .neq('storage_path', '')
          .not('storage_path', 'ilike', 'cf:%')
          .order('created_at', { ascending: true })
          .limit(batch);

        if (coversErr) {
          send({ type: 'log', message: `[covers] DB error: ${coversErr.message}` });
        } else if (!covers || covers.length === 0) {
          send({ type: 'log', message: '[covers] All covers already on Cloudflare ✓' });
        } else {
          send({ type: 'log', message: `[covers] Migrating ${covers.length} cover(s)…` });
          for (let i = 0; i < covers.length; i++) {
            const cover = covers[i];
            try {
              const { data: fileData, error: dlErr } = await sb.storage
                .from('covers_cafe_covers')
                .download(cover.storage_path);
              if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download failed');

              const arrayBuffer = await fileData.arrayBuffer();
              const filename = (cover.storage_path.split('/').pop() ?? 'cover.jpg');
              const cfId = await cfUpload(arrayBuffer, filename, undefined, { cover_id: cover.id });

              const { error: dbErr } = await sb
                .from('covers_cafe_covers')
                .update({ storage_path: `cf:${cfId}`, thumbnail_path: null })
                .eq('id', cover.id);
              if (dbErr) throw new Error(`DB: ${dbErr.message}`);

              if (cover.thumbnail_path) {
                await sb.storage.from('covers_cafe_covers').remove([cover.thumbnail_path]).catch(() => {});
              }

              migrated++;
              send({ type: 'progress', done: i + 1, total: covers.length });
              send({ type: 'log', message: `  ✓ cover ${cover.id} → cf:${cfId}` });
            } catch (err) {
              failed++;
              send({ type: 'log', message: `  ✗ cover ${cover.id}: ${(err as Error).message}` });
            }
          }
        }
      }

      // ── Avatars ───────────────────────────────────────────────────────────
      if (typeParam === 'avatars' || typeParam === 'all') {
        const { data: profiles, error: profilesErr } = await sb
          .from('covers_cafe_profiles')
          .select('id, avatar_url')
          .not('avatar_url', 'is', null)
          .not('avatar_url', 'ilike', '')
          .not('avatar_url', 'ilike', '%imagedelivery.net%')
          .order('created_at', { ascending: true })
          .limit(batch);

        if (profilesErr) {
          send({ type: 'log', message: `[avatars] DB error: ${profilesErr.message}` });
        } else if (!profiles || profiles.length === 0) {
          send({ type: 'log', message: '[avatars] All avatars already on Cloudflare ✓' });
        } else {
          send({ type: 'log', message: `[avatars] Migrating ${profiles.length} avatar(s)…` });
          for (let i = 0; i < profiles.length; i++) {
            const profile = profiles[i];
            try {
              const fetchRes = await fetch(profile.avatar_url as string);
              if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
              const arrayBuffer = await fetchRes.arrayBuffer();
              const cfId = await cfUpload(arrayBuffer, `avatar-${profile.id}.jpg`, undefined, {
                user_id: profile.id, type: 'avatar',
              });
              const newUrl = `https://imagedelivery.net/${CF_IMAGES_HASH}/${cfId}/public`;
              const { error: dbErr } = await sb
                .from('covers_cafe_profiles')
                .update({ avatar_url: newUrl })
                .eq('id', profile.id);
              if (dbErr) throw new Error(`DB: ${dbErr.message}`);
              migrated++;
              send({ type: 'progress', done: i + 1, total: profiles.length });
              send({ type: 'log', message: `  ✓ avatar ${profile.id} → ${cfId}` });
            } catch (err) {
              failed++;
              send({ type: 'log', message: `  ✗ avatar ${profile.id}: ${(err as Error).message}` });
            }
          }
        }
      }

      // ── Artist photos ─────────────────────────────────────────────────────
      if (typeParam === 'artist-photos' || typeParam === 'all') {
        // List all files in the artist photos bucket
        const { data: files, error: listErr } = await sb.storage
          .from('covers_cafe_artist_photos')
          .list('', { limit: batch, sortBy: { column: 'name', order: 'asc' } });

        if (listErr) {
          send({ type: 'log', message: `[artist-photos] Bucket list error: ${listErr.message}` });
        } else if (!files || files.length === 0) {
          send({ type: 'log', message: '[artist-photos] No artist photos found in Supabase bucket ✓' });
        } else {
          send({ type: 'log', message: `[artist-photos] Migrating ${files.length} artist photo(s)…` });
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filename = file.name; // e.g. "Pink%20Floyd.jpg"
            const artistName = decodeURIComponent(filename.replace(/\.jpg$/i, ''));
            const customId = artistPhotoCustomId(artistName);
            try {
              const { data: fileData, error: dlErr } = await sb.storage
                .from('covers_cafe_artist_photos')
                .download(filename);
              if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download failed');

              // Delete existing CF image with this custom ID first (ignore errors)
              await cfDelete(customId).catch(() => {});

              const arrayBuffer = await fileData.arrayBuffer();
              const cfId = await cfUpload(arrayBuffer, filename, customId, {
                artist_name: artistName, type: 'artist-photo',
              });
              migrated++;
              send({ type: 'progress', done: i + 1, total: files.length });
              send({ type: 'log', message: `  ✓ artist photo "${artistName}" → ${cfId}` });
            } catch (err) {
              failed++;
              send({ type: 'log', message: `  ✗ artist photo "${artistName}": ${(err as Error).message}` });
            }
          }
        }
      }

      // ── Count remaining ───────────────────────────────────────────────────
      const [{ count: remCovers }, { count: remAvatars }] = await Promise.all([
        sb.from('covers_cafe_covers').select('id', { count: 'exact', head: true })
          .neq('storage_path', '').not('storage_path', 'ilike', 'cf:%'),
        sb.from('covers_cafe_profiles').select('id', { count: 'exact', head: true })
          .not('avatar_url', 'is', null).not('avatar_url', 'ilike', '').not('avatar_url', 'ilike', '%imagedelivery.net%'),
      ]);

      const remaining = (remCovers ?? 0) + (remAvatars ?? 0);
      send({ type: 'done', migrated, failed, remaining });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
