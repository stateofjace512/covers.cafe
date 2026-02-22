import createDOMPurify from 'dompurify';
import type { DOMPurify } from 'dompurify';
import { marked } from 'marked';
import { wrapAnimatedEmojis } from './animatedEmoji';

const COMMENT_SANITIZE_CONFIG = {
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
  KEEP_CONTENT: true,
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'small',
    'span',
    'strong',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: ['class', 'href', 'title', 'rel', 'target', 'data-codepoint', 'style'],
};

let purifier: DOMPurify | null = null;
let markedConfigured = false;

const getDomPurifyInstance = (): DOMPurify | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!purifier) {
    purifier = createDOMPurify(window);
  }

  return purifier;
};

const FALLBACK_UNSAFE_ATTR_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const FALLBACK_SCRIPT_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const FALLBACK_JAVASCRIPT_PROTOCOL_PATTERN = /javascript:/gi;

const fallbackSanitize = (input: string) =>
  input
    .replace(FALLBACK_SCRIPT_PATTERN, '')
    .replace(FALLBACK_UNSAFE_ATTR_PATTERN, '')
    .replace(FALLBACK_JAVASCRIPT_PROTOCOL_PATTERN, '');

const sanitizeCommentHtml = (rawHtml: string) => {
  const instance = getDomPurifyInstance();
  if (!instance) {
    return fallbackSanitize(rawHtml);
  }

  return instance.sanitize(rawHtml, COMMENT_SANITIZE_CONFIG) ?? '';
};

const mentionRegex = /@([A-Za-z]+\d+)/g;

const normalizeText = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''));

const escapeHtml = (value: unknown) =>
  normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createMentionRenderer = (
  commentsById: Record<string, { author_username?: string; identity_hash?: string }>,
  currentUserIdentityHash?: string
) => (text: string) => {
  const escaped = escapeHtml(text);
  return escaped.replace(mentionRegex, (match, username) => {
    const isCurrentUser = Object.values(commentsById).some(
      (comment) => comment.author_username === username && comment.identity_hash === currentUserIdentityHash
    );
    const mentionClass = isCurrentUser ? 'comment-mention comment-mention--self' : 'comment-mention';
    return `<span class="${mentionClass}">@${username}</span>`;
  });
};

const createInlineExtension = (name: string, startDelimiter: string, pattern: RegExp, wrap: string) => ({
  name,
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf(startDelimiter);
  },
  tokenizer(src: string) {
    const match = pattern.exec(src);
    if (!match || match.index !== 0) {
      return undefined;
    }
    const text = match[1];
    return {
      type: name,
      raw: match[0],
      text,
      tokens: this.lexer.inlineTokens(text),
    };
  },
  childTokens: ['tokens'],
  renderer(token: { tokens?: Array<{ raw: string }> }) {
    const inner = token.tokens ? this.parser.parseInline(token.tokens) : '';
    return `<${wrap}>${inner}</${wrap}>`;
  },
});

const createRainbowExtension = () => ({
  name: 'rainbow',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('}}');
  },
  tokenizer(src: string) {
    if (src.startsWith('\\}}')) {
      return undefined;
    }
    const match = /^}}([^\n]+?)(?=$|\n)/.exec(src);
    if (!match) {
      return undefined;
    }
    const text = match[1].trim();
    return {
      type: 'rainbow',
      raw: match[0],
      text,
      tokens: this.lexer.inlineTokens(text),
    };
  },
  childTokens: ['tokens'],
  renderer(token: { tokens?: Array<{ raw: string }> }) {
    const inner = token.tokens ? this.parser.parseInline(token.tokens) : '';
    return `<span class="comment-rainbow">${inner}</span>`;
  },
});

