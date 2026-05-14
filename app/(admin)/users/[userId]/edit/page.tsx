'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';
import type { ApiListResponse } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';

interface UserItem {
  user_id?: string;
  auth_name?: string;
  user_name?: string;
  email?: string;
  org_name?: string;
  phone_number?: string;
  role?: string | {
    name?: string;
    level?: number;
    permissions?: string[];
  };
}

interface UserUpdateRequest {
  auth_password?: string;
  email?: string;
  user_name?: string;
  org_name?: string;
  phone_number?: string;
  role_name?: string;
}

const MASKED_PASSWORD = '********';

function pickString(src: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function toRoleName(role: UserItem['role']): string {
  if (!role) return '';
  if (typeof role === 'string') return role;
  return role.name ?? '';
}

function toUserItem(raw: unknown): UserItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const roleRaw = src.role;
  const role = typeof roleRaw === 'object' && roleRaw !== null
    ? roleRaw as UserItem['role']
    : (typeof roleRaw === 'string' ? roleRaw : undefined);

  return {
    user_id: pickString(src, ['user_id', 'uuid', 'id']),
    auth_name: pickString(src, ['auth_name', 'authName', 'username']),
    user_name: pickString(src, ['user_name', 'userName', 'name', 'display_name', 'displayName']),
    email: pickString(src, ['email', 'mail']),
    org_name: pickString(src, ['org_name', 'orgName', 'organization', 'organization_name']),
    phone_number: pickString(src, ['phone_number', 'phoneNumber', 'phone', 'mobile', 'mobile_number']),
    role,
  };
}

function pickUserFromResponse(payload: unknown): UserItem | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const candidates: unknown[] = [];

  candidates.push(root.user, root.item);
  if (Array.isArray(root.items) && root.items.length > 0) {
    candidates.push(root.items[0]);
  }

  const result = root.result;
  if (result && typeof result === 'object') {
    const resultObj = result as Record<string, unknown>;
    candidates.push(resultObj.user, resultObj.item, resultObj.profile, resultObj.data, resultObj);

    const items = resultObj.items;
    if (Array.isArray(items) && items.length > 0) {
      candidates.push(items[0]);
    }
  }

  for (const candidate of candidates) {
    const normalized = toUserItem(candidate);
    if (normalized && (normalized.user_id || normalized.auth_name || normalized.email || normalized.user_name)) {
      return normalized;
    }
  }

  return null;
}

