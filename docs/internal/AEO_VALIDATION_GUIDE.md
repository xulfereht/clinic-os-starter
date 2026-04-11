# AEO 검증 가이드 (Clinic-OS)

> 블로그 포스트 및 토픽 발행 시 AEO(Article Enhancement Optimization) 검증 정책

## 개요

AEO 검증은 **콘텐츠 품질을 높이기 위한 권장사항**입니다. 기본적으로(`strict=false`) AEO 필드가 불완전필도 발행은 가능합니다.

## 검증 모드

### `strict = false` (기본값)

- AEO 필드가 불완전필도 **발행 가능**
- 검증 오류는 `errors` 배열에 포함되지만 발행을 차단하지 않음
- 데이터 무결성 관련 오류(URL 형식, slug 형식)만 차단

### `strict = true`

- 모든 AEO 필수 조건을 충족해야 발행 가능
- 미충족 시 자동으로 `draft`로 다운그레이드

## API 사용법

### 포스트 생성 (POST /api/admin/posts)

```json
{
  "type": "blog",
  "title": "포스트 제목",
  "content": "...",
  "status": "published"
  // strict 미지정 = false, AEO 없이도 발행 가능
}
```

**AEO 완성 후 엄격하게 발행하려면:**

```json
{
  "type": "blog",
  "title": "포스트 제목",
  "content": "...",
  "status": "published",
  "strict": true,
  "aeo": {
    "summary": "40자 이상의 요약문을 입력합니다...",
    "answer_short": "40자 이상의 짧은 답변을 입력합니다...",
    "supervisor_id": "doctor-uuid",
    "last_reviewed_at": 1710000000,
    "key_claims": ["핵심 주장 1", "핵심 주장 2"],
    "citations": [
      {"label": "출처명", "url": "https://example.com/source"}
    ]
  }
}
```

### 포스트 수정 (PUT /api/admin/posts/[id])

```json
{
  "status": "published",
  "strict": true,
  "aeo": {
    "summary": "...",
    // ... 다른 필드들
  }
}
```

## 응답 형식

### 발행 성공 (strict=false, AEO 불완전)

```json
{
  "success": true,
  "id": 123,
  "aeo": {
    "publish_ready": true,
    "normalized_status": "published",
    "errors": ["summary_min_40", "citations_required"],
    "strict": false
  }
}
```

> `errors` 배열에 warning들이 포함되어 있지만, `publish_ready: true`이므로 발행은 정상 완료됨

### 발행 차단 (strict=true, AEO 불완전)

```json
{
  "success": true,
  "id": 123,
  "aeo": {
    "publish_ready": false,
    "normalized_status": "draft",
    "errors": ["summary_min_40", "citations_required"],
    "strict": true
  }
}
```

> `publish_ready: false`이고 `normalized_status: "draft"`로 자동 다운그레이드됨

## AEO 필드 체크리스트

| 필드 | 최소 요건 | strict=false | strict=true |
|------|----------|--------------|-------------|
| summary | 40자 이상 | warning | error (발행 차단) |
| answer_short | 40자 이상 | warning | error (발행 차단) |
| supervisor_id | 필수 | warning | error (발행 차단) |
| last_reviewed_at | 유효한 timestamp | warning | error (발행 차단) |
| key_claims | 1개 이상 | warning | error (발행 차단) |
| citations | 1개 이상 | warning | error (발행 차단) |
| citations[].url | http/https URL | error | error (항상 차단) |
| related_*_slugs | slug 형식 | error | error (항상 차단) |

## 에이전트 가이드라인

### 블로그 포스트 발행 시

#### 방법 1: 빠른 발행 (권장 - AEO 나중에 채움)

```
에이전트: "블로그 글을 발행합니다."
→ POST /api/admin/posts (strict 미지정 또는 false)
→ 발행 성공
→ 응답: aeo.errors에 누락된 필드 목록
→ "발행 완료. AEO 메타데이터가 완전하지 않습니다. "/admin/aeo"에서 보완하세요."
```

#### 방법 2: AEO 완성 후 발행

```
에이전트: "AEO 메타데이터를 확인합니다."
→ summary, answer_short, supervisor_id, key_claims, citations 모두 확인
→ "모든 AEO 필드가 완성되었습니다. strict 모드로 발행합니다."
→ POST /api/admin/posts (strict: true)
→ 발행 성공
```

#### 방법 3: AEO 미완성 발행 차단

```
에이전트: "AEO 완성된 콘텐츠만 발행하겠습니다."
→ POST /api/admin/posts (strict: true)
→ 응답: publish_ready: false, normalized_status: "draft"
→ "다음 필드가 필요합니다: summary (40자 이상), citations (1개 이상)"
```

### 경고 메시지 해석

| 에러 코드 | 의미 | 조치 |
|-----------|------|------|
| `summary_min_40` | 요약문 40자 미만 | 요약문 확장 |
| `answer_short_min_40` | 짧은 답변 40자 미만 | 답변 확장 |
| `supervisor_required` | 감수자 미지정 | 의료진 선택 |
| `last_reviewed_at_required` | 검토일 미지정 | 검토일 설정 |
| `key_claims_required` | 핵심 주장 없음 | key_claims 추가 |
| `citations_required` | 인용 출처 없음 | citations 추가 |
| `citation_invalid_url:{url}` | 잘못된 URL | http/https URL 사용 |

## 참고 파일

- 검증 로직: `src/lib/aeo-content.ts` (`validateAeoMetadata` 함수)
- 포스트 생성 API: `src/pages/api/admin/posts/index.ts`
- 포스트 수정 API: `src/pages/api/admin/posts/[id].ts`
