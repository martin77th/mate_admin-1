'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import {
  DEFAULT_API_BASE_URL,
  getConfiguredApiBaseUrl,
  isValidApiBaseUrl,
  saveApiBaseUrl,
} from '@/lib/service-config';

export default function LoginSettingsPage() {
  const { t } = useI18n();
  const initialUrl = useMemo(() => getConfiguredApiBaseUrl(), []);
  const [serviceUrl, setServiceUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    const nextValue = serviceUrl.trim();
    if (!isValidApiBaseUrl(nextValue)) {
      setError(t('login.invalidServiceUrl'));
      return;
    }

    saveApiBaseUrl(nextValue);
    setSaved(true);
  }

  function resetDefault() {
    setServiceUrl(DEFAULT_API_BASE_URL);
    setError('');
    setSaved(false);
  }

  return (
    <div className="mm-login-page">
      <div className="mm-login-card">
        <div className="mm-login-logo" style={{ marginBottom: 16 }}>
          <div className="mm-login-logo-icon">
            <i className="bi bi-gear-fill" />
          </div>
          <div>
            <div className="mm-login-logo-text">{t('login.serviceConfigTitle')}</div>
            <div className="mm-login-logo-sub">{t('login.serviceConfigSubtitle')}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mm-form-group">
            <label className="mm-form-label" htmlFor="serviceUrl">{t('login.serviceUrlLabel')}</label>
            <input
              id="serviceUrl"
              type="url"
              className={`mm-form-control${error ? ' is-invalid' : ''}`}
              placeholder={t('login.serviceUrlPlaceholder')}
              value={serviceUrl}
              onChange={e => setServiceUrl(e.target.value)}
              autoComplete="off"
            />
            <div className="mm-form-hint">{t('login.serviceUrlHelp')}</div>
          </div>

          {error && (
            <div className="mm-invalid-feedback" style={{ marginBottom: 10 }}>
              <i className="bi bi-exclamation-circle me-1" />{error}
            </div>
          )}
          {saved && (
            <div style={{ color: 'var(--mm-success)', fontSize: 13, marginBottom: 10 }}>
              <i className="bi bi-check-circle me-1" />{t('login.serviceUrlSaved')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="mm-btn mm-btn-primary">
              <i className="bi bi-save" /> {t('login.saveServiceUrl')}
            </button>
            <button type="button" className="mm-btn mm-btn-secondary" onClick={resetDefault}>
              <i className="bi bi-arrow-counterclockwise" /> {t('login.resetDefaultUrl')}
            </button>
            <Link href="/login" className="mm-btn mm-btn-ghost">
              <i className="bi bi-arrow-left" /> {t('login.backToLogin')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
