'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';

interface CreateMeetingRequest {
  name: string;
  start_time: string;
  progress_duration: number;
  pre_entering_duration: number;
  member_max: number;
  entry_option: 'unlimited' | 'registered';
  password?: string;
  password_checking?: boolean;
}

type RoleName = 'host' | 'participant' | 'presenter' | 'manager';

const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'host', label: '진행자' },
  { value: 'participant', label: '참석자' },
  { value: 'presenter', label: '발표자' },
  { value: 'manager', label: '매니저' },
];

interface UpdateMembersRequestItem {
  user_id: string;
  role_name: RoleName;
  nickname: string;
  profile: {
    user_name: string;
  };
}

interface UpdateMembersRequest {
  method: 'set';
  items: UpdateMembersRequestItem[];
}

interface PendingMemberSync {
  meetingId: string;
  items: UpdateMembersRequestItem[];
}

interface InviteUserItem {
  user_id: string;
  auth_name: string;
  user_name: string;
  phone_number: string;
  email: string;
}

function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function splitDatetimeLocal(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function combineDateAndTime(date: string, time: string): string {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function addMinutes(dateValue: string, minutes: number): string {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMinutes(fallback.getMinutes() + minutes);
    return toDatetimeLocalValue(fallback);
  }

  base.setMinutes(base.getMinutes() + minutes);
  return toDatetimeLocalValue(base);
}

function parseDateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function pickString(src: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeInviteUser(raw: unknown): InviteUserItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const src = raw as Record<string, unknown>;
  const userId = pickString(src, ['user_id', 'uuid', 'id']);
  const authName = pickString(src, ['auth_name', 'authName', 'username']);
  if (!userId && !authName) return null;

  return {
    user_id: userId || authName,
    auth_name: authName || '-',
    user_name: pickString(src, ['user_name', 'userName', 'name']) || '-',
    phone_number: pickString(src, ['phone_number', 'phoneNumber', 'phone']) || '-',
    email: pickString(src, ['email']) || '-',
  };
}

function normalizeUserList(payload: unknown): { items: InviteUserItem[]; totalCount: number } {
  if (!payload || typeof payload !== 'object') return { items: [], totalCount: 0 };

  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === 'object'
    ? root.result as Record<string, unknown>
    : null;

  const rawItems =
    (result?.items && Array.isArray(result.items) ? result.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  const items = rawItems
    .map(normalizeInviteUser)
    .filter((item): item is InviteUserItem => !!item);

  const totalCandidate =
    (typeof result?.total_count === 'number' ? result.total_count : null) ??
    (typeof result?.totalCount === 'number' ? result.totalCount : null) ??
    (typeof root.total_count === 'number' ? root.total_count : null) ??
    (typeof root.totalCount === 'number' ? root.totalCount : null);

  return {
    items,
    totalCount: typeof totalCandidate === 'number' ? totalCandidate : items.length,
  };
}

function extractMeetingIdFromCreateResponse(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';

  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === 'object'
    ? root.result as Record<string, unknown>
    : null;

  return (
    (result ? pickString(result, ['meeting_id', 'meetingId', 'uuid', 'id']) : '') ||
    pickString(root, ['meeting_id', 'meetingId', 'uuid', 'id'])
  );
}

function toMemberSyncItems(users: InviteUserItem[], roles: Record<string, RoleName>): UpdateMembersRequestItem[] {
  return users.map(user => ({
    user_id: user.user_id,
    role_name: roles[user.user_id] ?? 'participant',
    nickname: user.auth_name,
    profile: {
      user_name: user.auth_name,
    },
  }));
}

async function syncMeetingMembers(meetingId: string, items: UpdateMembersRequestItem[]): Promise<void> {
  if (!items.length) return;

  const payload: UpdateMembersRequest = {
    method: 'set',
    items,
  };

  await apiPut(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/members`, payload);
}

export default function MeetingCreatePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { addToast } = useToast();

  const defaultStart = new Date();
  defaultStart.setMinutes(defaultStart.getMinutes() + 10);
  const defaultStartValue = toDatetimeLocalValue(defaultStart);
  const defaultEndValue = addMinutes(defaultStartValue, 60);
  const defaultStartParts = splitDatetimeLocal(defaultStartValue);
  const defaultEndParts = splitDatetimeLocal(defaultEndValue);

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(defaultStartParts.date);
  const [startClock, setStartClock] = useState(defaultStartParts.time);
  const [endDate, setEndDate] = useState(defaultEndParts.date);
  const [endClock, setEndClock] = useState(defaultEndParts.time);
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public');
  const [limitMode, setLimitMode] = useState<'unlimited' | 'custom'>('unlimited');
  const [memberMax, setMemberMax] = useState(30);
  const [preEnteringMinutes, setPreEnteringMinutes] = useState(5);
  const [password, setPassword] = useState('');

  const [invitedUsers, setInvitedUsers] = useState<InviteUserItem[]>([]);
  const [inviteSearchInput, setInviteSearchInput] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitePage, setInvitePage] = useState(1);
  const invitePageSize = 5;

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userQueryInput, setUserQueryInput] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalCount, setUserTotalCount] = useState(0);
  const [userItems, setUserItems] = useState<InviteUserItem[]>([]);
  const userPageSize = 8;

  const [memberRoles, setMemberRoles] = useState<Record<string, RoleName>>({});

  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailInviteInput, setMailInviteInput] = useState('');
  const [pendingMemberSync, setPendingMemberSync] = useState<PendingMemberSync | null>(null);

  const startTime = useMemo(() => combineDateAndTime(startDate, startClock), [startDate, startClock]);
  const endTime = useMemo(() => combineDateAndTime(endDate, endClock), [endDate, endClock]);

  const durationMinutes = useMemo(() => {
    const startTs = parseDateValue(startTime);
    const endTs = parseDateValue(endTime);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return 0;
    return Math.floor((endTs - startTs) / 60000);
  }, [startTime, endTime]);

  useEffect(() => {
    if (!userModalOpen) return;

    let cancelled = false;

    async function fetchUsers() {
      setUserModalLoading(true);

      try {
        const keyword = userQuery.trim();
        const shouldFilterClientSide = keyword.length > 0;
        const offset = shouldFilterClientSide ? 0 : (userPage - 1) * userPageSize;
        const limit = shouldFilterClientSide ? 300 : userPageSize;
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(limit),
          order_by: 'creation_time',
          order: 'desc',
        });

        if (keyword) {
          params.append('auth_name', keyword);
        }

        const res = await apiGet<unknown>(`/svc/user/users?${params.toString()}`);
        if (cancelled) return;

        const normalized = normalizeUserList(res);

        if (!shouldFilterClientSide) {
          setUserItems(normalized.items);
          setUserTotalCount(normalized.totalCount);
          return;
        }

        const lowerKeyword = keyword.toLowerCase();
        const filtered = normalized.items.filter(user => {
          return user.auth_name.toLowerCase().includes(lowerKeyword);
        });

        const start = (userPage - 1) * userPageSize;
        const paged = filtered.slice(start, start + userPageSize);
        setUserItems(paged);
        setUserTotalCount(filtered.length);
      } catch {
        if (cancelled) return;
        setUserItems([]);
        setUserTotalCount(0);
      } finally {
        if (cancelled) return;
        setUserModalLoading(false);
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [userModalOpen, userPage, userQuery]);

  const filteredInvitedUsers = useMemo(() => {
    const keyword = inviteSearch.trim().toLowerCase();
    if (!keyword) return invitedUsers;

    return invitedUsers.filter(user => {
      return user.auth_name.toLowerCase().includes(keyword);
    });
  }, [invitedUsers, inviteSearch]);

  const inviteTotalPages = Math.max(1, Math.ceil(filteredInvitedUsers.length / invitePageSize));
  const safeInvitePage = Math.min(invitePage, inviteTotalPages);
  const pagedInvitedUsers = filteredInvitedUsers.slice((safeInvitePage - 1) * invitePageSize, safeInvitePage * invitePageSize);

  const userTotalPages = Math.max(1, Math.ceil(userTotalCount / userPageSize));
  const safeUserPage = Math.min(userPage, userTotalPages);
  const invitePopupMissingRows = Math.max(0, userPageSize - userItems.length);
  const invitePopupFillerHeight = invitePopupMissingRows * 63;

  const isPrivateRoom = roomVisibility === 'private';
  const isCustomLimit = limitMode === 'custom';
  const disabledBySubmit = submitting || !!pendingMemberSync;

  const submitInviteSearch = () => {
    setInvitePage(1);
    setInviteSearch(inviteSearchInput.trim());
  };

  const submitUserSearch = () => {
    setUserPage(1);
    setUserQuery(userQueryInput.trim());
  };

  const addInvitedUser = (user: InviteUserItem) => {
    setInvitedUsers(prev => {
      if (prev.some(item => item.user_id === user.user_id)) {
        return prev;
      }
      return [user, ...prev];
    });
    setMemberRoles(prev => ({ ...prev, [user.user_id]: 'participant' }));
    addToast('success', '참석자가 추가되었습니다.');
  };

  const removeInvitedUser = (userId: string) => {
    setInvitedUsers(prev => prev.filter(user => user.user_id !== userId));
    setMemberRoles(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const submitMailInvite = () => {
    const value = mailInviteInput.trim();
    if (!value) {
      addToast('warning', '초대할 메일을 입력해주세요.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      addToast('warning', '올바른 메일 형식을 입력해주세요.');
      return;
    }

    addToast('success', '메일 초대가 등록되었습니다.', value);
    setMailInviteInput('');
    setMailModalOpen(false);
  };

  async function retryMemberSync() {
    if (!pendingMemberSync) return;

    try {
      setSubmitting(true);
      await syncMeetingMembers(pendingMemberSync.meetingId, pendingMemberSync.items);
      setPendingMemberSync(null);
      addToast('success', '참석자 초대가 완료되었습니다.');
      router.push('/meetings');
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', '참석자 초대 재시도에 실패했습니다.', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (pendingMemberSync) {
      addToast('warning', '미팅은 이미 생성되었습니다. 참석자 초대를 재시도해주세요.');
      return;
    }

    const safeName = name.trim();
    const safePassword = password.trim();
    const startTs = parseDateValue(startTime);
    const endTs = parseDateValue(endTime);

    if (!safeName) {
      addToast('warning', t('meetings.createForm.requiredName'));
      return;
    }

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      addToast('warning', '종료일시는 시작일시 이후여야 합니다.');
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      addToast('warning', t('meetings.createForm.invalidDuration'));
      return;
    }

    if (isCustomLimit && (!Number.isFinite(memberMax) || memberMax < 1)) {
      addToast('warning', t('meetings.createForm.invalidMemberMax'));
      return;
    }

    if (isPrivateRoom && !safePassword) {
      addToast('warning', '비공개 설정 시 룸 비밀번호를 입력해주세요.');
      return;
    }

    const payload: CreateMeetingRequest = {
      name: safeName,
      start_time: new Date(startTs).toISOString(),
      progress_duration: Math.floor(endTs - startTs),
      pre_entering_duration: Math.max(0, Math.floor(preEnteringMinutes)) * 60000,
      member_max: isCustomLimit ? Math.floor(memberMax) : 0,
      entry_option: isPrivateRoom ? 'registered' : 'unlimited',
    };

    if (isPrivateRoom && safePassword) {
      payload.password = safePassword;
      payload.password_checking = true;
    }

    try {
      setSubmitting(true);
      const createRes = await apiPost<unknown>('/api/meeting/v1/meetings', payload);
      const createdMeetingId = extractMeetingIdFromCreateResponse(createRes);

      if (createdMeetingId && invitedUsers.length > 0) {
        const syncItems = toMemberSyncItems(invitedUsers, memberRoles);
        try {
          await syncMeetingMembers(createdMeetingId, syncItems);
        } catch (err) {
          const message = err instanceof Error ? err.message : undefined;
          setPendingMemberSync({ meetingId: createdMeetingId, items: syncItems });
          setUserModalOpen(false);
          setMailModalOpen(false);
          addToast('warning', '미팅은 생성되었지만 참석자 초대에 실패했습니다.', message);
          return;
        }
      }

      addToast('success', t('meetings.createForm.createdTitle'), t('meetings.createForm.createdMessage'));
      router.push('/meetings');
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.createForm.createFailedTitle'), message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mm-meeting-create-page">
      <div className="mm-meeting-create-head">
        <div>
          <h2 className="mm-page-title">{t('meetings.createForm.title')}</h2>
          <p className="mm-page-subtitle">{t('meetings.createForm.subtitle')}</p>
        </div>
      </div>

      {pendingMemberSync && (
        <div className="mm-meeting-create-sync-warning" role="alert">
          <div>
            <p className="mm-meeting-create-sync-warning-title">미팅은 생성되었습니다.</p>
            <p className="mm-meeting-create-sync-warning-desc">참석자 초대 중 오류가 발생했습니다. 재시도를 눌러 다시 등록해 주세요.</p>
          </div>
          <div className="mm-meeting-create-sync-warning-actions">
            <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={retryMemberSync} disabled={submitting}>
              참석자 초대 재시도
            </button>
            <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" onClick={() => router.push('/meetings')} disabled={submitting}>
              목록으로 이동
            </button>
          </div>
        </div>
      )}

      <div className="mm-card mm-meeting-create-card">
        <form className="mm-card-body mm-meeting-create-body" onSubmit={onSubmit}>
          <div className="mm-meeting-create-layout">
            <section className="mm-meeting-create-right">
              <div className="mm-meeting-create-grid">
                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">미팅명</label>
                  <input
                    className="mm-form-control"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('meetings.createForm.placeholderName')}
                    autoComplete="off"
                    disabled={disabledBySubmit}
                  />
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">룸설정</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="mm-toggle-group">
                      <button
                        type="button"
                        className={`mm-toggle-item${roomVisibility === 'public' ? ' active' : ''}`}
                        onClick={() => setRoomVisibility('public')}
                        disabled={disabledBySubmit}
                      >
                        <i className={`bi ${roomVisibility === 'public' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        공개
                      </button>
                      <button
                        type="button"
                        className={`mm-toggle-item${roomVisibility === 'private' ? ' active' : ''}`}
                        onClick={() => setRoomVisibility('private')}
                        disabled={disabledBySubmit}
                      >
                        <i className={`bi ${roomVisibility === 'private' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        비공개
                      </button>
                    </div>
                    {isPrivateRoom && (
                      <input
                        type="password"
                        className="mm-form-control"
                        style={{ flex: 1, minWidth: 0 }}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('meetings.createForm.placeholderPassword')}
                        autoComplete="new-password"
                        disabled={disabledBySubmit}
                      />
                    )}
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">참석제한</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="mm-toggle-group">
                      <button
                        type="button"
                        className={`mm-toggle-item${limitMode === 'unlimited' ? ' active' : ''}`}
                        onClick={() => setLimitMode('unlimited')}
                        disabled={disabledBySubmit}
                      >
                        <i className={`bi ${limitMode === 'unlimited' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        기본(무제한)
                      </button>
                      <button
                        type="button"
                        className={`mm-toggle-item${limitMode === 'custom' ? ' active' : ''}`}
                        onClick={() => setLimitMode('custom')}
                        disabled={disabledBySubmit}
                      >
                        <i className={`bi ${limitMode === 'custom' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        직접설정
                      </button>
                    </div>
                    {isCustomLimit && (
                      <input
                        type="number"
                        min={1}
                        className="mm-form-control"
                        style={{ width: 80 }}
                        value={String(memberMax)}
                        onChange={e => setMemberMax(Number(e.target.value || 0))}
                        placeholder="인원 수"
                        disabled={disabledBySubmit}
                      />
                    )}
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">시작일시</label>
                  <div className="mm-datetime-split">
                    <div className="mm-datetime-control">
                      <input
                        type="date"
                        className="mm-form-control mm-datetime-input"
                        value={startDate}
                        onChange={e => {
                          const nextStartDate = e.target.value;
                          setStartDate(nextStartDate);

                          const nextStart = combineDateAndTime(nextStartDate, startClock);
                          const nextStartTs = parseDateValue(nextStart);
                          const endTs = parseDateValue(endTime);
                          if (Number.isFinite(nextStartTs) && Number.isFinite(endTs) && endTs <= nextStartTs) {
                            const adjustedEnd = splitDatetimeLocal(addMinutes(nextStart, 60));
                            setEndDate(adjustedEnd.date);
                            setEndClock(adjustedEnd.time);
                          }
                        }}
                        disabled={disabledBySubmit}
                      />
                    </div>
                    <div className="mm-datetime-control">
                      <input
                        type="time"
                        className="mm-form-control mm-datetime-input"
                        value={startClock}
                        onChange={e => {
                          const nextStartClock = e.target.value;
                          setStartClock(nextStartClock);

                          const nextStart = combineDateAndTime(startDate, nextStartClock);
                          const nextStartTs = parseDateValue(nextStart);
                          const endTs = parseDateValue(endTime);
                          if (Number.isFinite(nextStartTs) && Number.isFinite(endTs) && endTs <= nextStartTs) {
                            const adjustedEnd = splitDatetimeLocal(addMinutes(nextStart, 60));
                            setEndDate(adjustedEnd.date);
                            setEndClock(adjustedEnd.time);
                          }
                        }}
                        disabled={disabledBySubmit}
                      />
                    </div>
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">종료일시</label>
                  <div className="mm-datetime-split">
                    <div className="mm-datetime-control">
                      <input
                        type="date"
                        className="mm-form-control mm-datetime-input"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        disabled={disabledBySubmit}
                      />
                    </div>
                    <div className="mm-datetime-control">
                      <input
                        type="time"
                        className="mm-form-control mm-datetime-input"
                        value={endClock}
                        onChange={e => setEndClock(e.target.value)}
                        disabled={disabledBySubmit}
                      />
                    </div>
                  </div>
                  <p className="mm-form-hint">유지시간: {durationMinutes > 0 ? `${durationMinutes}분` : '-'}</p>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">사전 입장 허용 시간</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      className="mm-form-control"
                      style={{ width: 100 }}
                      min={0}
                      max={60}
                      value={preEnteringMinutes}
                      onChange={e => setPreEnteringMinutes(Math.max(0, Number(e.target.value || 0)))}
                      disabled={disabledBySubmit}
                    />
                    <span style={{ color: 'var(--mm-text-secondary)', fontSize: 14 }}>분 전부터 입장 가능</span>
                  </div>
                  <p className="mm-form-hint">회의 시작 전 미리 입장할 수 있는 시간입니다. (기본: 5분)</p>
                </div>
              </div>
            </section>

            <section className="mm-meeting-create-left">
              <div className="mm-meeting-create-section-head">
                <h3 className="mm-card-title">참석자 초대 생성</h3>
                <div className="mm-meeting-create-invite-actions">
                  <button
                    type="button"
                    className="mm-btn mm-btn-secondary mm-btn-sm"
                    onClick={() => setUserModalOpen(true)}
                    disabled={disabledBySubmit}
                  >
                    <i className="bi bi-people" />
                    참석자 초대
                  </button>
                  <button
                    type="button"
                    className="mm-btn mm-btn-secondary mm-btn-sm"
                    onClick={() => setMailModalOpen(true)}
                    disabled={disabledBySubmit}
                  >
                    <i className="bi bi-envelope" />
                    메일 초대
                  </button>
                </div>
              </div>

              <div className="mm-meeting-create-toolbar">
                <div className="mm-search-wrap mm-search-tools-input-wrap">
                  <i className="bi bi-search" />
                  <input
                    className="mm-search-input"
                    style={{ width: '100%' }}
                    placeholder="아이디(auth_name) 검색"
                    value={inviteSearchInput}
                    onChange={e => setInviteSearchInput(e.target.value)}
                    disabled={disabledBySubmit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitInviteSearch();
                      }
                    }}
                  />
                </div>
                <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitInviteSearch} disabled={disabledBySubmit}>검색</button>
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary mm-btn-sm"
                  disabled={disabledBySubmit}
                  onClick={() => {
                    setInvitePage(1);
                    setInviteSearchInput('');
                    setInviteSearch('');
                  }}
                >
                  초기화
                </button>
              </div>

              <div className="mm-table-wrap">
                <table className="mm-table mm-meeting-invite-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>아이디</th>
                      <th style={{ width: 110 }}>성명</th>
                      <th style={{ width: 130 }}>전화번호</th>
                      <th>메일주소</th>
                      <th style={{ width: 110 }}>권한</th>
                      <th style={{ width: 72, textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedInvitedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          등록된 참석자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      pagedInvitedUsers.map(user => (
                        <tr key={user.user_id}>
                          <td><span className="mm-cell-ellipsis">{user.auth_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{user.user_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{user.phone_number}</span></td>
                          <td><span className="mm-cell-ellipsis">{user.email}</span></td>
                          <td>
                            <select
                              className="mm-form-control"
                              style={{ fontSize: 13, padding: '4px 6px' }}
                              value={memberRoles[user.user_id] ?? 'participant'}
                              onChange={e => setMemberRoles(prev => ({ ...prev, [user.user_id]: e.target.value as RoleName }))}
                              disabled={disabledBySubmit}
                            >
                              {ROLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="mm-btn mm-btn-danger mm-btn-sm"
                              onClick={() => removeInvitedUser(user.user_id)}
                              disabled={disabledBySubmit}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="mm-pagination-wrap">
                  <div className="mm-pagination-edge mm-pagination-edge-left">
                    <button
                      type="button"
                      className="mm-btn mm-btn-secondary mm-btn-sm"
                      disabled={disabledBySubmit || safeInvitePage <= 1}
                      onClick={() => setInvitePage(prev => Math.max(1, prev - 1))}
                    >
                      이전
                    </button>
                  </div>

                  <div className="mm-pagination-pages">
                    <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" disabled>
                      {safeInvitePage}
                    </button>
                    <span style={{ color: 'var(--mm-text-secondary)', fontSize: 12 }}>/ {inviteTotalPages}</span>
                  </div>

                  <div className="mm-pagination-edge mm-pagination-edge-right">
                    <button
                      type="button"
                      className="mm-btn mm-btn-secondary mm-btn-sm"
                      disabled={disabledBySubmit || safeInvitePage >= inviteTotalPages}
                      onClick={() => setInvitePage(prev => Math.min(inviteTotalPages, prev + 1))}
                    >
                      다음
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mm-meeting-create-actions">
            <button
              type="button"
              className="mm-btn mm-btn-secondary"
              onClick={() => router.push('/meetings')}
              disabled={submitting}
            >
              {t('meetings.createForm.cancel')}
            </button>
            <button type="submit" className="mm-btn mm-btn-primary" disabled={disabledBySubmit}>
              {submitting ? t('meetings.createForm.submitting') : t('meetings.createForm.submit')}
            </button>
          </div>
        </form>
      </div>

      {submitting && (
        <div className="mm-meeting-create-overlay" role="status" aria-live="polite" aria-label="미팅 등록 중입니다.">
          <div className="mm-meeting-create-overlay-card">
            <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <p>미팅 등록 중입니다.</p>
          </div>
        </div>
      )}

      <Modal
        open={userModalOpen && !disabledBySubmit}
        title="참석자 초대"
        onClose={() => setUserModalOpen(false)}
        size="lg"
      >
        <div className="mm-table-wrap mm-invite-search-panel-wrap">
          <div className="mm-card-header mm-invite-search-panel-head">
            <div className="mm-meeting-create-toolbar">
              <div className="mm-search-wrap mm-search-tools-input-wrap">
                <i className="bi bi-search" />
                <input
                  className="mm-search-input"
                  style={{ width: '100%' }}
                  placeholder="아이디(auth_name) 검색"
                  value={userQueryInput}
                  onChange={e => setUserQueryInput(e.target.value)}
                  disabled={disabledBySubmit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitUserSearch();
                    }
                  }}
                />
              </div>
              <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitUserSearch} disabled={disabledBySubmit}>검색</button>
              <button
                type="button"
                className="mm-btn mm-btn-secondary mm-btn-sm"
                disabled={disabledBySubmit}
                onClick={() => {
                  setUserQueryInput('');
                  setUserQuery('');
                  setUserPage(1);
                }}
              >
                초기화
              </button>
            </div>
          </div>

          <div className="mm-invite-search-panel-body">
            {userModalLoading ? (
              <div className="mm-invite-search-loading">
                <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
              </div>
            ) : (
              <div className="mm-invite-search-panel">
                <div className="mm-invite-search-table-area">
                  <table className="mm-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 140 }}>아이디</th>
                        <th style={{ width: 120 }}>성명</th>
                        <th style={{ width: 130 }}>전화번호</th>
                        <th>메일주소</th>
                        <th style={{ width: 84, textAlign: 'center' }}>추가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)', height: 352 }}>
                            {userQuery.trim() ? '검색한 사용자가 없습니다.' : '조회된 사용자가 없습니다.'}
                          </td>
                        </tr>
                      ) : (
                        <>
                          {userItems.map(user => (
                            <tr key={user.user_id}>
                              <td><span className="mm-cell-ellipsis">{user.auth_name}</span></td>
                              <td><span className="mm-cell-ellipsis">{user.user_name}</span></td>
                              <td><span className="mm-cell-ellipsis">{user.phone_number}</span></td>
                              <td><span className="mm-cell-ellipsis">{user.email}</span></td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="mm-btn mm-btn-primary mm-btn-sm"
                                  onClick={() => addInvitedUser(user)}
                                  disabled={disabledBySubmit}
                                >
                                  추가
                                </button>
                              </td>
                            </tr>
                          ))}

                          {invitePopupFillerHeight > 0 && (
                            <tr className="mm-invite-filler-row" aria-hidden="true">
                              <td colSpan={5} style={{ height: invitePopupFillerHeight }} />
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mm-pagination-wrap" style={{ marginTop: 8 }}>
                  <div className="mm-pagination-edge mm-pagination-edge-left">
                    <button
                      type="button"
                      className="mm-btn mm-btn-secondary mm-btn-sm"
                      onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                      disabled={disabledBySubmit || safeUserPage <= 1}
                    >
                      이전
                    </button>
                  </div>

                  <div className="mm-pagination-pages">
                    <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" disabled>{safeUserPage}</button>
                    <span style={{ color: 'var(--mm-text-secondary)', fontSize: 12 }}>/ {userTotalPages}</span>
                  </div>

                  <div className="mm-pagination-edge mm-pagination-edge-right">
                    <button
                      type="button"
                      className="mm-btn mm-btn-secondary mm-btn-sm"
                      onClick={() => setUserPage(prev => Math.min(userTotalPages, prev + 1))}
                      disabled={disabledBySubmit || safeUserPage >= userTotalPages}
                    >
                      다음
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={mailModalOpen && !disabledBySubmit}
        title="메일 초대"
        onClose={() => setMailModalOpen(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" onClick={() => setMailModalOpen(false)} disabled={disabledBySubmit}>취소</button>
            <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitMailInvite} disabled={disabledBySubmit}>등록</button>
          </>
        }
      >
        <label className="mm-form-label">초대 메일주소</label>
        <input
          className="mm-form-control"
          type="email"
          value={mailInviteInput}
          onChange={e => setMailInviteInput(e.target.value)}
          disabled={disabledBySubmit}
          placeholder="invite@example.com"
          autoComplete="off"
        />
      </Modal>
    </section>
  );
}
