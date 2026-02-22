/**
 * Content Normalization Utility for Anonymous Comments
 *
 * All comment content MUST be normalized before filtering or scoring.
 * Filtering without normalization is considered invalid.
 *
 * Normalization steps:
 * 1. Lowercase conversion
 * 2. Unicode homoglyph normalization (convert lookalike characters)
 * 3. Zero-width character removal
 * 4. Repeated character collapsing
 * 5. Leetspeak normalization
 * 6. Emoji to text representation (for scoring)
 */

// ============================================================================
// UNICODE HOMOGLYPH MAPPING
// Maps visually similar characters to their ASCII equivalents
// ============================================================================
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic to Latin
  'а': 'a', 'А': 'A',
  'е': 'e', 'Е': 'E',
  'о': 'o', 'О': 'O',
  'р': 'p', 'Р': 'P',
  'с': 'c', 'С': 'C',
  'у': 'y', 'У': 'Y',
  'х': 'x', 'Х': 'X',
  'і': 'i', 'І': 'I',
  'ј': 'j', 'Ј': 'J',
  'ѕ': 's', 'Ѕ': 'S',
  'в': 'b', 'В': 'B',
  'к': 'k', 'К': 'K',
  'м': 'm', 'М': 'M',
  'н': 'h', 'Н': 'H',
  'т': 't', 'Т': 'T',

  // Greek to Latin
  'α': 'a', 'Α': 'A',
  'β': 'b', 'Β': 'B',
  'ε': 'e', 'Ε': 'E',
  'ι': 'i', 'Ι': 'I',
  'ο': 'o', 'Ο': 'O',
  'ρ': 'p', 'Ρ': 'P',
  'τ': 't', 'Τ': 'T',
  'υ': 'y', 'Υ': 'Y',
  'χ': 'x', 'Χ': 'X',
  'ν': 'v', 'Ν': 'V',
  'κ': 'k', 'Κ': 'K',
  'μ': 'u', 'Μ': 'M',
  'η': 'n', 'Η': 'H',
  'ζ': 'z', 'Ζ': 'Z',

  // Special characters
  'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e',
  'ⓕ': 'f', 'ⓖ': 'g', 'ⓗ': 'h', 'ⓘ': 'i', 'ⓙ': 'j',
  'ⓚ': 'k', 'ⓛ': 'l', 'ⓜ': 'm', 'ⓝ': 'n', 'ⓞ': 'o',
  'ⓟ': 'p', 'ⓠ': 'q', 'ⓡ': 'r', 'ⓢ': 's', 'ⓣ': 't',
  'ⓤ': 'u', 'ⓥ': 'v', 'ⓦ': 'w', 'ⓧ': 'x', 'ⓨ': 'y', 'ⓩ': 'z',

  // Accented characters
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'ā': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ō': 'o', 'ø': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ų': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ñ': 'n', 'ń': 'n',
  'ç': 'c', 'ć': 'c', 'č': 'c',
  'ł': 'l', 'ĺ': 'l',
  'ś': 's', 'š': 's',
  'ź': 'z', 'ż': 'z', 'ž': 'z',

  // Common unicode confusables
  '\u200B': '', // Zero-width space
  '\u200C': '', // Zero-width non-joiner
  '\u200D': '', // Zero-width joiner
  '\uFEFF': '', // Zero-width no-break space
  '\u00A0': ' ', // Non-breaking space to regular space
};

// ============================================================================
// LEETSPEAK MAPPING
// Converts common leetspeak substitutions to normal characters
// ============================================================================
const LEETSPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'i',
  '()': 'o',
  '[]': 'o',
  '+': 't',
  '/-\\': 'a',
  '|\\|': 'n',
  '|)': 'd',
  '\\|/': 'w',
  '\\/': 'v',
};

// ============================================================================
// EMOJI TO TEXT MAPPING (Partial - for common offensive emoji)
// Used to detect emoji-based abuse
// ============================================================================
const EMOJI_TO_TEXT: Record<string, string> = {
  '🖕': 'middle finger',
  '💩': 'poop',
  '🍆': 'eggplant',
  '🍑': 'peach',
  '💦': 'sweat drops',
  '👅': 'tongue',
  '🔞': 'no one under eighteen',
  '🚫': 'prohibited',
  '💀': 'skull',
  '☠️': 'skull and crossbones',
  '🔥': 'fire',
  '💯': 'hundred points',
  '🤬': 'cursing',
  '😈': 'devil',
  '👿': 'angry devil',
};

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Removes zero-width characters and invisible Unicode characters
 */
