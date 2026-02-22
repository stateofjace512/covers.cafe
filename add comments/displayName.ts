/**
 * Client-side display name utilities for comments
 *
 * The actual admin username detection happens server-side (see displayName.server.ts).
 * The client receives a special marker value that it uses to render official badges.
 */

// This marker is set by the server when the comment author is the admin
export const OFFICIAL_ADMIN_MARKER = '__OFFICIAL_ADMIN__';

/**
 * Check if a display name is the official admin marker
 */
export function isOfficialAdmin(name?: string | null): boolean {
  return name === OFFICIAL_ADMIN_MARKER;
}

/**
 * Normalize a comment display name for rendering
 * Returns the name as-is unless it's the official marker
 */
export function normalizeCommentDisplayName(name?: string | null): string | undefined {
  if (!name) {
    return name ?? undefined;
  }

  // Official admin marker is handled specially by the component
  // Return undefined so the component knows to render the gradient version
  if (name === OFFICIAL_ADMIN_MARKER) {
    return undefined;
  }

  return name;
}
