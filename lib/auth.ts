import { apiPost } from './api';

const TOKEN_KEY = 'mm_access_token';
const REFRESH_KEY = 'mm_refresh_token';
const USER_KEY = 'mm_user';

export interface AuthUser {
  user_id?: string;
  auth_name?: string;
  user_name?: string;
  role?: string;
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

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
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

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

export function saveTokens(accessToken: string, refreshToken: string, user?: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
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
  return res;
}

export function logout() {
  clearTokens();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
