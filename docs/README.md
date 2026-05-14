# 문서 인덱스

## 운영 문서
- [프로젝트 계획](PROJECT_PLAN.md)
- [API 명세](API_SPEC.md)
- [UI 디자인 가이드](UI_DESIGN_GUIDE.md)
- [도커 개발 계획](DOCKER_DEV_PLAN.md)
- [운영 배포 가이드](../PROD_DEPLOYMENT_GUIDE.md)
- [다국어 적용 계획](I18N_ROLLOUT_PLAN.md)
- [에이전트 가이드](AGENTS.md)
- [Claude 프롬프트 가이드](CLAUDE.md)
- [Agent Prompt](AGENT_PROMPT.md)

## 운영 배포 문서 사용 순서
1. [운영 배포 가이드](../PROD_DEPLOYMENT_GUIDE.md)에서 운영망/폐쇄망 경로를 먼저 선택합니다.
2. `deploy/.env.prod.example`를 복사해 `deploy/.env.prod`를 준비합니다.
3. 가이드의 사전 검증(`lint`, `build`, `compose config`)을 통과시킵니다.
4. 배포 후 상태 점검/보안 점검/롤백 기준을 같은 문서에서 확인합니다.

## QA 문서
- [사용자 등록 QA 체크리스트](qa/USER_CREATE_QA_CHECKLIST.md)
- [사용자 등록 QA 결과 템플릿](qa/USER_CREATE_QA_RESULT_TEMPLATE.md)
- [사용자 등록 QA 결과 (2026-05-12)](qa/USER_CREATE_QA_RESULT_2026-05-12.md)

## 운영 원칙
- 운영 기능 문서는 `docs` 루트에 관리합니다.
- 테스트/검증 문서는 `docs/qa` 하위에 관리합니다.
