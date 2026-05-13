# Responsive Baseline Checklist

## Scope
- 대상: Dashboard, Users, Meetings(Current/History/New), Login
- 뷰포트: PC(>=1200), Pad(768~1199), Mobile(<=767)

## 1. Common Layout
- [ ] 사이드바 열림/접힘 상태에서 본문 영역 겹침 없음
- [ ] Header/Content 간격이 화면 크기에 맞게 유지됨
- [ ] Toast/Modal/Dropdown가 화면 경계를 넘지 않음

## 2. Dashboard
- [ ] 최근 미팅 테이블이 깨지지 않고 읽을 수 있음
- [ ] 진행 중 미팅 카드가 줄바꿈/잘림 없이 표시됨
- [ ] 최근 미팅: 종료된 미팅 최근 8개 표시
- [ ] 진행 중 미팅: 진행 중 회의만 표시

## 3. Users
- [ ] 검색도구(헤더+바디) 크기가 타 페이지와 동일 정책
- [ ] 검색/초기화/등록 버튼이 PC에서 한 줄 유지
- [ ] Pad/Mobile에서 자연스러운 줄바꿈으로 조작 가능
- [ ] 목록/페이지네이션/수정/비활성화 기능 정상

## 4. Meetings
- [ ] 현재 진행 미팅/지난 미팅 이력 메뉴 분리 동작
- [ ] 검색도구 크기 정책이 Users와 동일
- [ ] 현재 진행 미팅에서만 수정/삭제 노출
- [ ] 지난 미팅 이력에서 수정/삭제 미노출
- [ ] 미팅 생성 페이지 진입/등록/복귀 정상

## 5. Validation
- [ ] npm run lint
- [ ] npm run build

## Result Record
- Date:
- Reviewer:
- Branch/Commit:
- Summary:
- Open Issues:
