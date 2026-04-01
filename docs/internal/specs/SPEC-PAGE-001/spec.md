---
id: SPEC-PAGE-001
version: 1.0.0
status: implemented
created: 2026-02-08
updated: 2026-02-08
author: moai
priority: P1
lifecycle_level: spec-first
---

# HISTORY

## 2026-02-08
- Initial SPEC creation
- AI guardrail requirement added based on user feedback
- Implementation completed via DDD cycle (ANALYZE-PRESERVE-IMPROVE)

# 동적 페이지 관리 시스템 (Dynamic Page Management System)

## Overview

본 SPEC은 Clinic OS 플랫폼을 위한 동적 페이지 관리 시스템을 구현합니다. 관리자가 Admin Panel을 통해 페이지를 생성, 수정, 삭제하고, AI가 생성한 페이지도 자동으로 관리 시스템에 등록되도록 강제하는 가드레일을 포함합니다.

### 주요 목표

- **중앙화된 페이지 관리**: Admin Panel에서 모든 페이지 통합 관리
- **AI 가드레일**: AI가 생성하는 페이지가 `pages` 테이블에 자동 등록되도록 강제
- **유연한 레이아웃**: 섹션 기반 동적 컨텐츠 구성
- **게시 제어**: 초안/게시 상태 관리 및 즉시 발행
- **SEO 최적화**: slug, 메타데이터 지원

### 배경

현재 시스템은 정적 페이지 파일로 관리되어 다음과 같은 문제가 있습니다:
- 페이지 생성/수정 시 코드 배포 필요
- AI가 생성한 페이지가 Admin Panel에서 관리되지 않음
- 비개발자가 페이지 콘텐츠를 수정하기 어려움
- 중앙화된 페이지 관리 부족

## Environment

### 시스템 환경

- **데이터베이스**: D1 (SQLite 호환)
- **프레임워크**: Astro 4+, React 19
- **API**: REST API (`/api/admin/pages/*`)
- **인증**: Admin Auth (기존 시스템 활용)

### 제약 사항

- **페이지 슬러그**: URL-safe, 중복 불가
- **섹션 데이터**: JSON 형식, 최대 크기 1MB
- **동적 경로**: `/[slug]` 형태의 페이지 라우팅
- **AI 강제**: AI 생성 페이지는 반드시 `pages` 테이블 등록

## Assumptions

### 기술 가정 (신뢰도: 높음)

- 기존 Admin Auth 시스템이 정상 동작함
- D1 데이터베이스가 `pages` 테이블을 이미 포함함
- Astro의 동적 라우팅이 활성화되어 있음

### 운영 가정 (신뢰도: 중간)

- 관리자는 Admin Panel에 익숙함
- AI는 주로 콘텐츠 페이지(가이드, 매뉴얼 등)를 생성함
- 대부분의 페이지 생성은 AI를 통해 이루어질 것임

### 아키텍처 가정 (신뢰도: 높음)

- 기존 `pages` 테이블 스키마를 확장하여 사용
- AI Agent는 API를 통해 페이지를 생성해야 함

## EARS Requirements

### Requirements (이벤트 기반)

#### REQ-PAGE-001: 페이지 목록 조회
**WHEN** 관리자가 Admin Panel의 페이지 관리 화면에 접근하면, 시스템은 등록된 모든 페이지 목록을 표시해야 한다.

#### REQ-PAGE-002: 페이지 상세 조회
**WHEN** 관리자가 특정 페이지를 선택하면, 시스템은 해당 페이지의 상세 정보를 표시해야 한다.

#### REQ-PAGE-003: 페이지 생성
**WHEN** 관리자가 새 페이지 생성을 요청하면, 시스템은 유효성 검사 후 `pages` 테이블에 페이지를 등록해야 한다.

#### REQ-PAGE-004: 페이지 수정
**WHEN** 관리자가 페이지 내용을 수정하고 저장하면, 시스템은 `updated_at`을 갱신하고 변경사항을 저장해야 한다.

