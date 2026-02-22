/** Simple in-memory rate limiter keyed by action string. */
const timestamps: Map<string, number[]> = new Map();

/**
 * Returns true if the action is allowed, false if rate-limited.
 * @param action   Unique key, e.g. "favorite" or "upload"
 * @param max      Max calls allowed within the window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(action: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = (timestamps.get(action) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) return false;
  prev.push(now);
  timestamps.set(action, prev);
  return true;
}

/** Reset the rate limiter for an action (e.g. after the modal is dismissed). */
export function resetRateLimit(action: string): void {
  timestamps.delete(action);
}
