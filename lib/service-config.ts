export const DEFAULT_API_BASE_URL = 'https://mate3.dev.meetmate.co.kr';
export const API_BASE_URL_STORAGE_KEY = 'mm_api_base_url';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isValidApiBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getConfiguredApiBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_BASE_URL;

  const saved = localStorage.getItem(API_BASE_URL_STORAGE_KEY);
  if (!saved) return DEFAULT_API_BASE_URL;

  const normalized = normalizeBaseUrl(saved);
  return isValidApiBaseUrl(normalized) ? normalized : DEFAULT_API_BASE_URL;
}

export function saveApiBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value);
  localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
  return normalized;
}
