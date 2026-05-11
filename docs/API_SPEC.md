# MeetMate Admin — API 명세 정리

> API 문서: https://mate3.dev.meetmate.co.kr/api/swagger/index.html  
> Base URL: `https://mate3.dev.meetmate.co.kr`  
> ✅ Swagger 문서 확인 완료 (2026-05-11)

---

## 🔑 인증 (Authentication)

### 관리자 로그인
```
POST /svc/user/issue-auth-token/by-password

Headers:
  X-Mate-Tenant-ID: {tenant_id}  (옵션)

Request Body:
{
  "auth_name": "string",      // 인증 이름 (아이디)
  "auth_password": "string",  // 인증 비밀번호
  "enc_type": ""              // 인코딩 타입 (기본: "", 또는 "base64")
}

Response 200:
{
  "access_token": "string",   // JWT 접속 토큰
  "refresh_token": "string"   // 갱신 토큰
}
```

### 토큰 갱신
```
POST /svc/user/refresh-auth-token

Request Body:
{
  "access_token": "string",   // 기존 접속 토큰
  "refresh_token": "string"   // 갱신 토큰
}

Response 200:
{
  "access_token": "string"    // 새로운 접속 토큰
}
```

### 토큰 검증
```
POST /svc/user/verify-auth-token/by-self
Authorization: Bearer {access_token}

Response 200:
{
  "user": {
    "user_id": "string",
    "auth_name": "string",
    "role": { "name": "string", "level": number, "permissions": [] },
    "tenant_id": "string"
  }
}
```

---

## 👤 사용자 관리 (Users)

> 엔드포인트: `/api/user/v1/users`  
> 인증 필요: `Authorization: Bearer {access_token}`  
> 헤더: `X-Mate-Tenant-ID: {tenant_id}` (옵션)

### 사용자 목록 조회
```
GET /api/user/v1/users

Query Params:
  - offset: number (기본: 0)
  - limit: number (기본: 20, 최대: 100)
  - user_id: string[] (사용자 id 필터)
  - auth_name: string[] (인증ID 필터)
  - email: string[] (이메일 필터)

Response 200:
{
  "error": "string",
  "message": {},
  "result": {
    "found_count": number,
    "total_count": number,
    "items": [
      {
        "user_id": "string",
        "auth_name": "string",
        "role": { "name": "string", "level": number, "permissions": [] }
      }
    ]
  }
}
```

### 사용자 생성
```
POST /api/user/v1/users

Request Body:
{
  "auth_name": "string",      // 인증 이름 (기본: 자동생성)
  "auth_password": "string",  // 인증 비밀번호 (기본: 자동생성)
  "email": "string",          // 이메일
  "user_name": "string",      // 사용자 이름
  "org_name": "string",       // 조직 이름
  "phone_number": "string",   // 전화번호
  "role_name": "string"       // "anonymous" | "member" (기본: "anonymous")
}

Response 201:
{
  "result": {
    "user_id": "string",
    "auth_name": "string",
    "auth_password": "string"
  }
}
```

### 사용자 수정
```
PUT /api/user/v1/users/{user_id}

Request Body:
{
  "auth_name": "string",
  "auth_password": "string",
  "email": "string",
  "user_name": "string",
  "org_name": "string",
  "phone_number": "string",
  "role_name": "string"
}
```

### 사용자 비활성화
```
DELETE /api/user/v1/users/{user_id}
```

---

## 📹 회의 관리 (Meetings)

> 엔드포인트: `/api/meeting/v1/meetings`  
> 인증 필요: `Authorization: Bearer {access_token}`

