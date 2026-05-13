'use client';
import { useState, useEffect, useRef } from 'react';
import { logout, getStoredUser } from '@/lib/auth';
import { getInitials } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';
import { useI18n } from '@/components/I18nProvider';
import type { Theme } from '@/lib/theme';
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
  const user = getStoredUser();
  const roleText = formatRole(user?.role);
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
  }

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
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
          <div
            className="mm-user-avatar"
            onClick={() => setDropdownOpen(v => !v)}
            title={user?.user_name ?? user?.auth_name ?? ''}
          >
            {getInitials(user?.user_name ?? user?.auth_name)}
          </div>
          {dropdownOpen && (
            <div className="mm-dropdown-menu">
              <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--mm-border)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-text-primary)' }}>
                  {user?.user_name ?? user?.auth_name ?? t('common.admin')}
                </div>
                {roleText && (
                  <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>{roleText}</div>
                )}
              </div>
              <div style={{ padding: '4px 12px 6px', borderBottom: '1px solid var(--mm-border)', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{t('common.language')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="mm-btn mm-btn-ghost"
                    style={{ minWidth: 44, height: 28, padding: '0 8px', border: locale === 'ko' ? '1px solid var(--mm-primary)' : undefined }}
                    onClick={() => changeLocale('ko')}
                  >
                    KO
                  </button>
                  <button
                    className="mm-btn mm-btn-ghost"
                    style={{ minWidth: 44, height: 28, padding: '0 8px', border: locale === 'en' ? '1px solid var(--mm-primary)' : undefined }}
                    onClick={() => changeLocale('en')}
                  >
                    EN
                  </button>
                </div>
              </div>
              <div style={{ padding: '4px 12px 6px', borderBottom: '1px solid var(--mm-border)', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginBottom: 6 }}>{t('common.theme')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="mm-btn mm-btn-ghost"
                    style={{ minWidth: 58, height: 28, padding: '0 8px', border: theme === 'light' ? '1px solid var(--mm-primary)' : undefined }}
                    onClick={() => changeTheme('light')}
                  >
                    {t('common.light')}
                  </button>
                  <button
                    className="mm-btn mm-btn-ghost"
                    style={{ minWidth: 58, height: 28, padding: '0 8px', border: theme === 'dark' ? '1px solid var(--mm-primary)' : undefined }}
                    onClick={() => changeTheme('dark')}
                  >
                    {t('common.dark')}
                  </button>
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
