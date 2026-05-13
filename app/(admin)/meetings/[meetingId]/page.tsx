'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';
import {
  addMinutes,
  fetchMeetingById,
  splitDatetimeLocal,
  toDatetimeLocalValue,
  type MeetingItem,
} from '../_shared';

interface MeetingMemberItem {
  user_id: string;
  auth_name: string;
  user_name: string;
  phone_number: string;
  email: string;
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

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams<{ meetingId: string }>();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { addToast } = useToast();

  const meetingId = decodeURIComponent(params.meetingId ?? '').trim();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<MeetingItem | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [meetingMembers, setMeetingMembers] = useState<MeetingMemberItem[]>([]);

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
                      <th style={{ width: 150 }}>아이디</th>
                      <th style={{ width: 120 }}>성명</th>
                      <th style={{ width: 140 }}>전화번호</th>
                      <th>메일주소</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberLoading ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
                          참석자 목록을 불러오는 중입니다.
                        </td>
                      </tr>
                    ) : meetingMembers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--mm-text-secondary)' }}>
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
                  <input className="mm-form-control" value={meeting.name ?? '-'} disabled readOnly />
                </div>

                <div className="mm-meeting-create-field">
                  <label className="mm-form-label">룸설정</label>
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
                </div>

                {isPrivateRoom && (
                  <div className="mm-meeting-create-field mm-meeting-create-field-full">
                    <label className="mm-form-label">룸 비밀번호</label>
                    <input
                      className="mm-form-control"
                      value={meeting.password ? '********' : t('meetings.detailPage.setButHidden')}
                      disabled
                      readOnly
                    />
                  </div>
                )}

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

                <div className="mm-meeting-create-field mm-meeting-create-field-full">
                  <label className="mm-form-label">참석제한</label>
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
                    <div style={{ marginTop: 10 }}>
                      <input className="mm-form-control" value={String(meeting.member_max ?? 0)} disabled readOnly />
                    </div>
                  )}
                </div>

                <div className="mm-meeting-create-field mm-meeting-create-field-full">
                  <label className="mm-form-label">상태</label>
                  <input className="mm-form-control" value={meeting.status ?? '-'} disabled readOnly />
                </div>
              </div>
            </section>
          </div>

          <div className="mm-meeting-create-actions">
            <Link href={returnToListHref} className="mm-btn mm-btn-secondary">
              {t('meetings.createForm.cancel')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
