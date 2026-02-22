/**
 * Shadow Ban and Auto-Ban System for Anonymous Comments
 *
 * Implements intelligent banning based on abuse patterns:
 *
 * SHADOW BAN:
 * - Comment appears posted to the user
 * - Comment is invisible to everyone else
 * - Used to prevent ban evasion
 * - Algorithmic and reversible
 *
 * AUTO-BAN:
 * - Automatic permanent ban
 * - Triggered by severe/repeated abuse
 * - Prevents further comment submission
 *
 * Ban triggers:
 * - Single comment with extreme abuse (score 20+)
 * - Multiple comments with high abuse (X comments with Y score)
 * - Repeated hate speech
 * - Threats or violence
 */

import { type AbuseScore } from './abuseScoring';

// ============================================================================
// BAN THRESHOLDS
// ============================================================================

const BAN_THRESHOLDS = {
  // Single comment thresholds
  SHADOW_BAN_SCORE: 10,      // Single comment score that triggers shadow ban
  AUTO_BAN_SCORE: 20,         // Single comment score that triggers auto-ban

  // Pattern-based thresholds (within time window)
  PATTERN_TIME_WINDOW: 60 * 60 * 1000, // 1 hour

  // Multiple comments with abuse
  SHADOW_BAN_COMMENTS: 3,     // 3+ abusive comments in window
  SHADOW_BAN_TOTAL_SCORE: 15, // with combined score of 15+

  AUTO_BAN_COMMENTS: 5,       // 5+ highly abusive comments
  AUTO_BAN_TOTAL_SCORE: 30,   // with combined score of 30+

  // Hate speech tolerance (zero tolerance)
  HATE_SPEECH_COUNT: 2,       // 2 hate speech comments = auto-ban

  // Reports threshold
  REPORTS_SHADOW_BAN: 5,      // 5+ reports on same user = shadow ban
  REPORTS_AUTO_BAN: 10,       // 10+ reports = auto-ban consideration
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface BanDecision {
  shouldShadowBan: boolean;
  shouldAutoBan: boolean;
  reason: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  evidence: string[];
}

export interface AbuseHistory {
  totalComments: number;
  totalAbuseScore: number;
  hateSpeechCount: number;
  threatCount: number;
  recentComments: Array<{
    timestamp: Date;
    abuseScore: number;
  }>;
  reportCount: number;
  lastCommentAt: Date | null;
}

// ============================================================================
// SINGLE COMMENT BAN LOGIC
// ============================================================================

/**
 * Determines if a single comment should trigger an immediate ban
 */
export function evaluateSingleComment(abuseScore: AbuseScore): BanDecision {
  const evidence: string[] = [];
  let shouldShadowBan = false;
  let shouldAutoBan = false;
  let severity: BanDecision['severity'] = 'none';
  let reason = 'No ban required';

  // Check for extreme abuse (auto-ban)
  if (abuseScore.total >= BAN_THRESHOLDS.AUTO_BAN_SCORE) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Extreme abuse detected in single comment';
    evidence.push(`Abuse score: ${abuseScore.total}`);
    evidence.push(`Breakdown: ${JSON.stringify(abuseScore.breakdown)}`);
  }
  // Check for high abuse (shadow ban)
  else if (abuseScore.total >= BAN_THRESHOLDS.SHADOW_BAN_SCORE) {
    shouldShadowBan = true;
    severity = 'high';
    reason = 'High abuse score detected';
    evidence.push(`Abuse score: ${abuseScore.total}`);
  }

  // Threats always trigger auto-ban
  if (abuseScore.breakdown.threats > 0) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Threats or violence detected';
    evidence.push('Threats detected');
  }

  // Hate speech (Tier 3) triggers shadow ban, multiple triggers auto-ban
  if (abuseScore.breakdown.tier3 > 0) {
    shouldShadowBan = true;
    if (!shouldAutoBan) {
      severity = 'high';
      reason = 'Hate speech detected';
      evidence.push('Hate speech/slurs detected');
    }
  }

  return {
    shouldShadowBan,
    shouldAutoBan,
    reason,
    severity,
    evidence,
  };
}

// ============================================================================
// PATTERN-BASED BAN LOGIC
// ============================================================================

