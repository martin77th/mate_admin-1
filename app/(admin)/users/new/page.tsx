'use client';

import { FormEvent, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiPost } from '@/lib/api';
import type { ApiItemResponse } from '@/lib/api';
import { getAuthContext, type AuthContext } from '@/lib/auth';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';

const EMPTY_AUTH_CONTEXT: AuthContext = { permissions: [] };

interface CreateUserRequest {
  auth_name?: string;
  auth_password?: string;
  email?: string;
  user_name?: string;
  org_name?: string;
  phone_number?: string;
  role_name?: 'anonymous' | 'member';
}

interface CreatedUserResult {
  user_id?: string;
  auth_name?: string;
  auth_password?: string;
}

export default function UserCreatePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { addToast } = useToast();
  const showTokenContextDebug = process.env.NODE_ENV !== 'production';
  const authContext = useSyncExternalStore(
    () => () => {},
    () => getAuthContext(),
    () => EMPTY_AUTH_CONTEXT
  );
  const canSetRole = authContext.roleName === 'admin';
  const roleText = authContext.roleName || t('users.createForm.tokenEmpty');
  const tenantText = authContext.tenantId || t('users.createForm.tokenEmpty');
  const [submitting, setSubmitting] = useState(false);

  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleName, setRoleName] = useState<'' | 'anonymous' | 'member'>('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const safeAuthName = authName.trim();
    const safeAuthPassword = authPassword.trim();

    if (!safeAuthName) {
      addToast('warning', t('users.createForm.requiredAuthName'));
      return;
    }

    if (!safeAuthPassword) {
      addToast('warning', t('users.createForm.requiredAuthPassword'));
      return;
    }

    const createPayload = (includeRole: boolean): CreateUserRequest => {
      const payload: CreateUserRequest = {
        auth_name: safeAuthName,
        auth_password: safeAuthPassword,
      };

      if (includeRole && roleName && canSetRole) payload.role_name = roleName;
      if (email.trim()) payload.email = email.trim();
      if (userName.trim()) payload.user_name = userName.trim();
      if (orgName.trim()) payload.org_name = orgName.trim();
      if (phoneNumber.trim()) payload.phone_number = phoneNumber.trim();
      return payload;
    };

    try {
      setSubmitting(true);
      try {
        await apiPost<ApiItemResponse<CreatedUserResult>>('/api/user/v1/users', createPayload(canSetRole));
      } catch (firstErr) {
        const message = firstErr instanceof Error ? firstErr.message : '';
        const deniedRole = canSetRole && roleName && message.includes('역할 이름을 지정할 수 없습니다');
        if (!deniedRole) throw firstErr;

        await apiPost<ApiItemResponse<CreatedUserResult>>('/api/user/v1/users', createPayload(false));
      }
      addToast('success', t('users.createForm.createdTitle'), t('users.createForm.createdMessage'));
      const qs = new URLSearchParams({
        searchField: 'auth_name',
        q: safeAuthName,
      });
      router.push(`/users?${qs.toString()}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        addToast('warning', t('users.createForm.duplicateAuthNameTitle'), t('users.createForm.duplicateAuthNameMessage'));
        return;
      }

      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('users.createForm.createFailedTitle'), message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mm-card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="mm-card-header">
        <div>
          <h2 className="mm-card-title" style={{ margin: 0 }}>{t('users.createForm.title')}</h2>
          <p className="mm-page-subtitle" style={{ marginTop: 6 }}>{t('users.createForm.subtitle')}</p>
          {showTokenContextDebug && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="mm-badge mm-badge-muted">
                {t('users.createForm.tokenContextTitle')}
              </span>
              <span className="mm-badge mm-badge-info">
                {t('users.createForm.tokenRoleLabel')}: {roleText}
              </span>
              <span className="mm-badge mm-badge-primary">
                {t('users.createForm.tokenTenantLabel')}: {tenantText}
              </span>
            </div>
          )}
        </div>
      </div>

      <form className="mm-card-body" onSubmit={onSubmit}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.authName')}</label>
            <input
              className="mm-form-control"
              value={authName}
              onChange={e => setAuthName(e.target.value)}
              placeholder={t('users.createForm.placeholderAuthName')}
              autoComplete="off"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.authPassword')}</label>
            <input
              type="password"
              className="mm-form-control"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder={t('users.createForm.placeholderAuthPassword')}
              autoComplete="new-password"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.email')}</label>
            <input
              type="email"
              className="mm-form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('users.createForm.placeholderEmail')}
              autoComplete="off"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.userName')}</label>
            <input
              className="mm-form-control"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder={t('users.createForm.placeholderUserName')}
              autoComplete="off"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.orgName')}</label>
            <input
              className="mm-form-control"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder={t('users.createForm.placeholderOrgName')}
              autoComplete="off"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.phoneNumber')}</label>
            <input
              className="mm-form-control"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder={t('users.createForm.placeholderPhoneNumber')}
              autoComplete="off"
            />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.createForm.roleName')}</label>
            <select
              className="mm-form-control"
              value={roleName}
              onChange={e => setRoleName(e.target.value as '' | 'anonymous' | 'member')}
              disabled={!canSetRole}
            >
              <option value="">{t('users.createForm.roleDefault')}</option>
              <option value="anonymous">{t('users.createForm.roleAnonymous')}</option>
              <option value="member">{t('users.createForm.roleMember')}</option>
            </select>
            {!canSetRole && (
              <p className="mm-form-hint">{t('users.createForm.roleByTokenHint')}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="mm-btn mm-btn-secondary"
            onClick={() => router.push('/users')}
            disabled={submitting}
          >
            {t('users.createForm.cancel')}
          </button>
          <button type="submit" className="mm-btn mm-btn-primary" disabled={submitting}>
            {submitting ? t('users.createForm.submitting') : t('users.createForm.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
