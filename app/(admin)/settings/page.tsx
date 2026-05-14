'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { useToast } from '@/components/Toast';
import { getAccessToken, getAuthContext } from '@/lib/auth';
import {
  getConfiguredApiBaseUrl,
  isValidApiBaseUrl,
  saveApiBaseUrl,
} from '@/lib/service-config';

type SettingsMenuKey =
  | 'meetingPolicy'
  | 'userPolicy'
  | 'apiCatalog';

type ApiCheckAuthMode = 'withToken' | 'none';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiCatalogScope = 'quick' | 'common' | 'dashboard' | 'users' | 'meetings';
type EditablePolicySection = 'meetingPolicy' | 'userPolicy';

interface PreparedPolicyRequest {
  section: EditablePolicySection;
  endpoint: string;
  payload: Record<string, unknown>;
}

interface ApiQuickCheckItem {
  id: string;
  uri: string;
  method: HttpMethod;
  authName: string;
  authPassword: string;
  pathParams: Record<string, string>;
  requestBody: string;
  confirmDangerousRequest: boolean;
}

interface ApiCatalogItem {
  method: HttpMethod;
  uri: string;
  actionKey?: string;
}

interface ApiCheckResult {
  id: string;
  sourceKey: string;
  checkedAtIso: string;
  method: HttpMethod;
  authMode: ApiCheckAuthMode;
  inputUri: string;
  resolvedUrl: string;
  ok: boolean;
  elapsedMs: number;
  statusCode?: number;
  summary: string;
  responsePreview: string;
}

let checkResultSeq = 0;

function getCurrentTimeMs(): number {
  return Date.now();
}

function createCheckResultId(): string {
  checkResultSeq += 1;
  return `check-${checkResultSeq}`;
}

const SETTINGS_MENU_KEYS: SettingsMenuKey[] = [
  'meetingPolicy',
  'userPolicy',
  'apiCatalog',
];

const API_SCOPE_BUTTONS: Array<{ key: ApiCatalogScope; labelKey: string }> = [
  { key: 'common', labelKey: 'settings.apiCatalog.scopeCommon' },
  { key: 'quick', labelKey: 'settings.apiCatalog.scopeQuickCheck' },
  { key: 'dashboard', labelKey: 'settings.apiCatalog.scopeDashboard' },
  { key: 'users', labelKey: 'settings.apiCatalog.scopeUsers' },
  { key: 'meetings', labelKey: 'settings.apiCatalog.scopeMeetings' },
];

const SETTINGS_POLICY_APPLY_ENABLED = false;

const SETTINGS_POLICY_ENDPOINTS = {
  meeting: '/api/meeting/v1/settings/update',
  user: '/api/user/v1/settings/option',
} as const;

function normalizeSettingsSection(value: string | null): SettingsMenuKey {
  if (!value) return 'meetingPolicy';
  return SETTINGS_MENU_KEYS.includes(value as SettingsMenuKey) ? (value as SettingsMenuKey) : 'meetingPolicy';
}

function resolveCheckUrl(inputUri: string): string {
  const trimmed = inputUri.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = getConfiguredApiBaseUrl().replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

function extractPathParamKeys(uri: string): string[] {
  const matches = uri.match(/\{[^}]+\}/g) ?? [];
  return Array.from(new Set(matches.map(token => token.slice(1, -1))));
}

function syncPathParams(uri: string, prev: Record<string, string>): Record<string, string> {
  const keys = extractPathParamKeys(uri);
  const next: Record<string, string> = {};
  for (const key of keys) {
    next[key] = prev[key] ?? '';
  }
  return next;
}

function applyPathParams(uri: string, values: Record<string, string>): string {
  return uri.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(values[key] ?? ''));
}

function formatResponsePreview(rawText: string): string {
  if (!rawText) return '-';
  try {
    const parsed = JSON.parse(rawText);
    return JSON.stringify(parsed, null, 2).slice(0, 4000);
  } catch {
    return rawText.slice(0, 4000);
  }
}

function getDefaultActionKey(method: HttpMethod): string {
  switch (method) {
    case 'POST':
      return 'settings.apiCatalog.actionRegister';
    case 'PUT':
      return 'settings.apiCatalog.actionUpdate';
    case 'DELETE':
      return 'settings.apiCatalog.actionDelete';
    default:
      return 'settings.apiCatalog.actionRead';
  }
}

