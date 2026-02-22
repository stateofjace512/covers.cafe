/**
 * Identity Tracking System for Anonymous Comments (Server-Side)
 *
 * Tracks anonymous users without storing raw IP addresses.
 * Creates composite identity from multiple signals:
 * - Hashed IP address
 * - User Agent fingerprint
 * - Browser session ID
 * - localStorage persistent ID (from client)
 *
 * Used for:
 * - Rate limiting
 * - Cooldown enforcement
 * - Ban tracking
 * - Abuse history
 */

import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface IdentitySignals {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  localStorageId?: string;
}

export interface ComputedIdentity {
  identityHash: string;
  ipHash: string;
  userAgentHash: string;
  sessionId: string | null;
  localStorageId: string | null;
}

// ============================================================================
// HASHING FUNCTIONS
// ============================================================================

/**
 * Creates a SHA-256 hash of input string
 * @param input - String to hash
 * @param salt - Optional salt for additional security
 */
function sha256Hash(input: string, salt?: string): string {
  const data = salt ? `${input}:${salt}` : input;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hashes an IP address with optional salt
 * NEVER stores raw IP addresses
 */
export function hashIpAddress(ipAddress: string, salt?: string): string {
  if (!ipAddress) {
    return sha256Hash('unknown-ip', salt);
  }

  // Normalize IP (remove IPv6 prefix if present)
  const normalized = ipAddress.replace(/^::ffff:/, '');

  return sha256Hash(normalized, salt);
}

/**
 * Hashes user agent string
 */
export function hashUserAgent(userAgent: string, salt?: string): string {
  if (!userAgent) {
    return sha256Hash('unknown-ua', salt);
  }

  return sha256Hash(userAgent, salt);
}

/**
 * Creates a composite identity hash from all available signals
 * This is the primary identifier for tracking users
 */
export function createCompositeIdentityHash(signals: IdentitySignals, salt?: string): string {
  const components: string[] = [];

  // Include IP hash
  if (signals.ipAddress) {
    components.push(hashIpAddress(signals.ipAddress, salt));
  }

  // Include user agent hash
  if (signals.userAgent) {
    components.push(hashUserAgent(signals.userAgent, salt));
  }

  // Include localStorage ID (most persistent)
  if (signals.localStorageId) {
    components.push(signals.localStorageId);
  }

  // Include session ID (least persistent, but helps differentiate tabs)
  if (signals.sessionId) {
    components.push(signals.sessionId);
  }

  // If no signals available, create a random hash
  if (components.length === 0) {
    components.push('anonymous-' + Date.now());
  }

  // Combine all components and hash
  const combined = components.join('::');
  return sha256Hash(combined, salt);
}

// ============================================================================
// IDENTITY EXTRACTION FROM REQUEST
// ============================================================================

/**
 * Extracts identity signals from an API request
 * @param request - Netlify/Node.js request object
 */
export function extractIdentityFromRequest(request: Request | any): IdentitySignals {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;

  // Try to extract IP from various headers (Netlify, Cloudflare, etc.)
  if (request.headers) {
    // Standard headers
    ipAddress =
      request.headers.get?.('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get?.('x-real-ip') ||
      request.headers.get?.('cf-connecting-ip') || // Cloudflare
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.headers['x-real-ip'] ||
      request.headers['cf-connecting-ip'];

    // User agent
    userAgent =
      request.headers.get?.('user-agent') ||
      request.headers['user-agent'];
  }

  // Fallback to connection IP
  if (!ipAddress && request.socket) {
    ipAddress = request.socket.remoteAddress;
  }

  return {
    ipAddress,
    userAgent,
  };
}

/**
 * Computes full identity from request and client-provided IDs
 */
export function computeIdentity(
  request: Request | any,
  sessionId?: string,
  localStorageId?: string,
  salt?: string
): ComputedIdentity {
  const signals = extractIdentityFromRequest(request);

  // Add client-provided IDs
  const fullSignals: IdentitySignals = {
    ...signals,
    sessionId: sessionId || null,
    localStorageId: localStorageId || null,
  };

  // Create composite hash
  const identityHash = createCompositeIdentityHash(fullSignals, salt);

  // Create individual hashes
  const ipHash = hashIpAddress(signals.ipAddress || '', salt);
  const userAgentHash = hashUserAgent(signals.userAgent || '', salt);

  return {
    identityHash,
    ipHash,
    userAgentHash,
    sessionId: sessionId || null,
    localStorageId: localStorageId || null,
  };
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Gets a simpler identity hash for rate limiting (less granular)
 * Uses only IP + User Agent (no session/localStorage)
 * Useful for detecting ban evasion across multiple browsers/devices
 */
export function getBasicIdentityHash(signals: IdentitySignals, salt?: string): string {
  const basicSignals: IdentitySignals = {
    ipAddress: signals.ipAddress,
    userAgent: signals.userAgent,
  };

  return createCompositeIdentityHash(basicSignals, salt);
}

/**
 * Gets an IP-only hash (most restrictive)
 * Useful for detecting coordinated attacks from same IP
 */
export function getIpOnlyHash(ipAddress: string, salt?: string): string {
  return hashIpAddress(ipAddress, salt);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that we have sufficient signals for identity tracking
 * Requires at least IP OR localStorage ID
 */
export function hasValidIdentitySignals(signals: IdentitySignals): boolean {
  return Boolean(signals.ipAddress || signals.localStorageId);
}

/**
 * Gets a confidence score for identity tracking (0-100)
 * Higher score = more reliable identity
 */
export function getIdentityConfidence(signals: IdentitySignals): number {
  let confidence = 0;

  if (signals.ipAddress) confidence += 30;
  if (signals.userAgent) confidence += 20;
  if (signals.sessionId) confidence += 20;
  if (signals.localStorageId) confidence += 30;

  return confidence;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  computeIdentity,
  extractIdentityFromRequest,
  createCompositeIdentityHash,
  hashIpAddress,
  hashUserAgent,
  getBasicIdentityHash,
  getIpOnlyHash,
  hasValidIdentitySignals,
  getIdentityConfidence,
};