#### REQ-PAGE-005: 페이지 삭제
**WHEN** 관리자가 페이지 삭제를 요청하면, 시스템은 페이지를 비활성화하거나 삭제해야 한다.

#### REQ-PAGE-006: 게시 상태 변경
**WHEN** 관리자가 게시/비게시 토글을 조작하면, 시스템은 `is_published` 상태를 즉시 변경해야 한다.

#### REQ-PAGE-007: 동적 페이지 라우팅
**WHEN** 사용자가 `/[slug]` 경로로 접근하면, 시스템은 `pages` 테이블에서 해당 슬러그의 페이지를 조회하고 렌더링해야 한다.

#### REQ-PAGE-008: 중복 슬러그 검사
**WHEN** 페이지 생성 또는 수정 시 슬러그가 제공되면, 시스템은 중복 슬러그를 검사하고 충돌 시 에러를 반환해야 한다.

### Behavior (상태 기반)

#### BEH-PAGE-001: 미게시 페이지 접근 제한
**IF** 페이지의 `is_published`가 `false`이면, 시스템은 일반 사용자의 접근을 차단하고 404를 반환해야 한다.

#### BEH-PAGE-002: 관리자 권한 검사
**IF** 사용자가 관리자 권한이 없으면, 시스템은 페이지 관리 API 접근을 거부해야 한다.

#### BEH-PAGE-003: 섹션 데이터 검증
**IF** 섹션 데이터 JSON 형식이 올바르지 않으면, 시스템은 저장을 거부해야 한다.

#### BEH-PAGE-004: 존재하지 않는 페이지
**IF** 요청된 슬러그의 페이지가 존재하지 않으면, 시스템은 404 페이지를 표시해야 한다.

### Data (시스템 데이터)

#### DAT-PAGE-001: 페이지 테이블 스키마
**THE 시스템 SHALL** `pages` 테이블에 다음 컬럼을 포함해야 한다: `id`, `slug`, `title`, `description`, `sections`, `is_published`, `created_at`, `updated_at`.

#### DAT-PAGE-002: 섹션 데이터 구조
**THE 시스템 SHALL** 섹션 데이터를 JSON 배열 형식으로 저장해야 한다.

#### DAT-PAGE-003: 페이지 메타데이터
**THE 시스템 SHALL** 각 페이지에 생성일, 수정일 정보를 유지해야 한다.

### Security (보안)

#### SEC-PAGE-001: XSS 방지
**THE 시스템 SHALL** 모든 사용자 입력을 sanitize하고 렌더링 시 XSS 공격을 방지해야 한다.

#### SEC-PAGE-002: SQL 인젝션 방지
**THE 시스템 SHALL** 모든 DB 쿼리에 파라미터 바인딩을 사용해야 한다.

#### SEC-PAGE-003: 슬러그 검증
**THE 시스템 SHALL** 슬러그가 URL-safe 문자만 포함하도록 검증해야 한다.

### AI Guardrails (AI 강제 사항)

#### AI-PAGE-001: AI 페이지 등록 강제
**IF** AI가 페이지를 생성하면, 시스템은 반드시 `pages` 테이블에 등록하도록 강제해야 한다.

#### AI-PAGE-002: API 경로 강제
**WHEN** AI가 페이지 생성을 시도하면, 시스템은 직접 파일 생성이 아닌 `/api/admin/pages/create` API 사용을 강제해야 한다.

#### AI-PAGE-003: Admin 표시 강제
**THE 시스템 SHALL** AI가 생성한 모든 페이지가 Admin Panel의 페이지 관리 목록에 자동 표시되도록 해야 한다.

#### AI-PAGE-004: 고스트 페이지 방지
**THE 시스템 SHALL NOT** `pages` 테이블에 등록되지 않은 페이지가 라우팅되는 것을 허용해서는 안 된다.

