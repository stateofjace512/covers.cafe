import notoAnimated, { type AnimatedEmojiIndex } from './noto-animated';

const animatedEmojiIndex: AnimatedEmojiIndex = notoAnimated;

// Skin tone modifier codepoints (Fitzpatrick scale)
const SKIN_TONE_MODIFIERS = [0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff];

/**
 * Converts an emoji character to its codepoint representation.
 * Handles single codepoint emojis and compound emojis (with ZWJ sequences).
 *
 * @param emoji - The emoji character(s) to convert
 * @returns The codepoint string (e.g., "1f600" for 😀)
 */
export const emojiToCodepoint = (emoji: string): string => {
  const codePoints: string[] = [];

  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      // Skip variation selectors (fe0e, fe0f) for cleaner codepoints
      if (codePoint !== 0xfe0e && codePoint !== 0xfe0f) {
        codePoints.push(codePoint.toString(16).toLowerCase());
      }
    }
  }

  return codePoints.join('_');
};

/**
 * Strips skin tone modifiers from an emoji, returning the base emoji codepoint.
 *
 * @param emoji - The emoji character(s) to normalize
 * @returns The codepoint string without skin tone modifiers
 */
export const emojiToCodepointWithoutSkinTone = (emoji: string): string => {
  const codePoints: string[] = [];

  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      // Skip variation selectors (fe0e, fe0f) and skin tone modifiers
      const isSkinTone = codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
      if (codePoint !== 0xfe0e && codePoint !== 0xfe0f && !isSkinTone) {
        codePoints.push(codePoint.toString(16).toLowerCase());
      }
    }
  }

  return codePoints.join('_');
};

/**
 * Checks if an emoji has an animated version available.
 *
 * @param emoji - The emoji character to check
 * @returns True if an animated version exists
 */
export const hasAnimatedEmoji = (emoji: string): boolean => {
  const codepoint = emojiToCodepoint(emoji);
  const key = `emoji_u${codepoint}`;
  return key in animatedEmojiIndex;
};

/**
 * Gets the codepoint for an emoji if it has an animated version.
 * Falls back to base emoji (without skin tone) if the skin-toned version doesn't exist.
 *
 * @param emoji - The emoji character to look up
 * @returns The codepoint string if animated version exists, null otherwise
 */
export const getAnimatedEmojiCodepoint = (emoji: string): string | null => {
  const codepoint = emojiToCodepoint(emoji);
  const key = `emoji_u${codepoint}`;

  // First, try the exact emoji (with skin tone if present)
  if (key in animatedEmojiIndex) {
    return codepoint;
  }

  // Fallback: try the base emoji without skin tone modifiers
  const baseCodepoint = emojiToCodepointWithoutSkinTone(emoji);
  if (baseCodepoint !== codepoint) {
    const baseKey = `emoji_u${baseCodepoint}`;
    if (baseKey in animatedEmojiIndex) {
      return baseCodepoint;
    }
  }

  return null;
};