function getRequestBodySample(uri: string, method: HttpMethod): string {
  if (method !== 'POST' && method !== 'PUT') return '';

  const normalized = uri
    .split('?')[0]
    .toLowerCase()
    .replace(/\{[^}]+\}/g, '');

  if (normalized.includes('/api/meeting/v1/meetings/') && normalized.endsWith('/members') && method === 'PUT') {
    return JSON.stringify({
      members: [
        {
          user_id: 'USER_UUID_1',
          role: 'participant',
        },
      ],
    }, null, 2);
  }

  if (normalized.includes('/api/meeting/v1/meetings') && method === 'POST') {
    return JSON.stringify({
      title: '샘플 미팅',
      description: 'API 검사 샘플 생성 데이터',
      start_at: '2026-05-14T09:00:00+09:00',
      end_at: '2026-05-14T10:00:00+09:00',
      visibility: 'public',
      max_participants: 20,
    }, null, 2);
  }

  if (normalized.includes('/api/meeting/v1/meetings') && method === 'PUT') {
    return JSON.stringify({
      title: '샘플 미팅(수정)',
      description: 'API 검사 샘플 수정 데이터',
      visibility: 'private',
      max_participants: 10,
    }, null, 2);
  }

  if (normalized.includes('/api/user/v1/users') && method === 'POST') {
    return JSON.stringify({
      auth_name: 'sample_admin',
      auth_password: 'SamplePass123!',
      user_name: '샘플 사용자',
      email: 'sample.user@example.com',
      role: 'user',
    }, null, 2);
  }

  if (normalized.includes('/api/user/v1/users') && method === 'PUT') {
    return JSON.stringify({
      user_name: '샘플 사용자(수정)',
      email: 'sample.user.updated@example.com',
      role: 'manager',
    }, null, 2);
  }

  return JSON.stringify({}, null, 2);
}

function buildMeetingPolicyPayload(draft: SettingsDraft): Record<string, unknown> {
  return {
    policy: {
      default_pre_entering_minutes: draft.defaultPreEntryMinutes,
      default_progress_minutes: draft.defaultMeetingMinutes,
      default_entry_option: draft.defaultEntryOption,
      default_visibility: draft.defaultVisibility,
      editable_statuses: draft.editableStatuses.split(',').map(item => item.trim()).filter(Boolean),
      retention_days: draft.retentionDays,
    },
  };
}

function buildUserPolicyPayload(draft: SettingsDraft): Record<string, unknown> {
  return {
    policy: {
      default_user_role: draft.defaultUserRole,
      password_min_length: draft.passwordMinLength,
      session_timeout_minutes: draft.sessionTimeoutMinutes,
      allow_multi_session: draft.allowMultiSession,
    },
  };
}

function preparePolicyRequest(section: EditablePolicySection, draft: SettingsDraft): PreparedPolicyRequest {
  if (section === 'meetingPolicy') {
    return {
      section,
      endpoint: SETTINGS_POLICY_ENDPOINTS.meeting,
      payload: buildMeetingPolicyPayload(draft),
    };
  }

  return {
    section,
    endpoint: SETTINGS_POLICY_ENDPOINTS.user,
    payload: buildUserPolicyPayload(draft),
  };
}

const IMPLEMENTED_API_GROUPS: Array<{
  groupId: string;
  titleKey: string;
  scopes: ApiCatalogScope[];
  items: ApiCatalogItem[];
}> = [
  {
    groupId: 'auth',
    titleKey: 'settings.apiCatalog.groupAuth',
    scopes: ['common'],
    items: [{ method: 'POST', uri: '/svc/user/issue-auth-token/by-password', actionKey: 'settings.apiCatalog.actionRead' }],
  },
  {
    groupId: 'dashboard',
    titleKey: 'settings.apiCatalog.groupDashboard',
    scopes: ['dashboard'],
    items: [
      { method: 'GET', uri: '/api/user/v1/users?limit=1' },
      { method: 'GET', uri: '/api/meeting/v1/meetings?limit=1&status=booked&status=created' },
      { method: 'GET', uri: '/api/meeting/v1/meetings?limit=1&status=held' },
      { method: 'GET', uri: '/api/meeting/v1/meetings?limit=1&status=closed&status=deleted' },
      { method: 'GET', uri: '/svc/meeting/meetings?limit=8&only_enterable=false&order_by=creation_time&order=desc&status=closed&status=deleted' },
      { method: 'GET', uri: '/svc/meeting/meetings?limit=8&only_enterable=false&order_by=creation_time&order=desc&status=held' },
      { method: 'GET', uri: '/svc/user/users?uuid={user_id}&limit=1' },
    ],
  },
  {
    groupId: 'users',
    titleKey: 'settings.apiCatalog.groupUsers',
    scopes: ['users'],
    items: [
      { method: 'GET', uri: '/svc/user/users' },
      { method: 'GET', uri: '/api/user/v1/users' },
      { method: 'POST', uri: '/api/user/v1/users' },
      { method: 'PUT', uri: '/api/user/v1/users/{user_id}' },
      { method: 'DELETE', uri: '/api/user/v1/users/{user_id}' },
    ],
  },
  {
    groupId: 'meetings',
    titleKey: 'settings.apiCatalog.groupMeetings',
    scopes: ['meetings'],
    items: [
      { method: 'GET', uri: '/svc/meeting/meetings' },
      { method: 'GET', uri: '/api/meeting/v1/meetings' },
      { method: 'POST', uri: '/api/meeting/v1/meetings' },
      { method: 'PUT', uri: '/api/meeting/v1/meetings/{meeting_id}' },
      { method: 'DELETE', uri: '/api/meeting/v1/meetings/{meeting_id}' },
      { method: 'GET', uri: '/api/meeting/v1/members', actionKey: 'settings.apiCatalog.actionUpdate' },
      { method: 'PUT', uri: '/api/meeting/v1/meetings/{meeting_id}/members' },
    ],
  },
];

const API_QUICK_CHECK_DEFAULTS: ApiQuickCheckItem[] = IMPLEMENTED_API_GROUPS.flatMap(group =>
  group.items.map((item, index) => {
    const method = item.method;
    const uri = item.uri;
    return {
      id: `${group.groupId}-${index}`,
      uri,
      method,
      authName: '',
      authPassword: '',
      pathParams: syncPathParams(uri, {}),
      requestBody: method === 'POST' || method === 'PUT' ? getRequestBodySample(uri, method) : '',
      confirmDangerousRequest: false,
    };
  })
);

interface SettingsDraft {
  serviceName: string;
  timezone: string;
  language: 'ko' | 'en';
  dateFormat: string;
  defaultPageSize: number;
  defaultPreEntryMinutes: number;
  defaultMeetingMinutes: number;
  defaultEntryOption: 'unlimited' | 'registered';
  defaultVisibility: 'public' | 'private';
  editableStatuses: string;
  retentionDays: number;
  defaultUserRole: 'participant' | 'presenter' | 'manager';
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
  allowMultiSession: boolean;
  toastPosition: 'top-right' | 'bottom-right';
  toastDurationMs: number;
  notifyMeetingEvents: boolean;
  notifyUserEvents: boolean;
  emailAlertsEnabled: boolean;
  showUserCards: boolean;
  showMeetingCards: boolean;
  metricDefinition: string;
  cardOrder: string;
  auditRetentionDays: number;
  maskPersonalData: boolean;
  requireConfirmDelete: boolean;
  adminMfaRequired: boolean;
  systemVersion: string;
  buildTime: string;
  apiBaseUrl: string;
}

const DEFAULT_DRAFT: SettingsDraft = {
  serviceName: 'MeetMate Admin',
  timezone: 'Asia/Seoul',
  language: 'ko',
  dateFormat: 'yyyy-MM-dd HH:mm',
  defaultPageSize: 20,
  defaultPreEntryMinutes: 5,
  defaultMeetingMinutes: 60,
  defaultEntryOption: 'unlimited',
  defaultVisibility: 'public',
  editableStatuses: 'created,booked',
  retentionDays: 365,
  defaultUserRole: 'participant',
  passwordMinLength: 8,
  sessionTimeoutMinutes: 120,
  allowMultiSession: true,
  toastPosition: 'top-right',
  toastDurationMs: 4000,
  notifyMeetingEvents: true,
  notifyUserEvents: true,
  emailAlertsEnabled: false,
  showUserCards: true,
  showMeetingCards: true,
  metricDefinition: '예약=booked+created, 진행=held, 종료/삭제=closed+deleted',
  cardOrder: '사용자 > 미팅 > 최근미팅 > 진행중미팅',
  auditRetentionDays: 180,
  maskPersonalData: true,
  requireConfirmDelete: true,
  adminMfaRequired: false,
  systemVersion: 'v0.1.0',
  buildTime: '-',
  apiBaseUrl: '-',
};

