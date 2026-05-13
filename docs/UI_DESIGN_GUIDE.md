# MeetMate Admin — UI/UX 디자인 가이드
> Bootstrap 5.3 기반 | 최신 트렌드 반영 | 2025 기준

---

## 🎨 디자인 철학

**키워드**: 신뢰감 · 효율성 · 명확성  
**톤**: Professional Dark Admin — 어두운 배경에 선명한 액센트  
**영감**: Linear, Vercel Dashboard, Shadcn/ui 스타일

> 관리자 페이지는 "보기 좋은" 것보다 **빠르게 작업할 수 있는** 것이 우선입니다.
> 정보 밀도는 높게, 인지 부하는 낮게.

---

## 🎨 컬러 팔레트

### CSS 변수 정의 (`variables.css`)

```css
:root {
  /* === Brand Colors === */
  --mm-primary:       #4F6EF7;   /* 메인 브랜드 블루 */
  --mm-primary-hover: #3D5CE0;
  --mm-primary-soft:  rgba(79, 110, 247, 0.12);

  /* === Semantic Colors === */
  --mm-success:  #22C55E;
  --mm-warning:  #F59E0B;
  --mm-danger:   #EF4444;
  --mm-info:     #06B6D4;

  /* === Dark Theme Background === */
  --mm-bg-base:     #0F1117;   /* 최하단 배경 */
  --mm-bg-surface:  #1A1D27;   /* 카드/사이드바 */
  --mm-bg-elevated: #22263A;   /* hover, 입력 필드 */
  --mm-bg-overlay:  #2A2F47;   /* 모달, 드롭다운 */

  /* === Border === */
  --mm-border:       rgba(255,255,255,0.08);
  --mm-border-focus: rgba(79,110,247,0.5);

  /* === Text === */
  --mm-text-primary:   #F1F3F9;
  --mm-text-secondary: #8B91A7;
  --mm-text-muted:     #52576E;

  /* === Sidebar === */
  --mm-sidebar-width: 260px;
  --mm-sidebar-collapsed: 72px;

  /* === Spacing === */
  --mm-content-padding: 28px;

  /* === Radius === */
  --mm-radius-sm:  6px;
  --mm-radius-md:  10px;
  --mm-radius-lg:  14px;
  --mm-radius-xl:  20px;

  /* === Shadow === */
  --mm-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --mm-shadow-md: 0 4px 16px rgba(0,0,0,0.4);
  --mm-shadow-lg: 0 8px 32px rgba(0,0,0,0.5);

  /* === Transition === */
  --mm-transition: 0.2s ease;
}
```

---

## 🔤 타이포그래피

```css
/* 한국어 최적화 폰트 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');

body {
  font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--mm-text-primary);
}
```

### 텍스트 계층

| 용도 | 크기 | 굵기 | 색상 |
|------|------|------|------|
| 페이지 제목 | 22px | 700 | `--mm-text-primary` |
| 섹션 제목 | 16px | 600 | `--mm-text-primary` |
| 카드 제목 | 14px | 600 | `--mm-text-primary` |
| 본문 | 14px | 400 | `--mm-text-primary` |
| 보조 텍스트 | 13px | 400 | `--mm-text-secondary` |
| 레이블/캡션 | 12px | 500 | `--mm-text-muted` |

---

## 📐 레이아웃 구조

```
┌─────────────────────────────────────────────────┐
│                   HEADER (60px)                 │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ SIDEBAR  │         MAIN CONTENT                 │
│ (260px)  │         (padding: 28px)              │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### 레이아웃 HTML 뼈대
```html
<div class="mm-layout">
  <!-- Sidebar -->
  <aside class="mm-sidebar" id="sidebar">
    <div class="mm-sidebar-brand">...</div>
    <nav class="mm-sidebar-nav">...</nav>
    <div class="mm-sidebar-footer">...</div>
  </aside>

  <!-- Main -->
  <div class="mm-main">
    <!-- Header -->
    <header class="mm-header">...</header>

    <!-- Content -->
    <main class="mm-content">
      <!-- Page Header -->
      <div class="mm-page-header">
        <h1 class="mm-page-title">페이지 제목</h1>
        <div class="mm-page-actions">...</div>
      </div>

      <!-- Content Area -->
      <div class="mm-page-body">...</div>
    </main>
  </div>
