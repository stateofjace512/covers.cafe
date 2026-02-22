/**
 * Profanity Tier System for Anonymous Comments
 *
 * Three-tier system for detecting and categorizing inappropriate content:
 * - Tier 1: Low impact (damn, hell) - No penalty, no cooldown
 * - Tier 2: Aggressive profanity - Adds score, may trigger cooldowns
 * - Tier 3: Hate speech / slurs - Immediate escalation
 *
 * All detection MUST be performed on normalized content.
 */

// ============================================================================
// TIER 1: LOW IMPACT PROFANITY
// Allowed, no penalty, no cooldown
// ============================================================================
const TIER_1_WORDS = [
  'damn',
  'dammit',
  'hell',
  'crap',
  'crud',
  'dang',
  'heck',
];

// ============================================================================
// TIER 2: AGGRESSIVE PROFANITY
// Common swear words - adds score, may trigger cooldowns
// ============================================================================
const TIER_2_WORDS = [
  // Common profanity
  'fuck',
  'fucking',
  'fucked',
  'fucker',
  'fck',
  'fuk',
  'fking',
  'shit',
  'shitty',
  'bullshit',
  'shite',
  'bitch',
  'bitches',
  'bitchy',
  'bastard',
  'ass',
  'asshole',
  'assholes',
  'arse',
  'dick',
  'dickhead',
  'prick',
  'cock',
  'cunt',
  'pussy',
  'slut',
  'whore',
  'douche',
  'douchebag',
  'piss',
  'pissed',

  // Sexual/crude
  'balls',
  'ballsack',
  'screw',
  'screwing',
  'screwed',
  'sex',
  'sexy',
  'cum',
  'cumming',
  'jizz',
  'semen',
  'orgasm',
  'masturbate',
  'masturbation',
  'porn',
  'pornography',
  'tits',
  'boobs',
  'breast',
  'nipple',
  'penis',
  'vagina',
  'anal',
  'blowjob',
  'handjob',

  // Insults
  'idiot',
  'moron',
  'stupid',
  'dumb',
  'dumbass',
  'retard',
  'retarded',
  'loser',
  'pathetic',
  'worthless',
  'trash',
  'garbage',
];

// ============================================================================
// TIER 3: HATE SPEECH / SLURS
// Severe - immediate escalation, shadow ban likely
// ============================================================================
const TIER_3_WORDS = [
  // Racial slurs
  'nigger',
  'nigga',
  'niga',
  'nigg',
  'n1gger',
  'n1gga',
  'coon',
  'spic',
  'spick',
  'beaner',
  'wetback',
  'chink',
  'gook',
  'zipperhead',
  'towelhead',
  'sandnigger',
  'raghead',
  'kike',
  'hymie',
  'yid',
  'paki',
  'wop',
  'dago',
  'polack',
  'cracker',
  'honkey',
  'whitey',
  'redskin',
  'injun',

  // Homophobic slurs
  'faggot',
  'fag',
  'f4ggot',
  'f4g',
  'fagg0t',
  'fagot',
  'dyke',
  'tranny',
  'trannie',
  'shemale',

  // Ableist slurs (severe)
  'cripple',
  'mongoloid',
  'spastic',
  'vegetable',

  // Misogynistic slurs (severe)
  'feminazi',
  'cunt',

  // Extreme dehumanization
  'subhuman',
  'untermensch',
  'vermin',
  'parasite',
  'scum',
];

// ============================================================================
// SEXUAL CONTENT PATTERNS
// Explicit sexual references (scored as Tier 2+)
// ============================================================================
const SEXUAL_CONTENT_PATTERNS = [
  /\bsex(?:ual)?\s+(?:with|act|acts)\b/i,
  /\brape(?:d)?\b/i,
  /\bmolest(?:ed|ing)?\b/i,
  /\bpedophile\b/i,
  /\bpedo\b/i,
  /\bchild\s+(?:porn|abuse)\b/i,
  /\bincest\b/i,
  /\bbestiality\b/i,
  /\bnaked\s+(?:pic|picture|photo|image)/i,
  /\bnude(?:s)?\s+(?:pic|picture|photo|image)/i,
  /\bdick\s+pic/i,
];

// ============================================================================
// THREAT PATTERNS
// Violence, threats, self-harm (scored very high)
// ============================================================================
const THREAT_PATTERNS = [
  /\bkill\s+(?:you|yourself|myself|him|her|them)\b/i,
  /\b(?:gonna|going to|will)\s+kill\b/i,
  /\bmurder\s+(?:you|him|her|them)\b/i,
  /\bhurt\s+(?:you|him|her|them)\b/i,
  /\bharm\s+(?:you|yourself|him|her|them)\b/i,
  /\bbeat\s+(?:you|the shit|your ass)\b/i,
  /\bshoot\s+(?:you|up|him|her|them)\b/i,
  /\bstab\s+(?:you|him|her|them)\b/i,
  /\bsuicide\b/i,
  /\bkill\s+myself\b/i,
  /\bend\s+(?:my|your)\s+life\b/i,
  /\bdeath\s+threat/i,
  /\bbomb\s+(?:threat|you|this|the)\b/i,
  /\bterror(?:ist|ism)?\s+attack\b/i,
];

