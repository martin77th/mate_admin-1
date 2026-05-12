'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import type { ApiListResponse } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useI18n } from '@/components/I18nProvider';
import Modal, { ConfirmModal } from '@/components/Modal';
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
  created_at?: string;
}

interface UserUpdateRequest {
  auth_name?: string;
  auth_password?: string;
  email?: string;
  user_name?: string;
  org_name?: string;
  phone_number?: string;
  role_name?: string;
}

type UserSearchField = 'auth_name' | 'user_id' | 'email';

function formatRole(role: UserItem['role']): string {
  if (!role) return '-';
  if (typeof role === 'string') return role;
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
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editAuthName, setEditAuthName] = useState('');
  const [editAuthPassword, setEditAuthPassword] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOrgName, setEditOrgName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
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
          order_by: 'created_at',
          order: 'desc',
        });

        const keyword = query.trim();
        if (keyword) {
          params.append(searchField, keyword);
        }

        const res = await apiGet<ApiListResponse<UserItem>>(`/api/user/v1/users?${params.toString()}`);

        if (cancelled) return;
        setUsers(res.result?.items ?? []);
        setTotalCount(res.result?.total_count ?? 0);
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

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setEditAuthName(user.auth_name ?? '');
    setEditAuthPassword('');
    setEditUserName(user.user_name ?? '');
    setEditEmail(user.email ?? '');
    setEditOrgName(user.org_name ?? '');
    setEditPhoneNumber(user.phone_number ?? '');
    setEditRoleName(typeof user.role === 'string' ? user.role : (user.role?.name ?? ''));
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setSavingEdit(false);
  };

  const submitEdit = async () => {
    if (!editingUser?.user_id) return;

    const payload: UserUpdateRequest = {
      auth_name: editAuthName.trim() || undefined,
      user_name: editUserName.trim() || undefined,
      email: editEmail.trim() || undefined,
      org_name: editOrgName.trim() || undefined,
      phone_number: editPhoneNumber.trim() || undefined,
      role_name: editRoleName.trim() || undefined,
    };

    const safePassword = editAuthPassword.trim();
    if (safePassword) payload.auth_password = safePassword;

    try {
      setSavingEdit(true);
      await apiPut(`/api/user/v1/users/${editingUser.user_id}`, payload);
      addToast('success', t('users.editSuccessTitle'));
      closeEditModal();
      setReloadTick(v => v + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('users.editFailedTitle'), message);
      setSavingEdit(false);
    }
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
      <div className="mm-card" style={{ marginBottom: 12 }}>
        <div className="mm-card-header">
          <span className="mm-card-title">{t('users.searchTools')}</span>
          <Link href="/users/new" className="mm-btn mm-btn-primary mm-btn-sm">
            <i className="bi bi-person-plus" />
            {t('users.create')}
          </Link>
        </div>
        <div className="mm-card-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <div className="mm-search-wrap" style={{ maxWidth: 380, flex: '1 1 320px' }}>
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
          <span className="mm-card-title">{t('users.listTitle')} ({t('users.totalCount')}: {totalCount})</span>
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
            <table className="mm-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  {[
                    { key: 'no', align: 'left', minWidth: 56 },
                    { key: 'authName', align: 'left', minWidth: 120 },
                    { key: 'userId', align: 'left', minWidth: 160 },
                    { key: 'userName', align: 'left', minWidth: 120 },
                    { key: 'role', align: 'left', minWidth: 100 },
                    { key: 'createdAt', align: 'left', minWidth: 130 },
                    { key: 'actions', align: 'center', minWidth: 120 },
                  ].map(col => {
                    const label = t(`users.columns.${col.key}`);
                    return (
                      <th
                        key={col.key}
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
                    <td style={{ color: 'var(--mm-text-secondary)' }}>{rowStart + idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{user.auth_name ?? '-'}</td>
                    <td style={{ color: 'var(--mm-text-secondary)' }}>{user.user_id ?? '-'}</td>
                    <td>{user.user_name ?? '-'}</td>
                    <td style={{ color: 'var(--mm-text-secondary)' }}>{formatRole(user.role)}</td>
                    <td style={{ color: 'var(--mm-text-secondary)' }}>{formatDateTime(user.created_at, locale)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="mm-btn mm-btn-primary mm-btn-sm"
                          title={t('users.actionEdit')}
                          onClick={() => openEditModal(user)}
                        >
                          {t('users.actionEdit')}
                        </button>
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

      <Modal
        open={!!editingUser}
        title={t('users.editModalTitle')}
        onClose={closeEditModal}
        size="md"
        footer={(
          <>
            <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" onClick={closeEditModal} disabled={savingEdit}>
              {t('users.editCancel')}
            </button>
            <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitEdit} disabled={savingEdit}>
              {savingEdit ? t('users.editSaving') : t('users.editSave')}
            </button>
          </>
        )}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.authName')}</label>
            <input className="mm-form-control" value={editAuthName} onChange={e => setEditAuthName(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editAuthPassword')}</label>
            <input
              type="password"
              className="mm-form-control"
              value={editAuthPassword}
              onChange={e => setEditAuthPassword(e.target.value)}
              placeholder={t('users.editAuthPasswordPlaceholder')}
            />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.userName')}</label>
            <input className="mm-form-control" value={editUserName} onChange={e => setEditUserName(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editEmail')}</label>
            <input className="mm-form-control" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editOrgName')}</label>
            <input className="mm-form-control" value={editOrgName} onChange={e => setEditOrgName(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.editPhoneNumber')}</label>
            <input className="mm-form-control" value={editPhoneNumber} onChange={e => setEditPhoneNumber(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="mm-form-label">{t('users.columns.role')}</label>
            <input className="mm-form-control" value={editRoleName} onChange={e => setEditRoleName(e.target.value)} />
          </div>
        </div>
      </Modal>

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
