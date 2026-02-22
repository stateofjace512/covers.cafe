import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  // 1. Collect all the user's covers so we can delete storage files
  const { data: covers, error: coversError } = await sb
    .from('covers_cafe_covers')
    .select('id, storage_path, thumbnail_path')
    .eq('user_id', userId);

  if (coversError) {
    console.error('[delete-account] covers fetch error:', coversError.message);
    return new Response('Failed to fetch user covers', { status: 500 });
  }

  // 2. Delete all storage files (fire-and-forget individual failures are acceptable —
  //    orphaned files can be cleaned up later; the important thing is the DB records go)
  if (covers && covers.length > 0) {
    const storagePaths = covers
      .flatMap((c) => [c.storage_path, c.thumbnail_path])
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      const { error: storageError } = await sb.storage
        .from('covers_cafe_covers')
        .remove(storagePaths);
      if (storageError) {
        console.error('[delete-account] storage delete error:', storageError.message);
      }
    }

    // 3. Delete cover records (favorites and downloads should cascade via FK)
    const { error: coversDeleteError } = await sb
      .from('covers_cafe_covers')
      .delete()
      .eq('user_id', userId);

    if (coversDeleteError) {
      console.error('[delete-account] covers delete error:', coversDeleteError.message);
      return new Response('Failed to delete covers', { status: 500 });
    }
  }

  // 4. Delete the profile (may cascade from auth delete, but be explicit)
  await sb.from('covers_cafe_profiles').delete().eq('id', userId);

  // 5. Delete the auth user — this is the point of no return
  const { error: deleteError } = await sb.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[delete-account] auth delete error:', deleteError.message);
    return new Response(
      JSON.stringify({ ok: false, message: 'Failed to delete account. Please contact support.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