/**
 * Evaluates abuse history to detect patterns
 */
export function evaluateAbuseHistory(history: AbuseHistory): BanDecision {
  const evidence: string[] = [];
  let shouldShadowBan = false;
  let shouldAutoBan = false;
  let severity: BanDecision['severity'] = 'none';
  let reason = 'No ban required';

  // Get comments within time window
  const windowStart = new Date(Date.now() - BAN_THRESHOLDS.PATTERN_TIME_WINDOW);
  const recentAbuse = history.recentComments.filter(
    (comment) => new Date(comment.timestamp) > windowStart
  );

  const recentCount = recentAbuse.length;
  const recentTotalScore = recentAbuse.reduce((sum, c) => sum + c.abuseScore, 0);

  // Pattern 1: Multiple abusive comments in short time
  if (recentCount >= BAN_THRESHOLDS.AUTO_BAN_COMMENTS &&
      recentTotalScore >= BAN_THRESHOLDS.AUTO_BAN_TOTAL_SCORE) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Repeated severe abuse detected';
    evidence.push(`${recentCount} abusive comments in last hour`);
    evidence.push(`Combined abuse score: ${recentTotalScore}`);
  }
  // Pattern 2: Moderate repeated abuse (shadow ban)
  else if (recentCount >= BAN_THRESHOLDS.SHADOW_BAN_COMMENTS &&
           recentTotalScore >= BAN_THRESHOLDS.SHADOW_BAN_TOTAL_SCORE) {
    shouldShadowBan = true;
    severity = 'high';
    reason = 'Repeated abuse detected';
    evidence.push(`${recentCount} abusive comments recently`);
    evidence.push(`Combined abuse score: ${recentTotalScore}`);
  }

  // Pattern 3: Repeated hate speech (zero tolerance)
  if (history.hateSpeechCount >= BAN_THRESHOLDS.HATE_SPEECH_COUNT) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Repeated hate speech';
    evidence.push(`${history.hateSpeechCount} hate speech incidents`);
  }

  // Pattern 4: Threats (zero tolerance)
  if (history.threatCount > 0) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Threats detected';
    evidence.push('User has made threats');
  }

  // Pattern 5: Community reports
  if (history.reportCount >= BAN_THRESHOLDS.REPORTS_AUTO_BAN) {
    shouldAutoBan = true;
    shouldShadowBan = true;
    severity = 'extreme';
    reason = 'Excessive community reports';
    evidence.push(`${history.reportCount} reports from community`);
  } else if (history.reportCount >= BAN_THRESHOLDS.REPORTS_SHADOW_BAN) {
    shouldShadowBan = true;
    severity = 'high';
    reason = 'Multiple community reports';
    evidence.push(`${history.reportCount} reports from community`);
  }

  return {
    shouldShadowBan,
    shouldAutoBan,
    reason,
    severity,
    evidence,
  };
}

// ============================================================================
// COMBINED BAN EVALUATION
// ============================================================================

/**
 * Evaluates both single comment and abuse history to make final ban decision
 */
export function evaluateBanDecision(
  currentCommentScore: AbuseScore,
  history: AbuseHistory
): BanDecision {
  // Evaluate single comment
  const singleCommentDecision = evaluateSingleComment(currentCommentScore);

  // Evaluate pattern/history
  const historyDecision = evaluateAbuseHistory(history);

  // Combine decisions (take the most severe)
  const shouldShadowBan = singleCommentDecision.shouldShadowBan || historyDecision.shouldShadowBan;
  const shouldAutoBan = singleCommentDecision.shouldAutoBan || historyDecision.shouldAutoBan;

  // Determine overall severity
  const severities: BanDecision['severity'][] = [
    singleCommentDecision.severity,
    historyDecision.severity,
  ];
  const severityOrder = { none: 0, low: 1, medium: 2, high: 3, extreme: 4 };
  const maxSeverity = severities.reduce((max, s) =>
    severityOrder[s] > severityOrder[max] ? s : max
  , 'none');

  // Combine evidence
  const evidence = [
    ...singleCommentDecision.evidence,
    ...historyDecision.evidence,
  ];

  // Determine reason (prioritize auto-ban reasons)
  let reason = 'No ban required';
  if (shouldAutoBan) {
    reason = singleCommentDecision.shouldAutoBan
      ? singleCommentDecision.reason
      : historyDecision.reason;
  } else if (shouldShadowBan) {
    reason = singleCommentDecision.shouldShadowBan
      ? singleCommentDecision.reason
      : historyDecision.reason;
  }

  return {
    shouldShadowBan,
    shouldAutoBan,
    reason,
    severity: maxSeverity,
    evidence,
  };
}

