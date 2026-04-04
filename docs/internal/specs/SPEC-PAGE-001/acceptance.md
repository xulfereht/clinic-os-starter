# Acceptance Criteria

## Given/When/Then Scenarios

### Scenario 1: 페이지 목록 조회

**Given**: 관리자가 로그인되어 있고 Admin Panel에 접근함

**When**: 관리자가 페이지 관리 메뉴를 클릭함

**Then**:
- 등록된 모든 페이지 목록이 표시되어야 함
- 각 페이지의 제목, 슬러그, 게시 상태, 생성자가 표시되어야 함
- `created_by: ai`인 페이지는 AI 배지가 표시되어야 함
- 페이지가 없을 경우 빈 상태 메시지가 표시되어야 함

### Scenario 2: 새 페이지 생성 (Admin)

**Given**: 관리자가 페이지 생성 화면에 있음

**When**: 관리자가 제목, 슬러그, 섹션 데이터를 입력하고 저장함

**Then**:
- 페이지가 `pages` 테이블에 저장되어야 함
- `created_by`가 'admin'으로 설정되어야 함
- `created_at`, `updated_at`이 현재 시간으로 설정되어야 함
- 목록 화면으로 리다이렉트되어야 함
- 성공 메시지가 표시되어야 함

### Scenario 3: AI 페이지 생성 (가드레일)

**Given**: AI Agent가 새로운 페이지 생성을 요청함

**When**: AI Agent가 `createPageAI()` 함수를 호출함

**Then**:
- 페이지가 `pages` 테이블에 자동 등록되어야 함
- `created_by`가 'ai'로 강제 설정되어야 함
- `is_published`가 1(게시)으로 설정되어야 함
- Admin Panel 목록에 즉시 표시되어야 함
- 직접 파일 생성이 차단되어야 함

### Scenario 4: 중복 슬러그 방지

**Given**: 슬러그 'about-us'인 페이지가 이미 존재함

**When**: 관리자 또는 AI가 동일한 슬러그로 페이지 생성을 시도함

**Then**:
- 생성이 거부되어야 함
- "이미 존재하는 슬러그입니다" 에러가 반환되어야 함
- 새로운 슬러그 제안이 표시되어야 함 (예: about-us-2)

### Scenario 5: 게시 상태 변경

**Given**: 페이지가 비게시 상태임 (`is_published = 0`)

**When**: 관리자가 게시 토글을 클릭함

**Then**:
- `is_published`가 1로 변경되어야 함
- `updated_at`이 현재 시간으로 갱신되어야 함
- 공개 URL(`/about-us`)에서 즉시 접근 가능해야 함

### Scenario 6: 동적 페이지 라우팅

**Given**: 슬러그 'ai-guide'인 페이지가 `pages` 테이블에 존재하고 게시됨

**When**: 사용자가 `/ai-guide` URL로 접근함

**Then**:
- `pages` 테이블에서 해당 슬러그의 페이지가 조회되어야 함
- 섹션 데이터가 파싱되어 렌더링되어야 함
- SEO 메타데이터가 적용되어야 함
- 페이지가 정상적으로 표시되어야 함

### Scenario 7: 미게시 페이지 접근 제한

**Given**: 슬러그 'draft-page'인 페이지가 비게시 상태임 (`is_published = 0`)

**When**: 일반 사용자가 `/draft-page` URL로 접근함

**Then**:
- 404 페이지가 표시되어야 함
- "페이지를 찾을 수 없습니다" 메시지가 표시되어야 함
- 관리자는 Admin Panel에서만 접근 가능해야 함

### Scenario 8: 고스트 페이지 방지

**Given**: AI가 파일 시스템에 직접 `ghost-page.astro` 파일을 생성하려고 시도함

**When**: 사용자가 `/ghost-page` URL로 접근함

**Then**:
- `pages` 테이블에 해당 슬러그가 없으므로 404가 표시되어야 함
- Astro 파일이 존재하더라도 라우팅되지 않아야 함
- "페이지를 찾을 수 없습니다" 메시지가 표시되어야 함

### Scenario 9: AI 페이지 Admin 표시

**Given**: AI가 3개의 페이지를 생성함

**When**: 관리자가 Admin Panel의 페이지 목록을 조회함

**Then**:
- 모든 AI 생성 페이지가 목록에 표시되어야 함
- 각 AI 페이지에 'AI' 배지/아이콘이 표시되어야 함
- `created_by` 컬럼이 'ai'로 설정되어 있어야 함
- 필터로 AI 페이지만 볼 수 있어야 함

### Scenario 10: 페이지 수정

**Given**: 관리자가 기존 페이지를 편집 화면에서 열음

**When**: 관리자가 제목과 섹션 데이터를 수정하고 저장함

**Then**:
- `pages` 테이블에서 페이지가 업데이트되어야 함
- `updated_at`이 현재 시간으로 갱신되어야 함
- `created_by`는 변경되지 않아야 함 (AI 페이지는 AI 유지)
- 변경 사항이 공개 URL에 즉시 반영되어야 함

## Edge Cases

### EC-PAGE-001: 특수 문자 슬러그

**조건**: 슬러그에 공백, 한글, 특수 문자 포함

**예상 동작**:
- `cleanupSlug()` 함수가 URL-safe 형식으로 변환
- 공백은 하이픈으로 변환
- 한글은 유지 (URL 인코딩)
- 특수 문자 제거

