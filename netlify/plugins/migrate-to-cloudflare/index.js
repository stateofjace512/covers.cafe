/**
 * Netlify Build Plugin: migrate-to-cloudflare
 *
 * Runs after a successful build (onSuccess). Migrates cover images, avatars,
 * and artist photos that are still stored in Supabase to Cloudflare Images.
 *
 * Required env vars (set in Netlify dashboard):
 *   PUBLIC_SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service-role key
 *   CLOUDFLARE_API              — Cloudflare API token (Images:Edit permission)
 *   CLOUDFLARE_ACCOUNT_ID       — Cloudflare account ID
 *   PUBLIC_CF_IMAGES_HASH       — Cloudflare Images delivery hash
 *
 * Set MIGRATE_BATCH_SIZE (default 50) to control items processed per deploy.
 */

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = parseInt(process.env.MIGRATE_BATCH_SIZE ?? '50', 10);

function artistPhotoCustomId(artistName) {
  return 'artist-photo-' + artistName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 220);
}

async function cfUpload(token, accountId, fileBuffer, filename, customId, metadata) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  if (customId) form.append('id', customId);
  if (metadata) form.append('metadata', JSON.stringify(metadata));

  const res = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/images/v1',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form },
  );
  const json = await res.json();
  if (!json.success || !json.result?.id) {
    throw new Error(json.errors?.[0]?.message ?? 'CF upload failed');
  }
  return json.result.id;
}

async function cfDelete(token, accountId, imageId) {
  await fetch(
    'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/images/v1/' + encodeURIComponent(imageId),
    { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } },
  ).catch(() => {});
}

