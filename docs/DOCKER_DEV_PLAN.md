# Mate Admin Docker 개발 환경 계획

## 목표
- 앱 실행을 Docker 기반으로 전환한다.
- 구동 파일은 `/Volumes/MartinData/SERVER/mate_admin`에 둔다.
- 서비스 접근 포트는 호스트 `5001`로 고정한다.
- 로컬 소스 경로 `/Volumes/MartinData/dev-project/martin-project/mate_admin`를 개발 원본으로 유지한다.

## 경로/포트 표준
- 소스 코드: `/Volumes/MartinData/dev-project/martin-project/mate_admin`
- 구동 파일: `/Volumes/MartinData/SERVER/mate_admin`
- 컨테이너 내부 포트: `3000`
- 호스트 노출 포트: `5001`

## 동작 방식
- Docker Compose는 서버 폴더에 위치한다.
- Compose는 소스 코드를 bind mount로 연결한다.
- 최초 기동 시 `node_modules`가 비어 있으면 자동으로 `npm ci`를 수행한다.
- Next 개발 서버는 컨테이너 내부에서 `0.0.0.0:3000`으로 실행한다.
- 운영 모드는 멀티스테이지 빌드(`Dockerfile.prod`)로 실행한다.

## 개발 워크플로우
1. `/Volumes/MartinData/SERVER/mate_admin`로 이동
2. `chmod +x manage.sh`
3. `./manage.sh rebuild-dev`
3. 브라우저에서 `http://localhost:5001` 접속
4. 코드 수정 후 자동 반영(HMR) 확인
5. 종료 시 `./manage.sh down`

## 운영 워크플로우
1. `/Volumes/MartinData/SERVER/mate_admin`로 이동
2. `chmod +x manage.sh`
3. `./manage.sh rebuild-prod`
4. 브라우저에서 `http://localhost:5001` 접속
5. 종료 시 `./manage.sh down`

## 운영 규칙
- 앱 실행/중지는 서버 폴더의 Compose 기준으로만 수행한다.
- 패키지 변경(package-lock.json 변경) 시 컨테이너 재빌드(`--build`)를 수행한다.
- 캐시 이상 시 `docker compose down -v` 후 재기동한다.
- 빠른 실행은 `manage.sh`를 표준 엔트리로 사용한다.

## 확인 체크리스트
- [ ] `docker compose ps`에서 서비스 상태가 `running`
- [ ] `http://localhost:5001` 접속 가능
- [ ] 코드 수정 시 페이지가 자동 갱신됨
- [ ] 컨테이너 로그에 치명 오류 없음
