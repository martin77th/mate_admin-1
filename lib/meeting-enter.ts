import { apiPost } from './api';
import { getAccessToken, getRefreshToken, getStoredUser, getUserDisplayName } from './auth';
import { getConfiguredApiBaseUrl } from './service-config';

interface CheckEnterableBody {
  password?: string;
}

interface PrepareEnterBody {
  password?: string;
  user_id?: string;
  group_id?: string;
}

interface PrepareEnterResponse {
  result?: {
    meeting?: Record<string, unknown>;
    member?: Record<string, unknown>;
    others?: unknown[];
  };
}

function pickString(src: Record<string, unknown> | undefined, keys: string[]): string {
  if (!src) return '';
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function extractMeetingId(response: PrepareEnterResponse, fallbackMeetingId: string): string {
  const meeting = response.result?.meeting;
  const meetingId = pickString(meeting, ['meeting_id', 'meetingId', 'uuid', 'id']);
  return meetingId || fallbackMeetingId;
}

function extractMeetingRole(response: PrepareEnterResponse): string {
  const member = response.result?.member;
  const roleObj = member?.role;
  if (roleObj && typeof roleObj === 'object') {
    const roleName = pickString(roleObj as Record<string, unknown>, ['name']);
    if (roleName) return roleName;
  }

  const roleName = pickString(member, ['role_name', 'roleName']);
  return roleName || 'participant';
}

function submitRedirectForm(actionUrl: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  form.style.display = 'none';

  Object.entries(fields).forEach(([name, value]) => {
    if (!value) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export interface StartMeetingEnterOptions {
  meetingId: string;
  password?: string;
  groupId?: string;
}

export async function startMeetingEnterFlow({ meetingId, password, groupId }: StartMeetingEnterOptions): Promise<void> {
  const trimmedMeetingId = meetingId.trim();
  if (!trimmedMeetingId) {
    throw new Error('meeting_id is required');
  }

  const checkBody: CheckEnterableBody = {};
  if (password?.trim()) checkBody.password = password.trim();

  await apiPost(`/api/meeting/v1/meetings/${encodeURIComponent(trimmedMeetingId)}/check-enterable`, checkBody);

  const user = getStoredUser();
  const userId = (user?.user_id ?? user?.uuid ?? '').trim();
  const prepareBody: PrepareEnterBody = {};
  if (password?.trim()) prepareBody.password = password.trim();
  if (groupId?.trim()) prepareBody.group_id = groupId.trim();
  if (userId) prepareBody.user_id = userId;

  const prepared = await apiPost<PrepareEnterResponse>(
    `/api/meeting/v1/meetings/${encodeURIComponent(trimmedMeetingId)}/prepare-enter`,
    prepareBody
  );

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('access_token is missing');
  }

  const apiBaseUrl = getConfiguredApiBaseUrl().trim().replace(/\/+$/, '');
  if (!apiBaseUrl) {
    throw new Error('API base url is not configured');
  }

  const redirectUrl = `${apiBaseUrl}/svc/webutil/redirect`;
  const resolvedMeetingId = extractMeetingId(prepared, trimmedMeetingId);
  const roleName = extractMeetingRole(prepared);
  const refreshToken = getRefreshToken() ?? '';
  const nickname = getUserDisplayName('User');

  submitRedirectForm(redirectUrl, {
    access_token: accessToken,
    refresh_token: refreshToken,
    nickname,
    room_uuid: resolvedMeetingId,
    meeting_role: roleName,
  });
}