### 전체 회의 목록
```
GET /api/meeting/v1/meetings

Query Params:
  - offset: number (기본: 0)
  - limit: number (기본: 20, 최대: 100)
  - status: string[] ("drafted" | "booked" | "held" | "closed" | "deleted")
  - name_like: string (회의명 포함 검색)
  - search_keyword: string (회의명/초대코드/회의시간 검색)
  - show_password: boolean
  - exclude_member: boolean

Response 200:
{
  "error": "string",
  "message": {},
  "result": {
    "found_count": number,
    "total_count": number,
    "items": [
      {
        "meeting_id": "string",
        "name": "string",
        "code": "string",           // 초대 코드
        "status": "string",         // drafted|booked|held|closed|deleted
        "start_time": "string",     // ISO8601
        "progress_duration": number, // 진행시간 (ms)
        "member_max": number,       // 최대 참가자
        "password": "string",       // 비밀번호
        "owner_id": "string",
        "entry_option": "string"    // unlimited|registered
      }
    ]
  }
}
```

### 진행중 회의 목록
```
GET /api/meeting/v1/meetings?status=held
```

### 회의 예약 (생성)
```
POST /api/meeting/v1/meetings

Request Body:
{
  "name": "string",              // 회의 이름
  "start_time": "string",        // ISO8601 (기본: 현재시간)
  "progress_duration": number,   // 진행시간 ms (기본: 3600000)
  "member_max": number,          // 최대 참가자 (기본: 0=무제한)
  "password": "string",          // 비밀번호 (옵션)
  "entry_option": "string",      // "unlimited" | "registered"
  "members": [
    { "user_id": "string", "role_name": "string", "nickname": "string" }
  ]
}
```

### 회의 수정
```
PUT /api/meeting/v1/meetings/{meeting_id}

Request Body:
{
  "name": "string",
  "start_time": "string",
  "progress_duration": number,
  "member_max": number,
  "password": "string",
  "entry_option": "string"
}
```

### 회의 종료
```
POST /api/meeting/v1/meetings/{meeting_id}/close
```

### 회의 삭제
```
DELETE /api/meeting/v1/meetings/{meeting_id}
```

### 채팅 로그 조회
```
GET /api/meeting/v1/meetings/{meeting_id}/chat-logs

Query Params:
  - offset: number
  - limit: number (최대: 1000)
  - orderby: string (기본 시간순, "seq DESC" 역순)
```

---

## ⚙️ 시스템 설정 (Settings)

### 회의 설정 조회
```
GET /api/meeting/v1/settings

Response 200:
{
  "result": {
    "found_count": number,
    "items": [
      {
        "policy": { ... },
        "roles": { ... },
        "ui": { ... },
        "invitation_template": { ... }
      }
    ]
  }
}
```

### 회의 설정 수정
```
POST /api/meeting/v1/settings/update

Request Body:
{
  "policy": { ... },
  "roles": { ... },
  "ui": { ... }
}
```

### 사용자 서비스 옵션 조회
```
GET /api/user/v1/settings/option
```

---

## 📊 대시보드 통계

> ⚠️ 별도 통계 API 없음. 아래 API들을 조합해서 구성

| 통계 항목 | API |
|---------|-----|
| 전체 사용자 수 | `GET /api/user/v1/users?limit=1` → `total_count` |
| 전체 회의 수 | `GET /api/meeting/v1/meetings?limit=1` → `total_count` |
| 진행중 회의 수 | `GET /api/meeting/v1/meetings?status=held&limit=1` → `total_count` |
| 종료된 회의 수 | `GET /api/meeting/v1/meetings?status=closed&limit=1` → `total_count` |

---

## ⚠️ 공통 응답 구조

```json
{
  "error": "에러 코드 (성공시 빈 문자열)",
  "message": {
    "format": "에러 메시지 포맷",
    "params": {}
  },
  "result": { ... }
}
```

## 🔒 인증 방식

- **방식**: JWT Bearer Token
- **헤더**: `Authorization: Bearer {access_token}`
- **토큰 저장**: `localStorage`
- **만료 시 처리**: 401 응답 → 자동 로그아웃 → 로그인 페이지 리다이렉트
