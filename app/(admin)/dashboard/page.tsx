'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { ApiListResponse } from '@/lib/api';
import { formatDateTime, meetingStatusBadge, formatNumber } from '@/lib/utils';

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
  const [stats, setStats] = useState<StatState>({
    totalUsers: 0, totalMeetings: 0, activeMeetings: 0, closedMeetings: 0, loading: true,
  });
  const [meetings, setMeetings] = useState<MeetingsState>({ recent: [], active: [], loading: true });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [users, total, active, closed] = await Promise.all([
          apiGet<ApiListResponse<unknown>>('/api/user/v1/users?limit=1'),
          apiGet<ApiListResponse<unknown>>('/api/meeting/v1/meetings?limit=1'),
          apiGet<ApiListResponse<unknown>>('/api/meeting/v1/meetings?limit=1&status=held'),
          apiGet<ApiListResponse<unknown>>('/api/meeting/v1/meetings?limit=1&status=closed'),
        ]);
        setStats({
          totalUsers:    users.result?.total_count   ?? 0,
          totalMeetings: total.result?.total_count   ?? 0,
          activeMeetings: active.result?.total_count ?? 0,
          closedMeetings: closed.result?.total_count ?? 0,
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
    { label: '전체 사용자',  value: stats.totalUsers,    icon: 'bi-people-fill',         variant: 'primary' },
    { label: '전체 미팅',    value: stats.totalMeetings,  icon: 'bi-camera-video-fill',   variant: 'info' },
    { label: '진행 중 미팅', value: stats.activeMeetings, icon: 'bi-play-circle-fill',    variant: 'success' },
    { label: '종료된 미팅',  value: stats.closedMeetings, icon: 'bi-stop-circle-fill',    variant: 'warning' },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mm-page-header">
        <div>
          <h2 className="mm-page-title">대시보드</h2>
          <p className="mm-page-subtitle">MeetMate 서비스 현황을 한눈에 확인하세요.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {STAT_CARDS.map(card => (
          <div key={card.label} className="col-12 col-sm-6 col-xl-3">
            <div className="mm-stat-card">
              <div className={`mm-stat-icon mm-stat-icon--${card.variant}`}>
                <i className={`bi ${card.icon}`} />
              </div>
              <div className="mm-stat-info">
                <p className="mm-stat-label">{card.label}</p>
                {stats.loading ? (
                  <div className="mm-skeleton" style={{ height: 32, width: 80, borderRadius: 6 }} />
                ) : (
                  <p className="mm-stat-value">{formatNumber(card.value)}</p>
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
          <div className="mm-table-wrap">
            <div className="mm-card-header">
              <span className="mm-card-title">최근 미팅</span>
            </div>
            {meetings.loading ? (
              <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner-border text-primary" style={{ width: 24, height: 24, borderWidth: 2 }} />
              </div>
            ) : meetings.recent.length === 0 ? (
              <div className="mm-empty-state">
                <i className="bi bi-camera-video-off" />
                <p>미팅 데이터가 없습니다.</p>
              </div>
            ) : (
              <table className="mm-table">
                <thead>
                  <tr>
                    <th>미팅명</th>
                    <th>상태</th>
                    <th>생성일</th>
                    <th>주최자</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.recent.map(m => {
                    const badge = meetingStatusBadge(m.status);
                    return (
                      <tr key={m.meeting_id}>
                        <td style={{ fontWeight: 500 }}>{m.meeting_name ?? m.meeting_id}</td>
                        <td><span className={`mm-badge ${badge.cls}`}>{badge.label}</span></td>
                        <td style={{ color: 'var(--mm-text-secondary)' }}>{formatDateTime(m.created_at)}</td>
                        <td style={{ color: 'var(--mm-text-secondary)' }}>{m.owner_name ?? '-'}</td>
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
              <span className="mm-card-title">진행 중인 미팅</span>
              <span className="mm-badge mm-badge-success">
                <i className="bi bi-circle-fill" style={{ fontSize: 8 }} />
                {meetings.loading ? '...' : meetings.active.length}개
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
                  <p>진행 중인 미팅이 없습니다.</p>
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
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mm-success)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mm-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.meeting_name ?? m.meeting_id}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>
                          {m.held_at ? formatDateTime(m.held_at) : formatDateTime(m.created_at)}
                        </div>
                      </div>
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
