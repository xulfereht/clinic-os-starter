# Implementation Plan

## Phase Breakdown

### Phase 1: 데이터베이스 스키마 확장 (Priority High)

**목표**: `pages` 테이블에 AI 가드레일 및 메타데이터 컬럼 추가

**작업 항목**:
1. 마이그레이션 스크립트 작성
   - `created_by` 컬럼 추가 (TEXT, DEFAULT 'admin')
   - `meta_title`, `meta_description`, `meta_keywords` 컬럼 추가
   - 인덱스 생성: `idx_pages_created_by`

2. 기존 데이터 마이그레이션
   - 기존 페이지 레코드에 `created_by = 'admin'` 설정
   - NULL 값 처리

3. 마이그레이션 검증
   - 스키마 변경 확인
   - 인덱스 생성 확인
   - 기존 데이터 무결성 확인

**의존성**: 없음 (최초 단계)

**완료 기준**:
- [ ] 마이그레이션 스크립트 완성
- [ ] 모든 컬럼 및 인덱스 생성
- [ ] 기존 데이터 마이그레이션 완료

### Phase 2: API 레이어 구현 (Priority High)

**목표**: 페이지 CRUD API 및 AI 가드레일 구현

**작업 항목**:
1. 페이지 목록 API 확장
   - `created_by` 필터 추가
   - 정렬 옵션 확장

2. 페이지 생성 API
   - AI 표시자(`created_by`) 처리
   - 메타데이터 필드 지원
   - 강제 슬러그 정제

3. 페이지 수정/삭제 API
   - 권한 검증 강화
   - 섹션 데이터 검증

4. 게시 상태 변경 API
   - 즉시 반영
   - 상태 변경 로그

5. AI 가드레일 구현
   - `createPageAI()` 함수 구현
   - 직접 파일 생성 방지 로직
   - Admin 자동 표시

**의존성**: Phase 1 완료

**완료 기준**:
- [ ] 모든 API 엔드포인트 구현
- [ ] AI 가드레일 동작
- [ ] API 테스트 통과

### Phase 3: 동적 라우팅 (Priority High)

**목표**: `[slug].astro` 동적 페이지 라우팅 구현

**작업 항목**:
1. 동적 라우트 생성
   - `src/pages/[slug].astro` 생성
   - 페이지 조회 로직
   - 404 처리

2. 섹션 렌더러 구현
   - `SectionRenderer` 컴포넌트
   - 섹션 타입별 렌더링
   - 스타일 적용

3. SEO 메타데이터
   - 동적 meta 태그
   - Open Graph 지원

4. 고스트 페이지 방지
   - `pages` 테이블 외 페이지 라우팅 차단
   - 등록되지 않은 slug 404 처리

**의존성**: Phase 1, 2 완료

**완료 기준**:
- [ ] 동적 라우팅 동작
- [ ] 섹션 렌더링 정상
- [ ] SEO 메타데이터 적용
- [ ] 고스트 페이지 방지 확인

### Phase 4: Admin Panel UI (Priority High)

**목표**: 페이지 관리 인터페이스 구현

**작업 항목**:
1. 페이지 목록 화면
   - DataTable 컴포넌트
   - 필터 및 검색
   - `created_by` 표시 (AI/구분)
   - 게시 상태 토글

2. 페이지 생성/편집 화면
   - Section Builder
   - 미리보기
   - SEO 메타데이터 입력

3. AI 페이지 식별
   - `created_by: ai` 표시
   - AI 아이콘/배지

4. 일괄 작업
   - 다중 선택
   - 일괄 게시/비게시
   - 일괄 삭제

**의존성**: Phase 2 완료

**완료 기준**:
- [ ] 목록 화면 구현
- [ ] 생성/편집 화면 구현
- [ ] AI 페이지 식별 기능
- [ ] 일괄 작업 기능

### Phase 5: AI Agent 통합 (Priority Medium)

**목표**: AI Agent가 페이지 생성을 위한 API 활용

**작업 항목**:
1. AI Agent용 페이지 생성 함수
   - `createPageAI()` 함수
   - 강제 API 경로 사용
   - 자동 등록 로직

2. AI Agent 가이드라인
   - 페이지 생성 프로세스 문서화
   - 가드레일 규칙 명시
   - 예제 코드 제공

3. 테스트 및 검증
   - AI Agent 페이지 생성 테스트
   - Admin Panel 표시 확인
   - 고스트 페이지 부재 확인

**의존성**: Phase 2, 3, 4 완료

**완료 기준**:
- [ ] `createPageAI()` 함수 구현
- [ ] AI Agent 가이드라인 작성
- [ ] 통합 테스트 통과

## Technology Stack

### 핵심 기술

| 컴포넌트 | 기술 | 버전 | 용도 |
|----------|------|------|------|
| 프레임워크 | Astro | 4+ | 메인 프레임워크 |
| UI | React | 19 | Admin Panel 컴포넌트 |
| 데이터베이스 | D1 | Latest | 페이지 저장소 |
| 언어 | TypeScript | 5+ | 타입 안전성 |
| 스타일 | Tailwind CSS | 3+ | UI 스타일링 |
| API | REST | - | 페이지 CRUD |

### 추천 라이브러리

```json
{
  "dependencies": {
    "astro": "^4.0.0",
    "react": "^19.0.0",
    "@astrojs/react": "^3.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.9.0"
  }
}
```

## Architecture Design

