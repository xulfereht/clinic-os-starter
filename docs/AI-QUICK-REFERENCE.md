# AI Quick Reference Guide

> AI 어시스턴트가 Clinic-OS 프로젝트를 빠르게 파악하고 작업하기 위한 통합 레퍼런스

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 프레임워크 | Astro 5.x + TypeScript |
| 스타일링 | Tailwind CSS 4.x |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 배포 | Cloudflare Pages |
| 인증 | Session 기반 + API Key |

---

## 2. 핵심 디렉토리 구조

```
src/
├── pages/                    # 🔒 코어 페이지 (수정 자제)
│   ├── api/                  # API 엔드포인트
│   │   ├── admin/           # 관리자 API (인증 필요)
│   │   └── public/          # 공개 API
│   ├── admin/               # 관리자 페이지
│   └── [slug].astro         # 동적 페이지
├── components/
│   ├── layout/              # Header, Footer, Navigation
│   ├── sections/            # 페이지 섹션 컴포넌트
│   ├── ui/                  # 버튼, 카드 등 UI 요소
│   └── admin/               # 관리자 전용 컴포넌트
├── lib/
│   ├── clinic.ts            # 병원 설정 로드
│   ├── i18n.ts              # 다국어 지원
│   ├── admin-auth.ts        # 관리자 인증
│   ├── design-system/       # 테마 시스템
│   └── local/               # ✅ 클라이언트 전용
├── plugins/
│   ├── [plugin-name]/       # 플러그인
│   └── local/               # ✅ 클라이언트 전용 플러그인
└── survey-tools/
    └── local/               # ✅ 클라이언트 전용 검사도구
```

---

## 3. 주요 컴포넌트 위치

### 레이아웃
| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| Header | `src/components/layout/Header.astro` | 상단 네비게이션 |
| Footer | `src/components/layout/Footer.astro` | 하단 푸터 |
| BaseLayout | `src/layouts/BaseLayout.astro` | 기본 레이아웃 |
| AdminLayout | `src/layouts/AdminLayout.astro` | 관리자 레이아웃 |

### 홈페이지 섹션
| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| HeroSection | `src/components/sections/HeroSection.astro` | 메인 비주얼 |
| ProgramsSection | `src/components/sections/ProgramsSection.astro` | 프로그램 목록 |
| DoctorSection | `src/components/sections/DoctorSection.astro` | 의료진 소개 |
| HomeInfoSection | `src/components/sections/HomeInfoSection.astro` | 운영시간/연락처 |
| BusinessHours | `src/components/sections/BusinessHours.astro` | 운영시간 |

### UI 요소
| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| Button | `src/components/ui/Button.astro` | 버튼 |
| Card | `src/components/ui/Card.astro` | 카드 |
| Modal | `src/components/ui/Modal.astro` | 모달 |

---

## 4. 데이터베이스 스키마 요약

### 핵심 테이블

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `clinics` | 병원 정보 | name, phone, address, hours(JSON), theme_config(JSON) |
| `staff` | 의료진/직원 | name, type, department, bio, image, is_active |
| `programs` | 진료 프로그램 | title, description, pricing(JSON), is_visible |
| `posts` | 블로그/공지 | title, content, type, status, category |
| `pages` | 정적 페이지 | title, slug, sections(JSON), is_published |
| `patients` | 환자 정보 | name, phone, birth_date, memo |
| `reservations` | 예약 | patient_id, date, time, status |
| `site_settings` | 사이트 설정 | category, key, value |

### JSON 필드 구조

**clinics.hours:**
```json
{
  "weekdays": "09:00 - 18:00",
  "saturday": "09:00 - 13:00",
  "lunch": "12:30 - 14:00",
  "closed": "일요일, 공휴일",
  "freeform": false,
  "freeformText": ""
}
```

**clinics.theme_config:**
```json
{
  "skin": "clean",
  "brandHue": "blue",
  "rounding": "md",
  "englishName": "Clinic Name",
  "contact": { "addressEn": "..." }
}
```

**programs.pricing:**
```json
{
  "base": 100000,
  "currency": "KRW",
  "display": "100,000원~"
}
```

📖 **전체 스키마**: `SCHEMA.md`

---

## 5. 테마/스타일링

### CSS 변수 (design-system)

```css
/* 색상 */
--accent: 테마 포인트 색상
--bg-main: 메인 배경
--bg-soft: 부드러운 배경
--text-main: 주요 텍스트
--text-muted: 보조 텍스트
--border-subtle: 미묘한 테두리

/* 라운딩 */
--radius-sm: 4px
--radius-md: 8px
--radius-lg: 16px
```

### Tailwind 사용 패턴

```html
<!-- 테마 색상 사용 -->
<div class="bg-[color:var(--bg-soft)] text-[color:var(--text-main)]">

<!-- 버튼 스타일 -->
<button class="btn btn--primary">주요 버튼</button>
<button class="btn btn--secondary">보조 버튼</button>

<!-- 카드 스타일 -->
<div class="card card--soft card--radius-md p-6">카드 내용</div>
```

📖 **디자인 가이드**: `docs/DESIGN_SYSTEM_GUIDE.md`

---

## 6. 자주 하는 작업

