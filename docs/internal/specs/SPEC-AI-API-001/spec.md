# SPEC-AI-API-001: AI-Safe API Layer & Documentation System

> **Version**: 2.1.0
> **Created**: 2026-02-03
> **Updated**: 2026-02-03
> **Status**: Completed
> **Author**: MoAI

---

## 1. Overview

### 1.1 Problem Statement

클라이언트 측 AI 어시스턴트가 데이터베이스 작업을 요청받을 때:

1. **보안 위험**: AI가 DB 스키마를 직접 건드리거나 새 테이블 생성 시도
2. **데이터 무결성**: 잘못된 SQL로 데이터 손상 가능성
3. **복잡성**: 107개 테이블, 복잡한 관계 - AI가 올바른 쿼리 생성 어려움
4. **API 부재**: 많은 도메인에서 CRUD API가 불완전함

### 1.2 Solution

**AI-Safe API Layer**: AI가 DB를 직접 조작하지 않고 **검증된 API를 통해서만** 데이터를 주입/조회하게 함

```
[AI 요청] → [API Endpoint] → [Validation] → [DB Operation]
                   ↓
           [문서화된 응답]
```

### 1.3 Goals

1. **Complete CRUD APIs**: 모든 주요 도메인에 대해 완전한 CRUD API 제공
2. **Safe Data Injection**: API를 통한 안전한 데이터 주입
3. **Read-Only Public APIs**: 퍼블릭 조회 전용 API
4. **Comprehensive Documentation**: AI가 이해할 수 있는 상세 문서

---

## 2. Current State Analysis

### 2.1 API Completeness Matrix

| Domain | CREATE | READ | UPDATE | DELETE | Gap |
|--------|--------|------|--------|--------|-----|
| Staff | ✅ | ⚠️ (status만) | ✅ | ✅ (soft) | READ list |
| Posts | ✅ | ❌ | ❌ | ❌ | **CRITICAL** |
| Pages | ✅ | ❌ | ✅ | ✅ | READ list |
| Programs | ❌ | ❌ | ⚠️ (visibility) | ❌ | **CRITICAL** |
| Clinic Info | ❌ | ❌ | ❌ | ❌ | **CRITICAL** |
| FAQ | ✅ | ❌ | ✅ | ❌ | READ, DELETE |
| Products | ✅ | ✅ | ✅ | ✅ | None |
| Settings | ✅ | ✅ | ✅ | ❌ | Fragmented |

### 2.2 Critical Gaps

1. **Posts**: Create만 있음, 수정/삭제/목록 불가
2. **Programs**: visibility 토글만, CRUD 전무
3. **Clinic Info**: 전용 API 없음 (theme-config workaround)
4. **Public APIs**: 조회 전용 API 부재

---

## 3. Requirements (EARS Format)

### 3.1 Phase 1: Critical Admin APIs

#### REQ-001: Clinic Info API
**When** AI가 병원 기본 정보 변경을 요청받으면,
**The system shall** 다음 API를 통해 안전하게 변경할 수 있어야 함:
- `GET /api/admin/clinic-info` - 현재 정보 조회
- `PUT /api/admin/clinic-info` - 정보 업데이트

**Fields**: name, englishName, phone, address, addressEn, mapUrl, description, businessLicenseNumber, representativeName, representativeNameEn, bankInfo

#### REQ-002: Posts CRUD API
**When** AI가 블로그/칼럼/공지 관리를 요청받으면,
**The system shall** 다음 API를 제공해야 함:
- `GET /api/admin/posts` - 목록 조회 (필터: type, status, category)
- `GET /api/admin/posts/[id]` - 단일 조회
- `PUT /api/admin/posts/[id]` - 수정
- `DELETE /api/admin/posts/[id]` - 삭제
- `PUT /api/admin/posts/[id]/publish` - 발행 토글

#### REQ-003: Programs CRUD API
**When** AI가 진료 프로그램 관리를 요청받으면,
**The system shall** 다음 API를 제공해야 함:
- `POST /api/admin/programs` - 생성
- `GET /api/admin/programs` - 목록 조회
- `GET /api/admin/programs/[id]` - 단일 조회
- `PUT /api/admin/programs/[id]` - 수정
- `DELETE /api/admin/programs/[id]` - 삭제

#### REQ-004: Staff List API
**When** AI가 직원 목록을 조회하려면,
**The system shall** 다음 API를 제공해야 함:
- `GET /api/admin/staff` - 목록 조회 (필터: type, isActive)
- `GET /api/admin/staff/[id]` - 단일 조회

### 3.2 Phase 2: Additional Admin APIs

#### REQ-005: Pages List API
- `GET /api/admin/pages` - 페이지 목록 조회
- `GET /api/admin/pages/[id]` - 페이지 상세 조회
- `PUT /api/admin/pages/[id]/publish` - 발행 토글

#### REQ-006: FAQ Complete API
- `GET /api/admin/faq` - FAQ 목록 조회
- `DELETE /api/admin/faq/[id]` - FAQ 삭제

