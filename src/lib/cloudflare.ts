/**
 * Cloudflare Images API utilities (server-side only — never import in client bundles).
 * Requires env vars:
 *   CLOUDFLARE_API          — API token with Images:Edit permission
 *   CLOUDFLARE_ACCOUNT_ID   — CF account ID
 *
 * The public delivery hash (PUBLIC_CF_IMAGES_HASH) lives in media.ts
 * and is safe to expose to the browser.
 */

function getCfEnv() {
  const token = import.meta.env.CLOUDFLARE_API as string | undefined;
  const accountId = import.meta.env.CLOUDFLARE_ACCOUNT_ID as string | undefined;
  if (!token || !accountId) throw new Error('Missing CLOUDFLARE_API or CLOUDFLARE_ACCOUNT_ID env vars');
  return { token, accountId };
}

/**
 * Upload a file buffer to Cloudflare Images.
 * Returns the CF image ID (e.g. "abc123def456").
 */
export async function uploadToCf(
  fileBuffer: ArrayBuffer,
  filename: string,
  metadata?: Record<string, string>,
): Promise<string> {
  const { token, accountId } = getCfEnv();

  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  if (metadata) {
    form.append('metadata', JSON.stringify(metadata));
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  );

  const json = (await res.json()) as { success: boolean; result?: { id: string }; errors?: Array<{ message: string }> };
  if (!json.success || !json.result?.id) {
    throw new Error(json.errors?.[0]?.message ?? 'Cloudflare Images upload failed');
  }
  return json.result.id;
}

/**
 * Delete an image from Cloudflare Images by its CF image ID.
 * Swallows 404s (already deleted) but throws on other errors.
 */
export async function deleteFromCf(imageId: string): Promise<void> {
  const { token, accountId } = getCfEnv();

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );

  if (res.status === 404) return; // already gone, that's fine

  const json = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
  if (!json.success) {
    throw new Error(json.errors?.[0]?.message ?? 'Cloudflare Images delete failed');
  }
}

/**
 * True when the storage_path value points to a Cloudflare image.
 * CF paths are stored as "cf:<imageId>".
 */
export function isCfPath(storagePath: string | null | undefined): boolean {
  return typeof storagePath === 'string' && storagePath.startsWith('cf:');
}

/**
 * Extract the CF image ID from a storage path like "cf:abc123".
 */
export function cfImageIdFromPath(storagePath: string): string {
  return storagePath.slice(3);
}