### 병원 정보 변경
```bash
# API 사용 (권장)
curl -X PUT https://domain.com/api/admin/clinic-info \
  -H "X-Admin-API-Key: cos_xxx" \
  -d '{"phone": "02-1234-5678"}'
```

### 운영시간 변경
```bash
curl -X PUT https://domain.com/api/admin/hours \
  -H "X-Admin-API-Key: cos_xxx" \
  -d '{"weekdays": "09:00 - 19:00", "saturday": "09:00 - 14:00"}'
```

### 새 프로그램 추가
```bash
curl -X POST https://domain.com/api/admin/programs \
  -H "X-Admin-API-Key: cos_xxx" \
  -d '{"title": "새 프로그램", "description": "설명", "is_visible": true}'
```

### 게시글 발행
```bash
# 1. 게시글 생성
curl -X POST https://domain.com/api/admin/posts \
  -H "X-Admin-API-Key: cos_xxx" \
  -d '{"title": "제목", "content": "내용", "type": "blog", "status": "published"}'
```

### 직원 정보 수정
```bash
# 1. 직원 목록 조회
curl https://domain.com/api/admin/staff?type=doctor \
  -H "X-Admin-API-Key: cos_xxx"

# 2. 특정 직원 수정
curl -X PUT https://domain.com/api/admin/staff/[id] \
  -H "X-Admin-API-Key: cos_xxx" \
  -d '{"bio": "새로운 소개"}'
```

📖 **전체 API 문서**: `docs/API-REFERENCE.md`

---

## 7. 환경 설정

### wrangler.toml (클라이언트가 생성)
```toml
name = "clinic-name"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "clinic-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 환경변수 (.env)
```bash
# 필수
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx

# 선택 (기능별)
GOOGLE_CLIENT_ID=xxx          # Google 로그인
GOOGLE_CLIENT_SECRET=xxx
SOLAPI_API_KEY=xxx            # SMS 발송
SOLAPI_API_SECRET=xxx
R2_ACCESS_KEY_ID=xxx          # 이미지 업로드
R2_SECRET_ACCESS_KEY=xxx
```

---

## 8. 다국어 지원 (i18n)

### 지원 언어
- `ko` - 한국어 (기본)
- `en` - English
- `ja` - 日本語
- `zh` - 中文

### 번역 파일 위치
```
src/lib/i18n/
├── ko.json
├── en.json
├── ja.json
└── zh.json
```

### 사용법
```typescript
import { getUIText, extractLocaleFromPath } from '../lib/i18n';

const locale = extractLocaleFromPath(Astro.url.pathname);
const t = (key: string) => getUIText(key, locale);

// 사용
t('common.bookNow')  // "예약하기" or "Book Now"
```

---

## 9. 플러그인 시스템

### 플러그인 타입
| 타입 | 용도 |
|------|------|
| `new-route` | 새 URL 경로 추가 |
| `override` | 기존 페이지 덮어쓰기 |
| `component` | 컴포넌트 추가 |

### manifest.json 구조
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "type": "new-route",
  "route": "/my-page",
  "entry": "pages/my-page.astro"
}
```

📖 **플러그인 가이드**: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`

---

## 10. 문서 인덱스

### 필수 문서
| 문서 | 용도 |
|------|------|
| `GEMINI.md` | AI 시작점 |
| `docs/API-REFERENCE.md` | Admin API 전체 |
| `SCHEMA.md` | DB 스키마 |
| `docs/PLUGIN_DEVELOPMENT_GUIDE.md` | 플러그인 개발 |
| `docs/CUSTOMIZATION_GUIDE.md` | 홈페이지 커스터마이징 가이드 |

### 기능별 문서
| 문서 | 용도 |
|------|------|
| `docs/STAFF_MANAGEMENT.md` | 직원 관리 |
| `docs/PROGRAM_MANAGEMENT.md` | 프로그램 관리 |
| `docs/POST_MANAGEMENT.md` | 게시글 관리 |
| `docs/RESERVATION_MANAGEMENT.md` | 예약 관리 |
| `docs/PATIENT_MANAGEMENT.md` | 환자 관리 |
| `docs/CONTENT_MANAGEMENT_GUIDE.md` | 콘텐츠 관리 |

### 설정/운영
| 문서 | 용도 |
|------|------|
| `docs/CLINIC_INFO_SETUP.md` | 병원 정보 설정 |
| `docs/DESIGN_SYSTEM_GUIDE.md` | 디자인 커스터마이징 |
| `docs/LOCAL_GIT_ARCHITECTURE.md` | Git 아키텍처 |
| `DB_GUIDE.md` | 로컬/리모트 DB |

---

## 11. 작업 전 체크리스트

### 코드 수정 전
- [ ] `local/` 폴더에서 작업하는가? (코어 파일 보호)
- [ ] 기존 API가 있는지 확인했는가?
- [ ] 플러그인으로 해결 가능한가?

### DB 작업 전
- [ ] API를 통해 수정 가능한가? (직접 SQL 지양)
- [ ] 스키마 변경 시 마이그레이션 파일 작성했는가?
- [ ] custom_ 접두사를 사용했는가? (새 테이블)

### 배포 전
- [ ] `npm run dev`로 로컬 테스트했는가?
- [ ] TypeScript 에러 없는가?
- [ ] 환경변수 설정 완료했는가?

---

*Last Updated: 2026-02-03*
