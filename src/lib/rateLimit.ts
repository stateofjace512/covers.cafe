interface RateLimitBucket {
  timestamps: number[];
  weightedEvents: Array<{ timestamp: number; units: number }>;
  blockedUntil: number;
  strikes: number;
  lastViolationAt: number;
}

const buckets: Map<string, RateLimitBucket> = new Map();

function getBucket(action: string): RateLimitBucket {
  const bucket = buckets.get(action);
  if (bucket) return bucket;
  const created: RateLimitBucket = { timestamps: [], weightedEvents: [], blockedUntil: 0, strikes: 0, lastViolationAt: 0 };
  buckets.set(action, created);
  return created;
}

function getPenaltyConfig(windowMs: number) {
  const basePenaltyMs = Math.max(1500, Math.floor(windowMs / 2));
  const maxPenaltyMs = Math.max(30_000, windowMs * 5);
  return { basePenaltyMs, maxPenaltyMs };
}

function applyViolation(bucket: RateLimitBucket, now: number, windowMs: number) {
  const { basePenaltyMs, maxPenaltyMs } = getPenaltyConfig(windowMs);
  bucket.strikes += 1;

  const strikePenalty = Math.min(maxPenaltyMs, basePenaltyMs * (2 ** (bucket.strikes - 1)));

  if (bucket.blockedUntil > now) {
    const extension = Math.max(1_000, Math.floor(strikePenalty / 2));
    bucket.blockedUntil = Math.min(now + maxPenaltyMs, bucket.blockedUntil + extension);
  } else {
    bucket.blockedUntil = now + strikePenalty;
  }

  // Clear recorded events so that when the block expires the user isn't
  // immediately re-blocked because old timestamps are still inside the window.
  // The block duration itself is the full penalty.
  bucket.timestamps = [];
  bucket.weightedEvents = [];

  bucket.lastViolationAt = now;
}

export function checkRateLimit(action: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = getBucket(action);

  if (bucket.blockedUntil > 0 && now >= bucket.blockedUntil && now - bucket.lastViolationAt > windowMs * 2) {
    bucket.strikes = 0;
  }

  if (bucket.blockedUntil > now) {
    applyViolation(bucket, now, windowMs);
    return false;
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= max) {
    applyViolation(bucket, now, windowMs);
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

export function checkWeightedRateLimit(action: string, maxUnits: number, windowMs: number, units = 1): boolean {
  const now = Date.now();
  const bucket = getBucket(action);

  if (bucket.blockedUntil > 0 && now >= bucket.blockedUntil && now - bucket.lastViolationAt > windowMs * 2) {
    bucket.strikes = 0;
  }

  if (bucket.blockedUntil > now) {
    applyViolation(bucket, now, windowMs);
    return false;
  }

  bucket.weightedEvents = bucket.weightedEvents.filter((event) => now - event.timestamp < windowMs);
  const usedUnits = bucket.weightedEvents.reduce((sum, event) => sum + event.units, 0);

  if (usedUnits + units > maxUnits) {
    applyViolation(bucket, now, windowMs);
    return false;
  }

  bucket.weightedEvents.push({ timestamp: now, units });
  return true;
}

export function getRateLimitState(action: string): { blocked: boolean; retryAfterMs: number; strikes: number } {
  const bucket = buckets.get(action);
  if (!bucket) return { blocked: false, retryAfterMs: 0, strikes: 0 };

  const retryAfterMs = Math.max(0, bucket.blockedUntil - Date.now());
  return { blocked: retryAfterMs > 0, retryAfterMs, strikes: bucket.strikes };
}

export function resetRateLimit(action: string): void {
  buckets.delete(action);
}
