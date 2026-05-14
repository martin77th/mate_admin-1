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
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

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
    setTestMessage('');
    setTestSuccess(null);
  }

  function resetDefault() {
    setServiceUrl(DEFAULT_API_BASE_URL);
    setError('');
    setSaved(false);
    setTestMessage('');
    setTestSuccess(null);
  }

  async function testServiceUrlConnection() {
    setError('');
    setSaved(false);
    setTestMessage('');
    setTestSuccess(null);

    const nextValue = serviceUrl.trim();
    if (!isValidApiBaseUrl(nextValue)) {
      setError(t('login.invalidServiceUrl'));
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    setTesting(true);

    try {
      const response = await fetch(`${nextValue.replace(/\/+$/, '')}/svc/user/users?limit=1`, {
        method: 'GET',
        signal: controller.signal,
      });

      setTestSuccess(true);
      setTestMessage(`${t('login.serviceUrlTestSuccessPrefix')} (${response.status})`);
    } catch {
      setTestSuccess(false);
      setTestMessage(t('login.serviceUrlTestFailed'));
    } finally {
      clearTimeout(timeoutId);
      setTesting(false);
    }
  }

  return (
    <div className="mm-login-page">
      <div className="mm-login-card mm-service-settings-card">
        <div className="mm-login-logo mm-service-settings-logo">
          <div className="mm-login-logo-icon">
            <i className="bi bi-gear-fill" />
          </div>
          <div>
            <div className="mm-login-logo-text">{t('login.serviceConfigTitle')}</div>
            <div className="mm-login-logo-sub">{t('login.serviceConfigSubtitle')}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mm-service-settings-form">
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

          <div className="mm-service-settings-status" aria-live="polite">
            {error && (
              <div className="mm-service-settings-alert mm-service-settings-alert-error">
                <i className="bi bi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}
            {saved && (
              <div className="mm-service-settings-alert mm-service-settings-alert-success">
                <i className="bi bi-check-circle" />
                <span>{t('login.serviceUrlSaved')}</span>
              </div>
            )}
            {testMessage && (
              <div className={`mm-service-settings-alert ${testSuccess ? 'mm-service-settings-alert-success' : 'mm-service-settings-alert-error'}`}>
                <i className={`bi ${testSuccess ? 'bi-check-circle' : 'bi-x-circle'}`} />
                <span>{testMessage}</span>
              </div>
            )}
          </div>

          <div className="mm-service-settings-actions">
            <div className="mm-service-settings-actions-primary">
              <button type="submit" className="mm-btn mm-btn-primary">
                <i className="bi bi-save" /> {t('login.saveServiceUrl')}
              </button>
              <button type="button" className="mm-btn mm-btn-secondary" onClick={testServiceUrlConnection} disabled={testing}>
                <i className="bi bi-wifi" /> {testing ? t('login.testingServiceUrl') : t('login.testServiceUrl')}
              </button>
            </div>
            <div className="mm-service-settings-actions-secondary">
              <button type="button" className="mm-btn mm-btn-secondary" onClick={resetDefault}>
                <i className="bi bi-arrow-counterclockwise" /> {t('login.resetDefaultUrl')}
              </button>
            </div>
            <Link href="/login" className="mm-btn mm-btn-ghost mm-service-settings-back-link">
              <i className="bi bi-arrow-left" /> {t('login.backToLogin')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
