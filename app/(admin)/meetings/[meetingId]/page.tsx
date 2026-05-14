'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, apiDelete, apiGet } from '@/lib/api';
import Modal, { ConfirmModal } from '@/components/Modal';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';
import { getAuthContext, getAccessToken } from '@/lib/auth';
import { startMeetingEnterFlow } from '@/lib/meeting-enter';
import { getConfiguredApiBaseUrl } from '@/lib/service-config';
import {
  addMinutes,
  fetchMeetingById,
  splitDatetimeLocal,
  toDatetimeLocalValue,
  type MeetingItem,
} from '../_shared';

type RoleName = 'host' | 'participant' | 'presenter' | 'manager';

const ROLE_LABEL: Record<RoleName, string> = {
  host: '진행자',
  participant: '참석자',
  presenter: '발표자',
  manager: '매니저',
};

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

const DETAIL_EDITABLE_MEETING_STATUSES = new Set(['booked', 'created']);

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

function formatJsonPreview(payload: unknown): string {
  if (payload === null || payload === undefined) return '-';
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function decodeDispositionFilename(raw: string): string {
  const cleaned = raw.trim().replace(/^UTF-8''/i, '').replace(/^"|"$/g, '');
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

function parseFilenameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const filenameStarMatch = contentDisposition.match(/filename\*=([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    return decodeDispositionFilename(filenameStarMatch[1]);
  }

  const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (filenameMatch?.[1]) {
    return decodeDispositionFilename(filenameMatch[1]);
  }

  return null;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { addToast } = useToast();

  const meetingId = decodeURIComponent(params.meetingId ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<MeetingItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [meetingMembers, setMeetingMembers] = useState<MeetingMemberItem[]>([]);
  const [iceServersModalOpen, setIceServersModalOpen] = useState(false);
  const [iceServersLoading, setIceServersLoading] = useState(false);
  const [iceServersPreview, setIceServersPreview] = useState('-');
  const [chatLogDownloading, setChatLogDownloading] = useState(false);
  const [attendPasswordModalOpen, setAttendPasswordModalOpen] = useState(false);
  const [attendPassword, setAttendPassword] = useState('');
  const [attending, setAttending] = useState(false);

  const returnToListHref = useMemo(() => {
    const listParams = new URLSearchParams();
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const source = searchParams.get('source');

    if (page) listParams.set('page', page);
    if (pageSize) listParams.set('pageSize', pageSize);
    if (status) listParams.set('status', status);
    if (q) listParams.set('q', q);
    if (source === 'history') listParams.set('source', source);

    const qs = listParams.toString();
    const base = source === 'history' ? '/meetings/history' : '/meetings';
    return qs ? `${base}?${qs}` : base;
  }, [searchParams]);

  const returnToEditHref = useMemo(() => {
    const detailParams = new URLSearchParams();
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const source = searchParams.get('source');

    if (page) detailParams.set('page', page);
    if (pageSize) detailParams.set('pageSize', pageSize);
    if (status) detailParams.set('status', status);
    if (q) detailParams.set('q', q);
    if (source === 'history') detailParams.set('source', source);

    const qs = detailParams.toString();
    const base = `/meetings/${encodeURIComponent(meetingId)}/edit`;
    return qs ? `${base}?${qs}` : base;
  }, [meetingId, searchParams]);

  const goBackToPreviousPage = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(returnToListHref);
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchMeeting() {
      if (!meetingId) {
        addToast('error', t('meetings.detailLoadFailedTitle'));
        router.push('/meetings');
        return;
      }

      setLoading(true);
      try {
        const item = await fetchMeetingById(meetingId);
        if (cancelled) return;

        if (!item || item.meeting_id !== meetingId) {
          addToast('warning', t('meetings.detailNotFoundTitle'));
          router.push(returnToListHref);
          return;
        }

        setMeeting(item);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : undefined;
        addToast('error', t('meetings.detailLoadFailedTitle'), message);
        router.push(returnToListHref);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    fetchMeeting();
    return () => {
      cancelled = true;
    };
  }, [addToast, meetingId, returnToListHref, router, t]);

  const submitDelete = async () => {
    if (!meetingId) return;
    try {
      setDeleting(true);
      await apiDelete(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}`);
      addToast('success', t('meetings.deleteSuccessTitle'));
      router.push(returnToListHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.deleteFailedTitle'), message);
      setDeleting(false);
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const getErrorMessage = (err: unknown): string | undefined => {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return undefined;
  };

  const executeAttend = async (passwordInput = '') => {
    if (!meetingId) return;

    try {
      setAttending(true);
      await startMeetingEnterFlow({ meetingId, password: passwordInput.trim() });
      addToast('info', t('meetings.attendRedirectingTitle'), t('meetings.attendRedirectingMessage'));
    } catch (err) {
      addToast('error', t('meetings.attendFailedTitle'), getErrorMessage(err));
    } finally {
      setAttending(false);
    }
  };

  const onAttend = async () => {
    if (!meeting) return;

    if (meeting.password_checking) {
      setAttendPassword('');
      setAttendPasswordModalOpen(true);
      return;
    }

    await executeAttend();
  };

  const submitAttendWithPassword = async () => {
    if (meeting?.password_checking && !attendPassword.trim()) {
      addToast('warning', t('meetings.attendPasswordRequiredTitle'), t('meetings.attendPasswordRequiredMessage'));
      return;
    }

    await executeAttend(attendPassword);
  };

  const fetchIceServers = async () => {
    if (!meetingId) return;

    setIceServersModalOpen(true);
    setIceServersLoading(true);
    setIceServersPreview('-');

    try {
      const response = await apiGet<unknown>(`/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/ice-servers`);
      setIceServersPreview(formatJsonPreview(response));
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.iceServersLoadFailedTitle'), message);
      setIceServersPreview(t('meetings.iceServersEmpty'));
    } finally {
      setIceServersLoading(false);
    }
  };

  const downloadChatLogCsv = async () => {
    if (!meetingId) return;

    setChatLogDownloading(true);

    try {
      const token = getAccessToken();
      const { tenantId } = getAuthContext();
      const headers: Record<string, string> = {
        Accept: 'text/csv,*/*',
        'Accept-Charset': 'utf-8, euc-kr;q=0.9',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
        if (tenantId) headers['X-Mate-Tenant-ID'] = tenantId;
      }

      const baseUrl = getConfiguredApiBaseUrl().replace(/\/+$/, '');
      const downloadUrl = `${baseUrl}/api/meeting/v1/meetings/${encodeURIComponent(meetingId)}/chat-logs-as-csv`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      // 서버가 제공한 CSV 바이트를 그대로 저장해 UTF-8/EUC-KR 등 인코딩을 유지한다.
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filenameFromHeader = parseFilenameFromContentDisposition(disposition);
      const filename = sanitizeFilename(filenameFromHeader || `meeting-${meetingId}-chat-logs.csv`);

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);

      addToast('success', t('meetings.chatLogDownloadSuccessTitle'));
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      addToast('error', t('meetings.chatLogDownloadFailedTitle'), message);
    } finally {
      setChatLogDownloading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchMeetingMembers() {
      if (!meetingId) {
        setMeetingMembers([]);
        return;
      }

      setMemberLoading(true);
      try {
        const encodedMeetingId = encodeURIComponent(meetingId);
        const queries = [
          `/api/meeting/v1/members?meeting_id=${encodedMeetingId}&limit=300&status=vacated`,
          `/api/meeting/v1/members?meetingId=${encodedMeetingId}&limit=300&status=vacated`,
          `/api/meeting/v1/members?uuid=${encodedMeetingId}&limit=300&status=vacated`,
        ];

        let resolved: MeetingMemberItem[] = [];
        for (const query of queries) {
          try {
            const res = await apiGet<unknown>(query);
            const normalized = normalizeMeetingMemberList(res)
              .filter(member => !!member.user_id);

            const scoped = normalized.filter(member => member.meeting_id === meetingId);
            const filtered = scoped.length > 0 ? scoped : normalized;
            const deduped = Array.from(new Map(filtered.map(member => [member.user_id, member] as const)).values());

            if (deduped.length > 0) {
              resolved = deduped;
              break;
            }

            if (!resolved.length) {
              resolved = deduped;
            }
          } catch {
            // Try next query variant.
          }
        }

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

    void fetchMeetingMembers();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  if (loading) {
    return (
      <div className="mm-card" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="mm-card-body" style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  const startValue = meeting.start_time ? toDatetimeLocalValue(new Date(meeting.start_time)) : toDatetimeLocalValue(new Date());
  const endValue = addMinutes(startValue, Math.max(1, Math.floor((meeting.progress_duration ?? 0) / 60000)));
  const startParts = splitDatetimeLocal(startValue);
  const endParts = splitDatetimeLocal(endValue);
  const durationMinutes = Math.max(1, Math.floor((meeting.progress_duration ?? 0) / 60000));
  const isPrivateRoom = meeting.entry_option === 'registered' || !!meeting.password_checking;
  const isCustomLimit = (meeting.member_max ?? 0) > 0;
  const meetingStatus = normalizeMeetingStatus(meeting.status);
  const isHistoryDetail = searchParams.get('source') === 'history' || meetingStatus === 'closed' || meetingStatus === 'deleted';

  const canEditMeeting = (() => {
    if (!DETAIL_EDITABLE_MEETING_STATUSES.has(meetingStatus)) return false;
    if (meeting.start_time) {
      const startTs = Date.parse(meeting.start_time);
      const preEntering = meeting.pre_entering_duration ?? 300000;
      const now = new Date().getTime();
      if (Number.isFinite(startTs) && now >= startTs - preEntering) return false;
    }
    return true;
  })();

  const canAttendMeeting = !isHistoryDetail && (meetingStatus === 'booked' || meetingStatus === 'held');

  return (
    <section className="mm-meeting-create-page">
      <div className="mm-meeting-create-head">
        <div>
          <h2 className="mm-page-title">{t('meetings.detailPage.title')}</h2>
          <p className="mm-page-subtitle">{t('meetings.detailPage.subtitle')}</p>
        </div>
      </div>

      <div className="mm-card mm-meeting-create-card">
        <div className="mm-card-body mm-meeting-create-body">
          <div className="mm-meeting-create-layout">
            <section className="mm-meeting-create-right">
              <div className="mm-meeting-create-grid">
                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">미팅명</label>
                  <input className="mm-form-control" value={meeting.name ?? '-'} disabled readOnly />
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">룸설정</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="mm-toggle-group">
                      <button type="button" className={`mm-toggle-item${!isPrivateRoom ? ' active' : ''}`} disabled>
                        <i className={`bi ${!isPrivateRoom ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        공개
                      </button>
                      <button type="button" className={`mm-toggle-item${isPrivateRoom ? ' active' : ''}`} disabled>
                        <i className={`bi ${isPrivateRoom ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        비공개
                      </button>
                    </div>
                    {isPrivateRoom && (
                      <input
                        className="mm-form-control"
                        style={{ flex: 1, minWidth: 0 }}
                        value={meeting.password ? '********' : t('meetings.detailPage.setButHidden')}
                        disabled
                        readOnly
                      />
                    )}
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">참석제한</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="mm-toggle-group">
                      <button type="button" className={`mm-toggle-item${!isCustomLimit ? ' active' : ''}`} disabled>
                        <i className={`bi ${!isCustomLimit ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        기본(무제한)
                      </button>
                      <button type="button" className={`mm-toggle-item${isCustomLimit ? ' active' : ''}`} disabled>
                        <i className={`bi ${isCustomLimit ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                        직접설정
                      </button>
                    </div>
                    {isCustomLimit && (
                      <input
                        className="mm-form-control"
                        style={{ width: 80 }}
                        value={String(meeting.member_max ?? 0)}
                        disabled
                        readOnly
                      />
                    )}
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">시작일시</label>
                  <div className="mm-datetime-split">
                    <div className="mm-datetime-control">
                      <input type="date" className="mm-form-control mm-datetime-input" value={startParts.date} disabled readOnly />
                    </div>
                    <div className="mm-datetime-control">
                      <input type="time" className="mm-form-control mm-datetime-input" value={startParts.time} disabled readOnly />
                    </div>
                  </div>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">종료일시</label>
                  <div className="mm-datetime-split">
                    <div className="mm-datetime-control">
                      <input type="date" className="mm-form-control mm-datetime-input" value={endParts.date} disabled readOnly />
                    </div>
                    <div className="mm-datetime-control">
                      <input type="time" className="mm-form-control mm-datetime-input" value={endParts.time} disabled readOnly />
                    </div>
                  </div>
                  <p className="mm-form-hint">유지시간: {durationMinutes}분</p>
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">사전 입장 허용 시간</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mm-form-control" style={{ width: 'auto', display: 'inline-block' }}>
                      {Math.round((meeting.pre_entering_duration ?? 300000) / 60000)}분
                    </span>
                    <span style={{ color: 'var(--mm-text-secondary)', fontSize: 14 }}>전부터 입장 가능</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mm-meeting-create-left">
              <div className="mm-meeting-create-section-head">
                <h3 className="mm-card-title">참석자 초대 생성</h3>
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
                      <th style={{ width: '20%' }}>아이디</th>
                      <th style={{ width: '20%' }}>성명</th>
                      <th style={{ width: '20%' }}>전화번호</th>
                      <th style={{ width: '20%' }}>메일주소</th>
                      <th style={{ width: '20%' }}>권한</th>
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
                        <tr key={member.row_key}>
                          <td><span className="mm-cell-ellipsis">{member.auth_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.user_name}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.phone_number}</span></td>
                          <td><span className="mm-cell-ellipsis">{member.email}</span></td>
                          <td><span className="mm-cell-ellipsis">{ROLE_LABEL[member.role_name ?? 'participant']}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="mm-meeting-create-actions">
            <button
              type="button"
              className="mm-btn mm-btn-secondary"
              onClick={goBackToPreviousPage}
              style={{ marginRight: 'auto' }}
              disabled={deleting}
            >
              {t('meetings.paginationPrev')}
            </button>
            <button
              type="button"
              className="mm-btn mm-btn-secondary"
              onClick={fetchIceServers}
              disabled={iceServersLoading}
            >
              {t('meetings.actionIceServers')}
            </button>
            {canAttendMeeting && (
              <button
                type="button"
                className="mm-btn mm-btn-secondary"
                onClick={() => {
                  void onAttend();
                }}
                disabled={attending}
              >
                {attending ? t('meetings.attendPreparing') : t('meetings.actionAttend')}
              </button>
            )}
            {isHistoryDetail && (
              <button
                type="button"
                className="mm-btn mm-btn-secondary"
                onClick={downloadChatLogCsv}
                disabled={chatLogDownloading}
              >
                {chatLogDownloading ? t('meetings.chatLogDownloading') : t('meetings.actionDownloadChatCsv')}
              </button>
            )}
            {canEditMeeting && (
              <Link href={returnToEditHref} className="mm-btn mm-btn-primary">
                {t('meetings.actionEdit')}
              </Link>
            )}
            <button
              type="button"
              className="mm-btn mm-btn-danger"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
            >
              {t('meetings.actionDelete')}
            </button>
            <Link href={returnToListHref} className="mm-btn mm-btn-secondary">
              {t('meetings.createForm.cancel')}
            </Link>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteConfirmOpen}
        title={t('meetings.deleteConfirmTitle')}
        message={t('meetings.deleteConfirmMessage')}
        confirmLabel={deleting ? t('meetings.deleteDeleting') : t('meetings.deleteConfirmButton')}
        cancelLabel={t('meetings.deleteCancelButton')}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={submitDelete}
      />

      <Modal
        open={iceServersModalOpen}
        title={t('meetings.iceServersModalTitle')}
        onClose={() => setIceServersModalOpen(false)}
        size="lg"
      >
        {iceServersLoading ? (
          <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
            {t('meetings.iceServersLoading')}
          </div>
        ) : (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6 }}>
            {iceServersPreview}
          </pre>
        )}
      </Modal>

      <Modal
        open={attendPasswordModalOpen}
        title={t('meetings.attendPasswordModalTitle')}
        onClose={() => {
          if (attending) return;
          setAttendPasswordModalOpen(false);
          setAttendPassword('');
        }}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="mm-btn mm-btn-secondary mm-btn-sm"
              onClick={() => {
                if (attending) return;
                setAttendPasswordModalOpen(false);
                setAttendPassword('');
              }}
              disabled={attending}
            >
              {t('meetings.deleteCancelButton')}
            </button>
            <button
              type="button"
              className="mm-btn mm-btn-primary mm-btn-sm"
              onClick={() => {
                void submitAttendWithPassword();
              }}
              disabled={attending}
            >
              {attending ? t('meetings.attendPreparing') : t('meetings.attendEnterNow')}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <label className="mm-form-label" style={{ marginBottom: 0 }}>{t('meetings.attendPasswordLabel')}</label>
          <input
            type="password"
            className="mm-form-control"
            value={attendPassword}
            placeholder={t('meetings.attendPasswordPlaceholder')}
            onChange={e => setAttendPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitAttendWithPassword();
              }
            }}
            disabled={attending}
          />
        </div>
      </Modal>
    </section>
  );
}
