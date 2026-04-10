# SPEC: Client Data Protection + Foreign Visitor Detection

> **id**: M-SAAS-20260409-CDP-FVD  
> **executor**: charlie(SAS)  
> **BU**: SAAS  
> **date**: 2026-04-09  
> **status**: DRAFT → [SPEC-REVIEW] → [CONFIRMED] → implement  
> **related**: 단일 미션으로 통합 관리

---

## Problem Statement

### P1: ForeignLocaleBanner 미작동 (Critical — 사용자 접근성)

외국인 방문자가 `?lang=en` 파라미터 없이 한국어 경로(`/`)로 접속하면 외국인 안내 배너가 표시되지 않음.

**근본 원인**: `src/components/local/ForeignLocaleBanner.astro:18-19`가 URL 경로 prefix만으로 locale 판단:

```typescript
const currentLocale = extractLocaleFromPath(Astro.url.pathname) as Locale;
const isForeignLocale = currentLocale !== 'ko';
```

`/` → `'ko'` → `isForeignLocale = false` → 배너 미표시.  
`/en/` → `'en'` → `isForeignLocale = true` → 배너 표시.

**누락된 감지 채널**:
1. `Accept-Language` 헤더 (브라우저 언어 설정)
2. `CF-IPCountry` 헤더 (Cloudflare 국가 감지)

v1.40.4 배포 후 재발 보고됨.

**SSR 확인**: `astro.config.mjs:128` — `output: 'server'`. 모든 페이지 SSR 모드. `src/pages/index.astro:11` — `export const prerender = false`. ForeignLocaleBanner가 포함된 BaseLayout은 SSR로 렌더링되므로 `Astro.request.headers` 접근 가능.

### P2: 클라이언트 커스텀 데이터 덮어쓰기 (Critical — 데이터 유실)

클라이언트가 `digestive/skin` 등 커스텀 프로그램을 만들었는데, core:pull/setup 시 `seeds/sample_clinic.sql`의 `INSERT OR REPLACE`가 기존 데이터를 덮어씀. 4월 1일~9일 사이 50시간 작업 날아갈 뻔한 사례 발생.

**근본 원인** (코드 경로 검증 완료):

1. **`seeds/sample_clinic.sql:75` — `INSERT OR REPLACE INTO programs`**: SQLite의 `REPLACE` = `DELETE + INSERT`. 기존 row를 삭제 후 재삽입하여 모든 커스텀 필드(sections, title, description 등) 손실. `clinics`(L6), `site_settings`(L22), `staff`(L45), `clinic_weekly_schedules`(L280)도 동일 패턴.

2. **`.docking/engine/fetch.js:1684` — `runAllSeeds()`**: `d1_seeds` 테이블(스키마: `id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT datetime('now')`)로 동일 seed 파일명 재실행은 방지. 단, **새 버전에 추가된 seed 파일**은 실행되며, 그 안의 `INSERT OR REPLACE`가 기존 커스텀 데이터를 덮어씀.

3. **`.docking/engine/fetch.js:1705-1708` — `SKIP_SEEDS`**: `sample_clinic.sql`이 목록에 없음. `setup-clinic.js:110`에서도 `findSeedFile('seeds/sample_clinic.sql')`로 직접 실행.

4. **`programs` 테이블에 이미 `is_sample INTEGER DEFAULT 0` 컬럼 존재**: `migrations/0000_initial_schema.sql:696` 확인. **`is_custom` 컬럼은 불필요** — 기존 `is_sample`을 활용.

### P3: 비파괴 작업 지침 부족 (High — 프로세스)

로컬 클라이언트가 작업 시 중간 커밋, DB 백업 등 안전장치가 가이드에 명시되지 않음.

### P4: dev vs production 반영 차이 (Medium — 진단)

`npm run dev`에서 정상 동작하는 것이 프로덕션 배포 시 반영되지 않는 사례.

**의심 원인**:
| 원인 | 설명 |
|------|------|
| SSR 전용 | `Astro.request.headers`는 SSR에서만 동작. 현재 `output: 'server'`로 전체 SSR이므로 문제없음. 단, 특정 페이지가 `prerender = true`면 headers 접근 불가 |
| CF-IPCountry | Cloudflare Workers에서만 제공. 로컬 dev에서는 미제공 → graceful fallback 필요 |
| CDN 캐시 | Cloudflare Pages 배포 후 CDN 캐시로 인해 즉시 반영 안 될 수 있음 |

---

## Solution Design

### S1: ForeignLocaleBanner 자동 감지

**접근**: Astro SSR component에서 `Astro.request.headers`를 활용해 Accept-Language와 CF-IPCountry를 확인.