// Color code mapping for colored text
// &a-&g and &1-&7 codes for static colors
// &! prefix for animated gradient versions
// && as alias for rainbow
const COLOR_CODE_MAP: Record<string, { className: string; isAnimated?: boolean }> = {
  // Static colors (letter codes)
  '&a': { className: 'comment-color-red' },
  '&b': { className: 'comment-color-yellow' },
  '&c': { className: 'comment-color-green' },
  '&d': { className: 'comment-color-cyan' },
  '&e': { className: 'comment-color-indigo' },
  '&f': { className: 'comment-color-violet' },
  '&g': { className: 'comment-color-alt' },
  // Static colors (number codes)
  '&1': { className: 'comment-color-orange' },
  '&2': { className: 'comment-color-lime' },
  '&3': { className: 'comment-color-lightblue' },
  '&4': { className: 'comment-color-blue' },
  '&5': { className: 'comment-color-purple' },
  '&6': { className: 'comment-color-pink' },
  '&7': { className: 'comment-color-alt2' },
  // Animated gradient versions (letter codes with !)
  '&!a': { className: 'comment-glow-red', isAnimated: true },
  '&!b': { className: 'comment-glow-yellow', isAnimated: true },
  '&!c': { className: 'comment-glow-green', isAnimated: true },
  '&!d': { className: 'comment-glow-cyan', isAnimated: true },
  '&!e': { className: 'comment-glow-indigo', isAnimated: true },
  '&!f': { className: 'comment-glow-violet', isAnimated: true },
  '&!g': { className: 'comment-glow-alt', isAnimated: true },
  // Animated gradient versions (number codes with !)
  '&!1': { className: 'comment-glow-orange', isAnimated: true },
  '&!2': { className: 'comment-glow-lime', isAnimated: true },
  '&!3': { className: 'comment-glow-lightblue', isAnimated: true },
  '&!4': { className: 'comment-glow-blue', isAnimated: true },
  '&!5': { className: 'comment-glow-purple', isAnimated: true },
  '&!6': { className: 'comment-glow-pink', isAnimated: true },
  '&!7': { className: 'comment-glow-alt2', isAnimated: true },
  // Special rainbow aliases
  '&&': { className: 'comment-rainbow', isAnimated: true },
  '&!': { className: 'comment-rainbow', isAnimated: true },
};

const createColorTextExtension = () => ({
  name: 'colorText',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('&');
  },
  tokenizer(src: string) {
    // Try to match color codes: &!a, &!1, &a, &1, &&, &!
    // Pattern: & followed by optional ! and then a letter (a-g) or digit (1-7) or just & or just !
    const match = /^(&!?[a-g1-7]|&&|&!)(.+?)(?=&!?[a-g1-7]|&&|&!|&\[#|$|\n)/i.exec(src);
    if (!match) {
      return undefined;
    }
    const code = match[1].toLowerCase();
    const colorInfo = COLOR_CODE_MAP[code];
    if (!colorInfo) {
      return undefined;
    }
    const text = match[2].trim();
    if (!text) {
      return undefined;
    }
    return {
      type: 'colorText',
      raw: match[0],
      text,
      colorClass: colorInfo.className,
      tokens: this.lexer.inlineTokens(text),
    };
  },
  childTokens: ['tokens'],
  renderer(token: { tokens?: Array<{ raw: string }>; colorClass?: string }) {
    const inner = token.tokens ? this.parser.parseInline(token.tokens) : '';
    const colorClass = token.colorClass || 'comment-color-red';
    return `<span class="${colorClass}">${inner}</span>`;
  },
});

// Custom hex color extension: &[#hexcolor]text
// Allows users to pick any color from a color picker
const createCustomColorExtension = () => ({
  name: 'customColor',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('&[#');
  },
  tokenizer(src: string) {
    // Match &[#hexcolor]text pattern
    // Hex color must be 3 or 6 characters (e.g., #fff or #ffffff)
    const match = /^&\[(#[0-9a-fA-F]{3,6})\](.+?)(?=&\[#|&!?[a-g1-7]|&&|&!|$|\n)/i.exec(src);
    if (!match) {
      return undefined;
    }
    const hexColor = match[1];
    const text = match[2].trim();
    if (!text) {
      return undefined;
    }
    // Validate hex color format
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)) {
      return undefined;
    }
    return {
      type: 'customColor',
      raw: match[0],
      text,
      hexColor,
      tokens: this.lexer.inlineTokens(text),
    };
  },
  childTokens: ['tokens'],
  renderer(token: { tokens?: Array<{ raw: string }>; hexColor?: string }) {
    const inner = token.tokens ? this.parser.parseInline(token.tokens) : '';
    const color = token.hexColor || '#000000';
    // Use inline style for custom colors
    return `<span style="color: ${color}">${inner}</span>`;
  },
});

