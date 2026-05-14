# 운영 배포 가이드 (Docker + Domain + CORS + Security)

이 문서는 `mate_admin` 프론트엔드를 운영 서버에 안전하게 배포하기 위한 기본 체계를 정의합니다.

## 1) 배포 아키텍처

- `app` 컨테이너: Next.js 운영 서버 (`Dockerfile.prod`)
- `caddy` 컨테이너: TLS 종료 + 도메인 라우팅 + 보안 헤더
- 백엔드 API 서버: 별도 서비스 (`https://api.example.com` 등)
- 프론트 기본 API 주소: `deploy/.env.prod`의 `BACKEND_API_BASE_URL` 값을 빌드 시 `NEXT_PUBLIC_API_BASE_URL`로 주입

권장 도메인 분리:
- 관리자 웹: `https://admin.example.com`
- 백엔드 API: `https://api.example.com`

## 2) 사전 준비

- DNS A/AAAA 레코드:
  - `admin.example.com` -> 운영 서버 공인 IP
- 서버 방화벽:
  - 인바운드 `80/tcp`, `443/tcp`만 허용
  - SSH는 관리망/IP 제한
- 파일 준비:
  - `cp deploy/.env.prod.example deploy/.env.prod`
  - `deploy/.env.prod` 값 실서버 도메인/이메일로 변경

## 3) 배포 실행

```bash
cd /path/to/mate_admin
cp deploy/.env.prod.example deploy/.env.prod
# deploy/.env.prod 편집

docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml build --no-cache
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d
```

상태 점검:

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml ps
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs -f app
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml logs -f caddy
```

## 4) 도메인/TLS

- Caddy가 자동으로 Let's Encrypt 인증서를 발급/갱신합니다.
- 설정 파일: `deploy/Caddyfile`
- 인증서/설정 영속 볼륨:
  - `caddy_data`
  - `caddy_config`

## 5) CORS 운영 정책 (백엔드 필수)

프론트는 브라우저에서 백엔드 API를 직접 호출하므로, 백엔드에 정확한 CORS 제한이 필요합니다.

최소 정책:
- `Access-Control-Allow-Origin`: `https://admin.example.com`만 허용
- `Access-Control-Allow-Credentials`: `true`
- `Access-Control-Allow-Headers`: `Authorization, Content-Type, X-Mate-Tenant-ID`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS`
- `Vary: Origin` 설정

샘플: `deploy/cors-nginx.conf.example`

## 6) 보안 하드닝 반영 사항

코드/컨테이너에 반영됨:
- Next.js standalone 빌드 (`next.config.ts`)
- 보안 헤더(CSP, HSTS, X-Frame-Options 등) (`next.config.ts`)
- `poweredByHeader` 비활성화
- 프로덕션 컨테이너 비루트 유저 실행 (`Dockerfile.prod`)
- `docker-compose.prod.yml`에서 `read_only`, `cap_drop: [ALL]`, `no-new-privileges` 적용
- 앱/프록시 헬스체크

## 7) 운영 체크리스트

배포 직후:
- `https://admin.example.com` 접속 확인
- 로그인 가능 여부 확인
- 설정 > 공통에서 API Base URL을 운영 API로 지정
- 사용자 목록/미팅 목록 조회 확인

보안 점검:
- 응답 헤더 점검 (`curl -I https://admin.example.com`)
- CORS 오리진 제한 확인 (허용 도메인 외 차단)
- 서버 포트 노출 확인 (80/443 외 비공개)
- 컨테이너 루트 실행 여부 확인 (`docker inspect`)

## 8) 미구현/주의 사항

- 설정 페이지의 정책 저장은 현재 "골격만 준비, 실제 반영 비활성화" 상태입니다.
- 실제 정책 저장 적용 시, 백엔드 정책 API의 세부 payload 스키마 확정이 필요합니다.

## 9) 폐쇄망(Air-gapped) 배포 가이드

폐쇄망에서는 외부 인증서 발급(ACME/Let's Encrypt)을 사용할 수 없으므로, 로컬 인증서를 직접 마운트해야 합니다.

### 9-1) 앱 기본 API 주소 정책

- 코드 기본값은 외부 도메인 fallback을 사용하지 않습니다.
- `NEXT_PUBLIC_API_BASE_URL`을 주입하지 않으면 기본값은 빈 문자열이며, 로그인 설정 화면에서 내부 API 주소를 지정해야 합니다.

### 9-2) Caddy 설정 전환

기본 `deploy/Caddyfile`은 ACME 기반입니다. 폐쇄망에서는 아래 파일을 사용하세요.

- 폐쇄망용 파일: `deploy/Caddyfile.airgap`
- TLS 인증서 경로: `/certs/admin.crt`, `/certs/admin.key`

예시:

```bash
cp deploy/Caddyfile.airgap deploy/Caddyfile
```

그리고 `caddy` 서비스에 인증서 볼륨을 추가 마운트합니다.

```yaml
services:
  caddy:
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./deploy/certs:/certs:ro
      - caddy_data:/data
      - caddy_config:/config
```

### 9-3) 폐쇄망 검증 체크

- 외부 DNS/인터넷이 차단된 환경에서 컨테이너 기동 여부 확인
- `docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml config` 통과 확인
- 브라우저 접속 후 로그인 설정에서 내부 API 주소 지정/연결 테스트
- 사용자/미팅 목록 조회로 내부 API 통신 확인
