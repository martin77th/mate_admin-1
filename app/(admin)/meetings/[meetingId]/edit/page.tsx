'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';
import Modal from '@/components/Modal';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';
import {
  addMinutes,
  combineDateAndTime,
  fetchMeetingById,
  parseDateValue,
  splitDatetimeLocal,
  toDatetimeLocalValue,
} from '../../_shared';

interface UpdateMeetingRequest {
  name: string;
  start_time: string;
  progress_duration: number;
  member_max: number;
  entry_option: 'unlimited' | 'registered';
  password?: string;
}

interface MeetingMemberItem {
  user_id: string;
  auth_name: string;
  user_name: string;
  phone_number: string;
  email: string;
}

interface UserSearchItem {
  user_id: string;
  auth_name: string;
  user_name: string;
  phone_number: string;
  email: string;
}

interface UpdateMembersRequestItem {
  user_id: string;
  role_name: 'participant';
  nickname: string;
  profile: {
    user_name: string;
  };
}

interface UpdateMembersRequest {
  method: 'add' | 'remove';
  items: UpdateMembersRequestItem[];
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

function normalizeMeetingMember(raw: unknown): MeetingMemberItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const src = raw as Record<string, unknown>;
  const profile = src.profile && typeof src.profile === 'object'
    ? src.profile as Record<string, unknown>
    : null;

  const userId = pickString(src, ['user_id', 'userId', 'uuid', 'id']);
  const authName = pickString(src, ['auth_name', 'authName', 'nickname', 'user_name', 'userName']);

  if (!userId && !authName) return null;

  return {
    user_id: userId || authName,
    auth_name: authName || '-',
    user_name: pickString(src, ['user_name', 'userName']) || (profile ? pickString(profile, ['user_name', 'userName']) : '') || '-',
    phone_number: pickString(src, ['phone_number', 'phoneNumber', 'phone']) || (profile ? pickString(profile, ['phone_number', 'phoneNumber', 'phone']) : '') || '-',
    email: pickString(src, ['email']) || (profile ? pickString(profile, ['email']) : '') || '-',
  };
}

