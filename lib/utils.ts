/** YYYY-MM-DD */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
}

/** YYYY-MM-DD HH:MM */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const ymd = d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
  const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${ymd} ${hm}`;
}

/** 분 → "X시간 Y분" or "Y분" */
export function formatDuration(minutes?: number | null): string {
  if (minutes == null) return '-';
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 숫자 천단위 콤마 */
export function formatNumber(n?: number | null): string {
  if (n == null) return '0';
  return n.toLocaleString('ko-KR');
}

/** 미팅 상태 badge 클래스 */
export function meetingStatusBadge(status?: string): { cls: string; label: string } {
  switch (status) {
    case 'held':    return { cls: 'mm-badge-success', label: '진행 중' };
    case 'closed':  return { cls: 'mm-badge-muted',   label: '종료' };
    case 'created': return { cls: 'mm-badge-info',    label: '생성됨' };
    default:        return { cls: 'mm-badge-muted',   label: status ?? '-' };
  }
}

/** 사용자 역할 badge 클래스 */
export function userRoleBadge(role?: string): { cls: string; label: string } {
  switch (role) {
    case 'admin':    return { cls: 'mm-badge-danger',  label: '관리자' };
    case 'manager':  return { cls: 'mm-badge-warning', label: '매니저' };
    case 'user':     return { cls: 'mm-badge-primary', label: '일반 사용자' };
    default:         return { cls: 'mm-badge-muted',   label: role ?? '-' };
  }
}

/** 쿼리 파라미터 문자열 빌드 */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

/** debounce */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** 이니셜 추출 (아바타용) */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
