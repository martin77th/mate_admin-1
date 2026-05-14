const ENV_DEFAULT_API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim();
const LEGACY_DEFAULT_API_BASE_URL = 'https://mate3.dev.meetmate.co.kr';

export const DEFAULT_API_BASE_URL = ENV_DEFAULT_API_BASE_URL || LEGACY_DEFAULT_API_BASE_URL;
export const API_BASE_URL_STORAGE_KEY = 'mm_api_base_url';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function isValidApiBaseUrl(value: string): boolean {
  if (!value.trim()) return false;
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
  if (!normalized) return DEFAULT_API_BASE_URL;
  return isValidApiBaseUrl(normalized) ? normalized : DEFAULT_API_BASE_URL;
}

export function saveApiBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) {
    localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    return DEFAULT_API_BASE_URL;
  }
  localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
  return normalized;
}