export default function UserEditPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { addToast } = useToast();

  const userId = decodeURIComponent(params.userId ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState(MASKED_PASSWORD);
  const [passwordEditEnabled, setPasswordEditEnabled] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleName, setRoleName] = useState('');

  const returnToListHref = useMemo(() => {
    const listParams = new URLSearchParams();
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const searchField = searchParams.get('searchField');
    const q = searchParams.get('q');

    if (page) listParams.set('page', page);
    if (pageSize) listParams.set('pageSize', pageSize);
    if (searchField) listParams.set('searchField', searchField);
    if (q) listParams.set('q', q);

    const qs = listParams.toString();
    return qs ? `/users?${qs}` : '/users';
  }, [searchParams]);

  const goBackToPreviousPage = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(returnToListHref);
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      if (!userId) {
        addToast('error', t('users.editLoadFailedTitle'));
        router.push('/users');
        return;
      }

      setLoading(true);
      try {
        let user: UserItem | null = null;

        try {
          const svcRes = await apiGet<unknown>(`/svc/user/users?uuid=${encodeURIComponent(userId)}&limit=1`);
          user = pickUserFromResponse(svcRes);
        } catch {
          user = null;
        }

        if (!user) {
          const res = await apiGet<ApiListResponse<UserItem>>(`/api/user/v1/users?user_id=${encodeURIComponent(userId)}&limit=1`);
          user = res.result?.items?.[0] ?? null;
        }

        if (cancelled) return;

        if (!user) {
          addToast('warning', t('users.editNotFoundTitle'));
          router.push(returnToListHref);
          return;
        }

        setAuthName(user.auth_name ?? '');
        setAuthPassword(MASKED_PASSWORD);
        setPasswordEditEnabled(false);
        setPasswordVisible(false);
        setUserName(user.user_name ?? '');
        setEmail(user.email ?? '');
        setOrgName(user.org_name ?? '');
        setPhoneNumber(user.phone_number ?? '');
        setRoleName(toRoleName(user.role));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : undefined;
        addToast('error', t('users.editLoadFailedTitle'), message);
        router.push(returnToListHref);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, [addToast, returnToListHref, router, t, userId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    const payload: UserUpdateRequest = {
      user_name: userName.trim() || undefined,
      email: email.trim() || undefined,
      org_name: orgName.trim() || undefined,
      phone_number: phoneNumber.trim() || undefined,
      role_name: roleName.trim() || undefined,
    };

    const safePassword = passwordEditEnabled ? authPassword.trim() : '';
    if (safePassword) payload.auth_password = safePassword;

    try {
      setSaving(true);
      await apiPut(`/api/user/v1/users/${encodeURIComponent(userId)}`, payload);
      addToast('success', t('users.editSuccessTitle'));
      router.push(returnToListHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('users.editFailedTitle'), message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mm-card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="mm-card-body" style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="mm-card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="mm-card-header">
        <div>
          <h2 className="mm-card-title" style={{ margin: 0 }}>{t('users.editPage.title')}</h2>
          <p className="mm-page-subtitle" style={{ marginTop: 6 }}>{t('users.editPage.subtitle')}</p>
        </div>
      </div>

      <form className="mm-card-body" onSubmit={onSubmit}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.authName')}</label>
            <input className="mm-form-control" value={authName} disabled readOnly />
            <p className="mm-form-hint">{t('users.editPage.authNameReadonlyHint')}</p>
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editAuthPassword')}</label>
            <div className="mm-input-wrap">
              <input
                type={passwordVisible ? 'text' : 'password'}
                className="mm-form-control"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                placeholder={t('users.editAuthPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={!passwordEditEnabled}
              />
              <button
                type="button"
                className="mm-input-toggle"
                onClick={() => setPasswordVisible(v => !v)}
                title={passwordVisible ? t('users.editPage.passwordHide') : t('users.editPage.passwordShow')}
                aria-label={passwordVisible ? t('users.editPage.passwordHide') : t('users.editPage.passwordShow')}
                disabled={!passwordEditEnabled}
              >
                <i className={`bi ${passwordVisible ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
            <label className="mm-form-hint" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={passwordEditEnabled}
                onChange={e => {
                  const enabled = e.target.checked;
                  setPasswordEditEnabled(enabled);
                  setPasswordVisible(false);
                  setAuthPassword(enabled ? '' : MASKED_PASSWORD);
                }}
                disabled={saving}
              />
              {t('users.editPage.passwordEditEnable')}
            </label>
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.userName')}</label>
            <input className="mm-form-control" value={userName} placeholder="-" onChange={e => setUserName(e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editEmail')}</label>
            <input className="mm-form-control" value={email} placeholder="-" onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editOrgName')}</label>
            <input className="mm-form-control" value={orgName} placeholder="-" onChange={e => setOrgName(e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editPhoneNumber')}</label>
            <input className="mm-form-control" value={phoneNumber} placeholder="-" onChange={e => setPhoneNumber(e.target.value)} />
          </div>

          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.role')}</label>
            <input className="mm-form-control" value={roleName} placeholder="-" onChange={e => setRoleName(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="mm-btn mm-btn-secondary"
            onClick={goBackToPreviousPage}
            style={{ marginRight: 'auto' }}
            disabled={saving}
          >
            {t('users.paginationPrev')}
          </button>
          <button
            type="button"
            className="mm-btn mm-btn-secondary"
            onClick={() => router.push(returnToListHref)}
            disabled={saving}
          >
            {t('users.editCancel')}
          </button>
          <button type="submit" className="mm-btn mm-btn-primary" disabled={saving}>
            {saving ? t('users.editSaving') : t('users.editSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
