export const SUPPORTED_THEMES = ['light', 'dark'] as const;

export type Theme = (typeof SUPPORTED_THEMES)[number];

export const DEFAULT_THEME: Theme = 'light';
export const THEME_STORAGE_KEY = 'mm_theme';

export function normalizeTheme(value?: string | null): Theme {
  if (!value) return DEFAULT_THEME;
  return SUPPORTED_THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}
