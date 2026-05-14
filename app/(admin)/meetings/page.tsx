'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet } from '@/lib/api';
import { formatDateTime, formatNumber, meetingStatusBadge } from '@/lib/utils';
import { useI18n } from '@/components/I18nProvider';
import { ConfirmModal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import type { Locale } from '@/lib/i18n';

interface MeetingItem {
  meeting_id?: string;
  name?: string;
  status?: string;
  code?: string;
  owner_id?: string;
  entry_option?: string;
  password?: string;
  password_checking?: boolean;
  start_time?: string;
  pre_entering_duration?: number;
  progress_duration?: number;
  close_grace_duration?: number;
  member_max?: number;
  created_at?: string;
}

type MeetingStatusFilter = 'all' | 'booked' | 'held' | 'closed' | 'deleted';

const EDITABLE_MEETING_STATUSES = new Set(['booked', 'created']);

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

function pickNumber(src: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function pickBoolean(src: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function normalizeMeetingItem(raw: unknown): MeetingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;

  const meetingId = pickString(src, ['meeting_id', 'meetingId', 'uuid', 'id']);
  const name = pickString(src, ['name', 'meeting_name', 'meetingName']);
  const status = pickString(src, ['status']);
  const code = pickString(src, ['code', 'invite_code', 'inviteCode']);

  if (!meetingId && !name && !code) return null;

  return {
    meeting_id: meetingId,
    name,
    status,
    code,
    owner_id: pickString(src, ['owner_id', 'ownerId', 'owner_uuid', 'ownerUuid']),
    entry_option: pickString(src, ['entry_option', 'entryOption']),
    password: pickString(src, ['password']),
    password_checking: pickBoolean(src, ['password_checking', 'passwordChecking']),
    start_time: pickString(src, ['start_time', 'startTime', 'held_at', 'heldAt']),
    pre_entering_duration: pickNumber(src, ['pre_entering_duration', 'preEnteringDuration']),
    progress_duration: pickNumber(src, ['progress_duration', 'progressDuration']),
    close_grace_duration: pickNumber(src, ['close_grace_duration', 'closeGraceDuration']),
    member_max: pickNumber(src, ['member_max', 'memberMax']),
    created_at: pickString(src, ['creation_time', 'created_at', 'createdAt', 'creationTime']),
  };
}

function normalizeMeetingListResponse(payload: unknown): { items: MeetingItem[]; totalCount: number } {
  if (!payload || typeof payload !== 'object') {
    return { items: [], totalCount: 0 };
  }

  const root = payload as Record<string, unknown>;
  const resultObj = (root.result && typeof root.result === 'object') ? root.result as Record<string, unknown> : null;

  const itemsRaw =
    (resultObj?.items && Array.isArray(resultObj.items) ? resultObj.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  const items = itemsRaw
    .map(normalizeMeetingItem)
    .filter((item): item is MeetingItem => !!item);

  const totalCandidate =
    (typeof resultObj?.total_count === 'number' ? resultObj.total_count : null) ??
    (typeof root.total_count === 'number' ? root.total_count : null) ??
    (typeof resultObj?.totalCount === 'number' ? resultObj.totalCount : null) ??
    (typeof root.totalCount === 'number' ? root.totalCount : null);

  return { items, totalCount: typeof totalCandidate === 'number' ? totalCandidate : items.length };
}

function pickFirstUserAuthName(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const root = payload as Record<string, unknown>;
  const resultObj = (root.result && typeof root.result === 'object') ? root.result as Record<string, unknown> : null;

  const candidates: Record<string, unknown>[] = [];
  if (resultObj) {
    candidates.push(resultObj);
    if (Array.isArray(resultObj.items) && resultObj.items[0] && typeof resultObj.items[0] === 'object') {
      candidates.push(resultObj.items[0] as Record<string, unknown>);
    }
  }
  if (Array.isArray(root.items) && root.items[0] && typeof root.items[0] === 'object') {
    candidates.push(root.items[0] as Record<string, unknown>);
  }

  for (const candidate of candidates) {
    const authName = pickString(candidate, ['auth_name', 'authName', 'username']);
    if (authName) return authName;
  }

  return undefined;
}

function normalizeMemberStatusFromRaw(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';

  const src = raw as Record<string, unknown>;
  const profile = src.profile && typeof src.profile === 'object' ? src.profile as Record<string, unknown> : null;
  const userObj = src.user && typeof src.user === 'object' ? src.user as Record<string, unknown> : null;

  const candidate =
    pickString(src, ['status', 'stats']) ||
    (profile ? pickString(profile, ['status', 'stats']) : undefined) ||
    (userObj ? pickString(userObj, ['status', 'stats']) : undefined) ||
    '';

  return candidate.trim().toLowerCase();
}

function isVisibleMemberRaw(raw: unknown): boolean {
  return normalizeMemberStatusFromRaw(raw) !== 'banned';
}

function formatEndDateTime(startTime?: string, keepDurationMs?: number, locale?: Locale): string {
  if (!startTime || typeof keepDurationMs !== 'number' || !Number.isFinite(keepDurationMs)) return '-';
  const startTimestamp = Date.parse(startTime);
  if (!Number.isFinite(startTimestamp)) return '-';

  const endTimestamp = startTimestamp + Math.max(0, keepDurationMs);
  return formatDateTime(new Date(endTimestamp).toISOString(), locale);
}

function formatMeetingStatus(status: string | undefined, t: (key: string) => string): { cls: string; label: string } {
  if (status === 'booked') {
    return { cls: 'mm-badge-info', label: t('meetings.statusFilter.booked') };
  }

  const badge = meetingStatusBadge(status, {
    booked: t('meetings.statusFilter.booked'),
    held: t('status.held'),
    closed: t('status.closed'),
    created: t('status.created'),
    deleted: t('status.deleted'),
  });

  return badge;
}

function normalizeMeetingStatus(status?: string): string {
  return (status ?? '').trim().toLowerCase();
}

interface MeetingsPageClientProps {
  onlyEnterable?: boolean;
}

export function MeetingsPageClient({ onlyEnterable = true }: MeetingsPageClientProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [ownerNameMap, setOwnerNameMap] = useState<Record<string, string>>({});
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [reloadTick, setReloadTick] = useState(0);
  const [deletingMeeting, setDeletingMeeting] = useState<MeetingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memberCountMap, setMemberCountMap] = useState<Record<string, number | null>>({});

  const isHistoryMode = !onlyEnterable;

  useEffect(() => {
    let cancelled = false;

    async function fetchMeetings() {
      setLoading(true);

      try {
        const offset = (currentPage - 1) * pageSize;
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(pageSize),
          order_by: 'creation_time',
          order: 'desc',
        });

        if (isHistoryMode) {
          if (statusFilter === 'all') {
            params.append('status', 'closed');
            params.append('status', 'deleted');
          } else {
            params.append('status', statusFilter);
          }
        } else if (statusFilter === 'all') {
          params.append('status', 'booked');
          params.append('status', 'held');
        } else {
          params.append('status', statusFilter);
        }

        const keyword = query.trim();
        if (keyword) {
          params.append('search_keyword', keyword);
        }

        const res = await apiGet<unknown>(`/svc/meeting/meetings?${params.toString()}`);
        if (cancelled) return;

        const normalized = normalizeMeetingListResponse(res);
        setMeetings(normalized.items);
        setTotalCount(normalized.totalCount);
        setMemberCountMap({});
      } catch {
        if (cancelled) return;
        setMeetings([]);
        setTotalCount(0);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    fetchMeetings();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, query, statusFilter, reloadTick, onlyEnterable, isHistoryMode]);

  // 목록 변경 시 각 미팅의 참석자 수 비동기 조회
  useEffect(() => {
    if (meetings.length === 0) return;
    let cancelled = false;

    async function fetchMemberCounts() {
      await Promise.all(
        meetings
          .filter(m => !!m.meeting_id)
          .map(async m => {
            const id = m.meeting_id!;
            try {
              const res = await apiGet<unknown>(
                `/api/meeting/v1/members?meeting_id=${encodeURIComponent(id)}&limit=300&status=vacated`
              );
              if (cancelled) return;
              const root = res as Record<string, unknown>;
              const result = root.result && typeof root.result === 'object'
                ? root.result as Record<string, unknown>
                : null;
              const items = result?.items && Array.isArray(result.items) ? result.items : [];
              const count = items.filter(isVisibleMemberRaw).length;
              setMemberCountMap(prev => ({ ...prev, [id]: count }));
            } catch {
              if (!cancelled) setMemberCountMap(prev => ({ ...prev, [id]: null }));
            }
          })
      );
    }

    void fetchMemberCounts();
    return () => { cancelled = true; };
  }, [meetings]);

  useEffect(() => {
    let cancelled = false;

    async function resolveOwnerNames() {
      const ownerIds = Array.from(
        new Set(
          meetings
            .map(meeting => meeting.owner_id?.trim())
            .filter((ownerId): ownerId is string => !!ownerId)
        )
      );

      const unresolvedOwnerIds = ownerIds.filter(
        ownerId => !Object.prototype.hasOwnProperty.call(ownerNameMap, ownerId)
      );

      if (unresolvedOwnerIds.length === 0) return;

      const resolvedEntries = await Promise.all(
        unresolvedOwnerIds.map(async ownerId => {
          try {
            const res = await apiGet<unknown>(`/svc/user/users?uuid=${encodeURIComponent(ownerId)}&limit=1`);
            const authName = pickFirstUserAuthName(res);
            return [ownerId, authName ?? ''] as const;
          } catch {
            return [ownerId, ''] as const;
          }
        })
      );

      if (cancelled) return;

      setOwnerNameMap(prev => {
        const next = { ...prev };
        for (const [ownerId, authName] of resolvedEntries) {
          next[ownerId] = authName;
        }
        return next;
      });
    }

    resolveOwnerNames();
    return () => {
      cancelled = true;
    };
  }, [meetings, ownerNameMap]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const rowStart = (safeCurrentPage - 1) * pageSize;

  const pageNumbers = useMemo(() => {
    const blockSize = 10;
    const blockStart = Math.floor((safeCurrentPage - 1) / blockSize) * blockSize + 1;
    const blockEnd = Math.min(totalPages, blockStart + blockSize - 1);
    return Array.from({ length: blockEnd - blockStart + 1 }, (_, idx) => blockStart + idx);
  }, [safeCurrentPage, totalPages]);

  const goToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
  };

  const submitSearch = () => {
    setCurrentPage(1);
    setQuery(queryInput.trim());
  };

  const resetSearch = () => {
    setCurrentPage(1);
    setQueryInput('');
    setQuery('');
    setStatusFilter('all');
  };

  const canEditMeeting = (meeting: MeetingItem): boolean => {
    if (isHistoryMode) return false;
    const normalizedStatus = normalizeMeetingStatus(meeting.status);
    if (!normalizedStatus || !EDITABLE_MEETING_STATUSES.has(normalizedStatus)) return false;

    // 사전 입장 가능 시간이 이미 시작됐으면 수정 불가
    if (meeting.start_time) {
      const startTs = Date.parse(meeting.start_time);
      const preEntering = meeting.pre_entering_duration ?? 300000; // 기본 5분
      const now = new Date().getTime();
      if (Number.isFinite(startTs) && now >= startTs - preEntering) return false;
    }

    return true;
  };

  const canAttendMeeting = (meeting: MeetingItem): boolean => {
    if (isHistoryMode) return false;
    return meeting.status === 'booked' || meeting.status === 'held';
  };

  const onAttendMeeting = (meeting: MeetingItem) => {
    if (!meeting.meeting_id) {
      addToast('warning', t('meetings.detailNotFoundTitle'));
      return;
    }

    // TODO: 참석 기능 재오픈 시 아래 흐름(check-enterable/prepare-enter/redirect)을 복구한다.
    addToast('info', t('meetings.attendNotReadyTitle'), t('meetings.attendNotReadyMessage'));
  };

  const buildMeetingContextQuery = (): string => {
    const params = new URLSearchParams();
    params.set('page', String(safeCurrentPage));
    params.set('pageSize', String(pageSize));
    params.set('status', statusFilter);
    if (query.trim()) params.set('q', query.trim());
    if (isHistoryMode) params.set('source', 'history');
    return params.toString();
  };

  const buildMeetingDetailHref = (meetingId: string): string => {
    const qs = buildMeetingContextQuery();
    const base = `/meetings/${encodeURIComponent(meetingId)}`;
    return qs ? `${base}?${qs}` : base;
  };

  const buildMeetingEditHref = (meetingId: string): string => {
    const qs = buildMeetingContextQuery();
    const base = `/meetings/${encodeURIComponent(meetingId)}/edit`;
    return qs ? `${base}?${qs}` : base;
  };

  const onEditMeeting = (meeting: MeetingItem) => {
    if (!meeting.meeting_id) {
      addToast('warning', t('meetings.editNotFoundTitle'));
      return;
    }
    if (!canEditMeeting(meeting)) {
      addToast('warning', t('meetings.editPolicyTitle'), t('meetings.editPolicyReservedOnly'));
      return;
    }

    router.push(buildMeetingEditHref(meeting.meeting_id));
  };

  const submitDelete = async () => {
    if (!deletingMeeting?.meeting_id) return;

    try {
      setDeleting(true);
      await apiDelete(`/api/meeting/v1/meetings/${encodeURIComponent(deletingMeeting.meeting_id)}`);
      addToast('success', t('meetings.deleteSuccessTitle'));
      setDeletingMeeting(null);
      setDeleting(false);

      if (meetings.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else {
        setReloadTick(v => v + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.deleteFailedTitle'), message);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mm-card mm-search-tools-card" style={{ marginBottom: 12 }}>
        <div className="mm-card-header mm-search-tools-header">
          <span className="mm-card-title">{t('meetings.searchTools')}</span>
          {!isHistoryMode && (
            <Link href="/meetings/new" className="mm-btn mm-btn-primary mm-btn-sm">
              <i className="bi bi-calendar-plus" />
              {t('meetings.create')}
            </Link>
          )}
        </div>
        <div className="mm-card-body mm-search-tools-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="mm-search-tools-controls">
            <select
              className="mm-form-control"
              style={{ width: 180, flex: '0 0 180px' }}
              value={statusFilter}
              onChange={e => {
                setCurrentPage(1);
                setStatusFilter(e.target.value as MeetingStatusFilter);
              }}
            >
              <option value="all">{t('meetings.statusFilter.all')}</option>
              {!isHistoryMode && (
                <>
                  <option value="booked">{t('meetings.statusFilter.booked')}</option>
                  <option value="held">{t('meetings.statusFilter.held')}</option>
                </>
              )}
              {isHistoryMode && (
                <>
                  <option value="closed">{t('meetings.statusFilter.closed')}</option>
                  <option value="deleted">{t('meetings.statusFilter.deleted')}</option>
                </>
              )}
            </select>

            <div className="mm-search-wrap mm-search-tools-input-wrap">
              <i className="bi bi-search" />
              <input
                className="mm-search-input"
                style={{ width: '100%' }}
                placeholder={t('meetings.searchPlaceholder')}
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitSearch();
                }}
              />
            </div>

            <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitSearch}>
              {t('meetings.search')}
            </button>
            <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" onClick={resetSearch}>
              {t('meetings.reset')}
            </button>
          </div>
        </div>
      </div>

      <div className="mm-table-wrap">
        <div className="mm-card-header">
          <span className="mm-card-title">{t('meetings.listTitle')} ({t('meetings.totalCount')}: {formatNumber(totalCount, locale)})</span>
          <select
            className="mm-form-control"
            style={{ width: 150, minWidth: 150 }}
            value={String(pageSize)}
            onChange={e => {
              setCurrentPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value="10">{t('meetings.perPage10')}</option>
            <option value="20">{t('meetings.perPage20')}</option>
            <option value="50">{t('meetings.perPage50')}</option>
            <option value="100">{t('meetings.perPage100')}</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        ) : meetings.length === 0 ? (
          <div className="mm-empty-state">
            <i className="bi bi-camera-video-off" />
            <p>{query.trim() ? t('meetings.noSearchResults') : t('meetings.empty')}</p>
          </div>
        ) : (
          <>
            <table className="mm-table mm-meetings-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th className="mm-col-no" style={{ minWidth: 56 }}>{t('meetings.columns.no')}</th>
                  <th className="mm-col-meeting-name" style={{ minWidth: 180 }}>{t('meetings.columns.meetingName')}</th>
                  <th className="mm-col-status" style={{ minWidth: 130 }}>{t('meetings.columns.status')}</th>
                  <th className="mm-col-owner" style={{ minWidth: 180 }}>{t('meetings.columns.ownerId')}</th>
                  <th className="mm-col-started-at" style={{ minWidth: 170 }}>{t('meetings.columns.startedAt')}</th>
                  <th className="mm-col-ended-at" style={{ minWidth: 150 }}>{t('meetings.columns.keepDuration')}</th>
                  <th className="mm-col-member-max" style={{ minWidth: 140 }}>{t('meetings.columns.memberMax')}</th>
                  {!isHistoryMode && (
                    <th className="mm-col-actions" style={{ minWidth: 120, textAlign: 'center' }}>{t('meetings.columns.actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting, idx) => {
                  const badge = formatMeetingStatus(meeting.status, t);
                  const ownerLabel = (meeting.owner_id && ownerNameMap[meeting.owner_id]) || meeting.owner_id || '-';
                  const endDateTime = formatEndDateTime(meeting.start_time, meeting.progress_duration, locale);
                  const canEdit = canEditMeeting(meeting);
                  const canAttend = canAttendMeeting(meeting);

                  return (
                    <tr
                      key={meeting.meeting_id ?? `${meeting.name ?? 'meeting'}-${idx}`}
                      style={{ cursor: meeting.meeting_id ? 'pointer' : undefined }}
                      onClick={() => {
                        if (meeting.meeting_id) router.push(buildMeetingDetailHref(meeting.meeting_id));
                      }}
                    >
                      <td className="mm-col-no" style={{ color: 'var(--mm-text-secondary)' }}>{rowStart + idx + 1}</td>
                      <td className="mm-col-meeting-name">
                        <span className="mm-cell-ellipsis" style={{ fontWeight: 500, display: 'inline-block', width: '100%' }}>
                          {meeting.name || '-'}
                        </span>
                      </td>
                      <td className="mm-col-status"><span className={`mm-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td className="mm-col-owner" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{ownerLabel}</span></td>
                      <td className="mm-col-started-at" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{formatDateTime(meeting.start_time, locale)}</span></td>
                      <td className="mm-col-ended-at" style={{ color: 'var(--mm-text-secondary)' }}><span className="mm-cell-ellipsis">{endDateTime}</span></td>
                      <td className="mm-col-member-max" style={{ color: 'var(--mm-text-secondary)' }}>
                        <span className="mm-cell-ellipsis">
                          {(() => {
                            const invited = meeting.member_max == null || meeting.member_max === 0 ? '∞' : meeting.member_max;
                            const current = meeting.meeting_id ? memberCountMap[meeting.meeting_id] : undefined;
                            const currentLabel = current == null ? '-' : current;
                            return `${currentLabel} / ${invited}`;
                          })()}
                        </span>
                      </td>
                      {!isHistoryMode && (
                        <td className="mm-col-actions" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {canAttend && (
                              <button
                                type="button"
                                className="mm-btn mm-btn-secondary mm-btn-sm"
                                title={t('meetings.actionAttend')}
                                onClick={() => {
                                  onAttendMeeting(meeting);
                                }}
                              >
                                {t('meetings.actionAttend')}
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                className="mm-btn mm-btn-primary mm-btn-sm"
                                title={t('meetings.actionEdit')}
                                onClick={() => onEditMeeting(meeting)}
                              >
                                {t('meetings.actionEdit')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="mm-btn mm-btn-danger mm-btn-sm"
                              title={t('meetings.actionDelete')}
                              onClick={() => setDeletingMeeting(meeting)}
                            >
                              {t('meetings.actionDelete')}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
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
                  {t('meetings.paginationFirst')}
                </button>
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                >
                  {t('meetings.paginationPrev')}
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
                  {t('meetings.paginationNext')}
                </button>
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                >
                  {t('meetings.paginationLast')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={!isHistoryMode && !!deletingMeeting}
        title={t('meetings.deleteConfirmTitle')}
        message={t('meetings.deleteConfirmMessage')}
        confirmLabel={deleting ? t('meetings.deleteDeleting') : t('meetings.deleteConfirmButton')}
        cancelLabel={t('meetings.deleteCancelButton')}
        danger
        onCancel={() => {
          if (deleting) return;
          setDeletingMeeting(null);
        }}
        onConfirm={submitDelete}
      />
    </>
  );
}

export default function MeetingsPage() {
  return <MeetingsPageClient onlyEnterable />;
}
