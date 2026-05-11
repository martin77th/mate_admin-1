'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!authName.trim()) { setError('아이디를 입력해주세요.'); return; }
    if (!authPassword.trim()) { setError('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    try {
      await login(authName.trim(), authPassword);
      router.replace('/dashboard');
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
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
            <div className="mm-login-logo-sub">Admin Panel</div>
          </div>
        </div>

        <h2 className="mm-login-title">로그인</h2>
        <p className="mm-login-subtitle">관리자 계정으로 로그인하세요.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mm-form-group">
            <label className="mm-form-label" htmlFor="authName">아이디</label>
            <input
              id="authName"
              type="text"
              className={`mm-form-control${error ? ' is-invalid' : ''}`}
              placeholder="관리자 아이디"
              value={authName}
              onChange={e => setAuthName(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="mm-form-group">
            <label className="mm-form-label" htmlFor="authPassword">비밀번호</label>
            <div className="mm-input-wrap">
              <input
                id="authPassword"
                type={showPw ? 'text' : 'password'}
                className={`mm-form-control${error ? ' is-invalid' : ''}`}
                placeholder="비밀번호"
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
                로그인 중...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right" /> 로그인
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
