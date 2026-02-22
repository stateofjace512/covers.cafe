/**
 * Identity Tracking System for Anonymous Comments (Client-Side)
 *
 * Generates and manages client-side identity signals:
 * - localStorage persistent ID (survives browser restarts)
 * - sessionStorage session ID (cleared when tab closes)
 *
 * These IDs are sent to the server with each comment submission
 * to create a composite identity for rate limiting and abuse tracking.
 */

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  LOCAL_STORAGE_ID: 'mstrjk_comment_user_id',
  SESSION_ID: 'mstrjk_comment_session_id',
} as const;

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generates a cryptographically random ID
 */
function generateSecureId(): string {
  // Use crypto API if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates a timestamp-based ID with random component
 */
function generateTimestampId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

// ============================================================================
// LOCALSTORAGE ID MANAGEMENT
// ============================================================================

/**
 * Gets or creates a persistent localStorage ID
 * This ID survives browser restarts and is the most persistent identifier
 */
export function getOrCreateLocalStorageId(): string {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      return generateSecureId();
    }

    // Try to get existing ID
    let localId = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ID);

    // If no ID exists, create one
    if (!localId) {
      localId = generateSecureId();
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ID, localId);
    }

    return localId;
  } catch (error) {
    // localStorage may be blocked (private mode, etc.)
    return generateSecureId();
  }
}

/**
 * Clears the localStorage ID (for testing or user request)
 */
export function clearLocalStorageId(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ID);
    }
  } catch (error) {
  }
}

// ============================================================================
// SESSION ID MANAGEMENT
// ============================================================================

/**
 * Gets or creates a session ID
 * This ID is cleared when the browser tab is closed
 */
export function getOrCreateSessionId(): string {
  try {
    // Check if sessionStorage is available
    if (typeof sessionStorage === 'undefined') {
      return generateTimestampId();
    }

    // Try to get existing session ID
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);

    // If no ID exists, create one
    if (!sessionId) {
      sessionId = generateTimestampId();
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }

    return sessionId;
  } catch (error) {
    // sessionStorage may be blocked
    return generateTimestampId();
  }
}

/**
 * Clears the session ID
 */
export function clearSessionId(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    }
  } catch (error) {
  }
}

// ============================================================================
// COMPOSITE IDENTITY
// ============================================================================

export interface ClientIdentity {
  localStorageId: string;
  sessionId: string;
  timestamp: number;
}

/**
 * Gets complete client-side identity information
 * Call this before submitting a comment
 */
export function getClientIdentity(): ClientIdentity {
  return {
    localStorageId: getOrCreateLocalStorageId(),
    sessionId: getOrCreateSessionId(),
    timestamp: Date.now(),
  };
}

// ============================================================================
// PRIVACY & CLEANUP
// ============================================================================

/**
 * Clears all identity data (for privacy-conscious users)
 */
export function clearAllIdentityData(): void {
  clearLocalStorageId();
  clearSessionId();
}

/**
 * Checks if identity tracking is available
 */
export function isIdentityTrackingAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getOrCreateLocalStorageId,
  getOrCreateSessionId,
  getClientIdentity,
  clearLocalStorageId,
  clearSessionId,
  clearAllIdentityData,
  isIdentityTrackingAvailable,
};