#### AI-PAGE-005: AI 페이지 표시
**THE 시스템 SHALL** AI가 생성한 페이지를 식별할 수 있는 표시자(예: created_by 컬럼 또는 태그)를 제공해야 한다.

## Specifications

### 사양 상세

#### SP-PAGE-001: 페이지 테이블 스키마 확장

```sql
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    sections TEXT DEFAULT '[]', -- JSON Array of section data
    is_published INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    created_by TEXT DEFAULT 'admin', -- 'admin', 'ai', 'user'
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_published ON pages(is_published);
CREATE INDEX idx_pages_created_by ON pages(created_by);
```

#### SP-PAGE-002: 섹션 데이터 구조

```typescript
interface PageSection {
    id: string;
    type: 'hero' | 'content' | 'features' | 'cta' | 'custom';
    order: number;
    content: Record<string, any>;
    styles?: Record<string, string>;
}

interface Page {
    id: string;
    slug: string;
    title: string;
    description?: string;
    sections: PageSection[];
    is_published: boolean;
    created_at: number;
    updated_at: number;
    created_by: 'admin' | 'ai' | 'user';
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
}
```

#### SP-PAGE-003: API 엔드포인트

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/admin/pages | 페이지 목록 조회 | Required |
| POST | /api/admin/pages/create | 페이지 생성 | Required |
| PUT | /api/admin/pages/[id] | 페이지 수정 | Required |
| DELETE | /api/admin/pages/[id] | 페이지 삭제 | Required |
| PATCH | /api/admin/pages/[id]/publish | 게시 상태 변경 | Required |
| GET | /api/pages/[slug] | 공개 페이지 조회 | None |

#### SP-PAGE-004: AI 페이지 생성 가드레일

```typescript
// AI Agent가 호출해야 하는 페이지 생성 함수
async function createPageAI(params: {
    slug: string;
    title: string;
    description?: string;
    sections: PageSection[];
    meta?: {
        title?: string;
        description?: string;
        keywords?: string;
    };
}): Promise<{ success: boolean; id?: string; error?: string }> {
    // 1. 슬러그 정제 및 검증
    const cleanedSlug = cleanupSlug(params.slug);

    // 2. 중복 검사
    const existing = await db.prepare(
        "SELECT id FROM pages WHERE slug = ?"
    ).bind(cleanedSlug).first();

    if (existing) {
        return { success: false, error: "Duplicate slug" };
    }

    // 3. 강제 등록
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
        INSERT INTO pages (
            id, slug, title, description, sections,
            is_published, created_at, updated_at, created_by,
            meta_title, meta_description, meta_keywords
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'ai', ?, ?, ?)
    `).bind(
        id,
        cleanedSlug,
        params.title,
        params.description || '',
        JSON.stringify(params.sections),
        now,
        now,
        params.meta?.title || '',
        params.meta?.description || '',
        params.meta?.keywords || ''
    ).run();

    return { success: true, id };
}

// 가드레일: 직접 파일 생성 방지
// AI Agent는 이 함수를 통해서만 페이지를 생성할 수 있음
```

#### SP-PAGE-005: 동적 라우팅

```astro
---
// src/pages/[slug].astro
export const prerender = false;

import type { APIContext } from 'astro';

const { slug } = Astro.params;
const db = Astro.locals.runtime?.env?.DB;

// 페이지 조회
const page = await db.prepare(
    "SELECT * FROM pages WHERE slug = ? AND is_published = 1"
).bind(slug).first();

if (!page) {
    return Astro.redirect('/404');
}

// 섹션 데이터 파싱
const sections = JSON.parse(page.sections);
---

<!DOCTYPE html>
<html>
    <head>
        <title>{page.meta_title || page.title}</title>
        <meta name="description" content={page.meta_description || page.description} />
        <meta name="keywords" content={page.meta_keywords || ''} />
    </head>
    <body>
        <!-- 동적 섹션 렌더링 -->
        {sections.map(section => (
            <SectionRenderer section={section} />
        ))}
    </body>
