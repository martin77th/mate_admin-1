<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:commit-rules -->
# 커밋 정책 (반드시 준수)

## 자동 커밋
- 단위 개발(기능 하나, 파일 하나 완성 등)이 완료될 때마다 **즉시 커밋**한다.
- 커밋 메시지는 **반드시 한글**로 작성한다.
- `git push`는 절대 하지 않는다. push는 사용자가 직접 수행한다.

## 커밋 메시지 형식
```
타입: 한글 요약 (50자 이내)

- 변경 내용 상세 (선택)
```

## 타입 목록
| 타입 | 설명 |
|------|------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `style` | CSS/스타일 변경 |
| `refactor` | 리팩토링 |
| `docs` | 문서 수정 |
| `chore` | 설정, 의존성 등 기타 작업 |

## 예시
```
feat: 사용자 관리 페이지 목록 구현
fix: 로그인 후 리다이렉트 오류 수정
style: 대시보드 통계 카드 반응형 개선
```
<!-- END:commit-rules -->