export function removeZeroWidthCharacters(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Normalizes homoglyphs (lookalike characters) to ASCII equivalents
 */
export function normalizeHomoglyphs(text: string): string {
  let result = text;

  for (const [homoglyph, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    result = result.split(homoglyph).join(replacement);
  }

  return result;
}

/**
 * Collapses repeated characters (e.g., "fuuuuuck" to "fuck")
 * Preserves up to 2 consecutive identical characters
 */
export function collapseRepeatedCharacters(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Normalizes leetspeak to regular characters
 * Handles both single character and multi-character substitutions
 */
export function normalizeLeetspeak(text: string): string {
  let result = text;

  // Multi-character substitutions first
  result = result.replace(/\/\-\\/g, 'a');
  result = result.replace(/\|\\|/g, 'n');
  result = result.replace(/\|\)/g, 'd');
  result = result.replace(/\\\|\//g, 'w');
  result = result.replace(/\\\//g, 'v');
  result = result.replace(/\(\)/g, 'o');
  result = result.replace(/\[\]/g, 'o');

  // Single character substitutions
  for (const [leet, normal] of Object.entries(LEETSPEAK_MAP)) {
    if (leet.length === 1) {
      result = result.split(leet).join(normal);
    }
  }

  return result;
}

/**
 * Converts emojis to text representations for abuse detection
 * Preserves the original emoji in the output but adds text equivalent
 */
export function emojiToText(text: string): string {
  let result = text;

  for (const [emoji, textEquivalent] of Object.entries(EMOJI_TO_TEXT)) {
    // Replace emoji with text equivalent for detection purposes
    if (result.includes(emoji)) {
      result = result.split(emoji).join(` ${textEquivalent} `);
    }
  }

  return result;
}

/**
 * Strips all emojis from text (for final normalized content)
 */
export function stripEmojis(text: string): string {
  // Remove all emoji characters using Unicode ranges
  return text.replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '') // Mahjong Tiles
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, ''); // Playing Cards
}

/**
 * Normalizes whitespace (converts multiple spaces to single space)
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Multiple whitespace to single space
    .trim(); // Remove leading/trailing whitespace
}

// ============================================================================
// MAIN NORMALIZATION FUNCTION
// ============================================================================

export interface NormalizationResult {
  original: string;
  normalized: string;
  normalizedWithEmojis: string; // Normalized but keeps emoji text representations
}

/**
 * Complete content normalization pipeline
 * This is the ONLY way content should be normalized before filtering
 *
 * Steps:
 * 1. Remove zero-width characters
 * 2. Normalize homoglyphs
 * 3. Convert to lowercase
 * 4. Normalize leetspeak
 * 5. Collapse repeated characters
 * 6. Convert emojis to text (for detection)
 * 7. Normalize whitespace
 */
export function normalizeContent(content: string): NormalizationResult {
  if (!content || typeof content !== 'string') {
    return {
      original: '',
      normalized: '',
      normalizedWithEmojis: '',
    };
  }

  let normalized = content;

  // Step 1: Remove zero-width characters
  normalized = removeZeroWidthCharacters(normalized);

  // Step 2: Normalize homoglyphs (lookalike characters)
  normalized = normalizeHomoglyphs(normalized);

  // Step 3: Lowercase conversion
  normalized = normalized.toLowerCase();

  // Step 4: Normalize leetspeak
  normalized = normalizeLeetspeak(normalized);

  // Step 5: Collapse repeated characters
  normalized = collapseRepeatedCharacters(normalized);

  // Step 6: Convert emojis to text (for abuse detection)
  const normalizedWithEmojis = emojiToText(normalized);

  // Step 7: Strip emojis from final normalized version
  const finalNormalized = stripEmojis(normalizedWithEmojis);

  // Step 8: Normalize whitespace
  const cleaned = normalizeWhitespace(finalNormalized);

  return {
    original: content,
    normalized: cleaned,
    normalizedWithEmojis: normalizeWhitespace(normalizedWithEmojis),
  };
}

/**
 * Validates that content is not empty after normalization
 */
export function isValidContent(content: string): boolean {
  const { normalized } = normalizeContent(content);
  return normalized.trim().length > 0;
}

/**
 * Checks if content is only spaces/whitespace
 */
export function isOnlyWhitespace(content: string): boolean {
  return content.trim().length === 0;
}

/**
 * Checks if content is only emojis (no actual text)
 */
export function isOnlyEmojis(content: string): boolean {
  const { normalized } = normalizeContent(content);
  return normalized.trim().length === 0 && content.trim().length > 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  normalizeContent,
  isValidContent,
  isOnlyWhitespace,
  isOnlyEmojis,
  removeZeroWidthCharacters,
  normalizeHomoglyphs,
  collapseRepeatedCharacters,
  normalizeLeetspeak,
  emojiToText,
  stripEmojis,
  normalizeWhitespace,
};