export default function SettingsPage() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const activeMenu = normalizeSettingsSection(searchParams.get('section'));
  const isEditableSection = activeMenu === 'meetingPolicy' || activeMenu === 'userPolicy';
  const [draft, setDraft] = useState<SettingsDraft>(DEFAULT_DRAFT);
  const [globalAuthMode, setGlobalAuthMode] = useState<ApiCheckAuthMode>('withToken');
  const [useCustomBearerToken, setUseCustomBearerToken] = useState(false);
  const [customBearerToken, setCustomBearerToken] = useState('');
  const [checkUri, setCheckUri] = useState('/api/user/v1/users?limit=1');
  const [checking, setChecking] = useState(false);
  const [checkingRowId, setCheckingRowId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<ApiCheckResult[]>([]);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [quickChecks, setQuickChecks] = useState<ApiQuickCheckItem[]>(API_QUICK_CHECK_DEFAULTS);
  const [activeApiScope, setActiveApiScope] = useState<ApiCatalogScope>('common');
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(getConfiguredApiBaseUrl());
  const [lastPreparedPolicy, setLastPreparedPolicy] = useState<PreparedPolicyRequest | null>(null);

  const resizeBodyTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const onSaveSection = () => {
    if (activeMenu !== 'meetingPolicy' && activeMenu !== 'userPolicy') {
      addToast('info', t('settings.statusUiOnly'), t('settings.plannedHint'));
      return;
    }

    const prepared = preparePolicyRequest(activeMenu, draft);
    setLastPreparedPolicy(prepared);

    // 향후 실제 API 적용 시 여기에서 endpoint/payload를 사용해 호출한다.
    console.info('[SettingsPolicySkeleton] Prepared policy request', prepared);

    if (!SETTINGS_POLICY_APPLY_ENABLED) {
      addToast(
        'info',
        t('settings.policySkeletonPreparedTitle'),
        `${t('settings.policySkeletonNotApplied')} (${prepared.endpoint})`
      );
      return;
    }
  };

  const onResetSection = () => {
    setDraft(DEFAULT_DRAFT);
    addToast('success', t('settings.resetSection'));
  };

  const runApiCheck = async (
    inputUri: string,
    sourceKey = 'manual',
    rowId?: string,
    options?: { method?: HttpMethod; body?: unknown }
  ) => {
    const resolvedUrl = resolveCheckUrl(inputUri);
    if (!resolvedUrl) {
      addToast('warning', t('settings.apiCatalog.invalidUri'));
      return;
    }

    if (rowId) {
      setCheckingRowId(rowId);
    } else {
      setChecking(true);
    }

    const started = getCurrentTimeMs();

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const method = options?.method ?? 'GET';
      const body = options?.body;

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      if (globalAuthMode === 'withToken') {
        const token = useCustomBearerToken ? customBearerToken.trim() : getAccessToken();
        if (!token) {
          addToast('warning', t('settings.apiCatalog.noTokenTitle'), t('settings.apiCatalog.noTokenDescription'));
        } else {
          headers.Authorization = `Bearer ${token}`;
        }

        const { tenantId } = getAuthContext();
        if (tenantId) {
          headers['X-Mate-Tenant-ID'] = tenantId;
        }
      }

      const response = await fetch(resolvedUrl, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const bodyText = await response.text().catch(() => '');
      const elapsedMs = getCurrentTimeMs() - started;

      const result: ApiCheckResult = {
        id: createCheckResultId(),
        sourceKey,
        checkedAtIso: new Date().toISOString(),
        method,
        authMode: globalAuthMode,
        inputUri,
        resolvedUrl,
        ok: response.ok,
        elapsedMs,
        statusCode: response.status,
        summary: response.ok ? t('settings.apiCatalog.checkSuccess') : t('settings.apiCatalog.checkFailed'),
        responsePreview: formatResponsePreview(bodyText),
      };

      setCheckResults(prev => [result, ...prev.filter(item => item.sourceKey !== sourceKey)]);
      setExpandedResultId(result.id);
      addToast(response.ok ? 'success' : 'warning', result.summary, `${response.status} (${elapsedMs}ms)`);
    } catch (error) {
      const elapsedMs = getCurrentTimeMs() - started;
      const message = error instanceof Error ? error.message : t('settings.apiCatalog.unknownError');

      const result: ApiCheckResult = {
        id: createCheckResultId(),
        sourceKey,
        checkedAtIso: new Date().toISOString(),
        method: options?.method ?? 'GET',
        authMode: globalAuthMode,
        inputUri,
        resolvedUrl,
        ok: false,
        elapsedMs,
        summary: t('settings.apiCatalog.checkFailed'),
        responsePreview: message,
      };

      setCheckResults(prev => [result, ...prev.filter(item => item.sourceKey !== sourceKey)]);
      setExpandedResultId(result.id);
      addToast('error', t('settings.apiCatalog.checkFailed'), message);
    } finally {
      if (rowId) {
        setCheckingRowId(null);
      } else {
        setChecking(false);
      }
    }
  };

  const onCheckApi = async () => {
    await runApiCheck(checkUri, 'manual');
  };

  const onApplyApiBaseUrl = () => {
    const trimmed = apiBaseUrlInput.trim();
    if (!isValidApiBaseUrl(trimmed)) {
      addToast('warning', t('settings.apiCatalog.invalidServiceUrl'));
      return;
    }

    const saved = saveApiBaseUrl(trimmed);
    setApiBaseUrlInput(saved);
    addToast('success', t('settings.apiCatalog.serviceUrlSaved'));
  };

  const updateQuickCheck = (id: string, patch: Partial<ApiQuickCheckItem>) => {
    setQuickChecks(prev => prev.map(item => {
      if (item.id !== id) return item;
      const merged = { ...item, ...patch };
      if (patch.uri !== undefined) {
        if ((merged.method === 'POST' || merged.method === 'PUT') && (!item.requestBody.trim() || item.requestBody.trim() === '{}')) {
          merged.requestBody = getRequestBodySample(patch.uri, merged.method);
        }
        merged.pathParams = syncPathParams(patch.uri, merged.pathParams ?? {});
      }
      return merged;
    }));
  };

  const getQuickCheckById = (id: string): ApiQuickCheckItem => {
    return quickChecks.find(item => item.id === id) ?? {
      id,
      uri: '',
      method: 'GET',
      authName: '',
      authPassword: '',
      pathParams: {},
      requestBody: '',
      confirmDangerousRequest: false,
    };
  };

  const isAuthTokenEndpoint = (itemId: string, uri: string): boolean => {
    return itemId === 'auth-0' || uri.includes('/svc/user/issue-auth-token/by-password');
  };

  const visibleApiGroups = IMPLEMENTED_API_GROUPS.filter(group => group.scopes.includes(activeApiScope));

  const renderResultAccordion = (sourceKey: string) => {
    const results = checkResults.filter(result => result.sourceKey === sourceKey);
    if (results.length === 0) return null;

    return (
      <div className="mm-settings-api-accordion">
        {results.map(result => {
          const expanded = expandedResultId === result.id;
          return (
            <section key={result.id} className="mm-settings-api-accordion-item">
              <button
                type="button"
                className="mm-settings-api-accordion-toggle"
                onClick={() => setExpandedResultId(prev => (prev === result.id ? null : result.id))}
                aria-expanded={expanded}
              >
                <span className={`mm-badge ${result.ok ? 'mm-badge-success' : 'mm-badge-danger'}`}>
                  {result.ok ? 'OK' : 'FAIL'}
                </span>
                <span className="mm-settings-api-accordion-title">{result.inputUri}</span>
                <span className="mm-settings-api-accordion-meta">
                  {new Date(result.checkedAtIso).toLocaleString()} / {result.elapsedMs}ms
                </span>
                <i className={`bi ${expanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
              </button>

              {expanded && (
                <div className="mm-settings-api-accordion-body">
                  <p><strong>{t('settings.apiCatalog.resolvedUrl')}</strong>: {result.resolvedUrl}</p>
                  <p><strong>{t('settings.apiCatalog.methodLabel')}</strong>: {result.method}</p>
                  <p><strong>{t('settings.apiCatalog.authLabel')}</strong>: {result.authMode === 'withToken' ? t('settings.apiCatalog.authWithToken') : t('settings.apiCatalog.authNone')}</p>
                  <p><strong>{t('settings.apiCatalog.statusCode')}</strong>: {result.statusCode ?? '-'}</p>
                  <p><strong>{t('settings.apiCatalog.summaryLabel')}</strong>: {result.summary}</p>
                  <pre className="mm-settings-api-response-preview">{result.responsePreview}</pre>
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderSectionBody = () => {
    switch (activeMenu) {
      case 'meetingPolicy':
        return (
          <div className="mm-settings-grid">
            <label className="mm-settings-field">
              <span>{t('settings.meetingPolicy.defaultPreEntry')}</span>
              <input
                type="number"
                min={0}
                className="mm-form-control"
                value={draft.defaultPreEntryMinutes}
                onChange={e => setDraft(prev => ({ ...prev, defaultPreEntryMinutes: Number(e.target.value || 0) }))}
              />
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.meetingPolicy.defaultDuration')}</span>
              <input
                type="number"
                min={1}
                className="mm-form-control"
                value={draft.defaultMeetingMinutes}
                onChange={e => setDraft(prev => ({ ...prev, defaultMeetingMinutes: Number(e.target.value || 1) }))}
              />
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.meetingPolicy.defaultEntryOption')}</span>
              <select
                className="mm-form-control"
                value={draft.defaultEntryOption}
                onChange={e => setDraft(prev => ({ ...prev, defaultEntryOption: e.target.value as 'unlimited' | 'registered' }))}
              >
                <option value="unlimited">unlimited</option>
                <option value="registered">registered</option>
              </select>
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.meetingPolicy.defaultVisibility')}</span>
              <select
                className="mm-form-control"
                value={draft.defaultVisibility}
                onChange={e => setDraft(prev => ({ ...prev, defaultVisibility: e.target.value as 'public' | 'private' }))}
              >
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
            <label className="mm-settings-field mm-settings-field-wide">
              <span>{t('settings.meetingPolicy.editableStatuses')}</span>
              <input
                className="mm-form-control"
                value={draft.editableStatuses}
                onChange={e => setDraft(prev => ({ ...prev, editableStatuses: e.target.value }))}
              />
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.meetingPolicy.retentionDays')}</span>
              <input
                type="number"
                min={1}
                className="mm-form-control"
                value={draft.retentionDays}
                onChange={e => setDraft(prev => ({ ...prev, retentionDays: Number(e.target.value || 1) }))}
              />
            </label>
          </div>
        );
      case 'userPolicy':
        return (
          <div className="mm-settings-grid">
            <label className="mm-settings-field">
              <span>{t('settings.userPolicy.defaultRole')}</span>
              <select
                className="mm-form-control"
                value={draft.defaultUserRole}
                onChange={e => setDraft(prev => ({ ...prev, defaultUserRole: e.target.value as 'participant' | 'presenter' | 'manager' }))}
              >
                <option value="participant">participant</option>
                <option value="presenter">presenter</option>
                <option value="manager">manager</option>
              </select>
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.userPolicy.passwordPolicy')}</span>
              <input
                type="number"
                min={6}
                className="mm-form-control"
                value={draft.passwordMinLength}
                onChange={e => setDraft(prev => ({ ...prev, passwordMinLength: Number(e.target.value || 6) }))}
              />
            </label>
            <label className="mm-settings-field">
              <span>{t('settings.userPolicy.sessionTimeout')}</span>
              <input
                type="number"
                min={10}
                className="mm-form-control"
                value={draft.sessionTimeoutMinutes}
                onChange={e => setDraft(prev => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value || 10) }))}
              />
            </label>
            <label className="mm-settings-check">
              <input
                type="checkbox"
                checked={draft.allowMultiSession}
                onChange={e => setDraft(prev => ({ ...prev, allowMultiSession: e.target.checked }))}
              />
              <span>{t('settings.userPolicy.allowMultiSession')}</span>
            </label>
          </div>
        );
      case 'apiCatalog':
        return (
          <div>
            <div className="mm-settings-api-scope-tabs" role="tablist" aria-label={t('settings.apiCatalog.scopeTabsLabel')}>
              {API_SCOPE_BUTTONS.map(scope => (
                <button
                  key={scope.key}
                  type="button"
                  role="tab"
                  aria-selected={activeApiScope === scope.key}
                  className={`mm-settings-api-scope-tab ${activeApiScope === scope.key ? 'active' : ''}`}
                  onClick={() => setActiveApiScope(scope.key)}
                >
                  {t(scope.labelKey)}
                </button>
              ))}
            </div>

            <div className="mm-settings-api-list">
              {activeApiScope === 'quick' && (
                <section className="mm-settings-api-group">
                  <h3 className="mm-settings-api-group-title">{t('settings.apiCatalog.quickCheckTitle')}</h3>

                  <div className="mm-settings-api-auth-grid">
                    <label className="mm-settings-field">
                      <span>{t('settings.apiCatalog.authLabel')}</span>
                      <select
                        className="mm-form-control"
                        value={globalAuthMode}
                        onChange={e => setGlobalAuthMode(e.target.value as ApiCheckAuthMode)}
                      >
                        <option value="withToken">{t('settings.apiCatalog.authWithToken')}</option>
                        <option value="none">{t('settings.apiCatalog.authNone')}</option>
                      </select>
                    </label>

                    <label className="mm-settings-check">
                      <input
                        type="checkbox"
                        checked={useCustomBearerToken}
                        onChange={e => setUseCustomBearerToken(e.target.checked)}
                      />
                      <span>{t('settings.apiCatalog.useCustomBearerToken')}</span>
                    </label>

                    <label className="mm-settings-field mm-settings-field-wide">
                      <span>{t('settings.apiCatalog.bearerTokenLabel')}</span>
                      <input
                        className="mm-form-control"
                        placeholder={t('settings.apiCatalog.bearerTokenPlaceholder')}
                        value={customBearerToken}
                        onChange={e => setCustomBearerToken(e.target.value)}
                        disabled={!useCustomBearerToken || globalAuthMode === 'none'}
                      />
                    </label>
                  </div>

                  <div className="mm-settings-api-check-row">
                    <label className="mm-settings-field">
                      <span>{t('settings.apiCatalog.uriLabel')}</span>
                      <input
                        className="mm-form-control"
                        placeholder={t('settings.apiCatalog.uriPlaceholder')}
                        value={checkUri}
                        onChange={e => setCheckUri(e.target.value)}
                      />
                    </label>

                    <div className="mm-settings-api-check-submit">
                      <button type="button" className="mm-btn mm-btn-primary" onClick={onCheckApi} disabled={checking}>
                        {checking ? t('settings.apiCatalog.checking') : t('settings.apiCatalog.checkButton')}
                      </button>
                    </div>
                  </div>

                  {renderResultAccordion('manual')}

                  <p className="mm-form-hint" style={{ marginTop: 0, marginBottom: 0 }}>
                    {t('settings.apiCatalog.description')}
                  </p>
                </section>
              )}

              {activeApiScope === 'common' && (
                <section className="mm-settings-api-group">
                  <h3 className="mm-settings-api-group-title">{t('settings.apiCatalog.serviceUrlTitle')}</h3>
                  <div className="mm-settings-api-check-row">
                    <label className="mm-settings-field">
                      <span>{t('settings.apiCatalog.serviceUrlLabel')}</span>
                      <input
                        className="mm-form-control"
                        placeholder="https://example.com"
                        value={apiBaseUrlInput}
                        onChange={e => setApiBaseUrlInput(e.target.value)}
                      />
                    </label>
                    <div className="mm-settings-api-check-submit">
                      <button type="button" className="mm-btn mm-btn-primary" onClick={onApplyApiBaseUrl}>
                        {t('settings.apiCatalog.applyServiceUrl')}
                      </button>
                    </div>
                  </div>
                  <p className="mm-form-hint" style={{ marginTop: 0, marginBottom: 0 }}>
                    {t('settings.apiCatalog.currentServiceUrl')}: {getConfiguredApiBaseUrl()}
                  </p>
                </section>
              )}

              {visibleApiGroups.map(group => (
                <section key={group.titleKey} className="mm-settings-api-group">
                  <h3 className="mm-settings-api-group-title">{t(group.titleKey)}</h3>
                  <div className="mm-settings-api-quick-list">
                    {group.items.map((item, index) => {
                      const rowId = `${group.groupId}-${index}`;
                      const quick = getQuickCheckById(rowId);
                      const isAuthEndpoint = isAuthTokenEndpoint(rowId, quick.uri);
                      const pathParamKeys = extractPathParamKeys(quick.uri);
                      return (
                        <div key={rowId} className="mm-settings-api-quick-row-block">
                          <div className="mm-settings-api-quick-row">
                            <label className="mm-settings-field">
                              <span>{`(${t(item.actionKey ?? getDefaultActionKey(item.method))}) ${item.method} ${item.uri}`}</span>
                              <input
                                className="mm-form-control"
                                value={quick.uri}
                                onChange={e => updateQuickCheck(rowId, { uri: e.target.value })}
                              />
                            </label>

                            <div className="mm-settings-api-check-submit">
                              <button
                                type="button"
                                className="mm-btn mm-btn-primary"
                                disabled={checkingRowId === rowId}
                                onClick={() => {
                                  const hasMissingPathParam = pathParamKeys.some(key => !quick.pathParams[key]?.trim());
                                  if (hasMissingPathParam) {
                                    addToast('warning', t('settings.apiCatalog.pathParamRequired'));
                                    return;
                                  }

                                  if (quick.method === 'DELETE' && !quick.confirmDangerousRequest) {
                                    addToast('warning', t('settings.apiCatalog.deleteConfirmRequired'));
                                    return;
                                  }

                                  let body: unknown;
                                  if (isAuthEndpoint) {
                                    if (!quick.authName.trim() || !quick.authPassword.trim()) {
                                      addToast('warning', t('settings.apiCatalog.authCredentialRequired'));
                                      return;
                                    }
                                    body = {
                                      auth_name: quick.authName,
                                      auth_password: quick.authPassword,
                                    };
                                  } else if (quick.method === 'POST' || quick.method === 'PUT') {
                                    const bodyRaw = quick.requestBody.trim();
                                    if (!bodyRaw) {
                                      addToast('warning', t('settings.apiCatalog.requestBodyRequired'));
                                      return;
                                    }
                                    try {
                                      body = JSON.parse(bodyRaw);
                                    } catch {
                                      addToast('warning', t('settings.apiCatalog.requestBodyInvalidJson'));
                                      return;
                                    }
                                  }

                                  const uriWithParams = applyPathParams(quick.uri, quick.pathParams);
                                  runApiCheck(uriWithParams, rowId, rowId, { method: quick.method, body });
                                }}
                              >
                                {checkingRowId === rowId ? t('settings.apiCatalog.checking') : t('settings.apiCatalog.checkButton')}
                              </button>
                            </div>
                          </div>

                          {pathParamKeys.length > 0 && (
                            <div className="mm-settings-api-path-params-grid">
                              {pathParamKeys.map(paramKey => (
                                <label key={`${rowId}-${paramKey}`} className="mm-settings-field">
                                  <span>{`${t('settings.apiCatalog.pathParamLabel')}: ${paramKey}`}</span>
                                  <input
                                    className="mm-form-control"
                                    value={quick.pathParams[paramKey] ?? ''}
                                    onChange={e => updateQuickCheck(rowId, {
                                      pathParams: {
                                        ...quick.pathParams,
                                        [paramKey]: e.target.value,
                                      },
                                    })}
                                  />
                                </label>
                              ))}
                            </div>
                          )}

                          {isAuthEndpoint && (
                            <div className="mm-settings-api-auth-credentials">
                              <label className="mm-settings-field">
                                <span>{t('settings.apiCatalog.authNameLabel')}</span>
                                <input
                                  className="mm-form-control"
                                  value={quick.authName}
                                  onChange={e => updateQuickCheck(rowId, { authName: e.target.value })}
                                />
                              </label>
                              <label className="mm-settings-field">
                                <span>{t('settings.apiCatalog.authPasswordLabel')}</span>
                                <input
                                  type="password"
                                  className="mm-form-control"
                                  value={quick.authPassword}
                                  onChange={e => updateQuickCheck(rowId, { authPassword: e.target.value })}
                                />
                              </label>
                            </div>
                          )}

                          {!isAuthEndpoint && (quick.method === 'POST' || quick.method === 'PUT') && (
                            <div className="mm-settings-api-body-block">
                              <label className="mm-settings-field">
                                <span>{t('settings.apiCatalog.requestBodyLabel')}</span>
                                <textarea
                                  className="mm-form-control mm-settings-api-body-input"
                                  ref={resizeBodyTextarea}
                                  value={quick.requestBody}
                                  onInput={e => resizeBodyTextarea(e.currentTarget)}
                                  onChange={e => updateQuickCheck(rowId, { requestBody: e.target.value })}
                                />
                              </label>
                              <div className="mm-settings-api-body-actions">
                                <button
                                  type="button"
                                  className="mm-btn mm-btn-secondary"
                                  onClick={() => updateQuickCheck(rowId, { requestBody: getRequestBodySample(quick.uri, quick.method) })}
                                >
                                  {t('settings.apiCatalog.fillBodySample')}
                                </button>
                              </div>
                            </div>
                          )}

                          {quick.method === 'DELETE' && (
                            <label className="mm-settings-check">
                              <input
                                type="checkbox"
                                checked={quick.confirmDangerousRequest}
                                onChange={e => updateQuickCheck(rowId, { confirmDangerousRequest: e.target.checked })}
                              />
                              <span>{t('settings.apiCatalog.deleteConfirmLabel')}</span>
                            </label>
                          )}

                          {renderResultAccordion(rowId)}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="mm-settings-page">
      <div className="mm-card mm-settings-content-card">
        <div className="mm-card-body">
          {renderSectionBody()}

          {isEditableSection && (
            <div className="mm-settings-actions">
              <p className="mm-form-hint" style={{ margin: 0, alignSelf: 'center' }}>
                {lastPreparedPolicy && lastPreparedPolicy.section === activeMenu
                  ? `${t('settings.policySkeletonPreparedHint')} (${lastPreparedPolicy.endpoint})`
                  : t('settings.policySkeletonDraftHint')}
              </p>
              <button type="button" className="mm-btn mm-btn-secondary" onClick={onResetSection}>
                {t('settings.resetSection')}
              </button>
              <button type="button" className="mm-btn mm-btn-primary" onClick={onSaveSection}>
                {t('settings.saveDraft')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