</html>
```

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         Admin Panel                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              페이지 관리 인터페이스                     │     │
│  │  - 페이지 목록 (DataTable)                             │     │
│  │  - 생성/편집 폼 (Section Builder)                      │     │
│  │  - 게시 상태 토글                                     │     │
│  │  - 미리보기                                           │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP API
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GET    /api/admin/pages          - 목록 조회                    │
│  POST   /api/admin/pages/create   - 페이지 생성                  │
│  PUT    /api/admin/pages/[id]     - 페이지 수정                  │
│  DELETE /api/admin/pages/[id]     - 페이지 삭제                  │
│  PATCH  /api/admin/pages/[id]/publish - 게시 상태 변경          │
│                                                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              PageService                                │     │
│  │  - 슬러그 생성 및 검증                                  │     │
│  │  - 중복 검사                                            │     │
│  │  - 섹션 데이터 검증                                     │     │
│  │  - AI 가드레일 강제                                     │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer (D1)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              pages 테이블                                │     │
│  │  id, slug, title, description, sections,               │     │
│  │  is_published, created_at, updated_at, created_by,     │     │
│  │  meta_title, meta_description, meta_keywords           │     │
│  └────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Public Routes                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GET /[slug] - 동적 페이지 라우팅                               │
│  - pages 테이블 조회                                            │
│  - is_published = 1만 렌더링                                    │
│  - 섹션 기반 렌더링                                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Integration                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  AI Agent                                                         │
│      │                                                            │
│      ├─► 직접 파일 생성 ✗ (차단됨)                               │
│      │                                                            │
│      └─► createPageAI() API ◀─┐ (강제 경로)                     │
│                                │                                 │
│                         ┌──────▼──────┐                         │
│                         │   가드레일   │                         │
│                         │  - 등록 강제 │                         │
│                         │  - 검증 강제 │                         │
│                         │  - Admin 표시 │                         │
│                         └──────┬──────┘                         │
│                                │                                 │
│                         ┌──────▼──────┐                         │
│                         │  pages 테이블 │                         │
│                         └─────────────┘                         │
└───────────────────────────────────────────────────────────────────┘
```

## Traceability

### 태그 매핑

| 요구사항 ID | 태그 | 관련 컴포넌트 |
|-------------|------|---------------|
| REQ-PAGE-001 | page:list | /api/admin/pages |
| REQ-PAGE-002 | page:detail | /api/admin/pages/[id] |
| REQ-PAGE-003 | page:create | /api/admin/pages/create |
| REQ-PAGE-004 | page:update | /api/admin/pages/[id] |
| REQ-PAGE-005 | page:delete | /api/admin/pages/[id] |
| REQ-PAGE-006 | page:publish | /api/admin/pages/[id]/publish |
| REQ-PAGE-007 | page:route | src/pages/[slug].astro |
| REQ-PAGE-008 | page:slug-validate | PageService |
| AI-PAGE-001 | ai:guard:register | createPageAI() |
| AI-PAGE-002 | ai:guard:api-route | API Layer |
| AI-PAGE-003 | ai:guard:admin-list | Admin Panel |
| AI-PAGE-004 | ai:guard:ghost-page | 라우팅 계층 |
| AI-PAGE-005 | ai:page:marker | created_by 컬럼 |

### 구현 매핑

- `src/pages/api/admin/pages/`: 페이지 관리 API
- `src/pages/[slug].astro`: 동적 페이지 라우팅
- `src/lib/PageService.ts`: 비즈니스 로직 및 가드레일
- `src/components/admin/PageManager.tsx`: Admin Panel UI
- `src/components/SectionRenderer.tsx`: 섹션 렌더러

### 통합 포인트

- Admin Auth: 기존 인증 시스템 활용
- D1 Database: `pages` 테이블
- AI Agent: `createPageAI()` 함수 통해 통합
