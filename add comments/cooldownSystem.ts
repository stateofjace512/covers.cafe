/**
 * Cooldown Chain System for Anonymous Comments
 *
 * Implements escalating cooldowns for rate limiting and abuse prevention:
 * - Level 0: No cooldown (normal users)
 * - Level 1: Short delay (5 seconds)
 * - Level 2: Medium delay (30 seconds)
 * - Level 3: Long delay (2 minutes)
 * - Level 4: Very long delay (5 minutes)
 * - Level 5: Extreme delay (15 minutes)
 *
 * Cooldowns stack with repeated abuse and decay over time with good behavior.
 */

// ============================================================================
// COOLDOWN LEVELS
// ============================================================================

export const COOLDOWN_LEVELS = {
  NONE: 0,
  SHORT: 1,
  MEDIUM: 2,
  LONG: 3,
  VERY_LONG: 4,
  EXTREME: 5,
} as const;

export type CooldownLevel = typeof COOLDOWN_LEVELS[keyof typeof COOLDOWN_LEVELS];

// ============================================================================
// COOLDOWN DURATIONS (in milliseconds)
// ============================================================================

const COOLDOWN_DURATIONS: Record<CooldownLevel, number> = {
  [COOLDOWN_LEVELS.NONE]: 0,             // 0 seconds
  [COOLDOWN_LEVELS.SHORT]: 5_000,         // 5 seconds
  [COOLDOWN_LEVELS.MEDIUM]: 30_000,       // 30 seconds
  [COOLDOWN_LEVELS.LONG]: 120_000,        // 2 minutes
  [COOLDOWN_LEVELS.VERY_LONG]: 300_000,   // 5 minutes
  [COOLDOWN_LEVELS.EXTREME]: 900_000,     // 15 minutes
} as const;

// Human-readable duration labels
const COOLDOWN_LABELS: Record<CooldownLevel, string> = {
  [COOLDOWN_LEVELS.NONE]: 'No cooldown',
  [COOLDOWN_LEVELS.SHORT]: '5 seconds',
  [COOLDOWN_LEVELS.MEDIUM]: '30 seconds',
  [COOLDOWN_LEVELS.LONG]: '2 minutes',
  [COOLDOWN_LEVELS.VERY_LONG]: '5 minutes',
  [COOLDOWN_LEVELS.EXTREME]: '15 minutes',
} as const;

// ============================================================================
// COOLDOWN DECAY
// After good behavior, cooldown level decreases
// ============================================================================

const COOLDOWN_DECAY_TIME = 24 * 60 * 60 * 1000; // 24 hours without abuse

// ============================================================================
// TYPES
// ============================================================================

export interface CooldownState {
  level: CooldownLevel;
  endTime: Date | null;
  remainingMs: number;
  isActive: boolean;
  canPost: boolean;
}

export interface CooldownUpdate {
  newLevel: CooldownLevel;
  newEndTime: Date;
  duration: number;
  reason: string;
}

// ============================================================================
// COOLDOWN CALCULATION
// ============================================================================

/**
 * Gets the duration in milliseconds for a given cooldown level
 */
export function getCooldownDuration(level: CooldownLevel): number {
  return COOLDOWN_DURATIONS[level] || 0;
}

/**
 * Gets human-readable label for cooldown level
 */
export function getCooldownLabel(level: CooldownLevel): string {
  return COOLDOWN_LABELS[level] || 'Unknown';
}

/**
 * Calculates when the cooldown will end
 */
export function calculateCooldownEnd(level: CooldownLevel, fromTime?: Date): Date {
  const duration = getCooldownDuration(level);
  const startTime = fromTime || new Date();
  return new Date(startTime.getTime() + duration);
}

/**
 * Checks if a cooldown is currently active
 */
export function isCooldownActive(endTime: Date | null): boolean {
  if (!endTime) return false;
  return new Date() < new Date(endTime);
}

/**
 * Gets remaining cooldown time in milliseconds
 */
export function getRemainingCooldown(endTime: Date | null): number {
  if (!endTime) return 0;

  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const remaining = end - now;

  return Math.max(0, remaining);
}

/**
 * Formats cooldown time for display (e.g., "2m 30s", "45s")
 */
export function formatCooldownTime(milliseconds: number): string {
  if (milliseconds <= 0) return '0s';

  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

// ============================================================================
// COOLDOWN STATE MANAGEMENT
// ============================================================================

/**
 * Gets current cooldown state
 */
export function getCooldownState(
  currentLevel: CooldownLevel,
  cooldownEndTime: Date | null
): CooldownState {
  const isActive = isCooldownActive(cooldownEndTime);
  const remainingMs = getRemainingCooldown(cooldownEndTime);

  return {
    level: currentLevel,
    endTime: cooldownEndTime,
    remainingMs,
    isActive,
    canPost: !isActive,
  };
}

/**
 * Determines if cooldown should be applied based on abuse score
 * @param abuseScore - Current comment's abuse score
 * @param currentLevel - User's current cooldown level
 * @returns Whether to apply/escalate cooldown
 */
export function shouldApplyCooldown(abuseScore: number, currentLevel: CooldownLevel): boolean {
  // Score 3+ triggers cooldown
  return abuseScore >= 3;
}

/**
 * Calculates new cooldown level based on current level and abuse
 * @param currentLevel - Current cooldown level
 * @param abuseScore - Abuse score of current comment
 * @param isRepeatedAbuse - Has user abused repeatedly in short time?
 */
export function calculateNewCooldownLevel(
  currentLevel: CooldownLevel,
  abuseScore: number,
  isRepeatedAbuse: boolean = false
): CooldownLevel {
  // No abuse = no cooldown
  if (abuseScore < 3) {
    return COOLDOWN_LEVELS.NONE;
  }

  // Moderate abuse (3-9)
  if (abuseScore < 10) {
    if (isRepeatedAbuse) {
      // Escalate if repeated
      return Math.min(currentLevel + 1, COOLDOWN_LEVELS.EXTREME) as CooldownLevel;
    }
    // First offense = short cooldown
    return Math.max(currentLevel, COOLDOWN_LEVELS.SHORT) as CooldownLevel;
  }

  // High abuse (10-19)
  if (abuseScore < 20) {
    // Skip to medium or escalate
    return Math.max(COOLDOWN_LEVELS.MEDIUM, currentLevel + 1) as CooldownLevel;
  }

  // Extreme abuse (20+)
  // Jump to very long cooldown
  return Math.max(COOLDOWN_LEVELS.VERY_LONG, currentLevel + 1) as CooldownLevel;
}

/**
 * Applies cooldown escalation
 */
export function applyCooldown(
  currentLevel: CooldownLevel,
  abuseScore: number,
  isRepeatedAbuse: boolean = false
): CooldownUpdate {
  const newLevel = calculateNewCooldownLevel(currentLevel, abuseScore, isRepeatedAbuse);
  const duration = getCooldownDuration(newLevel);
  const newEndTime = calculateCooldownEnd(newLevel);

  let reason = 'Cooldown applied';
  if (isRepeatedAbuse) {
    reason = 'Cooldown escalated due to repeated abuse';
  } else if (abuseScore >= 20) {
    reason = 'Extended cooldown due to severe abuse';
  } else if (abuseScore >= 10) {
    reason = 'Cooldown applied due to high abuse score';
  }

  return {
    newLevel,
    newEndTime,
    duration,
    reason,
  };
}

// ============================================================================
// COOLDOWN DECAY
// ============================================================================

/**
 * Checks if cooldown level should decay (decrease) due to good behavior
 * @param lastCommentAt - Time of last comment
 * @param currentLevel - Current cooldown level
 */
export function shouldDecayCooldown(lastCommentAt: Date | null, currentLevel: CooldownLevel): boolean {
  if (!lastCommentAt || currentLevel === COOLDOWN_LEVELS.NONE) {
    return false;
  }

  const timeSinceLastComment = Date.now() - new Date(lastCommentAt).getTime();
  return timeSinceLastComment > COOLDOWN_DECAY_TIME;
}

/**
 * Decays cooldown level (rewards good behavior)
 */
export function decayCooldownLevel(currentLevel: CooldownLevel): CooldownLevel {
  if (currentLevel === COOLDOWN_LEVELS.NONE) {
    return COOLDOWN_LEVELS.NONE;
  }

  return Math.max(currentLevel - 1, COOLDOWN_LEVELS.NONE) as CooldownLevel;
}

// ============================================================================
// REPEATED ABUSE DETECTION
// ============================================================================

/**
 * Detects if user is repeatedly abusing within a short time window
 * @param recentComments - Number of comments in last hour
 * @param recentAbuseScore - Total abuse score in last hour
 */
export function isRepeatedAbuse(recentComments: number, recentAbuseScore: number): boolean {
  // 3+ comments with abuse in last hour = repeated abuse
  if (recentComments >= 3 && recentAbuseScore >= 9) {
    return true;
  }

  // 5+ comments in last hour regardless of score = spam
  if (recentComments >= 5) {
    return true;
  }

  return false;
}

// ============================================================================
// USER-FACING MESSAGES
// ============================================================================

/**
 * Gets user-friendly cooldown message
 */
export function getCooldownMessage(state: CooldownState): string {
  if (!state.isActive) {
    return 'You can post a comment now.';
  }

  const timeRemaining = formatCooldownTime(state.remainingMs);
  return `Please wait ${timeRemaining} before posting again.`;
}

/**
 * Gets cooldown warning message (shown before posting)
 */
export function getCooldownWarning(level: CooldownLevel): string | null {
  if (level === COOLDOWN_LEVELS.NONE) {
    return null;
  }

  const duration = getCooldownLabel(level);
  return `Due to previous activity, posting this comment will start a ${duration} cooldown.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  COOLDOWN_LEVELS,
  getCooldownDuration,
  getCooldownLabel,
  calculateCooldownEnd,
  isCooldownActive,
  getRemainingCooldown,
  formatCooldownTime,
  getCooldownState,
  shouldApplyCooldown,
  calculateNewCooldownLevel,
  applyCooldown,
  shouldDecayCooldown,
  decayCooldownLevel,
  isRepeatedAbuse,
  getCooldownMessage,
  getCooldownWarning,
};