const createSubtextExtension = () => ({
  name: 'subtext',
  level: 'block' as const,
  start(src: string) {
    const match = src.match(/#&s/);
    return match ? match.index : undefined;
  },
  tokenizer(src: string) {
    if (src.startsWith('\\#&s')) {
      return undefined;
    }
    const match = /^(#&s[^\n]*)(?:\n|$)/.exec(src);
    if (!match) {
      return undefined;
    }
    const text = match[1].replace(/^#&s\s?/, '');
    return {
      type: 'subtext',
      raw: match[0],
      text,
      tokens: this.lexer.inlineTokens(text),
    };
  },
  childTokens: ['tokens'],
  renderer(token: { tokens?: Array<{ raw: string }> }) {
    const inner = token.tokens ? this.parser.parseInline(token.tokens) : '';
    return `<p class="comment-subtext">${inner}</p>`;
  },
});

const createStickyQuoteExtension = () => ({
  name: 'stickyQuote',
  level: 'block' as const,
  start(src: string) {
    const match = src.match(/>>>/);
    return match ? match.index : undefined;
  },
  tokenizer(src: string) {
    if (!src.startsWith('>>>') || src.startsWith('\\>>>')) {
      return undefined;
    }

    const lines = src.split('\n');
    const contentLines: string[] = [];
    let consumed = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (index === 0) {
        contentLines.push(line.replace(/^>>>\s?/, ''));
      } else if (line.trim() === '\\') {
        consumed = index + 1;
        break;
      } else {
        contentLines.push(line);
      }
    }

    if (consumed === 0) {
      consumed = lines.length;
    }

    const raw = lines.slice(0, consumed).join('\n');
    const text = contentLines.join('\n');

    return {
      type: 'stickyQuote',
      raw,
      text,
      tokens: this.lexer.blockTokens(text),
    };
  },
  renderer(token: { tokens?: Array<{ raw: string }> }) {
    const inner = token.tokens ? this.parser.parse(token.tokens).trim() : '';
    return `<blockquote class="comment-quote-sticky">${inner}</blockquote>`;
  },
});

const ensureMarkedConfig = () => {
  if (markedConfigured) {
    return;
  }

  const inlineExtensions = [
    createInlineExtension('underline', '__', /^__(.+?)__(?!_)/, 'u'),
    createInlineExtension('customStrike', '==', /^==(.+?)==(?!=)/, 'del'),
    createRainbowExtension(),
    createColorTextExtension(),
    createCustomColorExtension(),
  ];

  marked.use({
    extensions: [
      ...inlineExtensions,
      createSubtextExtension(),
      createStickyQuoteExtension(),
    ],
  });

  marked.setOptions({
    gfm: true,
    breaks: true,
    mangle: false,
    headerIds: false,
  });

  markedConfigured = true;
};

export const renderCommentMarkdown = (
  content: string,
  commentsById: Record<string, { author_username?: string; identity_hash?: string }>,
  currentUserIdentityHash?: string
) => {
  ensureMarkedConfig();

  // Parse markdown first without custom renderers
  const html = marked.parse(content || '') as string;

  // Process mentions in the final HTML
  const htmlWithMentions = html.replace(mentionRegex, (match, username) => {
    const isCurrentUser = Object.values(commentsById).some(
      (comment) => comment.author_username === username && comment.identity_hash === currentUserIdentityHash
    );
    const mentionClass = isCurrentUser ? 'comment-mention comment-mention--self' : 'comment-mention';
    return `<span class="${mentionClass}">@${username}</span>`;
  });

  // Wrap animated emojis in spans with data-codepoint attributes
  const htmlWithAnimatedEmojis = wrapAnimatedEmojis(htmlWithMentions);

  return sanitizeCommentHtml(htmlWithAnimatedEmojis);
};
