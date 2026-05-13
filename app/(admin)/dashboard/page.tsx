'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { ApiListResponse } from '@/lib/api';
import { formatDateTime, meetingStatusBadge, formatNumber } from '@/lib/utils';
import { useI18n } from '@/components/I18nProvider';

interface Meeting {
  meeting_id: string;
  meeting_name?: string;
  status?: string;
  created_at?: string;
  held_at?: string;
  owner_id?: string;
  owner_name?: string;
}

interface StatState {
  totalUsers: number;
  onlineUsers: number | null;
  offlineUsers: number | null;
  totalMeetings: number;
  activeMeetings: number;
  closedMeetings: number;
  loading: boolean;
}

interface MeetingsState {
  recent: Meeting[];
  active: Meeting[];
  loading: boolean;
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

function normalizeMeetingItem(raw: unknown): Meeting | null {
  if (!raw || typeof raw !== 'object') return null;

  const src = raw as Record<string, unknown>;
  const meetingId = pickString(src, ['meeting_id', 'meetingId', 'uuid', 'id']);
  if (!meetingId) return null;

  return {
    meeting_id: meetingId,
    meeting_name: pickString(src, ['meeting_name', 'meetingName', 'name']),
    status: pickString(src, ['status']),
    created_at: pickString(src, ['creation_time', 'creationTime', 'created_at', 'createdAt']),
    held_at: pickString(src, ['start_time', 'startTime', 'held_at', 'heldAt']),
    owner_id: pickString(src, ['owner_id', 'ownerId', 'owner_uuid', 'ownerUuid']),
  };
}

function normalizeMeetingList(payload: unknown): Meeting[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const resultObj = (root.result && typeof root.result === 'object') ? root.result as Record<string, unknown> : null;
  const itemsRaw =
    (resultObj?.items && Array.isArray(resultObj.items) ? resultObj.items : null) ??
    (root.items && Array.isArray(root.items) ? root.items : []);

  return itemsRaw
    .map(normalizeMeetingItem)
    .filter((item): item is Meeting => !!item);
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

export default function DashboardPage() {
  const { locale, t } = useI18n();
  const [selectedActiveMeetingId, setSelectedActiveMeetingId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatState>({
    totalUsers: 0, onlineUsers: null, offlineUsers: null, totalMeetings: 0, activeMeetings: 0, closedMeetings: 0, loading: true,
  });
  const [meetings, setMeetings] = useState<MeetingsState>({ recent: [], active: [], loading: true });

  useEffect(() => {
    async function fetchTotalCount(path: string): Promise<number> {
      const res = await apiGet<ApiListResponse<unknown>>(path);
      return res.result?.total_count ?? 0;
    }

    async function fetchTotalCountSafe(path: string): Promise<number | null> {
      try {
        return await fetchTotalCount(path);
      } catch {
        return null;
      }
    }

    async function fetchStats() {
      try {
        const [totalUsers, onlineUsers, totalMeetings, activeMeetings, closedMeetings] = await Promise.all([
          fetchTotalCount('/api/user/v1/users?limit=1'),
          fetchTotalCountSafe('/api/user/v1/users?limit=1&status=online'),
          fetchTotalCount('/api/meeting/v1/meetings?limit=1'),
          fetchTotalCount('/api/meeting/v1/meetings?limit=1&status=held'),
          fetchTotalCount('/api/meeting/v1/meetings?limit=1&status=closed'),
        ]);

        const offlineUsers = typeof onlineUsers === 'number'
          ? Math.max(totalUsers - onlineUsers, 0)
          : null;

        setStats({
          totalUsers,
          onlineUsers,
          offlineUsers,
          totalMeetings,
          activeMeetings,
          closedMeetings,
          loading: false,
        });
      } catch {
        setStats(s => ({ ...s, loading: false }));
      }
    }

    async function fetchMeetings() {
      try {
          const [recentRes, activeRes] = await Promise.all([
              apiGet<unknown>('/svc/meeting/meetings?limit=8&only_enterable=false&status=closed&order_by=creation_time&order=desc'),
              apiGet<unknown>('/svc/meeting/meetings?limit=8&only_enterable=true&order_by=creation_time&order=desc'),
          ]);

        const recentItems = normalizeMeetingList(recentRes);
        const activeItems = normalizeMeetingList(activeRes);

        const ownerIds = Array.from(
          new Set(
            [...recentItems, ...activeItems]
              .map(item => item.owner_id?.trim())
              .filter((ownerId): ownerId is string => !!ownerId)
          )
        );

        const ownerMapEntries = await Promise.all(
          ownerIds.map(async ownerId => {
            try {
              const userRes = await apiGet<unknown>(`/svc/user/users?uuid=${encodeURIComponent(ownerId)}&limit=1`);
              return [ownerId, pickFirstUserAuthName(userRes) ?? ''] as const;
            } catch {
              return [ownerId, ''] as const;
            }
          })
        );

        const ownerNameById: Record<string, string> = {};
        for (const [ownerId, authName] of ownerMapEntries) {
          ownerNameById[ownerId] = authName;
        }

        const withOwnerName = (item: Meeting): Meeting => ({
          ...item,
          owner_name: (item.owner_id && ownerNameById[item.owner_id]) || item.owner_id || '-',
        });

        setMeetings({
          recent: recentItems.map(withOwnerName),
          active: activeItems.map(withOwnerName),
          loading: false,
        });
      } catch {
        setMeetings(s => ({ ...s, loading: false }));
      }
    }

    fetchStats();
    fetchMeetings();
  }, []);

  const STAT_CARDS = [
    { label: t('dashboard.totalUsers'), value: stats.totalUsers, icon: 'bi-people-fill', variant: 'primary' },
    { label: t('dashboard.onlineUsers'), value: stats.onlineUsers, icon: 'bi-broadcast-pin', variant: 'success' },
    { label: t('dashboard.offlineUsers'), value: stats.offlineUsers, icon: 'bi-person-x-fill', variant: 'warning' },
    { label: t('dashboard.totalMeetings'), value: stats.totalMeetings, icon: 'bi-camera-video-fill', variant: 'info' },
    { label: t('dashboard.activeMeetings'), value: stats.activeMeetings, icon: 'bi-play-circle-fill', variant: 'success' },
    { label: t('dashboard.closedMeetings'), value: stats.closedMeetings, icon: 'bi-stop-circle-fill', variant: 'warning' },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mm-page-header">
        <div>
          <h2 className="mm-page-title">{t('dashboard.title')}</h2>
          <p className="mm-page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="col-12 col-sm-6 col-xl-4">
            <div className="mm-stat-card">
              <div className={`mm-stat-icon mm-stat-icon--${card.variant}`}>
                <i className={`bi ${card.icon}`} />
              </div>
              <div className="mm-stat-info">
                <p className="mm-stat-label">{card.label}</p>
                {stats.loading ? (
                  <div className="mm-skeleton" style={{ height: 32, width: 80, borderRadius: 6 }} />
                ) : (
                  <p className="mm-stat-value">
                    {typeof card.value === 'number' ? formatNumber(card.value, locale) : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables Row */}
      <div className="row g-3">
        {/* Recent Meetings */}
        <div className="col-12 col-xl-8">
          <div className="mm-table-wrap mm-dashboard-recent-wrap">
            <div className="mm-card-header mm-dashboard-recent-header">
              <div className="mm-dashboard-recent-title-wrap">
                <span className="mm-card-title">{t('dashboard.recentMeetings')}</span>
                <span className="mm-badge mm-badge-muted">
                  <i className="bi bi-collection-play" />
                  {meetings.loading ? '...' : `${formatNumber(meetings.recent.length, locale)}${t('common.countSuffix')}`}
                </span>
              </div>
            </div>
            {meetings.loading ? (
              <div className="mm-dashboard-recent-loading">
                <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
              </div>
            ) : meetings.recent.length === 0 ? (
              <div className="mm-empty-state">
                <i className="bi bi-camera-video-off" />
                <p>{t('dashboard.noMeetingData')}</p>
              </div>
            ) : (
              <table className="mm-table mm-dashboard-table">
                <thead>
                  <tr>
                    <th className="mm-col-meeting-name">{t('dashboard.meetingName')}</th>
                    <th className="mm-col-status">{t('dashboard.status')}</th>
                    <th className="mm-col-created">{t('dashboard.startedAtLabel')}</th>
                    <th className="mm-col-owner">{t('dashboard.owner')}</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.recent.map(m => {
                    const badge = meetingStatusBadge(m.status, {
                      held: t('status.held'),
                      closed: t('status.closed'),
                      created: t('status.created'),
                    });
                    return (
                      <tr key={m.meeting_id}>
                        <td className="mm-dashboard-meeting-name">{m.meeting_name ?? m.meeting_id}</td>
                        <td><span className={`mm-badge ${badge.cls}`}>{badge.label}</span></td>
                        <td className="mm-dashboard-muted">{formatDateTime(m.held_at, locale)}</td>
                        <td className="mm-dashboard-muted">{m.owner_name ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Active Meetings */}
        <div className="col-12 col-xl-4">
          <div className="mm-card" style={{ height: '100%' }}>
            <div className="mm-card-header">
              <span className="mm-card-title">{t('dashboard.activeMeetingList')}</span>
              <span className="mm-badge mm-badge-success">
                <i className="bi bi-circle-fill" style={{ fontSize: 8 }} />
                {meetings.loading ? '...' : meetings.active.length}{t('common.countSuffix')}
              </span>
            </div>
            <div className="mm-card-body" style={{ padding: 0 }}>
              {meetings.loading ? (
                <div className="mm-dashboard-active-loading">
                  <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
                </div>
              ) : meetings.active.length === 0 ? (
                <div className="mm-empty-state">
                  <i className="bi bi-camera-video-off" />
                  <p>{t('dashboard.noActiveMeetings')}</p>
                </div>
              ) : (
                <div className="mm-dashboard-active-list">
                  {meetings.active.map(m => {
                    const badge = meetingStatusBadge(m.status, {
                      held: t('status.held'),
                      closed: t('status.closed'),
                      created: t('status.created'),
                    });

                    return (
                      <article
                        key={m.meeting_id}
                        className={`mm-dashboard-active-item${selectedActiveMeetingId === m.meeting_id ? ' is-selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedActiveMeetingId(prev => prev === m.meeting_id ? null : m.meeting_id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedActiveMeetingId(prev => prev === m.meeting_id ? null : m.meeting_id);
                          }
                        }}
                      >
                        <div className="mm-dashboard-active-item-head">
                          <h3 className="mm-dashboard-active-item-title">{m.meeting_name ?? m.meeting_id}</h3>
                          <span className={`mm-badge ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <p className="mm-dashboard-active-item-meta">
                          <span>{t('dashboard.startedAtLabel')} : {formatDateTime(m.held_at, locale)}</span>
                          <span>{t('dashboard.owner')} : {m.owner_name ?? '-'}</span>
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
