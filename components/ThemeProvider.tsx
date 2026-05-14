'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  resolveThemeFromPreference,
  SYSTEM_THEME_VALUE,
  THEME_STORAGE_KEY,
  Theme,
  ThemePreference,
  normalizeThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  setTheme: (theme: Theme) => void;
  setThemePreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return SYSTEM_THEME_VALUE;
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  });

  const [systemTheme, setSystemTheme] = useState<Theme>(() => resolveThemeFromPreference(SYSTEM_THEME_VALUE));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const theme = useMemo<Theme>(() => {
    if (themePreference === SYSTEM_THEME_VALUE) return systemTheme;
    return themePreference as Theme;
  }, [systemTheme, themePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    themePreference,
    setTheme: (nextTheme: Theme) => setThemePreferenceState(nextTheme),
    setThemePreference: setThemePreferenceState,
  }), [theme, themePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