**SSR 보장 확인 완료**:
- `astro.config.mjs:128` — `output: 'server'` (전체 SSR)
- `src/pages/index.astro:11` — `export const prerender = false`
- `src/pages/[locale]/index.astro:16` — `export const prerender = false`
- → ForeignLocaleBanner가 포함된 모든 페이지가 SSR 모드에서 렌더링됨. `Astro.request.headers` 접근 가능.

**Server-side 감지와 client-side localStorage 상호작용**:
- Server-side: `Astro.request.headers`로 초기 감지 → HTML 렌더링에 반영
- Client-side: dismiss 후 `localStorage.setItem('foreign_banner_dismissed', '1')` 저장 → 재방문 시 표시 안 함
- localStorage에 dismissed 기록이 있으면 server-side 감지 결과와 무관하게 배너 미표시

**변경 파일**: `src/components/local/ForeignLocaleBanner.astro` (local, core:pull 영향 없음)

```typescript
// 변경 전 (현재 버그)
const currentLocale = extractLocaleFromPath(Astro.url.pathname) as Locale;
const isForeignLocale = currentLocale !== 'ko';

// 변경 후
const currentLocale = extractLocaleFromPath(Astro.url.pathname) as Locale;
const acceptLanguage = Astro.request.headers.get('accept-language') || '';
const cfCountry = Astro.request.headers.get('cf-ipcountry') || '';

// URL에 locale이 있으면 URL 우선 (명시적 선택)
// URL에 locale이 없으면(=ko) Accept-Language/CF-IPCountry로 자동 감지
let detectedLocale: Locale | null = null;
let isForeignLocale = false;

if (currentLocale !== 'ko') {
  // URL에 명시적 locale → URL 우선
  isForeignLocale = true;
  detectedLocale = currentLocale;
} else {
  // URL이 한국어 경로 → 헤더로 자동 감지
  const headerLocale = detectLocaleFromHeaders(acceptLanguage, cfCountry);
  if (headerLocale && headerLocale !== 'ko') {
    isForeignLocale = true;
    detectedLocale = headerLocale;
  }
}
```

**헬퍼 함수** (`src/lib/i18n.ts`에 추가):

```typescript
export function detectLocaleFromHeaders(acceptLanguage: string, cfCountry: string): Locale | null {
  // 1. Accept-Language 파싱 (우선순위 높음)
  if (acceptLanguage) {
    const locale = parseAcceptLanguage(acceptLanguage);
    if (locale) return locale;
  }
  // 2. CF-IPCountry fallback
  if (cfCountry) {
    return countryToLocale(cfCountry);
  }
  return null;
}
```

**우선순위**:
1. URL 경로에 locale 포함 (`/en/`, `/ja/`) → URL 우선 (명시적 선택)
2. URL 경로가 `/` + Accept-Language/CF-IPCountry가 외국 → 배너 표시
3. URL 경로가 `/` + 한국어 헤더 → 배너 미표시

**배너 언어 결정**: `detectedLocale` 또는 Accept-Language의 최우선 언어에서 가장 가까운 지원 언어 선택.

### S2: 클라이언트 데이터 보호

**접근**: 기존 `is_sample` 컬럼 활용 + `INSERT OR IGNORE` 전환 + setup 감지.

#### 레이어 1: `sample_clinic.sql`을 `INSERT OR IGNORE` + 조건부 업데이트로 전환

**핵심 변경** (`seeds/sample_clinic.sql`):

```sql
-- 변경 전: 무조건 덮어쓰기 (커스텀 데이터 손실)
INSERT OR REPLACE INTO programs (id, title, ...) VALUES ('digestive', ...);

-- 변경 후: 기존 데이터 보존 + 샘플 데이터는 업데이트
-- is_sample = 0인(커스텀) 프로그램은 건드리지 않음
INSERT OR IGNORE INTO programs (id, title, ..., is_sample) VALUES ('digestive', ..., 1);
-- 이미 존재하는 is_sample = 1 프로그램만 업데이트
UPDATE programs SET title = '소화기질환', ... WHERE id = 'digestive' AND is_sample = 1;
```

**같은 원칙 적용**: `clinics`, `staff`, `site_settings`, `clinic_weekly_schedules` 모두 `INSERT OR IGNORE`로 전환.

**`site_settings` 특별 처리**: 클라이언트가 수정한 설정값은 보존. `sample_mode = 'true'` 설정만 `INSERT OR IGNORE`.

#### 레이어 2: `setup-clinic.js` 감지 로직 추가

`scripts/setup-clinic.js:569` (`setupClinic()` 함수)에 기존 데이터 감지 추가:

```javascript
// NEW: 기존 데이터 감지
const hasExistingData = await checkExistingData(dbName);
if (hasExistingData) {
  console.log('   ℹ️  기존 데이터 감지 — sample_clinic.sql 스킵');
  console.log('   ℹ️  커스터마이즈된 데이터가 보존됩니다.');
  // sample_clinic.sql 대신 마이그레이션만 실행
}
```

