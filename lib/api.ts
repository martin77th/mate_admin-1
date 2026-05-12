import { getConfiguredApiBaseUrl } from './service-config';
import { getAuthContext } from './auth';

export class ApiError extends Error {
  status: number;
  code?: string;
  responseBody?: unknown;

  constructor(status: number, message: string, code?: string, responseBody?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.responseBody = responseBody;
  }
}

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

      const { tenantId } = getAuthContext();
      if (tenantId && !headers['X-Mate-Tenant-ID']) {
        headers['X-Mate-Tenant-ID'] = tenantId;
      }
    }
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    let parsed: unknown;
    let code: string | undefined;
    let message = `API Error ${res.status}: ${text}`;

    try {
      parsed = JSON.parse(text);
      const asObj = parsed as {
        error?: string;
        message?: { format?: string };
      };
      code = asObj.error;
      if (asObj.message?.format) {
        message = asObj.message.format;
      }
    } catch {
      // Keep the fallback raw-text message.
    }

    throw new ApiError(res.status, message, code, parsed ?? text);
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
