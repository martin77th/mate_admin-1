# UI Responsive Renewal Plan (PC / Pad / Mobile)

## 1. Goal
- 모든 관리 화면이 `PC / Pad / Mobile`에서 동일 기능을 안정적으로 제공하도록 반응형 정책을 표준화한다.
- 기능 개발보다 안정성 우선: 기존 동작(조회/검색/생성/수정/삭제/API 파라미터)은 절대 깨지지 않아야 한다.

## 2. Device Policy
- PC: `>= 1200px`
- Pad: `768px ~ 1199px`
- Mobile: `<= 767px`

## 3. Global Rules
- 레이아웃
  - 사이드바/헤더/컨텐츠 영역 구조는 유지한다.
  - 패드/모바일에서는 가로 스크롤 최소화, 불가피한 경우 컴포넌트 단위 스크롤 허용.
- Table
  - 컬럼 제거 대신 우선순위 기반 폭 축소.
  - 모바일에서 가독성이 깨지면 카드형 전환보다 가로 스크롤 우선(기능 안정성 우선).
- Search Tools
  - PC: 1줄 정렬 유지.
  - Pad/Mobile: 줄바꿈 허용.
  - 버튼 유무와 관계없이 헤더/바디 높이 정책은 동일하게 유지.
- Form
  - PC: 2열 가능, Pad/Mobile: 1열 스택.
  - 필수 입력/검증/토스트 문구는 기존 키를 재사용.

## 4. Renewal Sequence (Stable-first)
1. Phase 0 - Baseline Lock
- 현재 화면별 기능 스냅샷 수집
- 핵심 경로(로그인, 사용자 관리, 미팅 관리, 대시보드) 회귀 체크리스트 확정

2. Phase 1 - Layout Foundation
- 공통 spacing / width / wrap 정책 정리
- 검색도구/테이블/페이지네이션 공통 반응형 규칙 통일

3. Phase 2 - Page-by-page Renewal
- 순서: 대시보드 -> 사용자 관리 -> 미팅 관리 -> 상세/생성/수정 페이지
- 각 페이지마다 PC/Pad/Mobile 3구간 검증 후 다음 페이지 진행

4. Phase 3 - Hardening
- 토스트/모달/드롭다운/사이드바 상호작용 회귀 검증
- 최종 문서 업데이트 및 QA 결과 기록

## 5. Definition of Done
- 모든 대상 페이지에서 아래를 만족해야 완료로 간주
  - 기능: 조회/검색/생성/수정/삭제/API 호출 기존과 동일
  - UI: PC/Pad/Mobile에서 레이아웃 깨짐 없음
  - 접근: 버튼/입력/테이블 조작 가능
  - 품질: `npm run lint` + `npm run build` 통과

## 6. Risk Controls
- 한 번에 대규모 CSS 변경 금지 (화면 단위 소규모 변경)
- 각 단계 완료 시 즉시 lint/build 수행
- API/상태관리 로직과 스타일 변경 분리
- 문제가 생기면 직전 단계까지 롤백 가능한 단위로 커밋

## 7. QA Matrix (Minimum)
- Dashboard: 최근 미팅/진행중 미팅 데이터 표시, 클릭 상호작용
- Users: 검색/페이지네이션/수정/비활성화/등록
- Meetings: 현재/이력 분리, 검색, 생성, 수정정책, 삭제정책
- Common: Sidebar collapse, Header dropdown, Modal, Toast

## 8. Execution Status
- Phase 0 (완료)
  - 반응형 기준 문서화 완료
  - 베이스라인 체크리스트 추가: `docs/qa/RESPONSIVE_BASELINE_CHECKLIST.md`
- Phase 1 (완료)
  - 검색도구 공통 높이/정렬 규칙 적용
  - Pad/Mobile 공통 레이아웃 보정(헤더/컨텐츠/테이블 스크롤) 적용
  - 안정성 검증: `npm run lint` / `npm run build` 통과
- Phase 2 (진행 예정)
  - 페이지별(대시보드 -> 사용자 관리 -> 미팅 관리 -> 상세/생성/수정) 수동 QA와 미세 조정 수행
- Phase 3 (진행 예정)
  - 상호작용 하드닝(토스트/모달/드롭다운/사이드바) 및 결과 리포트 정리

- Phase 3 (완료)
  - 모바일 상호작용 하드닝 적용 완료 (Sidebar / Dropdown / Toast / Modal)
  - 결과 문서 추가: `docs/qa/RESPONSIVE_PHASE3_HARDENING_RESULT_2026-05-12.md`
  - 안정성 검증: `npm run lint` / `npm run build` 통과

## 9. Final Report
- 종합 리포트: `docs/qa/RESPONSIVE_FINAL_REPORT_2026-05-12.md`
