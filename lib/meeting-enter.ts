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

export const POPUP_FALLBACK_USED_MESSAGE = 'popup_fallback_used';

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

function submitRedirectForm(actionUrl: string, fields: Record<string, string>, target?: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  if (target?.trim()) {
    form.target = target.trim();
  }
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

function normalizeRedirectUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('redirect url is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('redirect url is invalid');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('redirect url must start with http:// or https://');
  }

  return parsed.toString();
}

function createPopupWindow(popupName: string): Window {
  const popup = window.open('', popupName, 'popup=yes,width=1280,height=820,noopener,noreferrer');
  if (!popup) {
    throw new Error('popup_open_blocked');
  }
  return popup;
}

export function getDefaultMeetingRedirectUrl(): string {
  const apiBaseUrl = getConfiguredApiBaseUrl().trim().replace(/\/+$/, '');
  if (!apiBaseUrl) {
    throw new Error('API base url is not configured');
  }

  return `${apiBaseUrl}/svc/webutil/redirect`;
}

export interface StartMeetingEnterOptions {
  meetingId: string;
  password?: string;
  groupId?: string;
  redirectUrlOverride?: string;
  openInPopup?: boolean;
  fallbackToCurrentTabOnPopupBlocked?: boolean;
}

export async function startMeetingEnterFlow({
  meetingId,
  password,
  groupId,
  redirectUrlOverride,
  openInPopup = false,
  fallbackToCurrentTabOnPopupBlocked = true,
}: StartMeetingEnterOptions): Promise<void> {
  const trimmedMeetingId = meetingId.trim();
  if (!trimmedMeetingId) {
    throw new Error('meeting_id is required');
  }

  const popupName = `meeting-enter-popup-${trimmedMeetingId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  let popupWindow: Window | null = null;
  let popupFallbackUsed = false;
  if (openInPopup) {
    try {
      popupWindow = createPopupWindow(popupName);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'popup_open_blocked' && fallbackToCurrentTabOnPopupBlocked) {
        popupFallbackUsed = true;
      } else {
        throw err;
      }
    }
  }

  try {
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

    const redirectUrl = normalizeRedirectUrl(redirectUrlOverride?.trim() || getDefaultMeetingRedirectUrl());
    const resolvedMeetingId = extractMeetingId(prepared, trimmedMeetingId);
    const roleName = extractMeetingRole(prepared);
    const refreshToken = getRefreshToken() ?? '';
    const nickname = getUserDisplayName('User');

    submitRedirectForm(
      redirectUrl,
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        nickname,
        room_uuid: resolvedMeetingId,
        meeting_role: roleName,
      },
      openInPopup && !popupFallbackUsed ? popupName : undefined
    );

    popupWindow = null;

    if (popupFallbackUsed) {
      throw new Error(POPUP_FALLBACK_USED_MESSAGE);
    }
  } catch (err) {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    throw err;
  }
}