#### REQ-007: Operating Hours API
- `GET /api/admin/hours` - 운영시간 조회
- `PUT /api/admin/hours` - 운영시간 수정 (freeform 지원)

### 3.3 Phase 3: Admin API Key 인증 추가

#### REQ-008: API Key Authentication for Admin APIs
**For** AI가 Admin API를 호출할 때,
**The system shall** API Key 인증을 세션 인증의 대안으로 제공해야 함:

**Authentication Options** (OR):
1. 세션 인증 (웹 UI에서 로그인)
2. API Key 인증 (AI/자동화용)
   - Header: `X-Admin-API-Key: {api_key}`
   - Key는 site_settings에 저장 (category='api', key='admin_api_key')

**Affected Endpoints** (기존 Admin API 전체):
- `/api/admin/clinic-info` - 병원 정보
- `/api/admin/staff/*` - 직원 관리
- `/api/admin/posts/*` - 포스트 관리
- `/api/admin/programs/*` - 프로그램 관리
- `/api/admin/pages/*` - 페이지 관리
- `/api/admin/hours` - 운영시간
- 기타 모든 `/api/admin/*`

**Implementation**:
- 공통 인증 헬퍼 함수 생성
- 기존 세션 체크 로직을 "세션 OR API Key" 로직으로 변경
- API Key는 Admin 설정 페이지에서 생성/재발급

**Security**:
- API Key는 슈퍼 관리자만 생성 가능
- 요청 로깅 (감사 추적)
- Rate limiting (분당 60회)

### 3.4 Phase 4: Documentation

#### REQ-009: API Documentation
**The system shall** AI가 참조할 수 있는 API 문서를 제공해야 함:
- 각 엔드포인트의 요청/응답 형식
- 필수/선택 필드 명시
- 예시 요청/응답
- 자연어 → API 매핑 가이드

---

## 4. Technical Design

### 4.1 New API Endpoints

#### `/api/admin/clinic-info.ts`
```typescript
// GET: 병원 정보 조회
// PUT: 병원 정보 수정
interface ClinicInfo {
  name: string;
  englishName?: string;
  phone: string;
  address: string;
  addressEn?: string;
  mapUrl?: string;
  description?: string;
  businessLicenseNumber?: string;
  representativeName?: string;
  representativeNameEn?: string;
  bankInfo?: string;
}
```

#### `/api/admin/posts/[id].ts` (New)
```typescript
// GET: 포스트 조회
// PUT: 포스트 수정
// DELETE: 포스트 삭제
interface PostUpdate {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: 'draft' | 'published';
  category?: string;
  featured_image?: string;
}
```

#### `/api/admin/posts/index.ts` (Extend)
```typescript
// GET: 포스트 목록 조회
// Query params: type, status, category, limit, offset
interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}
```

#### `/api/admin/programs/index.ts` (New)
```typescript
// POST: 프로그램 생성
// GET: 프로그램 목록 조회
interface ProgramCreate {
  title: string;
  slug: string;
  description?: string;
  price?: number;
  duration?: number;
  category?: string;
  image?: string;
  is_visible?: boolean;
}
```

#### `/api/admin/programs/[id].ts` (New)
```typescript
// GET: 프로그램 조회
// PUT: 프로그램 수정
// DELETE: 프로그램 삭제
```

#### `src/lib/admin-auth.ts` (New - 공통 인증 헬퍼)
```typescript
// 세션 OR API Key 인증 검증
export async function verifyAdminAuth(request: Request, db: D1Database): Promise<{
  authenticated: boolean;
  method: 'session' | 'api_key' | null;
  error?: string;
}> {
  // 1. API Key 체크
  const apiKey = request.headers.get('X-Admin-API-Key');
  if (apiKey) {
    const stored = await db.prepare(
      "SELECT value FROM site_settings WHERE category='api' AND key='admin_api_key'"
    ).first();
    if (stored?.value === apiKey) {
      return { authenticated: true, method: 'api_key' };
    }
    return { authenticated: false, method: null, error: 'Invalid API Key' };
  }

  // 2. 세션 체크 (기존 로직)
  // ... existing session validation
}
```

### 4.2 API Response Standard

모든 API는 일관된 응답 형식 사용:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "total": 10, "page": 1 }
}

// Error
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 4.3 File Structure

```
src/pages/api/
├── admin/
│   ├── clinic-info.ts          # NEW: 병원 정보 CRUD
│   ├── hours.ts                # NEW: 운영시간 CRUD
│   ├── posts/
│   │   ├── index.ts            # EXTEND: + GET list
│   │   └── [id].ts             # NEW: GET/PUT/DELETE
│   ├── programs/
│   │   ├── index.ts            # NEW: POST/GET list
│   │   └── [id].ts             # NEW: GET/PUT/DELETE
│   ├── pages/
│   │   └── index.ts            # NEW: GET list
│   ├── staff/
│   │   └── index.ts            # EXTEND: + GET list
│   └── faq/
│       └── [id].ts             # NEW: DELETE
└── public/                      # NEW: 공개 읽기 전용 API
    ├── clinic.ts
    ├── staff.ts
    ├── programs.ts
    ├── posts.ts
    └── hours.ts
```