#### 레이어 3: `.docking/engine/fetch.js` `runAllSeeds()` 보호 강화

```javascript
// runAllSeeds() 내 SKIP_SEEDS 확장 (L1705-1708)
const SKIP_SEEDS = [
  'go_live.sql',
  'seed_digestive_content.sql',
  'screenshot_sample_data.sql',
  // NEW: 이미 데이터가 있는 클라이언트에서 sample_clinic 스킵
  // 단, 초기 설치 시에는 d1_seeds에 없으므로 실행됨
];
```

**`is_sample` 컬럼 활용** (기존 스키마에 이미 존재 — `migrations/0000_initial_schema.sql:696`):
- `is_sample = 0`: 클라이언트가 커스터마이즈한 데이터 → seed로 덮어쓰지 않음
- `is_sample = 1`: 샘플/초기 데이터 → seed 업데이트 허용
- `INSERT OR IGNORE`로 삽입 시 `is_sample = 1` 설정
- Admin API에서 프로그램 수정 시 `is_sample = 0`으로 전환 (별도 작업)

### S3: 비파괴 작업 지침 (CLAUDE.local.md 가이드 추가)

`CLAUDE.local.md` Section C에 다음 지침 추가:

```markdown
### 비파괴 작업 규칙 (CRITICAL)

1. **중간 커밋**: 의미 있는 변경 단위마다 커밋. 1시간 이상 커밋 없이 작업 금지.
2. **DB 백업**: `npm run db:backup`을 위험 작업 전 실행. 백업 없이 `db:migrate` 금지.
3. **core:pull 전 커밋**: `npm run core:pull` 전 반드시 `git commit`. 미커밋 변경분은 백업 후 커밋.
4. **샘플 데이터 주의**: `sample_clinic.sql`은 초기 설치 전용. 이미 커스터마이즈된 클라이언트에서는 절대 재실행하지 않음.
5. **dev → production 차이**: SSR 전용 코드(Astro.request.headers)는 로컬 dev에서 CF-IPCountry 미제공. graceful fallback 필수.
```

### S4: dev vs production 반영 차이 진단

| 항목 | 로컬 dev | 프로덕션(Cloudflare) |
|------|----------|---------------------|
| `Astro.request.headers` | O (SSR 모드) | O (SSR 모드) |
| `CF-IPCountry` | X (미제공) | O (Cloudflare 제공) |
| `Accept-Language` | O (브라우저 전송) | O (브라우저 전송) |
| CDN 캐시 | X | O (TTL에 따라 지연 가능) |

**해결책**: 로컬 dev에서 CF-IPCountry 미제공 시 graceful fallback — 배너 미표시(에러 없음). Accept-Language만으로 감지 동작.

---

## Acceptance Criteria

### AC-1: ForeignLocaleBanner 자동 감지

| ID | 검증 항목 | Type |
|----|----------|------|
| AC-1.1 | 한국어 경로(`/`)에서 `Accept-Language: en-US,en;q=0.9` 헤더로 접속 시 배너 표시 | manual |
| AC-1.2 | 한국어 경로(`/`)에서 `CF-IPCountry: US` 헤더로 접속 시 배너 표시 | manual |
| AC-1.3 | 한국어 경로(`/`)에서 `Accept-Language: ko-KR,ko;q=0.9,en;q=0.5` (한국어 우선) 접속 시 배너 미표시 | manual |
| AC-1.4 | 명시적 locale 경로(`/en/`) 접속 시 URL locale 우선 적용 | manual |
| AC-1.5 | 지원하지 않는 언어(`Accept-Language: fr`) 접속 시 영어 배너 fallback | manual |
| AC-1.6 | SSR 모드에서 `Astro.request.headers` 접근 정상 동작 (전체 페이지 `prerender = false` 확인 완료) | unit |
| AC-1.7 | 배너 dismiss 후 `localStorage` 저장 → 재방문 시 미표시 | manual |

### AC-2: 클라이언트 데이터 보호

| ID | 검증 항목 | Type |
|----|----------|------|
| AC-2.1 | `sample_clinic.sql`의 `INSERT OR IGNORE` + `UPDATE ... WHERE is_sample = 1` 패턴이 기존 커스텀 프로그램을 보존함 | unit |
| AC-2.2 | `runAllSeeds()` (.docking/engine/fetch.js:1684)가 이미 적용된 seed를 재실행하지 않음 (`d1_seeds` 트래킹) | unit |
| AC-2.3 | `is_sample = 0`인 program 레코드는 seed의 `UPDATE ... WHERE is_sample = 1`로 영향받지 않음 | unit |
| AC-2.4 | `setupClinic()` (scripts/setup-clinic.js:569) 실행 시 기존 데이터가 있으면 `sample_clinic.sql` 스킵 | unit |
| AC-2.5 | `digestive`, `skin` 외 커스텀 slug 프로그램이 seed로 영향받지 않음 | unit |
| AC-2.6 | `.docking/config.yaml.template`의 `protected_pages`에 커스텀 프로그램 페이지 등록 시 core:pull에서 보호됨 | unit |

