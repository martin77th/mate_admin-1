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

export default function DashboardPage() {
  const { locale, t } = useI18n();
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
        const [recent, active] = await Promise.all([
          apiGet<ApiListResponse<Meeting>>('/api/meeting/v1/meetings?limit=8&order_by=created_at&order=desc'),
          apiGet<ApiListResponse<Meeting>>('/api/meeting/v1/meetings?limit=8&status=held'),
        ]);
        setMeetings({
          recent:  recent.result?.items  ?? [],
          active:  active.result?.items  ?? [],
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
                    <th className="mm-col-created">{t('dashboard.createdAt')}</th>
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
                        <td className="mm-dashboard-muted">{formatDateTime(m.created_at, locale)}</td>
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
                <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
                  <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
                </div>
              ) : meetings.active.length === 0 ? (
                <div className="mm-empty-state">
                  <i className="bi bi-camera-video-off" />
                  <p>{t('dashboard.noActiveMeetings')}</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {meetings.active.map((m, i) => (
                    <li
                      key={m.meeting_id}
                      style={{
                        padding: '12px 20px',
                        borderBottom: i < meetings.active.length - 1 ? '1px solid var(--mm-border)' : 'none',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mm-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.meeting_name ?? m.meeting_id}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                          {m.held_at
                            ? `${t('dashboard.startedAtLabel')}: ${formatDateTime(m.held_at, locale)}`
                            : `${t('dashboard.createdAtLabel')}: ${formatDateTime(m.created_at, locale)}`}
                        </div>
                      </div>
                      <span className="mm-badge mm-badge-success">
                        {meetingStatusBadge(m.status, {
                          held: t('status.held'),
                          closed: t('status.closed'),
                          created: t('status.created'),
                        }).label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