</div>
```

---

## 🧩 컴포넌트 가이드

### 1. 통계 카드 (Stat Card)

```html
<div class="mm-stat-card">
  <div class="mm-stat-icon mm-stat-icon--primary">
    <i class="bi bi-people-fill"></i>
  </div>
  <div class="mm-stat-info">
    <p class="mm-stat-label">전체 계정</p>
    <h3 class="mm-stat-value">1,284</h3>
    <span class="mm-stat-change mm-stat-change--up">
      <i class="bi bi-arrow-up-short"></i> 12% 이번 달
    </span>
  </div>
</div>
```

```css
.mm-stat-card {
  background: var(--mm-bg-surface);
  border: 1px solid var(--mm-border);
  border-radius: var(--mm-radius-lg);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color var(--mm-transition);
}
.mm-stat-card:hover {
  border-color: var(--mm-primary);
}
.mm-stat-icon {
  width: 48px; height: 48px;
  border-radius: var(--mm-radius-md);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.mm-stat-icon--primary { background: var(--mm-primary-soft); color: var(--mm-primary); }
.mm-stat-value { font-size: 26px; font-weight: 700; margin: 0; }
.mm-stat-label { font-size: 12px; color: var(--mm-text-secondary); margin: 0 0 4px; }
.mm-stat-change--up { color: var(--mm-success); font-size: 12px; }
```

---

### 2. 테이블 (Data Table)

```html
<div class="mm-table-wrap">
  <!-- 툴바 -->
  <div class="mm-table-toolbar">
    <div class="mm-search-wrap">
      <i class="bi bi-search"></i>
      <input type="text" class="mm-search-input" placeholder="검색...">
    </div>
    <div class="mm-table-actions">
      <button class="mm-btn mm-btn-primary">
        <i class="bi bi-plus-lg"></i> 추가
      </button>
    </div>
  </div>

  <!-- 테이블 -->
  <table class="mm-table">
    <thead>
      <tr>
        <th><input type="checkbox" class="mm-checkbox"></th>
        <th>이름 <i class="bi bi-arrow-down-up mm-sort-icon"></i></th>
        <th>이메일</th>
        <th>상태</th>
        <th>생성일</th>
        <th>액션</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><input type="checkbox" class="mm-checkbox"></td>
        <td class="mm-td-name">홍길동</td>
        <td>hong@example.com</td>
        <td><span class="mm-badge mm-badge--success">활성</span></td>
        <td>2025.01.15</td>
        <td class="mm-td-actions">
          <button class="mm-icon-btn"><i class="bi bi-eye"></i></button>
          <button class="mm-icon-btn"><i class="bi bi-pencil"></i></button>
          <button class="mm-icon-btn mm-icon-btn--danger"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 페이지네이션 -->
  <div class="mm-pagination">
    <span class="mm-pagination-info">총 284건 중 1-20</span>
    <nav>
      <ul class="pagination pagination-sm mb-0">
        <li class="page-item"><a class="page-link" href="#">«</a></li>
        <li class="page-item active"><a class="page-link" href="#">1</a></li>
        <li class="page-item"><a class="page-link" href="#">2</a></li>
        <li class="page-item"><a class="page-link" href="#">»</a></li>
      </ul>
    </nav>
  </div>
</div>
```

---

### 3. 버튼 시스템

```html
<!-- Primary -->
<button class="mm-btn mm-btn-primary">
  <i class="bi bi-plus-lg"></i> 생성
</button>

<!-- Secondary (Ghost) -->
<button class="mm-btn mm-btn-secondary">취소</button>

<!-- Danger -->
<button class="mm-btn mm-btn-danger">삭제</button>

<!-- 아이콘 버튼 -->
<button class="mm-icon-btn"><i class="bi bi-pencil"></i></button>
```

```css
.mm-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  border-radius: var(--mm-radius-sm);
  font-size: 13px; font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer; transition: all var(--mm-transition);
}
.mm-btn-primary  { background: var(--mm-primary); color: #fff; }
.mm-btn-primary:hover { background: var(--mm-primary-hover); }
.mm-btn-secondary { background: transparent; color: var(--mm-text-secondary); border-color: var(--mm-border); }
.mm-btn-secondary:hover { background: var(--mm-bg-elevated); color: var(--mm-text-primary); }
.mm-btn-danger { background: rgba(239,68,68,0.12); color: var(--mm-danger); border-color: rgba(239,68,68,0.3); }
```

---

### 4. 배지 (Badge)

```html
<span class="mm-badge mm-badge--success">활성</span>
<span class="mm-badge mm-badge--danger">비활성</span>
<span class="mm-badge mm-badge--warning">대기중</span>
<span class="mm-badge mm-badge--info">진행중</span>
<span class="mm-badge mm-badge--default">종료</span>
```

```css
.mm-badge {
  display: inline-flex; align-items: center;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.mm-badge--success { background: rgba(34,197,94,0.15); color: var(--mm-success); }
.mm-badge--danger  { background: rgba(239,68,68,0.15); color: var(--mm-danger); }
.mm-badge--warning { background: rgba(245,158,11,0.15); color: var(--mm-warning); }
.mm-badge--info    { background: rgba(6,182,212,0.15); color: var(--mm-info); }
.mm-badge--default { background: var(--mm-bg-elevated); color: var(--mm-text-secondary); }
```

---

### 5. 폼 스타일

```html
<div class="mm-form-group">
  <label class="mm-label">이메일 <span class="mm-required">*</span></label>
  <input type="email" class="mm-input" placeholder="example@email.com">
  <span class="mm-form-hint">로그인에 사용될 이메일 주소입니다.</span>
</div>

<div class="mm-form-group">
  <label class="mm-label">역할</label>
  <select class="mm-select">
    <option>관리자</option>
    <option>일반 사용자</option>
  </select>
</div>
```

```css
.mm-input, .mm-select {
  width: 100%;
  background: var(--mm-bg-elevated);
  border: 1px solid var(--mm-border);
  border-radius: var(--mm-radius-sm);
  color: var(--mm-text-primary);
  padding: 9px 12px;
  font-size: 14px;
  transition: border-color var(--mm-transition);
}
.mm-input:focus, .mm-select:focus {
  outline: none;
  border-color: var(--mm-primary);
  box-shadow: 0 0 0 3px var(--mm-primary-soft);
}
.mm-label { font-size: 13px; font-weight: 500; color: var(--mm-text-secondary); margin-bottom: 6px; display: block; }
.mm-required { color: var(--mm-danger); }
.mm-form-hint { font-size: 12px; color: var(--mm-text-muted); margin-top: 4px; display: block; }
```

---

### 6. 사이드바 네비게이션

```html
<nav class="mm-sidebar-nav">
  <!-- 그룹 레이블 -->
  <p class="mm-nav-group-label">메인</p>

  <!-- 메뉴 아이템 -->
  <a href="#dashboard" class="mm-nav-item mm-nav-item--active">
    <i class="bi bi-grid-1x2-fill mm-nav-icon"></i>
    <span>대시보드</span>
  </a>

  <p class="mm-nav-group-label">관리</p>

  <a href="#accounts" class="mm-nav-item">
    <i class="bi bi-people-fill mm-nav-icon"></i>
    <span>계정 관리</span>
    <span class="mm-nav-badge">284</span>
  </a>

  <a href="#rooms" class="mm-nav-item">
    <i class="bi bi-building mm-nav-icon"></i>
    <span>회의룸 관리</span>
  </a>

  <!-- 서브메뉴 포함 -->
  <div class="mm-nav-group">
    <a href="#meetings" class="mm-nav-item mm-nav-has-sub">
      <i class="bi bi-camera-video-fill mm-nav-icon"></i>
      <span>회의 관리</span>
      <i class="bi bi-chevron-down mm-nav-chevron"></i>
    </a>
    <div class="mm-nav-sub">
      <a href="#meetings/active" class="mm-nav-sub-item">진행중 회의</a>
      <a href="#meetings/minutes" class="mm-nav-sub-item">종료된 회의록</a>
    </div>
  </div>
</nav>
```

---

### 7. 모달

```html
<div class="modal fade" id="createModal" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content mm-modal">
      <div class="mm-modal-header">
        <h5 class="mm-modal-title">계정 생성</h5>
        <button class="mm-modal-close" data-bs-dismiss="modal">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="mm-modal-body">
        <!-- 폼 내용 -->
      </div>
      <div class="mm-modal-footer">
        <button class="mm-btn mm-btn-secondary" data-bs-dismiss="modal">취소</button>
        <button class="mm-btn mm-btn-primary">생성하기</button>
      </div>
    </div>
  </div>
</div>
```

```css
.mm-modal { background: var(--mm-bg-surface); border: 1px solid var(--mm-border); border-radius: var(--mm-radius-lg); }
.mm-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--mm-border); display: flex; align-items: center; justify-content: space-between; }
.mm-modal-title { font-size: 16px; font-weight: 600; margin: 0; }
.mm-modal-close { background: none; border: none; color: var(--mm-text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.mm-modal-close:hover { background: var(--mm-bg-elevated); color: var(--mm-text-primary); }
.mm-modal-body { padding: 20px 24px; }
.mm-modal-footer { padding: 16px 24px; border-top: 1px solid var(--mm-border); display: flex; justify-content: flex-end; gap: 8px; }
```

---

### 8. 토스트 알림

```javascript
// 사용 예시
Toast.show('계정이 생성되었습니다.', 'success');
Toast.show('오류가 발생했습니다.', 'danger');
Toast.show('저장 중입니다...', 'info');
```

---

## 📱 반응형 기준점

| 브레이크포인트 | 화면 크기 | 레이아웃 |
|--------------|----------|---------|
| xl | ≥1400px | 사이드바 고정, 전체 표시 |
| lg | ≥1200px | 사이드바 고정 |
| md | ≥768px  | 사이드바 축소 (아이콘만) |
| sm | <768px  | 사이드바 숨김 (모바일 토글) |

---

## 📌 운영 반영 UI 정책 (2026-05-12)

아래 항목은 최근 사용자 관리 화면 고도화 작업을 통해 확정된 운영 기준입니다.

### 1) 사용자 목록/검색 정책

- 목록의 `아이디` 컬럼은 `auth_name` 값을 기준으로 표시합니다.
- 사용자 목록/검색 조회는 `/svc/user/users` 응답을 우선 사용하고, 응답 필드는 UI 표준 스키마로 정규화해 표시합니다.
- 생성일은 `creation_time` 필드를 우선 사용하고, 표시 시간은 GMT(UTC) 기준 일자/시간만 표기합니다.
- 기본 페이지 크기는 10건(`limit=10`)으로 고정합니다.
- 검색은 `검색` 버튼으로 실행하고, `초기화` 버튼으로 검색어/필터를 리셋합니다.
- 등록 완료 후에는 `/users?searchField=auth_name&q={생성한아이디}` 형태로 복귀해 생성 결과를 바로 확인합니다.

### 2) 사용자 액션 정책

- 목록 우측 `관리` 컬럼에 수정/비활성화 액션을 제공합니다.
- 수정은 모달이 아닌 전용 수정 페이지(`/users/{user_id}/edit`)에서 처리합니다.
- 비활성화는 반드시 확인 모달을 거친 뒤 실행합니다.
- 등록/수정/비활성화 이후에는 토스트로 성공/실패 결과를 즉시 안내합니다.
- 향후 작업: 비활성화 기능 고도화(활성/비활성 상태 필터, 비활성 사용자 노출 정책, 로그인 차단 검증)를 진행합니다.

### 3) 테이블 스타일 정책

- 사용자 목록 테이블은 최신형 데이터 테이블 스타일(헤더 대비, 행 hover, 가독성 중심)을 유지합니다.
- 테이블 외곽선은 좌/우뿐 아니라 상/하 선도 유지합니다.
- 목록 헤더 구분선과 테이블 본문은 붙지 않도록 상단 여백을 유지합니다.
- 페이지네이션 영역은 표와 시각적으로 분리하되, 과도한 구분선 대신 spacing 중심으로 정렬합니다.

### 4) 내비게이션/헤더 정책

- 사이드바 토글 아이콘은 헤더 메뉴 타이틀의 우측에 배치합니다.
- 메뉴 토글은 햄버거 버튼 대신 좌우 확장/축소 상태를 직관적으로 보여주는 아이콘(chevron 계열)을 사용합니다.

### 5) 대시보드 카드 정책

- KPI 카드는 총 6개를 기본 세트로 유지합니다.
- 세트 구성: 전체 사용자, 온라인 사용자, 오프라인 사용자, 전체 미팅, 진행 중 미팅, 종료된 미팅.
- API 미지원/누락 값은 UI에서 `-`로 안전하게 표시합니다.

### 6) 대시보드 최근 미팅 목록 정책

- 최근 미팅 목록은 카드 헤더에 목록 건수 배지를 함께 표시합니다.
- 테이블 컬럼은 `회의명 > 상태 > 생성일 > 소유자` 순서로 유지합니다.
- 회의명은 길이 초과 시 말줄임 처리하여 행 높이와 가독성을 유지합니다.
- 로딩/빈 상태는 공통 스피너/Empty State 패턴을 재사용합니다.
- 모바일 구간에서는 컬럼 고정 폭을 완화해 가로 스크롤 부담을 줄입니다.

### 7) 대시보드 진행 중 미팅 목록 정책

- 항목 선두의 상태 점 아이콘 대신, 항목 우측 끝에 상태 텍스트 배지를 배치합니다.
- 상태 표시는 공통 상태 라벨(`held`, `closed`, `created`) 번역 키를 재사용합니다.
- 미팅명 하단 보조 정보는 라벨을 포함해 `시작: YYYY-MM-DD HH:mm` 또는 `생성: YYYY-MM-DD HH:mm` 형태로 표시합니다.
- 카드 hover 시 배경/테두리 색상이 즉시 인지되도록 충분한 대비로 변경되며, 선택 상태는 hover와 명확히 구분되는 다른 강조 색상으로 표시합니다.
- 선택된 카드에 hover 하면 선택 강조가 더 분명해지도록 배경/테두리 대비를 한 단계 더 높입니다.
- 동일 카드를 다시 선택하면 선택 상태가 해제됩니다.

### 8) 미팅 목록 조회 정책

- 좌측 메뉴는 `현재 진행 미팅`(`/meetings`)과 `지난 미팅 이력`(`/meetings/history`)으로 구분합니다.
- 현재 진행 미팅 목록은 `only_enterable=true`, 지난 미팅 이력은 `only_enterable=false`로 조회합니다.
- 현재 진행 미팅 목록은 `status=booked,held`를 사용해 예약/진행중 상태만 조회합니다.
- 지난 미팅 이력은 `status=closed`를 강제해 진행 중 회의가 섞이지 않도록 합니다.
- 미팅 목록/검색 조회는 `/svc/meeting/meetings` 엔드포인트를 사용합니다.
- 현재 진행 미팅의 검색도구 헤더에는 `미팅 생성` 버튼을 제공하며, `/meetings/new` 생성 페이지로 이동합니다.
- 미팅 생성은 `POST /api/meeting/v1/meetings`로 처리하고 성공 시 현재 진행 미팅 목록으로 복귀합니다.
- 응답은 root/result 스키마 차이를 정규화해 동일한 테이블 스키마로 렌더링합니다.
- 종료시간 컬럼은 `start_time + progress_duration` 계산값으로 표시합니다.
- 현재 진행 미팅의 `수정`은 예약 상태(`booked`)에서만 허용합니다.
- `booked`가 아닌 상태에서는 `수정` 버튼을 노출하지 않습니다.
- 지난 미팅 이력에서는 `수정/삭제` 액션을 제공하지 않습니다.
- 목록 우측 `관리` 컬럼의 `수정/삭제` 액션은 현재 진행 미팅에서만 제공합니다.
- 삭제는 확인 모달을 거쳐 `DELETE /api/meeting/v1/meetings/{meeting_id}` 호출 후 목록을 갱신합니다.

---

## ✅ UI 체크리스트

개발 시 각 페이지에 반드시 확인:

- [ ] 다크 테마 CSS 변수 사용 (하드코딩 색상 금지)
- [ ] 로딩 상태 표시 (스켈레톤 또는 스피너)
- [ ] 빈 상태 표시 (데이터 없을 때 Empty State UI)
- [ ] 에러 상태 처리 (API 실패 시 메시지)
- [ ] 모바일 반응형 확인
- [ ] 폼 유효성 검사 피드백
- [ ] 액션 후 토스트 알림
- [ ] 삭제는 반드시 확인 모달 거치기

## 📐 반응형 리뉴얼 운영 규칙

- PC/Pad/Mobile 통합 리뉴얼은 [docs/UI_RESPONSIVE_RENEWAL_PLAN.md](docs/UI_RESPONSIVE_RENEWAL_PLAN.md) 정책 문서를 기준으로 진행합니다.
- 화면 개선은 "기능 회귀 없음"을 최우선으로 하며, 단계별(페이지별) 적용 후 즉시 lint/build 검증을 수행합니다.

### 모바일/Pad 내비게이션 정책

- 모바일/Pad에서는 하단 고정 1depth 메뉴(`대시보드/사용자 관리/미팅 관리/설정`)를 사용합니다.
- 상단 타이틀 영역의 햄버거 메뉴를 통해 서브 메뉴(예: 미팅관리 하위 메뉴)에 접근합니다.

### 모바일/Pad 테이블 노출 정책

- 사용자 관리 표: `번호 | 아이디 | 이름 | 권한 | 관리`
- 미팅관리 표: `번호 | 미팅명 | 생성자 | 시작일 | 관리`
- 긴 텍스트는 1줄 우선 표시하고, 길이 초과 시 `...` 말줄임 처리합니다.