// Base emoji character class (without skin tones)
const EMOJI_BASE_CLASS =
  '[' +
    '\u{1F600}-\u{1F64F}' + // Emoticons
    '\u{1F300}-\u{1F5FF}' + // Misc Symbols and Pictographs
    '\u{1F680}-\u{1F6FF}' + // Transport and Map
    '\u{1F700}-\u{1F77F}' + // Alchemical Symbols
    '\u{1F780}-\u{1F7FF}' + // Geometric Shapes Extended
    '\u{1F800}-\u{1F8FF}' + // Supplemental Arrows-C
    '\u{1F900}-\u{1F9FF}' + // Supplemental Symbols and Pictographs
    '\u{1FA00}-\u{1FA6F}' + // Chess Symbols
    '\u{1FA70}-\u{1FAFF}' + // Symbols and Pictographs Extended-A
    '\u{2600}-\u{26FF}' +   // Misc symbols (sun, moon, stars, etc.)
    '\u{2700}-\u{27BF}' +   // Dingbats
    '\u{231A}-\u{231B}' +   // Watch, Hourglass
    '\u{23E9}-\u{23F3}' +   // Media control symbols
    '\u{23F8}-\u{23FA}' +   // Media symbols
    '\u{25AA}-\u{25AB}' +   // Squares
    '\u{25B6}' +            // Play button
    '\u{25C0}' +            // Reverse button
    '\u{25FB}-\u{25FE}' +   // Squares
    '\u{2614}-\u{2615}' +   // Umbrella, Hot beverage
    '\u{2648}-\u{2653}' +   // Zodiac
    '\u{267F}' +            // Wheelchair
    '\u{2693}' +            // Anchor
    '\u{26A1}' +            // High voltage
    '\u{26AA}-\u{26AB}' +   // Circles
    '\u{26BD}-\u{26BE}' +   // Sports balls
    '\u{26C4}-\u{26C5}' +   // Weather
    '\u{26CE}' +            // Ophiuchus
    '\u{26D4}' +            // No entry
    '\u{26EA}' +            // Church
    '\u{26F2}-\u{26F3}' +   // Fountain, Golf
    '\u{26F5}' +            // Sailboat
    '\u{26FA}' +            // Tent
    '\u{26FD}' +            // Fuel pump
    '\u{2702}' +            // Scissors
    '\u{2705}' +            // Check mark
    '\u{2708}-\u{270D}' +   // Misc symbols
    '\u{270F}' +            // Pencil
    '\u{2712}' +            // Black nib
    '\u{2714}' +            // Check mark
    '\u{2716}' +            // X mark
    '\u{271D}' +            // Latin cross
    '\u{2721}' +            // Star of David
    '\u{2728}' +            // Sparkles
    '\u{2733}-\u{2734}' +   // Eight spoked asterisk
    '\u{2744}' +            // Snowflake
    '\u{2747}' +            // Sparkle
    '\u{274C}' +            // Cross mark
    '\u{274E}' +            // Cross mark
    '\u{2753}-\u{2755}' +   // Question marks
    '\u{2757}' +            // Exclamation mark
    '\u{2763}-\u{2764}' +   // Heart exclamation, Heart
    '\u{2795}-\u{2797}' +   // Math symbols
    '\u{27A1}' +            // Right arrow
    '\u{27B0}' +            // Curly loop
    '\u{27BF}' +            // Double curly loop
    '\u{2934}-\u{2935}' +   // Arrows
    '\u{2B05}-\u{2B07}' +   // Arrows
    '\u{2B1B}-\u{2B1C}' +   // Squares
    '\u{2B50}' +            // Star
    '\u{2B55}' +            // Circle
    '\u{3030}' +            // Wavy dash
    '\u{303D}' +            // Part alternation mark
    '\u{3297}' +            // Circled Ideograph Congratulation
    '\u{3299}' +            // Circled Ideograph Secret
  ']';

// Skin tone modifiers (Fitzpatrick scale): 🏻🏼🏽🏾🏿
const SKIN_TONE_CLASS = '[\u{1F3FB}-\u{1F3FF}]';

// Variation selectors
const VARIATION_SELECTOR_CLASS = '[\u{FE0E}\u{FE0F}]';

// Zero-Width Joiner for compound emojis
const ZWJ = '\u{200D}';

// Regex to match emoji characters with optional skin tone modifiers and ZWJ sequences
// Pattern: base_emoji + optional(skin_tone) + optional(variation_selector) + optional(ZWJ + more_emoji)*
const EMOJI_REGEX = new RegExp(
  EMOJI_BASE_CLASS +
    '(?:' + SKIN_TONE_CLASS + ')?' +           // Optional skin tone modifier
    '(?:' + VARIATION_SELECTOR_CLASS + ')?' +  // Optional variation selector
    '(?:' +
      ZWJ +                                    // ZWJ for compound emojis
      EMOJI_BASE_CLASS +
      '(?:' + SKIN_TONE_CLASS + ')?' +         // Optional skin tone in compound
      '(?:' + VARIATION_SELECTOR_CLASS + ')?' +
    ')*',                                      // Zero or more ZWJ sequences
  'gu'
);

/**
 * Processes text and wraps animated emojis in spans with data-codepoint attributes.
 * Non-animated emojis are left as-is.
 *
 * @param text - The text to process
 * @returns The text with animated emojis wrapped in spans
 */
export const wrapAnimatedEmojis = (text: string): string => {
  // Safety check for SSR and edge cases
  if (!text || typeof text !== 'string') {
    return text ?? '';
  }

  try {
    return text.replace(EMOJI_REGEX, (emoji) => {
      const codepoint = getAnimatedEmojiCodepoint(emoji);

      if (codepoint) {
        // Escape the emoji for safe HTML insertion
        const escapedEmoji = emoji
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        return `<span class="animated-emoji" data-codepoint="${codepoint}">${escapedEmoji}</span>`;
      }

      // Not an animated emoji, return as-is
      return emoji;
    });
  } catch {
    // If regex fails for any reason, return original text
    return text;
  }
};

/**
 * Gets the Lottie animation URL for a given codepoint.
 *
 * @param codepoint - The emoji codepoint (e.g., "1f600")
 * @returns The URL to the Lottie JSON file
 */
export const getLottieUrl = (codepoint: string): string => {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/lottie.json`;
};
