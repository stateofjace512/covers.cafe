/**
 * Abuse Scoring System for Anonymous Comments
 *
 * Scores comments based on detected abuse to determine handling:
 * - Low score: post normally
 * - Medium score: cooldown escalation
 * - High score: shadow ban
 * - Extreme score: auto-ban + shadow ban
 *
 * Score weights:
 * - Mild profanity (Tier 1): +0 (allowed)
 * - Aggressive profanity (Tier 2): +0 (allowed, masked on display)
 * - Hate speech / slurs (Tier 3): +10 per word
 * - Sexual content: +3 per match
 * - Threats: +20 per match
 * - Spam: +5 per match
 * - Emoji spam: +2
 * - Only emojis: +3
 */

import { detectProfanity, getAllMatchedWords, type ContentAnalysis } from './profanityTiers';
import { normalizeContent, isOnlyEmojis } from './contentNormalization';

// ============================================================================
// SCORE WEIGHTS
// ============================================================================
const SCORE_WEIGHTS = {
  TIER_1: 0,        // Allowed, no penalty
  TIER_2: 0,        // Mild profanity (allowed, masked on display)
  TIER_3: 10,       // Hate speech/slurs
  SEXUAL: 3,        // Sexual content
  THREAT: 20,       // Threats/violence
  SPAM: 5,          // Spam patterns
  EMOJI_SPAM: 2,    // Emoji spam (too many emojis)
  EMOJI_ONLY: 3,    // Only emojis, no text
} as const;

// ============================================================================
// SCORE THRESHOLDS
// ============================================================================
const THRESHOLDS = {
  LOW: 0,           // 0-2: Normal post
  MEDIUM: 3,        // 3-9: Apply cooldown
  HIGH: 10,         // 10-19: Shadow ban
  EXTREME: 20,      // 20+: Auto-ban + shadow ban
} as const;

// ============================================================================
// ACTION TYPES
// ============================================================================
export type AbuseAction =
  | 'allow'           // Post normally
  | 'cooldown'        // Apply/escalate cooldown
  | 'shadow_ban'      // Shadow ban the user
  | 'auto_ban';       // Auto-ban + shadow ban

// ============================================================================
// TYPES
// ============================================================================
export interface AbuseScore {
  total: number;
  breakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
    sexual: number;
    threats: number;
    spam: number;
    emojiSpam: number;
    emojiOnly: number;
  };
  action: AbuseAction;
  reason: string;
  matchedWords: string[];
  shouldBlock: boolean; // Should the comment be blocked entirely?
  shouldShadowBan: boolean;
  shouldAutoBan: boolean;
}

// ============================================================================
// EMOJI SPAM DETECTION
// ============================================================================

/**
 * Detects emoji spam (too many emojis relative to text)
 */