### AC-3: 비파괴 작업 지침

| ID | 검증 항목 | Type |
|----|----------|------|
| AC-3.1 | `CLAUDE.local.md`에 비파괴 작업 규칙 섹션이 추가됨 | doc |
| AC-3.2 | `npm run db:backup` 스크립트 존재 및 정상 동작 | manual |

### AC-4: dev vs production 진단

| ID | 검증 항목 | Type |
|----|----------|------|
| AC-4.1 | ForeignLocaleBanner가 SSR 모드에서만 실행됨 (astro.config.mjs: `output: 'server'` 확인) | unit |
| AC-4.2 | 로컬 dev에서 CF-IPCountry 헤더 없을 시 graceful fallback (배너 미표시, 에러 없음) | manual |
| AC-4.3 | 프로덕션 배포 후 외국인 감지 배너 정상 작동 | manual |
| AC-4.4 | `src/pages/_local/` 디렉토리 미존재 시에도 core:pull 정상 동작 (protection-manifest.yaml 등록만으로 보호) | unit |

---

## Implementation Plan

### Phase 1: ForeignLocaleBanner 자동 감지 (S1)

1. `src/lib/i18n.ts` — `detectLocaleFromHeaders()`, `parseAcceptLanguage()`, `countryToLocale()` 함수 추가
2. `src/components/local/ForeignLocaleBanner.astro` — Accept-Language/CF-IPCountry 감지 + localStorage dismiss 로직 추가
3. SSR 렌더링 보장 확인 완료 (`output: 'server'`, `prerender = false`)

### Phase 2: 클라이언트 데이터 보호 (S2)

1. `seeds/sample_clinic.sql` — `INSERT OR REPLACE` → `INSERT OR IGNORE` + `UPDATE ... WHERE is_sample = 1` 패턴 전환
2. `.docking/engine/fetch.js:1705` — `SKIP_SEEDS`에 조건부 `sample_clinic.sql` 추가 (기존 데이터 감지 시)
3. `scripts/setup-clinic.js:569` — `setupClinic()`에 기존 데이터 감지 로직 추가
4. Admin API — 프로그램 수정 시 `is_sample = 0` 전환 (기존 `is_sample` 컬럼 활용, 새 migration 불필요)

### Phase 3: 비파괴 지침 + 진단 (S3+S4)

1. `CLAUDE.local.md` — 비파괴 작업 규칙 섹션 추가
2. dev vs production 차이 검증 및 문서화

### Phase 4: Release

1. `npm run release:verify` — 무결성 검증
2. core:push → 클라이언트 전파
3. 백록담 배포 검증

---

## No-Gos

- 기존 `sample_clinic.sql`의 샘플 데이터 **내용** 변경 없음 (보호 방식만 변경)
- ForeignLocaleBanner의 시각적 디자인 변경 없음 (감지 로직만 추가)
- `extractLocaleFromPath()` 함수의 기존 동작 변경 없음 (새 함수 추가만)
- `d1_seeds` 트래킹 메커니즘의 스키마 변경 없음 (필터링 로직만 강화)
- 새 migration 파일 추가 없음 — 기존 `is_sample` 컬럼 활용 (`migrations/0000_initial_schema.sql:696`에 이미 존재)
- `.docking/config.yaml` 변경 없음 — `.docking/config.yaml.template`만 존재 (실제 config는 클라이언트별 생성)

---

## Appetite

- Phase 1: 1 session (ForeignLocaleBanner)
- Phase 2: 1-2 sessions (데이터 보호)
- Phase 3: 0.5 session (지침 + 진단)
- Phase 4: 0.5 session (릴리스)
- **Total**: 3-4 sessions

---

## SOT Impact

| SOT File | Change Type | Risk | Note |
|----------|-------------|------|------|
| `src/lib/i18n.ts` | Add functions | Low | additive, core path |
| `src/components/local/ForeignLocaleBanner.astro` | Modify detection + dismiss | Medium | local path, SSR dependency |
| `seeds/sample_clinic.sql` | INSERT OR REPLACE → IGNORE + conditional UPDATE | Medium | seed data, 초기 설치 영향 |
| `.docking/engine/fetch.js` | Add data detection to runAllSeeds() | Medium | core:pull path, 클라이언트 전파 |
| `scripts/setup-clinic.js` | Add existing data detection | Medium | setup path |
| `CLAUDE.local.md` | Add guidelines section | None | documentation only |
| `.docking/protection-manifest.yaml` | No change | None | `src/pages/_local/` already listed |