### EC-PAGE-002: 대용량 섹션 데이터

**조건**: 섹션 데이터 JSON이 1MB 초과

**예상 동작**:
- 저장 거부
- "섹션 데이터가 너무 큽니다 (최대 1MB)" 에러
- 섹션 분할 권장

### EC-PAGE-003: 동시 수정

**조건**: 두 관리자가 동일한 페이지를 동시에 수정

**예상 동작**:
- 마지막 저장이 우선됨
- 낙관적 잠금 또는 경고 메시지
- `updated_at` 기반 충돌 감지

### EC-PAGE-004: AI 페이지 삭제

**조건**: 관리자가 AI 생성 페이지 삭제 시도

**예상 동작**:
- 삭제 가능 (AI 페이지도 관리자 제어)
- 삭제 확인 대화상자
- "AI 페이지입니다. 정말 삭제하시겠습니까?" 경고

### EC-PAGE-005: 존재하지 않는 페이지 수정

**조건**: 삭제된 페이지 ID로 수정 시도

**예상 동작**:
- 404 에러
- "페이지를 찾을 수 없습니다" 메시지
- 목록 화면으로 리다이렉트

## Performance Criteria

### PC-PAGE-001: API 응답 시간

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 페이지 목록 조회 | P95 < 200ms | GET /api/admin/pages |
| 페이지 상세 조회 | P95 < 100ms | GET /api/admin/pages/[id] |
| 페이지 생성 | P95 < 300ms | POST /api/admin/pages/create |
| 페이지 수정 | P95 < 250ms | PUT /api/admin/pages/[id] |

### PC-PAGE-002: 페이지 로드 시간

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 동적 페이지 렌더링 | P95 < 1s | /[slug] 접근 ~ 완료 |
| Admin Panel 로드 | P95 < 500ms | 페이지 관리 화면 로드 |

### PC-PAGE-003: 데이터베이스 쿼리

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 슬러그 조회 | < 50ms | SELECT WHERE slug |
| 목록 조회 (50개) | < 100ms | SELECT ORDER BY LIMIT |

## Quality Gates

### TRUST 5 기준

#### Tested
- 단위 테스트 커버리지 ≥ 80%
- 모든 Given/When/Then 시나리오 통과
- 엣지 케이스 테스트 포함
- AI 가드레일 테스트 필수

#### Readable
- 명확한 변수/함수 명명
- TypeScript 타입 정의 완료
- 코드 주석 포함

#### Unified
- 일관된 API 응답 형식
- 표준 에러 처리
- 일관된 UI 컴포넌트

#### Secured
- XSS 방지 (모든 입력 sanitize)
- SQL 인젝션 방지 (파라미터 바인딩)
- Admin 인증 필수
- 슬러그 검증

#### Trackable
- 모든 API 호출 로깅
- `created_at`, `updated_at` 유지
- `created_by` 추적
- 변경 이력

## Testing Strategy

### 단위 테스트

```typescript
describe('PageService', () => {
    test('createPageAI - 정상 생성', async () => {
        const result = await createPageAI({
            slug: 'test-page',
            title: '테스트 페이지',
            sections: []
        });
        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
    });

    test('createPageAI - 중복 슬러그 거부', async () => {
        await createPageAI({ slug: 'duplicate', title: 'First' });
        const result = await createPageAI({ slug: 'duplicate', title: 'Second' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Duplicate');
    });
});
```

### 통합 테스트

```typescript
describe('Page API Integration', () => {
    test('AI 페이지 생성 후 Admin 표시', async () => {
        // AI로 페이지 생성
        const createResult = await createPageAI({ ... });
        
        // Admin 목록 조회
        const listResult = await fetch('/api/admin/pages');
        const pages = await listResult.json();
        
        // AI 페이지가 목록에 있는지 확인
        const aiPage = pages.data.find(p => p.id === createResult.id);
        expect(aiPage).toBeDefined();
        expect(aiPage.created_by).toBe('ai');
    });
});
```

### AI 가드레일 테스트

```typescript
describe('AI Guardrail Tests', () => {
    test('고스트 페이지 방지', async () => {
        // pages 테이블에 없는 슬러그로 접근
        const response = await fetch('/non-existent-page');
        expect(response.status).toBe(404);
    });

    test('AI 페이지 강제 등록', async () => {
        const result = await createPageAI({ ... });
        
        // DB에 직접 조회
        const page = await db.prepare(
            "SELECT * FROM pages WHERE id = ?"
        ).bind(result.id).first();
        
        expect(page).toBeDefined();
        expect(page.created_by).toBe('ai');
    });
});
```

## Definition of Done

- [ ] 모든 Given/When/Then 시나리오 통과
- [ ] AI 가드레일 테스트 통과 (AI-PAGE-001~005)
- [ ] 엣지 케이스 처리 완료
- [ ] 성능 기준 충족
- [ ] TRUST 5 품질 게이트 통과
- [ ] 테스트 커버리지 80% 이상
- [ ] API 문서 완성
- [ ] AI Agent 가이드라인 작성
- [ ] Admin Panel UI 구현 완료
- [ ] 동적 라우팅 동작
- [ ] 고스트 페이지 0개 확인

## Rollback Criteria

다음 경우 이전 버전으로 롤백 고려:
- AI 가드레일 우회 가능
- 고스트 페이지 발견
- 성능 저하가 50% 이상
- 데이터 일관성 손상
- 48시간 내 해결 불가능한 문제
