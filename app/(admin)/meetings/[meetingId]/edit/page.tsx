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

type RoleName = 'host' | 'participant' | 'presenter' | 'manager';

const ROLE_OPTIONS: { value: RoleName; label: string }[] = [
  { value: 'host', label: '진행자' },
  { value: 'participant', label: '참석자' },
  { value: 'presenter', label: '발표자' },
  { value: 'manager', label: '매니저' },
];

const EDIT_DEBUG_PREFIX = '[MeetingEditDebug]';

function debugLog(step: string, data?: unknown): void {
  if (data === undefined) {
    console.info(`${EDIT_DEBUG_PREFIX} ${step}`);
    return;
  }
  console.info(`${EDIT_DEBUG_PREFIX} ${step}`, data);
}

interface UpdateMeetingRequest {
  name: string;
  start_time: string;
  progress_duration: number;
  pre_entering_duration: number;
  member_max: number;
  entry_option: 'unlimited' | 'registered';
  password?: string;
}

interface MeetingMemberItem {
  meeting_id: string;
  user_id: string;
  row_key: string;
  auth_name: string;
  user_name: string;
  phone_number: string;
  email: string;
  role_name?: RoleName;
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
  role_name: RoleName;
  nickname: string;
  profile: {
    user_name: string;
  };
}

interface ResetMembersRequest {
  method: 'reset';
  items: UpdateMembersRequestItem[];
}

interface RemoveMembersRequest {
  method: 'remove';
  items: Array<{ user_id: string; role_name: RoleName }>;
}

function normalizeMeetingStatus(status?: string): string {
  return (status ?? '').trim().toLowerCase();
}

function pickString(src: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && trimmed !== '-') {
        return trimmed;
      }
    }
  }
  return '';
}

function normalizeMemberStatus(src: Record<string, unknown>, profile: Record<string, unknown> | null, userObj: Record<string, unknown> | null): string {
  const candidate =
    pickString(src, ['status', 'stats']) ||
    (profile ? pickString(profile, ['status', 'stats']) : '') ||
    (userObj ? pickString(userObj, ['status', 'stats']) : '');
  return candidate.trim().toLowerCase();
}

