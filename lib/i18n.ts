export const SUPPORTED_LOCALES = ['ko', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface I18nDictionary {
  [key: string]: string | I18nDictionary;
}

export const DEFAULT_LOCALE: Locale = 'ko';
export const LOCALE_STORAGE_KEY = 'mm_locale';

export const MESSAGES: Record<Locale, I18nDictionary> = {
  ko: {
    common: {
      appName: 'MeetMate',
      adminPanel: 'Admin Panel',
      admin: '관리자',
      menu: '메뉴',
      logout: '로그아웃',
      language: '언어',
      theme: '테마',
      light: 'Light',
      dark: 'Dark',
      loading: '로딩 중...',
      countSuffix: '개',
      sidebarToggle: '사이드바 토글',
      noData: '데이터가 없습니다.',
    },
    page: {
      dashboard: '대시보드',
      users: '사용자 관리',
      meetings: '미팅 관리',
      settings: '설정',
      fallbackTitle: 'MeetMate Admin',
    },
    login: {
      title: '로그인',
      subtitle: '관리자 계정으로 로그인하세요.',
      serviceConfigTitle: '서비스 설정',
      serviceConfigSubtitle: 'API 서버 URL을 설정합니다.',
      serviceUrlLabel: '서비스 URL',
      serviceUrlPlaceholder: 'https://example.com',
      serviceUrlHelp: '저장 후 로그인부터 해당 URL을 기준으로 API를 호출합니다.',
      saveServiceUrl: 'URL 저장',
      resetDefaultUrl: '기본값 복원',
      backToLogin: '로그인으로 돌아가기',
      serviceUrlSaved: '서비스 URL이 저장되었습니다.',
      invalidServiceUrl: 'http:// 또는 https:// 로 시작하는 URL을 입력해주세요.',
      authNameLabel: '아이디',
      authNamePlaceholder: '관리자 아이디',
      authPasswordLabel: '비밀번호',
      authPasswordPlaceholder: '비밀번호',
      submit: '로그인',
      submitting: '로그인 중...',
      requiredAuthName: '아이디를 입력해주세요.',
      requiredAuthPassword: '비밀번호를 입력해주세요.',
      invalidCredentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
    },
    dashboard: {
      title: '대시보드',
      subtitle: 'MeetMate 서비스 현황을 한눈에 확인하세요.',
      totalUsers: '전체 사용자',
      totalMeetings: '전체 미팅',
      activeMeetings: '진행 중 미팅',
      closedMeetings: '종료된 미팅',
      recentMeetings: '최근 미팅',
      activeMeetingList: '진행 중인 미팅',
      noMeetingData: '미팅 데이터가 없습니다.',
      noActiveMeetings: '진행 중인 미팅이 없습니다.',
      meetingName: '미팅명',
      status: '상태',
      createdAt: '생성일',
      owner: '주최자',
    },
    status: {
      held: '진행 중',
      closed: '종료',
      created: '생성됨',
    },
    role: {
      admin: '관리자',
      manager: '매니저',
      user: '일반 사용자',
    },
    duration: {
      hour: '시간',
      minute: '분',
    },
  },
  en: {
    common: {
      appName: 'MeetMate',
      adminPanel: 'Admin Panel',
      admin: 'Admin',
      menu: 'Menu',
      logout: 'Logout',
      language: 'Language',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      loading: 'Loading...',
      countSuffix: '',
      sidebarToggle: 'Toggle sidebar',
      noData: 'No data available.',
    },
    page: {
      dashboard: 'Dashboard',
      users: 'User Management',
      meetings: 'Meeting Management',
      settings: 'Settings',
      fallbackTitle: 'MeetMate Admin',
    },
    login: {
      title: 'Login',
      subtitle: 'Sign in with an administrator account.',
      serviceConfigTitle: 'Service Settings',
      serviceConfigSubtitle: 'Configure the API server URL.',
      serviceUrlLabel: 'Service URL',
      serviceUrlPlaceholder: 'https://example.com',
      serviceUrlHelp: 'After saving, login and API calls use this base URL.',
      saveServiceUrl: 'Save URL',
      resetDefaultUrl: 'Reset to Default',
      backToLogin: 'Back to Login',
      serviceUrlSaved: 'Service URL has been saved.',
      invalidServiceUrl: 'Enter a valid URL starting with http:// or https://.',
      authNameLabel: 'Username',
      authNamePlaceholder: 'Admin username',
      authPasswordLabel: 'Password',
      authPasswordPlaceholder: 'Password',
      submit: 'Sign In',
      submitting: 'Signing in...',
      requiredAuthName: 'Please enter your username.',
      requiredAuthPassword: 'Please enter your password.',
      invalidCredentials: 'The username or password is incorrect.',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Check MeetMate service status at a glance.',
      totalUsers: 'Total Users',
      totalMeetings: 'Total Meetings',
      activeMeetings: 'Active Meetings',
      closedMeetings: 'Closed Meetings',
      recentMeetings: 'Recent Meetings',
      activeMeetingList: 'Active Meetings',
      noMeetingData: 'No meeting data available.',
      noActiveMeetings: 'No active meetings.',
      meetingName: 'Meeting Name',
      status: 'Status',
      createdAt: 'Created At',
      owner: 'Owner',
    },
    status: {
      held: 'In Progress',
      closed: 'Closed',
      created: 'Created',
    },
    role: {
      admin: 'Administrator',
      manager: 'Manager',
      user: 'User',
    },
    duration: {
      hour: 'h',
      minute: 'm',
    },
  },
};

function getValueFromPath(obj: I18nDictionary, path: string): string | undefined {
  const parts = path.split('.');
  let current: string | I18nDictionary | undefined = obj;

  for (const part of parts) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}

export function normalizeLocale(value?: string | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function localeToBcp47(locale: Locale): string {
  switch (locale) {
    case 'en':
      return 'en-US';
    case 'ko':
    default:
      return 'ko-KR';
  }
}

export function getMessage(locale: Locale, key: string): string {
  const byLocale = getValueFromPath(MESSAGES[locale], key);
  if (byLocale) return byLocale;

  const fallback = getValueFromPath(MESSAGES[DEFAULT_LOCALE], key);
  if (fallback) return fallback;

  return key;
}