function detectEmojiSpam(originalContent: string, normalizedContent: string): boolean {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;

  const emojiMatches = originalContent.match(emojiRegex);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;

  // If more than 5 emojis, consider it spam
  if (emojiCount > 5) {
    return true;
  }

  // If emojis make up more than 30% of the content
  const totalLength = originalContent.length;
  if (totalLength > 0 && emojiCount / totalLength > 0.3) {
    return true;
  }

  return false;
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Scores comment content for abuse detection
 * Returns a score object with total score, breakdown, and recommended action
 */
export function scoreComment(originalContent: string): AbuseScore {
  // Normalize content first
  const { normalized, original } = normalizeContent(originalContent);

  // Detect profanity and abuse patterns
  const analysis: ContentAnalysis = detectProfanity(normalized);

  // Calculate scores for each category
  const tier1Score = analysis.tier1Matches.length * SCORE_WEIGHTS.TIER_1;
  const tier2Score = analysis.tier2Matches.length * SCORE_WEIGHTS.TIER_2;
  const tier3Score = analysis.tier3Matches.length * SCORE_WEIGHTS.TIER_3;
  const sexualScore = analysis.sexualContentMatches.length * SCORE_WEIGHTS.SEXUAL;
  const threatScore = analysis.threatMatches.length * SCORE_WEIGHTS.THREAT;
  const spamScore = analysis.spamMatches.length * SCORE_WEIGHTS.SPAM;

  // Emoji spam detection
  const emojiSpamDetected = detectEmojiSpam(original, normalized);
  const emojiSpamScore = emojiSpamDetected ? SCORE_WEIGHTS.EMOJI_SPAM : 0;

  const emojiOnlyDetected = isOnlyEmojis(original);
  const emojiOnlyScore = emojiOnlyDetected ? SCORE_WEIGHTS.EMOJI_ONLY : 0;

  // Calculate total score
  const totalScore =
    tier1Score +
    tier2Score +
    tier3Score +
    sexualScore +
    threatScore +
    spamScore +
    emojiSpamScore +
    emojiOnlyScore;

  // Determine action based on score
  let action: AbuseAction = 'allow';
  let reason = 'Comment appears safe';
  let shouldBlock = false;
  let shouldShadowBan = false;
  let shouldAutoBan = false;

  if (totalScore >= THRESHOLDS.EXTREME) {
    action = 'auto_ban';
    reason = 'Extreme abuse detected (score: ' + totalScore + ')';
    shouldBlock = true;
    shouldShadowBan = true;
    shouldAutoBan = true;
  } else if (totalScore >= THRESHOLDS.HIGH) {
    action = 'shadow_ban';
    reason = 'High abuse score (score: ' + totalScore + ')';
    shouldBlock = false; // Allow comment but shadow ban it
    shouldShadowBan = true;
    shouldAutoBan = false;
  } else if (totalScore >= THRESHOLDS.MEDIUM) {
    action = 'cooldown';
    reason = 'Moderate abuse detected (score: ' + totalScore + ')';
    shouldBlock = false;
    shouldShadowBan = false;
    shouldAutoBan = false;
  } else {
    action = 'allow';
    reason = 'Comment appears safe (score: ' + totalScore + ')';
    shouldBlock = false;
    shouldShadowBan = false;
    shouldAutoBan = false;
  }

  // Get all matched words for audit trail
  const matchedWords = getAllMatchedWords(analysis);

  return {
    total: totalScore,
    breakdown: {
      tier1: tier1Score,
      tier2: tier2Score,
      tier3: tier3Score,
      sexual: sexualScore,
      threats: threatScore,
      spam: spamScore,
      emojiSpam: emojiSpamScore,
      emojiOnly: emojiOnlyScore,
    },
    action,
    reason,
    matchedWords,
    shouldBlock,
    shouldShadowBan,
    shouldAutoBan,
  };
}

/**
 * Quick check: Should this comment be blocked entirely?
 * Blocks comments with extreme scores (auto-ban threshold)
 */
export function shouldBlockComment(content: string): boolean {
  const score = scoreComment(content);
  return score.shouldBlock;
}

/**
 * Quick check: Should this user be shadow banned?
 */
export function shouldShadowBanUser(content: string): boolean {
  const score = scoreComment(content);
  return score.shouldShadowBan;
}

/**
 * Quick check: Should cooldown be applied?
 */
export function shouldApplyCooldown(content: string): boolean {
  const score = scoreComment(content);
  return score.action === 'cooldown' || score.action === 'shadow_ban' || score.action === 'auto_ban';
}

/**
 * Get human-readable abuse report
 */
export function getAbuseReport(score: AbuseScore): string {
  const lines: string[] = [
    `Total Abuse Score: ${score.total}`,
    `Action: ${score.action}`,
    `Reason: ${score.reason}`,
    '',
    'Score Breakdown:',
  ];

  if (score.breakdown.tier1 > 0) {
    lines.push(`  - Tier 1 (mild): ${score.breakdown.tier1}`);
  }
  if (score.breakdown.tier2 > 0) {
    lines.push(`  - Tier 2 (profanity): ${score.breakdown.tier2}`);
  }
  if (score.breakdown.tier3 > 0) {
    lines.push(`  - Tier 3 (hate speech): ${score.breakdown.tier3}`);
  }
  if (score.breakdown.sexual > 0) {
    lines.push(`  - Sexual content: ${score.breakdown.sexual}`);
  }
  if (score.breakdown.threats > 0) {
    lines.push(`  - Threats: ${score.breakdown.threats}`);
  }
  if (score.breakdown.spam > 0) {
    lines.push(`  - Spam: ${score.breakdown.spam}`);
  }
  if (score.breakdown.emojiSpam > 0) {
    lines.push(`  - Emoji spam: ${score.breakdown.emojiSpam}`);
  }
  if (score.breakdown.emojiOnly > 0) {
    lines.push(`  - Emoji only: ${score.breakdown.emojiOnly}`);
  }

  if (score.matchedWords.length > 0) {
    lines.push('');
    lines.push('Matched Words:');
    lines.push(`  ${score.matchedWords.join(', ')}`);
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  scoreComment,
  shouldBlockComment,
  shouldShadowBanUser,
  shouldApplyCooldown,
  getAbuseReport,
  SCORE_WEIGHTS,
  THRESHOLDS,
};
