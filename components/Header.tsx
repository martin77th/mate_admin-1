'use client';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { logout, getStoredUser, getUserDisplayName } from '@/lib/auth';
import { getInitials } from '@/lib/utils';
import { SYSTEM_LOCALE_VALUE, type Locale, type LocalePreference } from '@/lib/i18n';
import { useI18n } from '@/components/I18nProvider';
import { SYSTEM_THEME_VALUE, type Theme, type ThemePreference } from '@/lib/theme';
import { useTheme } from '@/components/ThemeProvider';

interface HeaderProps {
  title: string;
  onToggleMobileMenu?: () => void;
}

function formatRole(role: unknown): string {
  if (!role) return '';
  if (typeof role === 'string') return role;
  if (typeof role === 'object' && role !== null) {
    const roleObj = role as { name?: string; level?: number };
    if (roleObj.name) return roleObj.name;
    if (typeof roleObj.level === 'number') return `level:${roleObj.level}`;
  }
  return '';
}

export default function Header({ title, onToggleMobileMenu }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { localePreference, setLocalePreference, t } = useI18n();
  const { themePreference, setThemePreference } = useTheme();
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const user = isHydrated ? getStoredUser() : null;
  const displayName = isHydrated ? getUserDisplayName('User') : 'User';
  const roleText = isHydrated ? formatRole(user?.role) : '';
  const displayNameWithRole = roleText ? `${displayName} (${roleText})` : displayName;
  const avatarText = getInitials(displayName);

  function changeLocale(nextLocalePreference: LocalePreference) {
    setLocalePreference(nextLocalePreference);
  }

  function changeTheme(nextThemePreference: ThemePreference) {
    setThemePreference(nextThemePreference);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="mm-header">
      <div className="mm-header-left">
        <button
          type="button"
          className="mm-mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label={t('common.menu')}
          title={t('common.menu')}
        >
          <i className="bi bi-list" />
        </button>
        <h1 className="mm-header-title">{title}</h1>
      </div>
      <div className="mm-header-right">
        <div className="mm-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="mm-user-profile-trigger"
            onClick={() => setDropdownOpen(v => !v)}
            title={displayNameWithRole}
            aria-label={displayNameWithRole}
          >
            <span className="mm-user-avatar" aria-hidden="true">
              {avatarText ? avatarText : <i className="bi bi-person-fill" />}
            </span>
            <span className="mm-user-profile-chevron" aria-hidden="true">
              <i className={`bi ${dropdownOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
            </span>
          </button>
          {dropdownOpen && (
            <div className="mm-dropdown-menu">
              <div className="mm-user-menu-profile">
                <span className="mm-user-menu-avatar" aria-hidden="true">
                  {avatarText ? avatarText : <i className="bi bi-person-fill" />}
                </span>
                <div className="mm-user-menu-identity">
                  <div className="mm-user-menu-name">{displayNameWithRole}</div>
                </div>
              </div>

              <div className="mm-user-menu-controls">
                <div className="mm-user-menu-control-row">
                  <span className="mm-user-menu-control-label">{t('common.language')}</span>
                  <select
                    className="mm-form-control mm-user-menu-select"
                    value={localePreference}
                    onChange={e => changeLocale(e.target.value as Locale | typeof SYSTEM_LOCALE_VALUE)}
                  >
                    <option value={SYSTEM_LOCALE_VALUE}>{t('common.auto')}</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="mm-user-menu-control-row">
                  <span className="mm-user-menu-control-label">{t('common.theme')}</span>
                  <select
                    className="mm-form-control mm-user-menu-select"
                    value={themePreference}
                    onChange={e => changeTheme(e.target.value as Theme | typeof SYSTEM_THEME_VALUE)}
                  >
                    <option value={SYSTEM_THEME_VALUE}>{t('common.auto')}</option>
                    <option value="light">{t('common.light')}</option>
                    <option value="dark">{t('common.dark')}</option>
                  </select>
                </div>
              </div>

              <button className="mm-dropdown-item danger" onClick={logout}>
                <i className="bi bi-box-arrow-right" />
                {t('common.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
