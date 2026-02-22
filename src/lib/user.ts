import type { Profile } from './types';
import type { User } from '@supabase/supabase-js';

const INVALID_VALUES = new Set(['profile picture uploaded', 'uploaded']);

export function getSafeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (INVALID_VALUES.has(normalized.toLowerCase())) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') return normalized;
  } catch {
    return null;
  }

  return null;
}

export function getDisplayName(profile: Profile | null | undefined, user?: User | null): string {
  return profile?.display_name?.trim() || profile?.username?.trim() || user?.user_metadata?.username || 'User';
}
