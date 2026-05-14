import { apiPost } from './api';

const TOKEN_KEY = 'mm_access_token';
const REFRESH_KEY = 'mm_refresh_token';
const USER_KEY = 'mm_user';

export interface AuthUser {
  uuid?: string;
  user_id?: string;
  tenant_id?: string;
  auth_name?: string;
  user_name?: string;
  role?: string | {
    name?: string;
    level?: number;
    permissions?: string[];
  };
}

export interface LoginResponse {
  error: string;
  message: { format: string; params: string[] };
  result?: {
    access_token?: string;
    refresh_token?: string;
    user?: AuthUser;
  };
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
}

interface VerifyAuthTokenResponse {
  error?: string;
  message?: { format?: string; params?: string[] };
  result?: {
    user?: AuthUser;
  };
  user?: AuthUser;
}

export const AUTH_ERROR_ADMIN_ONLY = 'AUTH_ADMIN_ONLY';
const ADMIN_ROLE_NAMES = new Set(['admin', 'administrator', 'super_admin', 'system_admin', 'master']);

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padLength)}`;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(padded);
  }
  return '';
}

function getTokenPayload(): Record<string, unknown> | null {
  const token = getAccessToken();
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) return null;
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface AuthContext {
  tenantId?: string;
  roleName?: string;
  roleLevel?: number;
  permissions: string[];
}

const EMPTY_AUTH_CONTEXT: AuthContext = { permissions: [] };
let cachedAuthContextKey = '';
let cachedAuthContext: AuthContext = EMPTY_AUTH_CONTEXT;

export function getAuthContext(): AuthContext {
  if (typeof window === 'undefined') return EMPTY_AUTH_CONTEXT;

  const tokenRaw = localStorage.getItem(TOKEN_KEY) ?? '';
  const userRaw = localStorage.getItem(USER_KEY) ?? '';
  const cacheKey = `${tokenRaw}::${userRaw}`;
  if (cacheKey === cachedAuthContextKey) {
    return cachedAuthContext;
  }

  const user = getStoredUser();
  const payload = getTokenPayload();

  const payloadUser = (payload?.user as Record<string, unknown> | undefined) ?? {};
  const userRoleObj = typeof user?.role === 'object' && user.role ? user.role : undefined;
  const payloadRoleObj = (payloadUser.role as Record<string, unknown> | undefined) ?? undefined;

  const roleName =
    (typeof user?.role === 'string' ? user.role : undefined) ??
    (userRoleObj?.name as string | undefined) ??
    (payloadRoleObj?.name as string | undefined);
  const roleLevelRaw = userRoleObj?.level ?? payloadRoleObj?.level;
  const roleLevel = typeof roleLevelRaw === 'number' ? roleLevelRaw : undefined;

  const permissionsRaw = userRoleObj?.permissions ?? payloadRoleObj?.permissions;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw.filter((item): item is string => typeof item === 'string')
    : [];

  const tenantId =
    user?.tenant_id ??
    (typeof payloadUser.tenant_id === 'string' ? payloadUser.tenant_id : undefined) ??
    (typeof payload?.tenant_id === 'string' ? payload.tenant_id : undefined);

  cachedAuthContextKey = cacheKey;
  cachedAuthContext = { tenantId, roleName, roleLevel, permissions };
  return cachedAuthContext;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

function getTrimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getUserDisplayName(fallback = 'User'): string {
  const user = getStoredUser();

  const userCandidates = [
    user?.user_name,
    user?.auth_name,
    user?.user_id,
    user?.uuid,
  ];

  for (const candidate of userCandidates) {
    const trimmed = getTrimmedString(candidate);
    if (trimmed) return trimmed;
  }

  const payload = getTokenPayload();
  const payloadUser = (payload?.user as Record<string, unknown> | undefined) ?? undefined;
  const payloadCandidates = [
    payloadUser?.user_name,
    payloadUser?.auth_name,
    payloadUser?.user_id,
    payloadUser?.name,
    payload?.preferred_username,
    payload?.name,
    payload?.sub,
  ];

  for (const candidate of payloadCandidates) {
    const trimmed = getTrimmedString(candidate);
    if (trimmed) return trimmed;
  }

  return fallback;
}

function getRoleNameFromUser(user?: AuthUser | null): string {
  if (!user?.role) return '';
  if (typeof user.role === 'string') return user.role.trim().toLowerCase();
  if (typeof user.role === 'object' && user.role !== null) {
    return (user.role.name ?? '').trim().toLowerCase();
  }
  return '';
}

function hasAdminPermission(user?: AuthUser | null): boolean {
  if (!user?.role || typeof user.role !== 'object' || user.role === null) return false;
  const permissions = Array.isArray(user.role.permissions) ? user.role.permissions : [];
  return permissions.some(permission => {
    const normalized = permission.trim().toLowerCase();
    return normalized === '*' || normalized === 'admin' || normalized.startsWith('admin:');
  });
}

export function isAdminUser(user?: AuthUser | null): boolean {
  const roleName = getRoleNameFromUser(user);
  if (roleName && ADMIN_ROLE_NAMES.has(roleName)) return true;
  return hasAdminPermission(user);
}

export function isAdminSession(): boolean {
  if (!isLoggedIn()) return false;

  const user = getStoredUser();
  if (isAdminUser(user)) return true;

  const authContext = getAuthContext();
  const roleName = (authContext.roleName ?? '').trim().toLowerCase();
  if (roleName && ADMIN_ROLE_NAMES.has(roleName)) return true;

  return authContext.permissions.some(permission => {
    const normalized = permission.trim().toLowerCase();
    return normalized === '*' || normalized === 'admin' || normalized.startsWith('admin:');
  });
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

export function saveTokens(accessToken: string, refreshToken: string, user?: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function refreshUserProfileAfterLogin(): Promise<AuthUser | null> {
  try {
    const res = await apiPost<VerifyAuthTokenResponse>(
      '/svc/user/verify-auth-token/by-self',
      {}
    );
    const verifiedUser = res?.result?.user ?? res?.user;
    if (!verifiedUser) return null;
    localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
    return verifiedUser;
  } catch {
    // 로그인 자체는 성공했으므로 프로필 재조회 실패는 무시한다.
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(authName: string, authPassword: string): Promise<LoginResponse> {
  const res = await apiPost<LoginResponse>(
    '/svc/user/issue-auth-token/by-password',
    { auth_name: authName, auth_password: authPassword },
    { skipAuth: true }
  );

  const accessToken = res.result?.access_token ?? res.access_token;
  const refreshToken = res.result?.refresh_token ?? res.refresh_token;
  const user = res.result?.user ?? res.user;
  if (!accessToken || !refreshToken) {
    const message = res.message?.format || res.error || 'Login failed';
    throw new Error(message);
  }

  saveTokens(accessToken, refreshToken, user);
  await refreshUserProfileAfterLogin();

  if (!isAdminSession()) {
    clearTokens();
    throw new Error(AUTH_ERROR_ADMIN_ONLY);
  }

  return res;
}

export function logout() {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
