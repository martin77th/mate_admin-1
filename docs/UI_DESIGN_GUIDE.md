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
