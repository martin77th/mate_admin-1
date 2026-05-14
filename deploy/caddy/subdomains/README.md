# Caddy subdomain routes

이 디렉터리는 운영 시 추가 서브도메인 라우트를 정의할 때 사용합니다.

- 이 폴더의 `*.caddy` 파일은 메인 Caddy 설정에서 자동으로 import 됩니다.
- 기본 도메인 라우트는 `deploy/Caddyfile`에 있으며, 이 폴더는 추가 도메인 전용입니다.

## 사용 방법

1. 예시 파일을 복사해 실제 파일명(확장자 `.caddy`)으로 생성합니다.
2. 도메인과 upstream을 환경에 맞게 수정합니다.
3. DNS 레코드를 먼저 반영한 뒤 Caddy를 재기동합니다.

```bash
cp deploy/caddy/subdomains/admin-subdomain.example.caddy deploy/caddy/subdomains/ops.caddy
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d caddy
```

## 인증서 주의사항

- 일반 운영망: Caddy가 각 도메인에 대해 ACME 인증서를 자동 발급/갱신합니다.
- 폐쇄망: `/certs`에 마운트한 인증서가 해당 서브도메인 SAN을 포함해야 합니다.