// ============================================================================
// BAN OVERRIDE (Admin)
// ============================================================================

/**
 * Checks if admin has overridden bans for this identity
 */
export function isAdminUnbanned(
  isAdminBanned: boolean,
  isAdminUnbanned: boolean
): boolean {
  // Admin unbanned overrides all automatic bans
  return isAdminUnbanned && !isAdminBanned;
}

/**
 * Checks if user is currently banned (any type)
 */
export function isCurrentlyBanned(
  isShadowBanned: boolean,
  isAutoBanned: boolean,
  isAdminBanned: boolean,
  isAdminUnbanned: boolean
): boolean {
  // Admin override takes precedence
  if (isAdminUnbanned) {
    return isAdminBanned; // Only admin ban applies if unbanned
  }

  // Any type of ban counts
  return isShadowBanned || isAutoBanned || isAdminBanned;
}

/**
 * Gets ban status with admin overrides considered
 */
export function getBanStatus(identity: {
  is_shadow_banned: boolean;
  is_auto_banned: boolean;
  is_admin_banned: boolean;
  is_admin_unbanned: boolean;
}): {
  isBanned: boolean;
  isShadowBanned: boolean;
  isAutoBanned: boolean;
  isAdminBanned: boolean;
  reason: string;
} {
  const adminOverride = isAdminUnbanned(
    identity.is_admin_banned,
    identity.is_admin_unbanned
  );

  if (adminOverride) {
    return {
      isBanned: identity.is_admin_banned,
      isShadowBanned: false,
      isAutoBanned: false,
      isAdminBanned: identity.is_admin_banned,
      reason: identity.is_admin_banned ? 'Banned by administrator' : 'Admin unbanned',
    };
  }

  const isBanned = isCurrentlyBanned(
    identity.is_shadow_banned,
    identity.is_auto_banned,
    identity.is_admin_banned,
    identity.is_admin_unbanned
  );

  let reason = 'Not banned';
  if (identity.is_auto_banned) {
    reason = 'Automatically banned due to severe abuse';
  } else if (identity.is_shadow_banned) {
    reason = 'Shadow banned due to abuse patterns';
  } else if (identity.is_admin_banned) {
    reason = 'Banned by administrator';
  }

  return {
    isBanned,
    isShadowBanned: identity.is_shadow_banned,
    isAutoBanned: identity.is_auto_banned,
    isAdminBanned: identity.is_admin_banned,
    reason,
  };
}

// ============================================================================
// USER-FACING MESSAGES
// ============================================================================

/**
 * Gets user-facing message for shadow ban
 * (Comment appears posted, but isn't visible to others)
 */
export function getShadowBanMessage(): string {
  // Don't tell user they're shadow banned
  return 'Comment posted successfully!';
}

/**
 * Gets user-facing message for auto-ban
 */
export function getAutoBanMessage(): string {
  return 'Unable to post comment. Your account has been restricted due to policy violations.';
}

/**
 * Gets admin-facing ban summary
 */
export function getBanSummary(decision: BanDecision): string {
  const lines = [
    `Ban Decision: ${decision.shouldAutoBan ? 'AUTO-BAN' : decision.shouldShadowBan ? 'SHADOW BAN' : 'NO BAN'}`,
    `Severity: ${decision.severity.toUpperCase()}`,
    `Reason: ${decision.reason}`,
  ];

  if (decision.evidence.length > 0) {
    lines.push('');
    lines.push('Evidence:');
    decision.evidence.forEach((e) => lines.push(`  - ${e}`));
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BAN_THRESHOLDS,
  evaluateSingleComment,
  evaluateAbuseHistory,
  evaluateBanDecision,
  isAdminUnbanned,
  isCurrentlyBanned,
  getBanStatus,
  getShadowBanMessage,
  getAutoBanMessage,
  getBanSummary,
};
