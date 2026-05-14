export const SUPPORTED_THEMES = ['light', 'dark'] as const;

export type Theme = (typeof SUPPORTED_THEMES)[number];
export type ThemePreference = Theme | 'system';

export const DEFAULT_THEME: Theme = 'light';
export const THEME_STORAGE_KEY = 'mm_theme';
export const SYSTEM_THEME_VALUE: ThemePreference = 'system';

export function normalizeThemePreference(value?: string | null): ThemePreference {
  if (!value) return SYSTEM_THEME_VALUE;
  if (value === SYSTEM_THEME_VALUE) return SYSTEM_THEME_VALUE;
  return SUPPORTED_THEMES.includes(value as Theme) ? (value as Theme) : SYSTEM_THEME_VALUE;
}

export function resolveThemeFromPreference(preference: ThemePreference): Theme {
  if (preference === SYSTEM_THEME_VALUE) {
    return getSystemTheme();
  }
  return normalizeTheme(preference);
}

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_THEME;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function normalizeTheme(value?: string | null): Theme {
  if (!value) return DEFAULT_THEME;
  return SUPPORTED_THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
