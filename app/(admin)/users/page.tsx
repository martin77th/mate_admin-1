'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet } from '@/lib/api';
import type { ApiListResponse } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useI18n } from '@/components/I18nProvider';
import { ConfirmModal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
function formatDateTimeGmt(dateStr?: string | null, locale: 'ko' | 'en' = 'ko'): string {
  if (!dateStr) return '-';
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateStr);
  const normalized = hasZone ? dateStr : `${dateStr}Z`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '-';

  const targetLocale = locale === 'en' ? 'en-US' : 'ko-KR';
  const ymd = d
    .toLocaleDateString(targetLocale, {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
    })
    .replace(/\. /g, '-')
    .replace('.', '');
  const hm = d.toLocaleTimeString(targetLocale, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  });

  return `${ymd} ${hm}`;
}

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
  created_at?: string;
}

type UserSearchField = 'auth_name' | 'user_id' | 'email';

interface NormalizedUserListResult {
  items: UserItem[];
  totalCount: number;
}

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

function normalizeUserItem(raw: unknown): UserItem | null {
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
    created_at:
      pickString(src, ['creation_time', 'creationTime', 'created_at', 'createdAt']),
  };
}

function normalizeUserListResponse(payload: unknown): NormalizedUserListResult {
  if (!payload || typeof payload !== 'object') {
    return { items: [], totalCount: 0 };
  }

  const root = payload as Record<string, unknown>;
  const resultRaw = (root.result && typeof root.result === 'object') ? root.result as Record<string, unknown> : null;

  const itemsRaw =
    (resultRaw?.items && Array.isArray(resultRaw.items) ? resultRaw.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  const items = itemsRaw
    .map(normalizeUserItem)
    .filter((u): u is UserItem => !!u);

  const totalCandidate =
    (typeof resultRaw?.total_count === 'number' ? resultRaw.total_count : null) ??
    (typeof resultRaw?.totalCount === 'number' ? resultRaw.totalCount : null) ??
    (typeof root.total_count === 'number' ? root.total_count : null) ??
    (typeof root.totalCount === 'number' ? root.totalCount : null);

  const totalCount = typeof totalCandidate === 'number' ? totalCandidate : items.length;
  return { items, totalCount };
}

function formatRole(role: UserItem['role']): string {
  if (!role) return '-';
  if (typeof role === 'string') return role.trim() || '-';
  if (role.name) return role.name;
  if (typeof role.level === 'number') return `level:${role.level}`;
  return '-';
}

function getHeaderFontSizeByLength(label: string): number {
  const length = label.trim().length;
  if (length >= 10) return 15;
  if (length >= 6) return 14;
  if (length >= 3) return 13;
  return 12;
}

export default function UsersPage() {
  const initialParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;
  const initialQuery = (initialParams?.get('q') ?? '').trim();
  const initialFieldParam = initialParams?.get('searchField');
  const initialSearchField: UserSearchField =
    initialFieldParam === 'user_id' || initialFieldParam === 'email' || initialFieldParam === 'auth_name'
      ? initialFieldParam
      : 'auth_name';
  const { locale, t } = useI18n();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [searchField, setSearchField] = useState<UserSearchField>(initialSearchField);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [reloadTick, setReloadTick] = useState(0);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      setLoading(true);

      try {
        const offset = (currentPage - 1) * pageSize;
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(pageSize),
          order_by: 'creation_time',
          order: 'desc',
        });

        const svcParams = new URLSearchParams(params);
        const apiParams = new URLSearchParams(params);

        const keyword = query.trim();
        if (keyword) {
          apiParams.append(searchField, keyword);
          if (searchField === 'user_id') {
            svcParams.append('uuid', keyword);
          } else {
            svcParams.append(searchField, keyword);
          }
        }

        let normalized: NormalizedUserListResult | null = null;

        try {
          const svcRes = await apiGet<unknown>(`/svc/user/users?${svcParams.toString()}`);
          normalized = normalizeUserListResponse(svcRes);
        } catch {
          normalized = null;
        }

        if (!normalized) {
          const res = await apiGet<ApiListResponse<UserItem>>(`/api/user/v1/users?${apiParams.toString()}`);
          normalized = {
            items: res.result?.items ?? [],
            totalCount: res.result?.total_count ?? 0,
          };
        }

        if (cancelled) return;
        setUsers(normalized.items);
        setTotalCount(normalized.totalCount);
      } catch {
        if (cancelled) return;
        setUsers([]);
        setTotalCount(0);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, query, searchField, reloadTick]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const goToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
  };
  const rowStart = (safeCurrentPage - 1) * pageSize;

  const pageNumbers = useMemo(() => {
    const blockSize = 10;
    const blockStart = Math.floor((safeCurrentPage - 1) / blockSize) * blockSize + 1;
    const blockEnd = Math.min(totalPages, blockStart + blockSize - 1);
    return Array.from({ length: blockEnd - blockStart + 1 }, (_, idx) => blockStart + idx);
  }, [safeCurrentPage, totalPages]);

  const submitSearch = () => {
    setCurrentPage(1);
    setQuery(queryInput.trim());
  };

  const resetSearch = () => {
    setCurrentPage(1);
    setQueryInput('');
    setQuery('');
  };

  const buildEditHref = (userId: string) => {
    const params = new URLSearchParams();
    params.set('page', String(safeCurrentPage));
    params.set('pageSize', String(pageSize));
    params.set('searchField', searchField);
    if (query.trim()) params.set('q', query.trim());
    return `/users/${encodeURIComponent(userId)}/edit?${params.toString()}`;
  };

  const submitDelete = async () => {
    if (!deletingUser?.user_id) return;

    try {
      setDeleting(true);
      await apiDelete(`/api/user/v1/users/${deletingUser.user_id}`);
      addToast('success', t('users.deleteSuccessTitle'));
      setDeletingUser(null);
      setDeleting(false);

      if (users.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else {
        setReloadTick(v => v + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('users.deleteFailedTitle'), message);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mm-card mm-search-tools-card" style={{ marginBottom: 12 }}>
        <div className="mm-card-header mm-search-tools-header">
          <span className="mm-card-title">{t('users.searchTools')}</span>
          <Link href="/users/new" className="mm-btn mm-btn-primary mm-btn-sm">
            <i className="bi bi-person-plus" />
            {t('users.create')}
          </Link>
        </div>
        <div className="mm-card-body mm-search-tools-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="mm-search-tools-controls">
            <select
              className="mm-form-control"
              style={{ width: 180, flex: '0 0 180px' }}
              value={searchField}
              onChange={e => setSearchField(e.target.value as UserSearchField)}
            >
              <option value="auth_name">{t('users.searchField.authName')}</option>
              <option value="user_id">{t('users.searchField.userId')}</option>
              <option value="email">{t('users.searchField.email')}</option>
            </select>
            <div className="mm-search-wrap mm-search-tools-input-wrap">
              <i className="bi bi-search" />
              <input
                className="mm-search-input"
                style={{ width: '100%' }}
                placeholder={t('users.searchPlaceholder')}
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitSearch();
                }}
              />
            </div>
            <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitSearch}>
              {t('users.search')}
            </button>
            <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" onClick={resetSearch}>
              {t('users.reset')}
            </button>
          </div>
        </div>
      </div>

      <div className="mm-table-wrap">
        <div className="mm-card-header">
          <span className="mm-card-title">{t('users.listTitle')} ({t('users.totalCount')}: {formatNumber(totalCount, locale)})</span>
          <select
            className="mm-form-control"
            style={{ width: 150, minWidth: 150 }}
            value={String(pageSize)}
            onChange={e => {
              setCurrentPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value="10">{t('users.perPage10')}</option>
            <option value="20">{t('users.perPage20')}</option>
            <option value="50">{t('users.perPage50')}</option>
            <option value="100">{t('users.perPage100')}</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        ) : users.length === 0 ? (
          <div className="mm-empty-state">
            <i className="bi bi-people" />
            <p>{query.trim() ? t('users.noSearchResults') : t('users.empty')}</p>
          </div>
        ) : (
          <>
            <table className="mm-table mm-users-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  {[
                    { key: 'no', align: 'left', minWidth: 56, cls: 'mm-col-no' },
                    { key: 'authName', align: 'left', minWidth: 120, cls: 'mm-col-auth-name' },
                    { key: 'userId', align: 'left', minWidth: 160, cls: 'mm-col-user-id' },
                    { key: 'userName', align: 'left', minWidth: 120, cls: 'mm-col-user-name' },
                    { key: 'role', align: 'left', minWidth: 100, cls: 'mm-col-role' },
                    { key: 'createdAt', align: 'left', minWidth: 130, cls: 'mm-col-created-at' },
                    { key: 'actions', align: 'center', minWidth: 120, cls: 'mm-col-actions' },
                  ].map(col => {
                    const label = t(`users.columns.${col.key}`);
                    return (
                      <th
                        key={col.key}
                        className={col.cls}
                        style={{
                          textAlign: col.align as 'left' | 'center',
                          fontSize: getHeaderFontSizeByLength(label),
                          minWidth: col.minWidth,
                        }}
                      >
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.user_id ?? `${user.auth_name ?? 'unknown'}-${idx}`}>
                    <td className="mm-col-no" style={{ color: 'var(--mm-text-secondary)' }}>{rowStart + idx + 1}</td>
                    <td className="mm-col-auth-name"><span className="mm-cell-ellipsis" style={{ fontWeight: 500 }}>{user.auth_name || '-'}</span></td>
                    <td className="mm-col-user-id" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{user.user_id || '-'}</span></td>
                    <td className="mm-col-user-name"><span className="mm-cell-ellipsis">{user.user_name || '-'}</span></td>
                    <td className="mm-col-role" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{formatRole(user.role)}</span></td>
                    <td className="mm-col-created-at" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{formatDateTimeGmt(user.created_at, locale)}</span></td>
                    <td className="mm-col-actions" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {user.user_id ? (
                          <Link
                            href={buildEditHref(user.user_id)}
                            className="mm-btn mm-btn-primary mm-btn-sm"
                            title={t('users.actionEdit')}
                          >
                            {t('users.actionEdit')}
                          </Link>
                        ) : (
                          <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" disabled>
                            {t('users.actionEdit')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="mm-btn mm-btn-danger mm-btn-sm"
                          title={t('users.actionDelete')}
                          onClick={() => setDeletingUser(user)}
                        >
                          {t('users.actionDelete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mm-pagination-wrap">
              <div className="mm-pagination-edge mm-pagination-edge-left">
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(1)}
                  disabled={safeCurrentPage <= 1}
                >
                  {t('users.paginationFirst')}
                </button>

                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                >
                  {t('users.paginationPrev')}
                </button>
              </div>

              <div className="mm-pagination-pages">
                {pageNumbers.map(page => (
                  <button
                    key={page}
                    type="button"
                    className={`mm-btn mm-btn-sm ${page === safeCurrentPage ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
                    onClick={() => goToPage(page)}
                    disabled={page === safeCurrentPage}
                    aria-current={page === safeCurrentPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <div className="mm-pagination-edge mm-pagination-edge-right">
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                >
                  {t('users.paginationNext')}
                </button>

                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                >
                  {t('users.paginationLast')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!deletingUser}
        title={t('users.deleteConfirmTitle')}
        message={t('users.deleteConfirmMessage')}
        confirmLabel={deleting ? t('users.deleteDeleting') : t('users.deleteConfirmButton')}
        cancelLabel={t('users.deleteCancelButton')}
        danger
        onCancel={() => {
          if (deleting) return;
          setDeletingUser(null);
        }}
        onConfirm={submitDelete}
      />
    </>
  );
}