function normalizeMeetingMemberList(payload: unknown): MeetingMemberItem[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === 'object'
    ? root.result as Record<string, unknown>
    : null;

  const rawItems =
    (result?.items && Array.isArray(result.items) ? result.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  return rawItems
    .map(normalizeMeetingMember)
    .filter((item): item is MeetingMemberItem => !!item);
}

function normalizeUserSearchItem(raw: unknown): UserSearchItem | null {
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

function normalizeUserList(payload: unknown): { items: UserSearchItem[]; totalCount: number } {
  if (!payload || typeof payload !== 'object') return { items: [], totalCount: 0 };

  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === 'object'
    ? root.result as Record<string, unknown>
    : null;

  const rawItems =
    (result?.items && Array.isArray(result.items) ? result.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  const items = rawItems
    .map(normalizeUserSearchItem)
    .filter((item): item is UserSearchItem => !!item);

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

function toMemberPayloadItem(user: { user_id: string; auth_name: string }): UpdateMembersRequestItem {
  return {
    user_id: user.user_id,
    role_name: 'participant',
    nickname: user.auth_name,
    profile: {
      user_name: user.auth_name,
    },
  };
}

export default function MeetingEditPage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { addToast } = useToast();

  const meetingId = decodeURIComponent(params.meetingId ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public');
  const [limitMode, setLimitMode] = useState<'unlimited' | 'custom'>('unlimited');
  const [memberMax, setMemberMax] = useState(0);
  const [password, setPassword] = useState('');
  const [meetingMembers, setMeetingMembers] = useState<MeetingMemberItem[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMutating, setMemberMutating] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userQueryInput, setUserQueryInput] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalCount, setUserTotalCount] = useState(0);
  const [userItems, setUserItems] = useState<UserSearchItem[]>([]);
  const userPageSize = 8;

  const startTime = useMemo(() => combineDateAndTime(startDate, startClock), [startDate, startClock]);
  const endTime = useMemo(() => combineDateAndTime(endDate, endClock), [endDate, endClock]);
  const durationMinutes = useMemo(() => {
    const startTs = parseDateValue(startTime);
    const endTs = parseDateValue(endTime);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return 0;
    return Math.floor((endTs - startTs) / 60000);
  }, [startTime, endTime]);

  const returnToDetailHref = useMemo(() => {
    if (!meetingId) return '/meetings';
    const detailParams = new URLSearchParams();
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    if (page) detailParams.set('page', page);
    if (pageSize) detailParams.set('pageSize', pageSize);
    if (status) detailParams.set('status', status);
    if (q) detailParams.set('q', q);

    const qs = detailParams.toString();
    const base = `/meetings/${encodeURIComponent(meetingId)}`;
    return qs ? `${base}?${qs}` : base;
  }, [meetingId, searchParams]);

  const returnToListHref = useMemo(() => {
    const listParams = new URLSearchParams();
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    if (page) listParams.set('page', page);
    if (pageSize) listParams.set('pageSize', pageSize);
    if (status) listParams.set('status', status);
    if (q) listParams.set('q', q);

    const qs = listParams.toString();
    return qs ? `/meetings?${qs}` : '/meetings';
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeeting() {
      if (!meetingId) {
        addToast('error', t('meetings.editLoadFailedTitle'));
        router.push('/meetings');
        return;
      }

      setLoading(true);
      try {
        const item = await fetchMeetingById(meetingId);
        if (cancelled) return;

        if (!item || item.meeting_id !== meetingId) {
          addToast('warning', t('meetings.editNotFoundTitle'));
          router.push('/meetings');
          return;
        }

        if (item.status !== 'booked') {
          addToast('warning', t('meetings.editPolicyTitle'), t('meetings.editPolicyReservedOnly'));
          router.push(returnToDetailHref);
          return;
        }

        const startValue = item.start_time
          ? toDatetimeLocalValue(new Date(item.start_time))
          : toDatetimeLocalValue(new Date());
        const progressMinutes = Math.max(1, Math.floor((item.progress_duration ?? 0) / 60000));
        const endValue = addMinutes(startValue, progressMinutes);
        const startParts = splitDatetimeLocal(startValue);
        const endParts = splitDatetimeLocal(endValue);

        setName(item.name ?? '');
        setStartDate(startParts.date);
        setStartClock(startParts.time);
        setEndDate(endParts.date);
        setEndClock(endParts.time);
        setRoomVisibility((item.entry_option === 'registered' || !!item.password_checking) ? 'private' : 'public');
        setLimitMode((item.member_max ?? 0) > 0 ? 'custom' : 'unlimited');
        setMemberMax(Math.max(0, item.member_max ?? 0));
        setPassword(item.password ?? '');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : undefined;
        addToast('error', t('meetings.editLoadFailedTitle'), message);
        router.push('/meetings');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    fetchMeeting();
    return () => {
      cancelled = true;
    };
  }, [addToast, meetingId, returnToDetailHref, router, t]);

  async function queryMeetingMembers(targetMeetingId: string): Promise<MeetingMemberItem[]> {
    const encodedMeetingId = encodeURIComponent(targetMeetingId);
    const queries = [
      `/api/meeting/v1/members?meeting_id=${encodedMeetingId}&limit=300`,
      `/api/meeting/v1/members?meetingId=${encodedMeetingId}&limit=300`,
      `/api/meeting/v1/members?uuid=${encodedMeetingId}&limit=300`,
    ];

    let resolved: MeetingMemberItem[] = [];
    for (const query of queries) {
      try {
        const res = await apiGet<unknown>(query);
        const normalized = normalizeMeetingMemberList(res);
        if (normalized.length > 0) {
          resolved = normalized;
          break;
        }

        if (!resolved.length) {
          resolved = normalized;
        }
      } catch {
        // Try next query variant.
      }
    }

    return resolved;
  }

  async function refreshMeetingMembers(): Promise<void> {
    if (!meetingId) {
      setMeetingMembers([]);
      return;
    }

    setMemberLoading(true);
    try {
      const resolved = await queryMeetingMembers(meetingId);
      setMeetingMembers(resolved);
    } catch {
      setMeetingMembers([]);
    } finally {
      setMemberLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      if (!meetingId) {
        setMeetingMembers([]);
        return;
      }

      setMemberLoading(true);
      try {
        const resolved = await queryMeetingMembers(meetingId);
        if (cancelled) return;
        setMeetingMembers(resolved);
      } catch {
        if (cancelled) return;
        setMeetingMembers([]);
      } finally {
        if (cancelled) return;
        setMemberLoading(false);
      }
    }

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

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
        const filtered = normalized.items.filter(user => user.auth_name.toLowerCase().includes(lowerKeyword));

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

  const userTotalPages = Math.max(1, Math.ceil(userTotalCount / userPageSize));
  const safeUserPage = Math.min(userPage, userTotalPages);

  const submitUserSearch = () => {
    setUserPage(1);
    setUserQuery(userQueryInput.trim());
  };

  async function addMeetingMember(user: UserSearchItem): Promise<void> {
    if (!meetingId) return;

    if (meetingMembers.some(member => member.user_id === user.user_id)) {
      addToast('warning', '이미 등록된 참석자입니다.');
      return;
    }

    const payload: UpdateMembersRequest = {
      method: 'add',
      items: [toMemberPayloadItem(user)],
    };

    try {
      setMemberMutating(true);
      await apiPut(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/members`, payload);
      addToast('success', '참석자가 추가되었습니다.');
      await refreshMeetingMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', '참석자 추가에 실패했습니다.', message);
    } finally {
      setMemberMutating(false);
    }
  }

  async function removeMeetingMember(member: MeetingMemberItem): Promise<void> {
    if (!meetingId) return;

    const payload: UpdateMembersRequest = {
      method: 'remove',
      items: [toMemberPayloadItem(member)],
    };

    try {
      setMemberMutating(true);
      await apiPut(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/members`, payload);
      addToast('success', '참석자가 삭제되었습니다.');
      await refreshMeetingMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', '참석자 삭제에 실패했습니다.', message);
    } finally {
      setMemberMutating(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!meetingId) return;

    const safeName = name.trim();
    const startTs = parseDateValue(startTime);
    const endTs = parseDateValue(endTime);
    const isPrivateRoom = roomVisibility === 'private';
    const isCustomLimit = limitMode === 'custom';

    if (!safeName) {
      addToast('warning', t('meetings.createForm.requiredName'));
      return;
    }

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      addToast('warning', t('meetings.editPage.invalidDateTime'));
      return;
    }

    const durationMs = Math.floor(endTs - startTs);
    if (durationMs < 60000) {
      addToast('warning', t('meetings.createForm.invalidDuration'));
      return;
    }

    if (isCustomLimit && (!Number.isFinite(memberMax) || memberMax < 1)) {
      addToast('warning', t('meetings.createForm.invalidMemberMax'));
      return;
    }

    if (isPrivateRoom && !password.trim()) {
      addToast('warning', t('meetings.editPage.requiredPassword'));
      return;
    }

    const payload: UpdateMeetingRequest = {
      name: safeName,
      start_time: new Date(startTs).toISOString(),
      progress_duration: durationMs,
      member_max: isCustomLimit ? Math.floor(memberMax) : 0,
      entry_option: isPrivateRoom ? 'registered' : 'unlimited',
    };

    if (isPrivateRoom && password.trim()) {
      payload.password = password.trim();
    }

    try {
      setSaving(true);
      await apiPut(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}`, payload);
      addToast('success', t('meetings.editPage.updatedTitle'));
      router.push(returnToDetailHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.editPage.updateFailedTitle'), message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mm-card" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="mm-card-body" style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      </div>
    );
  }

  return (
    <section className="mm-meeting-create-page">
      <div className="mm-meeting-create-head">
        <div>
          <h2 className="mm-page-title">{t('meetings.editPage.title')}</h2>
          <p className="mm-page-subtitle">{t('meetings.editPage.subtitle')}</p>
        </div>
      </div>

      <div className="mm-card mm-meeting-create-card">
        <form className="mm-card-body mm-meeting-create-body" onSubmit={onSubmit}>
          <div className="mm-meeting-create-layout">
            <section className="mm-meeting-create-left">
              <div className="mm-meeting-create-section-head">
                <h3 className="mm-card-title">참석자 초대 생성</h3>
                <div className="mm-meeting-create-invite-actions">
                  <button
                    type="button"
                    className="mm-btn mm-btn-secondary mm-btn-sm"
                    onClick={() => setUserModalOpen(true)}
                    disabled={saving || memberMutating}
                  >
                    <i className="bi bi-people" />
                    참석자 초대
                  </button>
                  <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" disabled>
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
                    value=""
                    readOnly
                    disabled
                  />
                </div>
                <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" disabled>검색</button>
                <button type="button" className="mm-btn mm-btn-secondary mm-btn-sm" disabled>초기화</button>
              </div>

              <div className="mm-table-wrap">
                <table className="mm-table mm-meeting-invite-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>아이디</th>
                      <th style={{ width: 120 }}>성명</th>
                      <th style={{ width: 140 }}>전화번호</th>
                      <th>메일주소</th>
                      <th style={{ width: 88, textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberLoading ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          참석자 목록을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : meetingMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          등록된 참석자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      meetingMembers.map(member => (
                        <tr key={member.user_id}>
                          <td><span className="mm-cell-ellipsis">{member.auth_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.user_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.phone_number}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.email}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="mm-btn mm-btn-danger mm-btn-sm"
                              onClick={() => removeMeetingMember(member)}
                              disabled={saving || memberMutating}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

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
                    disabled={saving}
                  />
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">룸설정</label>
                  <div className="mm-toggle-group">
                    <button
                      type="button"
                      className={`mm-toggle-item${roomVisibility === 'public' ? ' active' : ''}`}
                      onClick={() => setRoomVisibility('public')}
                      disabled={saving}
                    >
                      <i className={`bi ${roomVisibility === 'public' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                      공개
                    </button>
                    <button
                      type="button"
                      className={`mm-toggle-item${roomVisibility === 'private' ? ' active' : ''}`}
                      onClick={() => setRoomVisibility('private')}
                      disabled={saving}
                    >
                      <i className={`bi ${roomVisibility === 'private' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                      비공개
                    </button>
                  </div>
                </div>

                {roomVisibility === 'private' && (
                  <div className="mm-meeting-create-field mm-meeting-create-field-full">
                    <label className="mm-form-label">룸 비밀번호</label>
                    <input
                      type="password"
                      className="mm-form-control"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t('meetings.createForm.placeholderPassword')}
                      autoComplete="new-password"
                      disabled={saving}
                    />
                  </div>
                )}

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
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
                      />
                    </div>
                    <div className="mm-datetime-control">
                      <input
                        type="time"
                        className="mm-form-control mm-datetime-input"
                        value={endClock}
                        onChange={e => setEndClock(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <p className="mm-form-hint">유지시간: {durationMinutes > 0 ? `${durationMinutes}분` : '-'}</p>
                </div>

                <div className="mm-meeting-create-field mm-meeting-create-field-full">
                  <label className="mm-form-label">참석제한</label>
                  <div className="mm-toggle-group">
                    <button
                      type="button"
                      className={`mm-toggle-item${limitMode === 'unlimited' ? ' active' : ''}`}
                      onClick={() => setLimitMode('unlimited')}
                      disabled={saving}
                    >
                      <i className={`bi ${limitMode === 'unlimited' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                      기본(무제한)
                    </button>
                    <button
                      type="button"
                      className={`mm-toggle-item${limitMode === 'custom' ? ' active' : ''}`}
                      onClick={() => setLimitMode('custom')}
                      disabled={saving}
                    >
                      <i className={`bi ${limitMode === 'custom' ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                      직접설정
                    </button>
                  </div>

                  {limitMode === 'custom' && (
                    <div style={{ marginTop: 10 }}>
                      <input
                        type="number"
                        min={1}
                        className="mm-form-control"
                        value={String(memberMax)}
                        onChange={e => setMemberMax(Number(e.target.value || 0))}
                        placeholder="참석 가능 인원 수"
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="mm-meeting-create-actions">
            <button type="button" className="mm-btn mm-btn-secondary" onClick={() => router.push(returnToListHref)} disabled={saving}>
              {t('meetings.createForm.cancel')}
            </button>
            <button type="submit" className="mm-btn mm-btn-primary" disabled={saving}>
              {saving ? t('meetings.editPage.saving') : t('meetings.editPage.save')}
            </button>
          </div>
        </form>
      </div>

      <Modal
        open={userModalOpen}
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
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitUserSearch();
                    }
                  }}
                />
              </div>
              <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitUserSearch} disabled={memberMutating}>검색</button>
              <button
                type="button"
                className="mm-btn mm-btn-secondary mm-btn-sm"
                disabled={memberMutating}
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
                        userItems.map(user => (
                          <tr key={user.user_id}>
                            <td><span className="mm-cell-ellipsis">{user.auth_name}</span></td>
                            <td><span className="mm-cell-ellipsis">{user.user_name}</span></td>
                            <td><span className="mm-cell-ellipsis">{user.phone_number}</span></td>
                            <td><span className="mm-cell-ellipsis">{user.email}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="mm-btn mm-btn-primary mm-btn-sm"
                                onClick={() => addMeetingMember(user)}
                                disabled={memberMutating}
                              >
                                추가
                              </button>
                            </td>
                          </tr>
                        ))
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
                      disabled={memberMutating || safeUserPage <= 1}
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
                      disabled={memberMutating || safeUserPage >= userTotalPages}
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
    </section>
  );
}