// ============================================================================
// SPAM PATTERNS
// Link spam, repetitive content, promotional
// ============================================================================
const SPAM_PATTERNS = [
  // URL patterns (links are not allowed per spec, but this helps detect attempts)
  /https?:\/\//i,
  /www\./i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|info|biz)\b/i,

  // Excessive repetition
  /(.{3,})\1{3,}/i, // Same pattern repeated 3+ times

  // Promotional spam
  /\b(?:click here|buy now|limited time|act now|order now|free money|make money)\b/i,
  /\b(?:check out|follow me|subscribe|like and subscribe)\b/i,
];

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

export interface ProfanityMatch {
  word: string;
  tier: 1 | 2 | 3;
  position: number;
}

export interface ContentAnalysis {
  tier1Matches: ProfanityMatch[];
  tier2Matches: ProfanityMatch[];
  tier3Matches: ProfanityMatch[];
  sexualContentMatches: string[];
  threatMatches: string[];
  spamMatches: string[];
  highestTier: 0 | 1 | 2 | 3;
  hasThreats: boolean;
  hasSexualContent: boolean;
  hasSpam: boolean;
}

/**
 * Detects profanity in normalized content
 * Returns all matches organized by tier
 */
export function detectProfanity(normalizedContent: string): ContentAnalysis {
  const tier1Matches: ProfanityMatch[] = [];
  const tier2Matches: ProfanityMatch[] = [];
  const tier3Matches: ProfanityMatch[] = [];
  const sexualContentMatches: string[] = [];
  const threatMatches: string[] = [];
  const spamMatches: string[] = [];

  const lowerContent = normalizedContent.toLowerCase();

  // Helper function to find word boundaries
  const findWordMatches = (word: string, tier: 1 | 2 | 3) => {
    // Create regex with word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;

    while ((match = regex.exec(lowerContent)) !== null) {
      const matched: ProfanityMatch = {
        word: match[0],
        tier,
        position: match.index,
      };

      if (tier === 1) tier1Matches.push(matched);
      else if (tier === 2) tier2Matches.push(matched);
      else if (tier === 3) tier3Matches.push(matched);
    }
  };

  // Detect Tier 1 (low impact)
  TIER_1_WORDS.forEach((word) => findWordMatches(word, 1));

  // Detect Tier 2 (aggressive profanity)
  TIER_2_WORDS.forEach((word) => findWordMatches(word, 2));

  // Detect Tier 3 (hate speech/slurs)
  TIER_3_WORDS.forEach((word) => findWordMatches(word, 3));

  // Detect sexual content patterns
  SEXUAL_CONTENT_PATTERNS.forEach((pattern) => {
    const match = lowerContent.match(pattern);
    if (match) {
      sexualContentMatches.push(match[0]);
    }
  });

  // Detect threats
  THREAT_PATTERNS.forEach((pattern) => {
    const match = lowerContent.match(pattern);
    if (match) {
      threatMatches.push(match[0]);
    }
  });

  // Detect spam
  SPAM_PATTERNS.forEach((pattern) => {
    const match = lowerContent.match(pattern);
    if (match) {
      spamMatches.push(match[0]);
    }
  });

  // Determine highest tier
  let highestTier: 0 | 1 | 2 | 3 = 0;
  if (tier1Matches.length > 0) highestTier = 1;
  if (tier2Matches.length > 0) highestTier = 2;
  if (tier3Matches.length > 0) highestTier = 3;

  return {
    tier1Matches,
    tier2Matches,
    tier3Matches,
    sexualContentMatches,
    threatMatches,
    spamMatches,
    highestTier,
    hasThreats: threatMatches.length > 0,
    hasSexualContent: sexualContentMatches.length > 0,
    hasSpam: spamMatches.length > 0,
  };
}

/**
 * Quick check: Does content contain Tier 3 hate speech?
 */
export function containsHateSpeech(normalizedContent: string): boolean {
  const lowerContent = normalizedContent.toLowerCase();

  return TIER_3_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerContent);
  });
}

/**
 * Quick check: Does content contain threats?
 */
export function containsThreats(normalizedContent: string): boolean {
  return THREAT_PATTERNS.some((pattern) => pattern.test(normalizedContent));
}

/**
 * Quick check: Does content contain spam?
 */
export function containsSpam(normalizedContent: string): boolean {
  return SPAM_PATTERNS.some((pattern) => pattern.test(normalizedContent));
}

/**
 * Get all matched profane words (for logging/audit purposes)
 */
export function getAllMatchedWords(analysis: ContentAnalysis): string[] {
  return [
    ...analysis.tier1Matches.map((m) => m.word),
    ...analysis.tier2Matches.map((m) => m.word),
    ...analysis.tier3Matches.map((m) => m.word),
    ...analysis.sexualContentMatches,
    ...analysis.threatMatches,
    ...analysis.spamMatches,
  ];
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

const MASKABLE_WORDS = [...TIER_2_WORDS, ...TIER_3_WORDS];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Masks profanity by replacing matched words with asterisks.
 */
export function maskProfanity(content: string): string {
  if (!content) {
    return content;
  }

  return MASKABLE_WORDS.reduce((masked, word) => {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    return masked.replace(regex, (match) => '*'.repeat(match.length));
  }, content);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  detectProfanity,
  containsHateSpeech,
  containsThreats,
  containsSpam,
  getAllMatchedWords,
  maskProfanity,
};
