/**
 * Server-side display name normalization for comments
 *
 * This file handles admin username detection and normalization server-side
 * where environment variables are accessible. The client receives a special
 * marker value that it can use to render the official badge with styling.
 */

import { getEnvString } from '../env.server.js';

// Special marker for official/admin comments - client detects this and renders with styling
export const OFFICIAL_ADMIN_MARKER = '__OFFICIAL_ADMIN__';

/**
 * Check if a username matches the admin login username
 */
export function isAdminUsername(username?: string | null): boolean {
  if (!username) return false;

  const adminUsername = getEnvString('USER_NAME_LOGIN', '');
  if (!adminUsername) return false;

  // Case-insensitive comparison since the admin username casing might vary
  return username.toLowerCase() === adminUsername.toLowerCase();
}

/**
 * Normalize a comment's author username for storage
 * If the username matches the admin, returns the special marker
 */
export function normalizeAuthorUsername(username?: string | null): string | undefined {
  if (!username) return username ?? undefined;

  if (isAdminUsername(username)) {
    return OFFICIAL_ADMIN_MARKER;
  }

  return username;
}

/**
 * Transform comment data for client consumption
 * Normalizes the author_username field if it matches admin
 */
export function normalizeCommentForClient<T extends { author_username?: string | null }>(
  comment: T
): T {
  if (!comment.author_username) return comment;

  if (isAdminUsername(comment.author_username)) {
    return {
      ...comment,
      author_username: OFFICIAL_ADMIN_MARKER,
    };
  }

  return comment;
}

/**
 * Transform multiple comments for client consumption
 */
export function normalizeCommentsForClient<T extends { author_username?: string | null }>(
  comments: T[]
): T[] {
  return comments.map(normalizeCommentForClient);
}
