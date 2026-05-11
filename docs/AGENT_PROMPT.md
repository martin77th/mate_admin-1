# MeetMate Admin — Claude Agent 개발 가이드

## 🤖 이 파일의 목적

이 파일은 Claude AI Agent가 MeetMate Admin 프로젝트를 개발할 때
일관되게 참조해야 할 컨텍스트와 프롬프트 패턴을 정의합니다.

---

## 📁 프로젝트 컨텍스트 (매 작업 시 참조)

```
프로젝트: MeetMate Admin Panel
API Base URL: https://mate3.dev.meetmate.co.kr/api
API 문서: https://mate3.dev.meetmate.co.kr/api/swagger/index.html
UI 프레임워크: Bootstrap 5.3 + 커스텀 CSS (variables.css 기준)
폰트: Noto Sans KR
색상 테마: 다크 테마 (--mm-* CSS 변수 사용)
참조 파일:
  - PROJECT_PLAN.md    (전체 계획)
  - UI_DESIGN_GUIDE.md (UI 컴포넌트 가이드)
  - API_SPEC.md        (API 명세)
```

---

## 🚀 Phase별 실행 명령어

### Phase 1: 기반 구조 구축
```
PROJECT_PLAN.md, UI_DESIGN_GUIDE.md를 참고해서
meetmate-admin 프로젝트의 Phase 1을 시작해.

다음 파일들을 생성해줘:
1. assets/css/variables.css — CSS 변수 (UI_DESIGN_GUIDE.md 컬러 팔레트 기준)
2. assets/css/main.css — 전역 레이아웃 스타일 (사이드바, 헤더, 콘텐츠 영역)
3. assets/css/components.css — 컴포넌트 스타일 (버튼, 배지, 테이블, 폼, 모달 등)
4. assets/js/api.js — API 통신 모듈 (fetch 기반, JWT 자동 첨부, 401 처리)
5. assets/js/auth.js — 인증 모듈 (토큰 저장/조회/삭제, 로그인/로그아웃, 가드)
6. assets/js/utils.js — 유틸리티 (날짜 포맷, 숫자 포맷, 디바운스 등)
7. assets/js/components/sidebar.js — 사이드바 렌더러
8. assets/js/components/header.js — 헤더 렌더러
9. assets/js/components/toast.js — 토스트 알림
```

### Phase 2: 로그인 페이지
```
PROJECT_PLAN.md, UI_DESIGN_GUIDE.md, API_SPEC.md를 참고해서
pages/login.html 파일을 생성해줘.

요구사항:
- 중앙 정렬 로그인 카드 레이아웃
- 이메일/패스워드 입력 폼
- API_SPEC.md의 로그인 API 연동 (POST /auth/login 또는 실제 엔드포인트)
- 로그인 성공 시 토큰 저장 후 dashboard로 이동
- 에러 처리 (잘못된 계정 정보 등)
- 다크 테마, UI_DESIGN_GUIDE.md 스타일 적용
```

### Phase 3: 대시보드
```
API_SPEC.md와 UI_DESIGN_GUIDE.md를 참고해서
pages/dashboard.html을 생성해줘.

포함 내용:
- 통계 카드 4개 (계정수, 회의룸수, 진행중 회의, 이번달 완료 회의)
- 최근 회의 목록 테이블 (5~10개)
- Chart.js 기반 주간 회의 현황 차트
- 각 통계는 실제 API에서 데이터를 가져와 표시
```

### Phase 4: 계정 관리
```
API_SPEC.md와 UI_DESIGN_GUIDE.md를 참고해서
pages/accounts/ 폴더의 파일들을 생성해줘.

list.html:
- 계정 목록 테이블 (이름, 이메일, 역할, 상태, 생성일)
- 검색 기능 (이름/이메일)
- 페이지네이션
- 생성 버튼 → create.html 또는 모달 열기
- 각 행 수정/삭제 버튼

create.html (또는 모달):
- 계정 생성 폼
- 유효성 검사
- 생성 성공 시 list로 이동 + 토스트

detail.html:
- 계정 상세 정보
- 수정 폼
- 삭제 버튼 (확인 모달)
```

### Phase 5: 회의룸 관리
```
API_SPEC.md와 UI_DESIGN_GUIDE.md를 참고해서
pages/rooms/ 폴더의 파일들을 생성해줘.

list.html:
- 회의룸 목록 (룸 이름, 코드, 최대 인원, 상태, 생성일)
- 검색/필터 기능
- 생성 버튼

create.html:
- 회의룸 생성 폼
- 옵션 설정 (최대 인원, 비밀번호 등 API 스펙 기준)

detail.html:
- 회의룸 상세 정보
- 수정/삭제
```

### Phase 6: 회의/회의록 관리
```
API_SPEC.md와 UI_DESIGN_GUIDE.md를 참고해서
pages/meetings/ 폴더의 파일들을 생성해줘.

list.html:
- 전체 회의 목록 (날짜 범위 필터, 상태 필터)
- 진행중 / 종료 구분 배지

active.html:
- 현재 진행중인 회의 실시간 목록
- 회의 강제 종료 버튼

minutes.html:
- 종료된 회의 목록
- 회의록 상세 보기 (참가자, 시작/종료 시간, 녹화 여부 등)
```

---

## 📐 코딩 규칙 (Agent 필수 준수)

### CSS
```
✅ CSS 변수만 사용: var(--mm-primary), var(--mm-bg-surface) 등
✅ 클래스명 접두사: mm- 사용
❌ 인라인 스타일 지양
❌ 하드코딩 색상 금지 (#4F6EF7 같은 직접 사용 금지)
```

### JavaScript
```
✅ API 호출은 반드시 api.js의 API 객체 통해서
✅ 인증 체크는 반드시 Auth.guard() 호출
✅ 비동기는 async/await 사용
✅ 에러 처리는 try/catch
✅ 성공/실패 시 Toast.show() 호출
❌ fetch 직접 호출 금지 (api.js 모듈 사용)
❌ alert() 사용 금지 (Toast 사용)
```

### HTML
```
✅ Bootstrap 5.3 클래스 + mm- 커스텀 클래스 조합
✅ 접근성: aria-label, role 속성 사용
✅ 로딩 상태 (skeleton 또는 spinner) 포함
✅ 빈 상태 (empty state) UI 포함
```

---

## 🔄 반복 작업 패턴

### 새 페이지 추가 시 체크리스트
1. [ ] HTML 파일 생성 (레이아웃 뼈대 포함)
2. [ ] Auth.guard() 호출 확인
3. [ ] Sidebar 활성 메뉴 상태 업데이트
4. [ ] API 연동 코드 작성
5. [ ] 로딩 상태 처리
6. [ ] 에러 상태 처리
7. [ ] 빈 상태 처리
8. [ ] 모바일 반응형 확인

### API 연동 표준 패턴
```javascript
async function loadData() {
  const tbody = document.getElementById('tableBody');
  
  // 1. 로딩 상태
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm" role="status"></div></td></tr>';
  
  try {
    // 2. API 호출
    const result = await API.get('/endpoint');
    
    // 3. 데이터 없을 때
    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6">
          <div class="mm-empty-state">
            <i class="bi bi-inbox"></i>
            <p>데이터가 없습니다.</p>
          </div>
        </td></tr>`;
      return;
    }
    
    // 4. 렌더링
    tbody.innerHTML = result.data.map(item => `...`).join('');
    
  } catch (err) {
    // 5. 에러 처리
    Toast.show('데이터를 불러오는 데 실패했습니다.', 'danger');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">오류가 발생했습니다.</td></tr>`;
  }
}
```
