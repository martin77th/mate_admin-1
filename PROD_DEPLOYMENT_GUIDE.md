# 운영 배포 런북 (Production + Air-gapped)

이 문서는 `mate_admin` 운영 배포를 위한 실행 절차를 한 번에 제공하는 런북입니다.

## 1) 범위와 목표

- 대상: Docker 기반 운영 배포
- 포함: 일반 운영망(인터넷 가능), 폐쇄망(air-gapped)
- 목표: 재현 가능한 배포 절차 + 점검 + 롤백 기준

## 2) 배포 아키텍처

- `app` 컨테이너: Next.js 운영 서버 (`Dockerfile.prod`)
- `caddy` 컨테이너: TLS 종료, 도메인 라우팅, 보안 헤더
- 백엔드 API: 별도 서비스

권장 도메인 구성:
- 관리자 웹: `https://admin.example.com`
- 백엔드 API: `https://api.example.com`

## 3) 공통 사전 점검

### 3-1. 인프라

- DNS: `admin.example.com`이 운영 서버를 가리키는지 확인
- 방화벽: `80/tcp`, `443/tcp`만 외부 허용
- SSH: 관리망/IP 제한

### 3-2. 파일 준비

```bash
cd /path/to/mate_admin
cp deploy/.env.prod.example deploy/.env.prod
```

`deploy/.env.prod` 필수 값:
- `ADMIN_DOMAIN`
- `ACME_EMAIL` (일반 운영망에서만 사용)
- `FRONTEND_ORIGIN`
- `BACKEND_API_BASE_URL`

### 3-3. 배포 전 검증

```bash
npm run lint
npm run build
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml config
```

## 4) 일반 운영망 배포 (인터넷 가능)

### 4-1. 배포 실행

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml build --no-cache
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d
```

### 4-2. 상태 확인

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml ps
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs -f app
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs -f caddy
```

### 4-3. TLS

- 기본 `deploy/Caddyfile`은 ACME(Let's Encrypt) 자동 발급/갱신을 사용
- 인증서 데이터는 `caddy_data`, `caddy_config` 볼륨에 보관

### 4-4. HTTPS 도메인 매핑 (서브도메인 포함)

기본 운영 도메인은 `deploy/.env.prod`의 `ADMIN_DOMAIN`으로 매핑됩니다.

추가 서브도메인을 적용하려면:

1. DNS 레코드 추가
- `ops-admin.example.com` 같은 서브도메인을 운영 서버 IP로 연결

2. Caddy 서브도메인 라우트 파일 생성

```bash
cp deploy/caddy/subdomains/admin-subdomain.example.caddy deploy/caddy/subdomains/ops.caddy
```

3. 생성한 `.caddy` 파일의 도메인/upstream 수정

4. Caddy 재적용

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d caddy
```

주의:
- 일반 운영망에서는 Caddy가 추가 서브도메인 인증서를 자동 발급합니다.
- 방화벽 80/443, DNS 전파가 완료되어야 인증서 발급이 성공합니다.

## 5) 폐쇄망 배포 (Air-gapped)

폐쇄망에서는 외부 ACME를 사용할 수 없으므로, 로컬 인증서를 직접 마운트해야 합니다.

### 5-1. API 기본값 정책

- 앱 기본 API 주소는 외부 fallback을 사용하지 않음
- `NEXT_PUBLIC_API_BASE_URL`이 비어 있으면 기본값은 빈 문자열
- 운영 시 로그인 설정 화면에서 내부 API 주소를 명시 저장

### 5-2. Caddy 설정 전환

- 일반 운영망용: `deploy/Caddyfile`
- 폐쇄망용: `deploy/Caddyfile.airgap`

```bash
cp deploy/Caddyfile.airgap deploy/Caddyfile
```

폐쇄망용 Caddy는 다음 인증서 경로를 사용:
- `/certs/admin.crt`
- `/certs/admin.key`

`docker-compose.prod.yml`의 `caddy` 볼륨에 인증서 마운트 추가:

```yaml
services:
  caddy:
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./deploy/caddy/subdomains:/etc/caddy/subdomains:ro
      - ./deploy/certs:/certs:ro
      - caddy_data:/data
      - caddy_config:/config
```

폐쇄망 서브도메인 주의:
- `deploy/caddy/subdomains/*.caddy`로 서브도메인 라우트를 추가할 수 있습니다.
- `/certs/admin.crt` 인증서에 각 서브도메인 SAN이 포함되어야 브라우저 경고 없이 HTTPS가 동작합니다.

### 5-3. 폐쇄망 검증

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml config
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d
```

기능 점검:
- 관리자 웹 접속
- 로그인 후 내부 API 주소 저장/연결 테스트
- 사용자/미팅 목록 조회

## 6) 백엔드 CORS 운영 정책 (필수)

브라우저에서 백엔드 API를 직접 호출하므로 백엔드 CORS는 반드시 제한해야 합니다.

최소 권장:
- `Access-Control-Allow-Origin`: `https://admin.example.com`
- `Access-Control-Allow-Credentials`: `true`
- `Access-Control-Allow-Headers`: `Authorization, Content-Type, X-Mate-Tenant-ID`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS`
- `Vary: Origin`

샘플: `deploy/cors-nginx.conf.example`

서브도메인을 함께 운영할 경우:
- 백엔드 CORS 허용 origin 목록에 각 프론트엔드 서브도메인을 명시 추가해야 합니다.

## 7) 보안 하드닝 체크

반영 항목:
- Next.js standalone 빌드
- 보안 헤더(CSP/HSTS/X-Frame-Options 등)
- `poweredByHeader` 비활성화
- 컨테이너 `read_only`, `cap_drop: [ALL]`, `no-new-privileges`
- app/caddy 헬스체크

운영 점검:
- `curl -I https://admin.example.com`
- 80/443 외 포트 외부 미노출 확인
- 컨테이너 비루트 실행 여부 확인

## 8) 장애 대응 및 롤백

### 8-1. 기본 진단

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml ps
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs --tail=200 app
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs --tail=200 caddy
```

### 8-2. 롤백 기준

- 앱 응답 불가, 로그인 불가, 핵심 목록 조회 불가 시 즉시 롤백

### 8-3. 롤백 절차(예시)

```bash
git checkout <이전_정상_커밋>
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml build --no-cache
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d
```

## 9) 현재 제한 사항

- 설정 페이지 정책 저장은 UI 골격만 준비되어 있고 서버 반영은 비활성화 상태
