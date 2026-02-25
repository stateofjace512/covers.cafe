export const USER_PREFERENCE_KEYS = {
  noThemeImages: 'pref_no_theme_images',
  coverGridMinWidth: 'pref_cover_grid_min_width',
  preferModalOverPage: 'pref_prefer_modal_over_page',
  gradientStart: 'pref_gradient_start',
  gradientEnd: 'pref_gradient_end',
} as const;

export type ThemeName = 'light' | 'dark' | 'pureblack' | 'crisp' | 'gradient';

const DEFAULT_GRADIENT_START = '#4f46e5';
const DEFAULT_GRADIENT_END = '#db2777';

const DEFAULT_COVER_GRID_MIN_WIDTH = 160;

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getNoThemeImagesPreference(): boolean {
  const store = getLocalStorage();
  return store?.getItem(USER_PREFERENCE_KEYS.noThemeImages) === '1';
}

export function setNoThemeImagesPreference(value: boolean): void {
  const store = getLocalStorage();
  if (!store) return;
  store.setItem(USER_PREFERENCE_KEYS.noThemeImages, value ? '1' : '0');
}

export function getCoverGridMinWidthPreference(): number {
  const store = getLocalStorage();
  const raw = store?.getItem(USER_PREFERENCE_KEYS.coverGridMinWidth);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 120 || parsed > 320) return DEFAULT_COVER_GRID_MIN_WIDTH;
  return parsed;
}

export function setCoverGridMinWidthPreference(value: number): void {
  const store = getLocalStorage();
  if (!store) return;
  store.setItem(USER_PREFERENCE_KEYS.coverGridMinWidth, `${value}`);
}

export function getPreferModalOverPagePreference(): boolean {
  const store = getLocalStorage();
  return store?.getItem(USER_PREFERENCE_KEYS.preferModalOverPage) === '1';
}

export function setPreferModalOverPagePreference(value: boolean): void {
  const store = getLocalStorage();
  if (!store) return;
  store.setItem(USER_PREFERENCE_KEYS.preferModalOverPage, value ? '1' : '0');
}

export function applyUserPreferencesToDocument(): void {
  if (typeof document === 'undefined') return;
  const noThemeImages = getNoThemeImagesPreference();
  const gridMinWidth = getCoverGridMinWidthPreference();
  document.documentElement.setAttribute('data-no-theme-images', noThemeImages ? 'true' : 'false');
  document.documentElement.style.setProperty('--cover-grid-min-width', `${gridMinWidth}px`);
}

// ---------------------------------------------------------------------------
// Gradient theme preferences
// ---------------------------------------------------------------------------

/** Parse a hex color string (#rrggbb) into [r, g, b] 0–255 components. */
function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/**
 * WCAG 2.1 relative luminance for an sRGB colour.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Return '#ffffff' or '#000000' — whichever achieves the higher WCAG
 * contrast ratio against the given background luminance.
 * The crossover point is luminance ≈ 0.179.
 */
function accessibleTextColor(bgLuminance: number): '#ffffff' | '#000000' {
  const contrastWithWhite = (1.05) / (bgLuminance + 0.05);
  const contrastWithBlack = (bgLuminance + 0.05) / (0.05);
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
}

export function getGradientPreference(): { start: string; end: string } {
  const store = getLocalStorage();
  return {
    start: store?.getItem(USER_PREFERENCE_KEYS.gradientStart) ?? DEFAULT_GRADIENT_START,
    end: store?.getItem(USER_PREFERENCE_KEYS.gradientEnd) ?? DEFAULT_GRADIENT_END,
  };
}

export function setGradientPreference(start: string, end: string): void {
  const store = getLocalStorage();
  if (!store) return;
  store.setItem(USER_PREFERENCE_KEYS.gradientStart, start);
  store.setItem(USER_PREFERENCE_KEYS.gradientEnd, end);
}

/**
 * Apply gradient CSS variables to the document root, computing accessible
 * text/muted/border colours from the WCAG contrast algorithm so text is
 * always readable regardless of the chosen gradient.
 */
export function applyGradientColorsToDocument(start: string, end: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--gradient-start', start);
  root.style.setProperty('--gradient-end', end);

  const rgbStart = parseHex(start);
  const rgbEnd = parseHex(end);
  if (!rgbStart || !rgbEnd) return;

  // Average the two endpoints to get a representative midpoint luminance.
  const avgR = (rgbStart[0] + rgbEnd[0]) / 2;
  const avgG = (rgbStart[1] + rgbEnd[1]) / 2;
  const avgB = (rgbStart[2] + rgbEnd[2]) / 2;
  const midLuminance = relativeLuminance(avgR, avgG, avgB);

  const textColor = accessibleTextColor(midLuminance);
  const isBright = textColor === '#000000';

  // Panel overlays: dark on bright gradients, light on dark gradients.
  const panelBg = isBright ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
  const cardBg  = isBright ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  const border  = isBright ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
  const muted   = isBright ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)';

  root.style.setProperty('--gradient-text', textColor);
  root.style.setProperty('--gradient-text-muted', muted);
  root.style.setProperty('--gradient-border', border);
  root.style.setProperty('--gradient-card-bg', cardBg);
  root.style.setProperty('--gradient-panel-bg', panelBg);
}
