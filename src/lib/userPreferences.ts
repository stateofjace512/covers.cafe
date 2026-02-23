export const USER_PREFERENCE_KEYS = {
  noThemeImages: 'pref_no_theme_images',
  coverGridMinWidth: 'pref_cover_grid_min_width',
  preferModalOverPage: 'pref_prefer_modal_over_page',
} as const;

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
