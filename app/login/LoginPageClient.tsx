'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, AUTH_ERROR_ADMIN_ONLY } from '@/lib/auth';
import { useI18n } from '@/components/I18nProvider';
import { SYSTEM_LOCALE_VALUE, type Locale, type LocalePreference } from '@/lib/i18n';
import { useTheme } from '@/components/ThemeProvider';
import { SYSTEM_THEME_VALUE, type Theme, type ThemePreference } from '@/lib/theme';

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { localePreference, setLocalePreference, t } = useI18n();
  const { themePreference, setThemePreference } = useTheme();
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reasonAdminOnly = searchParams.get('reason') === 'admin-only';
  const displayError = error || (reasonAdminOnly ? t('login.adminOnly') : '');

  function changeLocale(nextLocalePreference: LocalePreference) {
    setLocalePreference(nextLocalePreference);
  }

  function changeTheme(nextThemePreference: ThemePreference) {
    setThemePreference(nextThemePreference);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!authName.trim()) { setError(t('login.requiredAuthName')); return; }
    if (!authPassword.trim()) { setError(t('login.requiredAuthPassword')); return; }

    setLoading(true);
    try {
      await login(authName.trim(), authPassword);
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof Error && error.message === AUTH_ERROR_ADMIN_ONLY) {
        setError(t('login.adminOnly'));
      } else {
        setError(t('login.invalidCredentials'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mm-login-page">
      <div className="mm-login-card">
        <div className="mm-login-logo">
          <div className="mm-login-logo-icon">
            <i className="bi bi-camera-video-fill" />
          </div>
          <div>
            <div className="mm-login-logo-text">MeetMate</div>
            <div className="mm-login-logo-sub">{t('common.adminPanel')}</div>
          </div>
        </div>

        <h2 className="mm-login-title">{t('login.title')}</h2>
        <p className="mm-login-subtitle">{t('login.subtitle')}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mm-form-group">
            <label className="mm-form-label" htmlFor="authName">{t('login.authNameLabel')}</label>
            <input
              id="authName"
              type="text"
              className={`mm-form-control${displayError ? ' is-invalid' : ''}`}
              placeholder={t('login.authNamePlaceholder')}
              value={authName}
              onChange={e => setAuthName(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="mm-form-group">
            <label className="mm-form-label" htmlFor="authPassword">{t('login.authPasswordLabel')}</label>
            <div className="mm-input-wrap">
              <input
                id="authPassword"
                type={showPw ? 'text' : 'password'}
                className={`mm-form-control${displayError ? ' is-invalid' : ''}`}
                placeholder={t('login.authPasswordPlaceholder')}
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="mm-input-toggle"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
              >
                <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>

          {displayError && (
            <div className="mm-invalid-feedback" style={{ marginBottom: 12 }}>
              <i className="bi bi-exclamation-circle me-1" />{displayError}
            </div>
          )}

          <div className="mm-login-actions">
            <button
              type="submit"
              className="mm-btn mm-btn-primary mm-btn-lg mm-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  {t('login.submitting')}
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" /> {t('login.submit')}
                </>
              )}
            </button>
          </div>

          <div className="mm-login-bottom-toolbar">
            <div className="mm-login-bottom-item">
              <span className="mm-login-toolbar-label">{t('common.theme')}</span>
              <select
                className="mm-form-control mm-login-select"
                value={themePreference}
                onChange={e => changeTheme(e.target.value as Theme | typeof SYSTEM_THEME_VALUE)}
              >
                <option value={SYSTEM_THEME_VALUE}>{t('common.auto')}</option>
                <option value="light">{t('common.light')}</option>
                <option value="dark">{t('common.dark')}</option>
              </select>
            </div>

            <div className="mm-login-bottom-item">
              <span className="mm-login-toolbar-label">{t('common.language')}</span>
              <select
                className="mm-form-control mm-login-select"
                value={localePreference}
                onChange={e => changeLocale(e.target.value as Locale | typeof SYSTEM_LOCALE_VALUE)}
              >
                <option value={SYSTEM_LOCALE_VALUE}>{t('common.auto')}</option>
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>

            <Link
              href="/login/settings"
              className="mm-login-settings-link"
              title={t('login.serviceConfigTitle')}
            >
              <i className="bi bi-gear" />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
