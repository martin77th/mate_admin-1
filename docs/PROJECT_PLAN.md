# MeetMate Admin 관리자 페이지 개발 계획

## 📌 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | MeetMate Admin Panel |
| API 서버 | https://mate3.dev.meetmate.co.kr |
| API 문서 | https://mate3.dev.meetmate.co.kr/api/swagger/index.html |
| 개발 방식 | Claude AI Agent 기반 자동화 개발 |
| UI 프레임워크 | Bootstrap 5.3 (npm 패키지) |
| 아키텍처 | Next.js 15 App Router (TypeScript) |
| 런타임 | Node.js / npm |

> **변경 이력**: 초기 계획(Vanilla JS SPA) → **Next.js 15 + TypeScript App Router**로 전환 (2026-05-11)

---

## 🛠️ 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.x (Turbopack) | 앱 프레임워크 (App Router) |
| React | 19.x | UI 라이브러리 |
| TypeScript | 5.x | 정적 타입 |
| Bootstrap | 5.3.x (npm) | UI 컴포넌트 & 그리드 |
| Bootstrap Icons | 1.11.x (npm) | 아이콘 |
| js-cookie | 3.x | 쿠키 유틸리티 |
| Noto Sans KR | - | 기본 폰트 (Google Fonts) |

---

## 🗂️ 디렉토리 구조

```
mate_admin/
├── app/                          # Next.js App Router
│   ├── globals.css               # 전역 스타일 (--mm-* 변수 + 컴포넌트)
│   ├── layout.tsx                # 루트 레이아웃
│   ├── page.tsx                  # 루트 → /login or /dashboard 리다이렉트
│   ├── login/
│   │   └── page.tsx              # 로그인 페이지 ✅
│   └── (admin)/                  # 인증 필요 영역 (Route Group)
│       ├── layout.tsx            # 어드민 공통 레이아웃 (인증 가드 + Sidebar + Header) ✅
│       ├── dashboard/
│       │   └── page.tsx          # 대시보드 ✅
│       ├── users/
│       │   └── page.tsx          # 사용자 관리 (예정)
│       ├── meetings/
│       │   └── page.tsx          # 미팅 관리 (예정)
│       └── settings/
│           └── page.tsx          # 설정 (예정)
│
├── components/                   # 공통 컴포넌트
│   ├── Sidebar.tsx               # 사이드바 (접힘 지원) ✅
│   ├── Header.tsx                # 헤더 (토글 + 사용자 드롭다운) ✅
│   ├── Toast.tsx                 # 토스트 알림 (Context 기반) ✅
│   └── Modal.tsx                 # 모달 + ConfirmModal ✅
│
├── lib/                          # 유틸리티 모듈
│   ├── api.ts                    # fetch 래퍼 (JWT 자동 첨부, 401 처리) ✅
│   ├── auth.ts                   # 토큰 관리, login(), logout() ✅
│   └── utils.ts                  # 날짜/숫자 포맷, badge 헬퍼, debounce ✅
│
├── docs/                         # 기획/설계 문서
│   ├── PROJECT_PLAN.md           # 이 파일
│   ├── API_SPEC.md               # API 명세 (Swagger 확인 완료)
│   ├── UI_DESIGN_GUIDE.md        # UI/UX 디자인 가이드
│   └── AGENT_PROMPT.md           # AI Agent 개발 가이드
│
├── public/                       # 정적 파일
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 개발 단계별 계획

### Phase 1 — 기반 구조 ✅ 완료
| 작업 | 파일 | 상태 |
|------|------|------|
| Next.js 프로젝트 초기화 | `package.json` | ✅ |
| 글로벌 CSS (다크 테마 + 변수) | `app/globals.css` | ✅ |
| 루트 레이아웃 | `app/layout.tsx` | ✅ |
| fetch 래퍼 (API 모듈) | `lib/api.ts` | ✅ |
| 인증 모듈 (토큰 관리) | `lib/auth.ts` | ✅ |
| 공통 유틸리티 | `lib/utils.ts` | ✅ |
| 사이드바 컴포넌트 | `components/Sidebar.tsx` | ✅ |
| 헤더 컴포넌트 | `components/Header.tsx` | ✅ |
| 토스트 알림 | `components/Toast.tsx` | ✅ |
| 모달 컴포넌트 | `components/Modal.tsx` | ✅ |

### Phase 2 — 인증 시스템 ✅ 완료
| 작업 | 파일 | 상태 |
|------|------|------|
| 로그인 페이지 UI | `app/login/page.tsx` | ✅ |
| 로그인 API 연동 | `lib/auth.ts` | ✅ |
| JWT 토큰 저장/관리 (localStorage) | `lib/auth.ts` | ✅ |
| 인증 가드 (어드민 레이아웃) | `app/(admin)/layout.tsx` | ✅ |
| 루트 리다이렉트 | `app/page.tsx` | ✅ |

### Phase 3 — 대시보드 ✅ 완료
| 작업 | 파일 | 상태 |
|------|------|------|
| 통계 카드 (사용자수, 미팅수) | `app/(admin)/dashboard/page.tsx` | ✅ |
| 최근 미팅 목록 테이블 | `app/(admin)/dashboard/page.tsx` | ✅ |
| 진행 중 미팅 리스트 | `app/(admin)/dashboard/page.tsx` | ✅ |

### Phase 4 — 사용자 관리 🔲 예정
| 작업 | 파일 | 상태 |
|------|------|------|
| 사용자 목록 (검색, 페이징) | `app/(admin)/users/page.tsx` | 🔲 |
| 사용자 상세 모달 | `app/(admin)/users/page.tsx` | 🔲 |
| 사용자 생성/수정/삭제 | `app/(admin)/users/page.tsx` | 🔲 |

### Phase 5 — 미팅 관리 🔲 예정
| 작업 | 파일 | 상태 |
|------|------|------|
| 미팅 목록 (필터/검색/페이징) | `app/(admin)/meetings/page.tsx` | 🔲 |
| 미팅 상세 모달 | `app/(admin)/meetings/page.tsx` | 🔲 |
| 진행 중 미팅 모니터링 | `app/(admin)/meetings/page.tsx` | 🔲 |

### Phase 6 — 설정 🔲 예정
| 작업 | 파일 | 상태 |
|------|------|------|
| 시스템 설정 페이지 | `app/(admin)/settings/page.tsx` | 🔲 |

---

## 🎨 디자인 시스템

- **테마**: 다크 테마 고정
- **주요 색상**: Primary `#4F6EF7`, Bg-base `#0F1117`, Bg-surface `#1A1D27`
- **CSS 변수 접두사**: `--mm-*`
- **컴포넌트 클래스 접두사**: `mm-*`
- **폰트**: Noto Sans KR (Google Fonts)
- **아이콘**: Bootstrap Icons (`bi-*`)
