'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';
import { useI18n } from '@/components/I18nProvider';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!authName.trim()) { setError(t('login.requiredAuthName')); return; }
    if (!authPassword.trim()) { setError(t('login.requiredAuthPassword')); return; }

    setLoading(true);
    try {
      await login(authName.trim(), authPassword);
      router.replace('/dashboard');
    } catch {
      setError(t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mm-login-page">
      <div className="mm-login-card">
        {/* Logo */}
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
              className={`mm-form-control${error ? ' is-invalid' : ''}`}
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
                className={`mm-form-control${error ? ' is-invalid' : ''}`}
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

          {error && (
            <div className="mm-invalid-feedback" style={{ marginBottom: 12 }}>
              <i className="bi bi-exclamation-circle me-1" />{error}
            </div>
          )}

          <button
            type="submit"
            className="mm-btn mm-btn-primary mm-btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
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
        </form>
      </div>
    </div>
  );
}