export default {
  onSuccess: async () => {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const cfToken = process.env.CLOUDFLARE_API;
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfHash = process.env.PUBLIC_CF_IMAGES_HASH;

    if (!supabaseUrl || !serviceKey || !cfToken || !cfAccountId || !cfHash) {
      console.log('[migrate-to-cloudflare] Missing required env vars — skipping.');
      console.log('  Required: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_API, CLOUDFLARE_ACCOUNT_ID, PUBLIC_CF_IMAGES_HASH');
      return;
    }

    const sb = createClient(supabaseUrl, serviceKey);
    let totalSuccess = 0;
    let totalFailed = 0;

    // ── 1. Migrate cover images ─────────────────────────────────────────────

    console.log('[migrate-to-cloudflare] Fetching up to ' + BATCH_SIZE + ' unmigrated covers...');

    const { data: covers, error: coversErr } = await sb
      .from('covers_cafe_covers')
      .select('id, storage_path')
      .neq('storage_path', '')
      .not('storage_path', 'ilike', 'cf:%')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (coversErr) {
      console.error('[migrate-to-cloudflare] Failed to fetch covers:', coversErr.message);
    } else if (!covers || covers.length === 0) {
      console.log('[migrate-to-cloudflare] All covers are already on Cloudflare.');
    } else {
      console.log('[migrate-to-cloudflare] Migrating ' + covers.length + ' cover(s)...');

      for (const cover of covers) {
        try {
          const { data: fileData, error: dlErr } = await sb.storage
            .from('covers_cafe_covers')
            .download(cover.storage_path);

          if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download returned no data');

          const arrayBuffer = await fileData.arrayBuffer();
          const filename = cover.storage_path.split('/').pop() ?? 'cover.jpg';

          const cfId = await cfUpload(cfToken, cfAccountId, arrayBuffer, filename, null, {
            supabase_path: cover.storage_path,
            cover_id: cover.id,
          });

          const { error: dbErr } = await sb
            .from('covers_cafe_covers')
            .update({ storage_path: 'cf:' + cfId })
            .eq('id', cover.id);

          if (dbErr) throw new Error('DB update: ' + dbErr.message);

          console.log('  ok cover ' + cover.id + ' → cf:' + cfId);
          totalSuccess++;
        } catch (err) {
          console.error('  fail cover ' + cover.id + ' (' + cover.storage_path + '): ' + err.message);
          totalFailed++;
        }
      }
    }

    // ── 2. Migrate avatars ──────────────────────────────────────────────────

    console.log('[migrate-to-cloudflare] Fetching up to ' + BATCH_SIZE + ' unmigrated avatars...');

    const { data: profiles, error: profilesErr } = await sb
      .from('covers_cafe_profiles')
      .select('id, avatar_url')
      .not('avatar_url', 'is', null)
      .not('avatar_url', 'ilike', '')
      .not('avatar_url', 'ilike', '%imagedelivery.net%')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (profilesErr) {
      console.error('[migrate-to-cloudflare] Failed to fetch profiles:', profilesErr.message);
    } else if (!profiles || profiles.length === 0) {
      console.log('[migrate-to-cloudflare] All avatars are already on Cloudflare.');
    } else {
      console.log('[migrate-to-cloudflare] Migrating ' + profiles.length + ' avatar(s)...');

      for (const profile of profiles) {
        try {
          const avatarRes = await fetch(profile.avatar_url);
          if (!avatarRes.ok) throw new Error('HTTP ' + avatarRes.status + ' fetching avatar');
          const arrayBuffer = await avatarRes.arrayBuffer();

          const cfId = await cfUpload(cfToken, cfAccountId, arrayBuffer, 'avatar-' + profile.id + '.jpg', null, {
            user_id: profile.id,
            type: 'avatar',
          });

          const newUrl = 'https://imagedelivery.net/' + cfHash + '/' + cfId + '/public';

          const { error: dbErr } = await sb
            .from('covers_cafe_profiles')
            .update({ avatar_url: newUrl })
            .eq('id', profile.id);

          if (dbErr) throw new Error('DB update: ' + dbErr.message);

          console.log('  ok avatar ' + profile.id + ' → ' + cfId);
          totalSuccess++;
        } catch (err) {
          console.error('  fail avatar ' + profile.id + ': ' + err.message);
          totalFailed++;
        }
      }
    }

    // ── 3. Migrate artist photos ──────────────────────────────────────────────

    console.log('[migrate-to-cloudflare] Fetching up to ' + BATCH_SIZE + ' artist photos from Supabase bucket...');

    const { data: artistFiles, error: artistListErr } = await sb.storage
      .from('covers_cafe_artist_photos')
      .list('', { limit: BATCH_SIZE, sortBy: { column: 'name', order: 'asc' } });

    if (artistListErr) {
      console.error('[migrate-to-cloudflare] Artist photo list error:', artistListErr.message);
    } else if (!artistFiles || artistFiles.length === 0) {
      console.log('[migrate-to-cloudflare] No artist photos found in Supabase bucket.');
    } else {
      console.log('[migrate-to-cloudflare] Migrating ' + artistFiles.length + ' artist photo(s)...');

      for (const file of artistFiles) {
        const artistName = decodeURIComponent(file.name.replace(/\.jpg$/i, ''));
        const customId = artistPhotoCustomId(artistName);
        try {
          const { data: fileData, error: dlErr } = await sb.storage
            .from('covers_cafe_artist_photos')
            .download(file.name);

          if (dlErr || !fileData) throw new Error(dlErr?.message ?? 'download failed');

          // Delete existing CF image with this custom ID first (upsert via delete+upload)
          await cfDelete(cfToken, cfAccountId, customId);

          const arrayBuffer = await fileData.arrayBuffer();
          const cfId = await cfUpload(cfToken, cfAccountId, arrayBuffer, file.name, customId, {
            artist_name: artistName,
            type: 'artist-photo',
          });

          console.log('  ok artist photo "' + artistName + '" → ' + cfId);
          totalSuccess++;
        } catch (err) {
          console.error('  fail artist photo "' + artistName + '": ' + err.message);
          totalFailed++;
        }
      }
    }

    // ── 4. Summary ──────────────────────────────────────────────────────────

    console.log('[migrate-to-cloudflare] Done. ' + totalSuccess + ' migrated, ' + totalFailed + ' failed.');

    const { count: remainingCovers } = await sb
      .from('covers_cafe_covers')
      .select('id', { count: 'exact', head: true })
      .neq('storage_path', '')
      .not('storage_path', 'ilike', 'cf:%');

    const { count: remainingAvatars } = await sb
      .from('covers_cafe_profiles')
      .select('id', { count: 'exact', head: true })
      .not('avatar_url', 'is', null)
      .not('avatar_url', 'ilike', '')
      .not('avatar_url', 'ilike', '%imagedelivery.net%');

    const remaining = (remainingCovers ?? 0) + (remainingAvatars ?? 0);
    if (remaining > 0) {
      console.log('[migrate-to-cloudflare] ' + remaining + ' image(s) still need migration. Trigger another deploy to continue.');
    } else {
      console.log('[migrate-to-cloudflare] All images have been migrated to Cloudflare!');
    }
  },
};
