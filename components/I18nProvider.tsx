'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  LOCALE_STORAGE_KEY,
  Locale,
  LocalePreference,
  SYSTEM_LOCALE_VALUE,
  getSystemLocale,
  getMessage,
  normalizeLocalePreference,
  resolveLocaleFromPreference,
} from '@/lib/i18n';

interface I18nContextValue {
  locale: Locale;
  localePreference: LocalePreference;
  setLocale: (locale: Locale) => void;
  setLocalePreference: (preference: LocalePreference) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(() => {
    if (typeof window === 'undefined') return SYSTEM_LOCALE_VALUE;
    return normalizeLocalePreference(localStorage.getItem(LOCALE_STORAGE_KEY));
  });

  const [systemLocale, setSystemLocale] = useState<Locale>(() =>
    getSystemLocale(typeof window !== 'undefined' ? window.navigator.languages : undefined)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const applySystemLocale = () => setSystemLocale(getSystemLocale(window.navigator.languages));
    window.addEventListener('languagechange', applySystemLocale);
    return () => window.removeEventListener('languagechange', applySystemLocale);
  }, []);

  const locale = useMemo<Locale>(() => {
    if (localePreference === SYSTEM_LOCALE_VALUE) return systemLocale;
    return resolveLocaleFromPreference(localePreference);
  }, [localePreference, systemLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, localePreference);
  }, [localePreference]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    localePreference,
    setLocale: (nextLocale: Locale) => setLocalePreferenceState(nextLocale),
    setLocalePreference: setLocalePreferenceState,
    t: (key: string) => getMessage(locale, key),
  }), [locale, localePreference]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