---

## 5. Deliverables

### Phase 1: Critical Admin APIs
| Deliverable | File | Status |
|-------------|------|--------|
| Clinic Info API | `/api/admin/clinic-info.ts` | ✅ DONE |
| Posts GET/PUT/DELETE | `/api/admin/posts/[id].ts` | ✅ DONE |
| Posts List | `/api/admin/posts/index.ts` | ✅ DONE |
| Programs CRUD | `/api/admin/programs/*.ts` | ✅ DONE |

### Phase 2: Additional Admin APIs
| Deliverable | File | Status |
|-------------|------|--------|
| Pages List | `/api/admin/pages/index.ts` | ✅ DONE |
| Pages GET by ID | `/api/admin/pages/[id].ts` | ✅ DONE |
| Staff List | `/api/admin/staff/index.ts` | ✅ DONE |
| Staff GET by ID | `/api/admin/staff/[id].ts` | ✅ DONE |
| Hours API | `/api/admin/hours.ts` | ✅ DONE |

### Phase 3: API Key 인증 시스템
| Deliverable | File | Status |
|-------------|------|--------|
| 공통 인증 헬퍼 | `src/lib/admin-auth.ts` | ✅ DONE |
| 기존 Admin API 인증 로직 교체 | `/api/admin/*.ts` | ✅ DONE |
| API Key 생성/관리 API | `/api/admin/settings/api-key.ts` | ✅ DONE |

### Phase 4: Documentation
| Deliverable | File | Status |
|-------------|------|--------|
| API Reference | `docs/API-REFERENCE.md` | ✅ DONE |

---

## 6. Acceptance Criteria

### Phase 1
- [x] AC-001: `GET /api/admin/clinic-info` 병원 정보 반환
- [x] AC-002: `PUT /api/admin/clinic-info` 병원 정보 수정 동작
- [x] AC-003: `GET /api/admin/posts` 목록 조회 (필터 지원)
- [x] AC-004: `PUT /api/admin/posts/[id]` 포스트 수정 동작
- [x] AC-005: `DELETE /api/admin/posts/[id]` 포스트 삭제 동작
- [x] AC-006: Programs 전체 CRUD 동작

### Phase 2
- [x] AC-007: Pages 목록/단일 조회 동작
- [x] AC-008: Staff 목록/단일 조회 동작
- [x] AC-009: Hours API 동작

### Phase 3
- [x] AC-010: API Key로 모든 Admin API 호출 가능
- [x] AC-011: API Key 없으면 401 반환
- [ ] AC-012: API Key 생성/재발급 UI 동작 (Optional - Admin 설정 페이지)

### Phase 4
- [x] AC-013: 모든 API에 문서 존재 (`docs/API-REFERENCE.md`)
- [x] AC-014: 사용 예시 및 Best Practices 포함
- [ ] AC-015: CLAUDE.md가 새 문서 참조 (Optional)

---

## 7. Implementation Plan (Simplified)

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1 | API Key 인증 시스템 | 0.5 session |
| Phase 2 | 빠진 API 구현 (Posts CRUD, Programs CRUD, Clinic Info) | 1 session |
| Phase 3 | 기존 API 확장 (Staff/Pages GET list, Hours) | 0.5 session |
| Phase 4 | API 문서화 + AI 가이드 | 1 session |

**총 예상: 3 sessions**

### 기존 API 활용
대부분의 Admin API는 이미 구현되어 있음. 웹 UI에서 세션 인증으로 동작 중.
AI 사용을 위해 API Key 인증을 추가하고, 빠진 엔드포인트만 구현.

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API 중복/충돌 | 기존 API 확장 우선, 신규는 필요시만 |
| 보안 취약점 | Admin API는 인증 필수, Public은 읽기 전용 |
| Breaking Changes | 기존 응답 형식 유지, 확장만 |

---

## Appendix: Natural Language → API Mapping (Preview)

| 사용자 요청 | API Call |
|------------|----------|
| "병원 전화번호 바꿔줘" | `PUT /api/admin/clinic-info` |
| "김원장 프로필 수정해줘" | `PUT /api/admin/staff/[id]` |
| "블로그 글 발행해줘" | `PUT /api/admin/posts/[id]` with `status: 'published'` |
| "새 프로그램 추가해줘" | `POST /api/admin/programs` |
| "운영시간 변경해줘" | `PUT /api/admin/hours` |
| "FAQ 삭제해줘" | `DELETE /api/admin/faq/[id]` |
| "직원 목록 보여줘" | `GET /api/admin/staff` |
| "병원 정보 보여줘" | `GET /api/public/clinic` |