### 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Admin Panel UI                      │    │
│  │  - PageList, PageEditor, SectionBuilder        │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │            REST API Endpoints                   │    │
│  │  /api/admin/pages/*                             │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Business Logic Layer                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │              PageService                        │    │
│  │  - createPageAI() (가드레일)                   │    │
│  │  - validateSlug()                              │    │
│  │  - checkDuplicate()                            │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │              D1 Database                        │    │
│  │  pages 테이블                                    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Risk Analysis

| 리스크 | 영향도 | 확률 | 완화책 |
|--------|--------|------|--------|
| **AI 가드레일 우회** | 높음 | 중간 | - API 강제 사용<br>- 파일 생성 권한 제한<br>- 정기 검증 |
| **성능 저하** | 중간 | 낮음 | - 인덱스 최적화<br>- 캐싱 도입<br>- 쿼리 최적화 |
| **SEO 이슈** | 중간 | 중간 | - 메타데이터 지원<br>- sitemap 자동화<br>- 정적 생성 지원 |
| **데이터 일관성** | 높음 | 낮음 | - 트랜잭션 처리<br>- 유효성 검사<br>- 롤백 계획 |
| **UI 복잡도** | 중간 | 중간 | - Section Builder 단순화<br>- 미리보기 기능<br>- 템플릿 제공 |

## AI Guardrail Implementation Strategy

### 가드레일 1: 강제 API 경로

**구현**:
```typescript
// src/lib/PageService.ts
export async function createPageAI(params: CreatePageParams) {
    // 1. 필수 검증
    if (!params.slug || !params.title) {
        throw new Error("Slug and title are required");
    }

    // 2. 슬러그 정제
    const cleanedSlug = cleanupSlug(params.slug);

    // 3. 중복 검사
    const exists = await checkDuplicate(cleanedSlug);
    if (exists) {
        throw new Error(`Slug '${cleanedSlug}' already exists`);
    }

    // 4. 강제 등록
    const id = crypto.randomUUID();
    await db.prepare(INSERT_QUERY).bind(
        id, cleanedSlug, params.title, /* ... */
        'ai' // created_by 강제 설정
    ).run();

    return { success: true, id };
}
```

**사용**:
```typescript
// AI Agent가 호출하는 유일한 경로
import { createPageAI } from '@/lib/PageService';

const result = await createPageAI({
    slug: 'ai-generated-guide',
    title: 'AI 생성 가이드',
    sections: [...]
});
```

### 가드레일 2: 고스트 페이지 방지

**구현**:
```astro
---
// src/pages/[slug].astro
const { slug } = Astro.params;
const db = Astro.locals.runtime?.env?.DB;

// pages 테이블에서만 조회
const page = await db.prepare(
    "SELECT * FROM pages WHERE slug = ? AND is_published = 1"
).bind(slug).first();

// 없으면 404
if (!page) {
    return Astro.redirect('/404');
}
---
```

### 가드레일 3: Admin 자동 표시

**구현**:
```typescript
// pages 테이블 조회 시 created_by 포함
const pages = await db.prepare(
    "SELECT *, created_by FROM pages ORDER BY created_at DESC"
).all();

// UI에서 created_by 표시
<Badge variant={page.created_by === 'ai' ? 'purple' : 'gray'}>
    {page.created_by === 'ai' ? 'AI' : 'Admin'}
</Badge>
```

## Migration Strategy

### 데이터베이스 마이그레이션

```sql
-- migrations/add_pages_ai_support.sql

-- 1. AI 지원 컬럼 추가
ALTER TABLE pages ADD COLUMN created_by TEXT DEFAULT 'admin';
ALTER TABLE pages ADD COLUMN meta_title TEXT;
ALTER TABLE pages ADD COLUMN meta_description TEXT;
ALTER TABLE pages ADD COLUMN meta_keywords TEXT;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pages_created_by ON pages(created_by);

-- 3. 기존 데이터 마이그레이션
UPDATE pages SET created_by = 'admin' WHERE created_by IS NULL;
```

### 롤백 계획

- 마이그레이션 실패 시 이전 스키마로 복원
- 기능 플래그로 AI 가드레일 활성화/비활성화

## Success Metrics

### 정량적 지표

- **API 응답 시간**: P95 < 200ms
- **페이지 로드 시간**: P95 < 1s
- **AI 생성 페이지 등록률**: 100%
- **고스트 페이지**: 0개

### 정성적 지표

- **관리자 경험**: 직관적인 UI
- **AI 페이지 식별**: 명확한 표시
- **SEO**: 메타데이터 지원

## Dependencies

### 외부 의존성

- D1 데이터베이스 안정성
- Astro 동적 라우팅

### 내부 의존성

- Admin Auth 시스템
- 기존 `pages` 테이블

## Timeline

**총 예상 기간**: 4-5주

- Phase 1: 3일
- Phase 2: 1주
- Phase 3: 1주
- Phase 4: 1.5주
- Phase 5: 3일
- 테스트 및 버퍼: 3-5일

## Rollout Plan

1. **Alpha Release**: Phase 3 완료 후 기능 테스트
2. **Beta Release**: Phase 4 완료 후 Admin Panel 테스트
3. **GA Release**: Phase 5 완료 후 AI Agent 통합

## References

- Astro Dynamic Routing: https://docs.astro.build/en/guides/routing/
- D1 Database: https://developers.cloudflare.com/d1/
- React 19: https://react.dev/
