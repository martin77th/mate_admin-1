import { getConfiguredApiBaseUrl } from './service-config';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mm_access_token');
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mm_access_token');
    localStorage.removeItem('mm_refresh_token');
    localStorage.removeItem('mm_user');
    window.location.href = '/login';
  }
}

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { skipAuth, ...init } = options;
  const baseUrl = getConfiguredApiBaseUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export function apiPost<T = unknown>(path: string, body: unknown, options?: ApiOptions): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...options });
}

export function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}

export interface ApiListResponse<T> {
  error: string;
  message: { format: string; params: string[] };
  result: {
    found_count: number;
    total_count: number;
    items: T[];
  };
}

export interface ApiItemResponse<T> {
  error: string;
  message: { format: string; params: string[] };
  result: T;
}