function normalizeMeetingMember(raw: unknown): MeetingMemberItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const src = raw as Record<string, unknown>;
  const profile = src.profile && typeof src.profile === 'object'
    ? src.profile as Record<string, unknown>
    : null;
  const userObj = src.user && typeof src.user === 'object'
    ? src.user as Record<string, unknown>
    : null;

  const memberStatus = normalizeMemberStatus(src, profile, userObj);
  if (memberStatus === 'banned') return null;

  const meetingId =
    pickString(src, ['meeting_id', 'meetingId']) ||
    (profile ? pickString(profile, ['meeting_id', 'meetingId']) : '') ||
    (userObj ? pickString(userObj, ['meeting_id', 'meetingId']) : '');

  const userId =
    pickString(src, ['user_id', 'userId', 'uuid']) ||
    (profile ? pickString(profile, ['user_id', 'userId', 'uuid']) : '') ||
    (userObj ? pickString(userObj, ['user_id', 'userId', 'uuid']) : '');
  const authName = pickString(src, ['auth_name', 'authName', 'nickname', 'user_name', 'userName']);

  if (!userId && !authName) return null;

  const roleObj = src.role && typeof src.role === 'object' ? src.role as Record<string, unknown> : null;
  const rawRoleName = (typeof src.role_name === 'string' ? src.role_name : null) ??
    (roleObj && typeof roleObj.name === 'string' ? roleObj.name : null);
  const roleName: RoleName = (rawRoleName === 'host' || rawRoleName === 'participant' || rawRoleName === 'presenter' || rawRoleName === 'manager')
    ? rawRoleName
    : 'participant';

  return {
    meeting_id: meetingId,
    user_id: userId,
    row_key: userId || authName,
    auth_name: authName || '-',
    user_name: pickString(src, ['user_name', 'userName']) || (profile ? pickString(profile, ['user_name', 'userName']) : '') || '-',
    phone_number: pickString(src, ['phone_number', 'phoneNumber', 'phone']) || (profile ? pickString(profile, ['phone_number', 'phoneNumber', 'phone']) : '') || '-',
    email: pickString(src, ['email']) || (profile ? pickString(profile, ['email']) : '') || '-',
    role_name: roleName,
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

function toMemberPayloadItem(user: { user_id: string; auth_name: string; user_name?: string }, roleName: RoleName = 'participant'): UpdateMembersRequestItem {
  const placeholder = (v: string | undefined) => (!v || v === '-') ? '' : v;
  const nickname = placeholder(user.user_name) || placeholder(user.auth_name) || user.user_id;
  return {
    user_id: user.user_id,
    role_name: roleName,
    nickname,
    profile: {
      user_name: nickname,
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
  const [preEnteringMinutes, setPreEnteringMinutes] = useState(5);
  const [password, setPassword] = useState('');
  const [meetingMembers, setMeetingMembers] = useState<MeetingMemberItem[]>([]);
  const [initialMemberIds, setInitialMemberIds] = useState<string[]>([]);
  const [initialMemberRoleMap, setInitialMemberRoleMap] = useState<Record<string, RoleName>>({});
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberRoles, setMemberRoles] = useState<Record<string, RoleName>>({});

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

        console.log('[EditPage] fetchMeetingById result:', { meetingId, item_id: item?.meeting_id, status: item?.status });

        if (!item) {
          addToast('warning', t('meetings.editNotFoundTitle'));
          router.push('/meetings');
          return;
        }

        const editableStatus = normalizeMeetingStatus(item.status);
        console.log('[EditPage] editableStatus:', editableStatus);
        if (editableStatus !== 'booked' && editableStatus !== 'created') {
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
        setPreEnteringMinutes(Math.round((item.pre_entering_duration ?? 300000) / 60000));
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
    // GET /meetings/{id}/members 는 서버에서 405 반환 — query param 방식만 사용
    const queries = [
      `/api/meeting/v1/members?meeting_id=${encodedMeetingId}&limit=300&status=vacated`,
      `/api/meeting/v1/members?meetingId=${encodedMeetingId}&limit=300&status=vacated`,
    ];

    for (const query of queries) {
      try {
        const res = await apiGet<unknown>(query);
        const normalized = normalizeMeetingMemberList(res)
          .filter(member => !!member.user_id);

        const scoped = normalized.filter(member => !member.meeting_id || member.meeting_id === targetMeetingId);
        const deduped = Array.from(
          new Map(scoped.map(member => [member.user_id, member] as const)).values()
        );

        debugLog('queryMeetingMembers.success', {
          query,
          normalizedCount: normalized.length,
          scopedCount: scoped.length,
          dedupedCount: deduped.length,
          dedupedIds: deduped.map(member => member.user_id),
        });

        if (deduped.length > 0) return deduped;
      } catch {
        debugLog('queryMeetingMembers.failed', { query });
        // Try next query variant.
      }
    }

    debugLog('queryMeetingMembers.empty', { targetMeetingId });
    return [];
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
        setInitialMemberIds(resolved.map(m => m.user_id));
        const roles: Record<string, RoleName> = {};
        for (const m of resolved) {
          roles[m.user_id] = m.role_name ?? 'participant';
        }
        setInitialMemberRoleMap(roles);
        setMemberRoles(roles);
        debugLog('loadMembers.snapshot', {
          meetingId,
          memberIds: resolved.map(m => m.user_id),
          memberRoles: roles,
        });
      } catch {
        if (cancelled) return;
        setMeetingMembers([]);
        setInitialMemberIds([]);
        setInitialMemberRoleMap({});
        setMemberRoles({});
        debugLog('loadMembers.error', { meetingId });
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
    if (meetingMembers.some(member => member.user_id === user.user_id)) {
      addToast('warning', '이미 등록된 참석자입니다.');
      return;
    }

    setMeetingMembers(prev => [
      {
        meeting_id: meetingId,
        user_id: user.user_id,
        row_key: user.user_id,
        auth_name: user.auth_name,
        user_name: user.user_name,
        phone_number: user.phone_number,
        email: user.email,
        role_name: 'participant',
      },
      ...prev,
    ]);
    setMemberRoles(prev => ({ ...prev, [user.user_id]: 'participant' }));
    addToast('success', '참석자가 목록에 추가되었습니다. 수정 버튼을 눌러 저장해 주세요.');
  }

  function removeMeetingMember(member: MeetingMemberItem): void {
    if (!member.user_id) {
      addToast('warning', '사용자 ID가 없어 삭제할 수 없습니다.');
      return;
    }

    debugLog('removeMeetingMember.before', {
      targetUserId: member.user_id,
      currentMemberIds: meetingMembers.map(item => item.user_id),
      initialMemberIds,
      initialRole: initialMemberRoleMap[member.user_id],
      currentRole: memberRoles[member.user_id],
    });

    setMeetingMembers(prev => prev.filter(item => item.user_id !== member.user_id));
    setMemberRoles(prev => {
      const next = { ...prev };
      delete next[member.user_id];
      return next;
    });
    addToast('success', '참석자가 목록에서 제거되었습니다. 수정 버튼을 눌러 저장해 주세요.');
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
      pre_entering_duration: Math.max(0, Math.floor(preEnteringMinutes)) * 60000,
      member_max: isCustomLimit ? Math.floor(memberMax) : 0,
      entry_option: isPrivateRoom ? 'registered' : 'unlimited',
    };

    if (isPrivateRoom && password.trim()) {
      payload.password = password.trim();
    }

    try {
      setSaving(true);
      await apiPut(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}`, payload);

      // 저장 전략: set 방식 — 현재 화면의 참석자 목록 전체를 서버와 동기화
      const dedupedMembers = Array.from(
        new Map(
          meetingMembers
            .filter(member => !!member.user_id)
            .map(member => [member.user_id, member] as const)
        ).values()
      );
      const currentIds = dedupedMembers.map(m => m.user_id);

      debugLog('onSubmit.delta.prepare', {
        meetingId,
        initialMemberIds,
        currentIds,
        initialMemberRoleMap,
        memberRoles,
      });

      const resetPayload: ResetMembersRequest = {
        method: 'reset',
        items: dedupedMembers.map(m => toMemberPayloadItem(m, memberRoles[m.user_id] ?? 'participant')),
      };
      debugLog('onSubmit.reset.request', resetPayload);
      const resetRes = await apiPut<unknown>(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/members`, resetPayload);
      debugLog('onSubmit.reset.response', resetRes);

      setInitialMemberIds(currentIds);
      const nextInitialRoles: Record<string, RoleName> = {};
      for (const id of currentIds) {
        nextInitialRoles[id] = memberRoles[id] ?? 'participant';
      }
      setInitialMemberRoleMap(nextInitialRoles);

      const removedIds = initialMemberIds.filter(id => !currentIds.includes(id));
      let ghostIds: string[] = [];
      try {
        const serverMembers = await queryMeetingMembers(meetingId);
        const serverIds = serverMembers.map(member => member.user_id);
        ghostIds = removedIds.filter(id => serverIds.includes(id));
        debugLog('onSubmit.verify.serverMembers', {
          serverIds,
          ghostIds,
        });
      } catch {
        debugLog('onSubmit.verify.failed', { meetingId });
      }

      if (ghostIds.length > 0) {
        const removeFallbackPayload: RemoveMembersRequest = {
          method: 'remove',
          items: ghostIds.map(user_id => ({
            user_id,
            role_name: initialMemberRoleMap[user_id] ?? 'participant',
          })),
        };

        debugLog('onSubmit.removeFallback.request', removeFallbackPayload);
        try {
          const removeFallbackRes = await apiPut<unknown>(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/members`, removeFallbackPayload);
          debugLog('onSubmit.removeFallback.response', removeFallbackRes);

          const fallbackServerMembers = await queryMeetingMembers(meetingId);
          const fallbackServerIds = fallbackServerMembers.map(member => member.user_id);
          const remainingGhostIds = ghostIds.filter(id => fallbackServerIds.includes(id));
          debugLog('onSubmit.removeFallback.verify', {
            fallbackServerIds,
            remainingGhostIds,
          });

          if (remainingGhostIds.length > 0) {
            addToast('error', '일부 참석자 삭제가 서버에 반영되지 않았습니다.', `삭제 미반영 사용자 수: ${remainingGhostIds.length}`);
            setSaving(false);
            return;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          debugLog('onSubmit.removeFallback.error', { message });
          addToast('error', '일부 참석자 삭제가 서버에 반영되지 않았습니다.', `삭제 보정 호출 실패: ${message}`);
          setSaving(false);
          return;
        }
      }

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                    {roomVisibility === 'private' && (
                      <input
                        type="password"
                        className="mm-form-control"
                        style={{ flex: 1, minWidth: 0 }}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('meetings.createForm.placeholderPassword')}
                        autoComplete="new-password"
                        disabled={saving}
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
                      <input
                        type="number"
                        min={1}
                        className="mm-form-control"
                        style={{ width: 80 }}
                        value={String(memberMax)}
                        onChange={e => setMemberMax(Number(e.target.value || 0))}
                        placeholder="인원 수"
                        disabled={saving}
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
                      disabled={saving}
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
                    disabled={saving}
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
                      <th style={{ width: 140 }}>아이디</th>
                      <th style={{ width: 110 }}>성명</th>
                      <th style={{ width: 130 }}>전화번호</th>
                      <th>메일주소</th>
                      <th style={{ width: 110 }}>권한</th>
                      <th style={{ width: 72, textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberLoading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          참석자 목록을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : meetingMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          등록된 참석자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      meetingMembers.map(member => (
                        <tr key={member.row_key}>
                          <td><span className="mm-cell-ellipsis">{member.auth_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.user_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.phone_number}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.email}</span></td>
                          <td>
                            <select
                              className="mm-form-control"
                              style={{ fontSize: 13, padding: '4px 6px' }}
                              value={memberRoles[member.user_id] ?? 'participant'}
                              onChange={e => setMemberRoles(prev => ({ ...prev, [member.user_id]: e.target.value as RoleName }))}
                              disabled={saving}
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
                              onClick={() => removeMeetingMember(member)}
                              disabled={saving || !member.user_id}
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
              <button type="button" className="mm-btn mm-btn-primary mm-btn-sm" onClick={submitUserSearch} disabled={saving}>검색</button>
              <button
                type="button"
                className="mm-btn mm-btn-secondary mm-btn-sm"
                disabled={saving}
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
                                disabled={saving}
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
                      disabled={saving || safeUserPage <= 1}
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
                      disabled={saving || safeUserPage >= userTotalPages}
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
