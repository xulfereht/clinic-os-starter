# SPEC-SEEDS-001: Seeds 라이프사이클 관리 시스템

---
id: SPEC-SEEDS-001
version: "1.0.0"
status: draft
created: "2025-01-30"
updated: "2025-01-30"
author: "Claude"
priority: MEDIUM
lifecycle: spec-anchored
related_specs:
  - SPEC-CORE-001
tags:
  - seeds
  - sample-data
  - d1-database
  - data-sync
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2025-01-30 | Claude | 초안 작성 |
| 1.1.0 | 2025-01-30 | Claude | Seeds Lockfile, Health Check, Retry, Reset 기능 추가 |

---

## 1. 개요

### 1.1 배경

Clinic-OS의 `seeds/` 폴더는 샘플 데이터, 시스템 초기값, 템플릿 등 27개 이상의 SQL 파일을 포함합니다. 현재 시스템에서 다음 문제가 식별되었습니다:

**Seeds 관리 이슈:**
- **Dual Tracking**: SQL 파일은 d1_seeds 테이블로 추적되지만, JSON 파일은 미추적
- **Idempotency 불일치**: 일부는 INSERT OR IGNORE, 일부는 단순 INSERT 사용
- **버전 불명확**: Seeds가 어떤 코어 버전에 해당하는지 명시 안 됨
- **중복 처리 불일치**: UNIQUE constraint 오류 처리 방식이 파일마다 다름
- **카테고리 미분류**: 시스템 필수 데이터 vs 샘플 데이터 구분 없음

**현재 Seeds 파일 분석 (27개):**

| 카테고리 | 파일 수 | 예시 |
|----------|---------|------|
| 시스템 필수 | ~5 | seed_templates.sql, terms_definitions.sql |
| 샘플 데이터 | ~15 | sample_patients.sql, dummy_posts.sql |
| 번역/로컬라이제이션 | ~5 | program_translations_*.sql |
| 플러그인 | ~2 | add_plugins_local.sql |

### 1.2 목표

1. **Seeds Manifest**: seeds.manifest.json으로 메타데이터 중앙 관리
2. **카테고리 분류**: 시스템 필수 / 샘플 / 번역 / 플러그인 구분
3. **Idempotency 표준화**: 모든 Seeds에 INSERT OR IGNORE 패턴 적용
4. **버전 추적**: 각 Seed의 최소 요구 코어 버전 명시
5. **선택적 적용**: 환경별 (dev/staging/prod) Seeds 분리
6. **Seeds Lockfile**: 적용된 Seeds 상태를 seeds.lock으로 추적
7. **Health Check**: Seeds 적용 후 데이터 무결성 검증
8. **Retry 메커니즘**: SQLITE_BUSY 오류 시 자동 재시도
9. **Seeds Reset**: 샘플 데이터 정리 및 초기화 기능

### 1.3 비목표

- 기존 Seeds SQL 파일 대량 리팩토링
- JSON 기반 Seed 포맷 전면 전환
- 원격 D1 Seeds 자동 배포 (위험)

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements (항상 활성)

| ID | 요구사항 | 근거 |
|----|----------|------|
| REQ-U01 | 시스템은 **항상** Seeds 실행 전 d1_seeds 테이블 존재를 확인해야 한다 | 추적 안정성 |
| REQ-U02 | 시스템은 **항상** Seeds 실행 결과를 d1_seeds 테이블에 기록해야 한다 | 중복 방지 |
| REQ-U03 | 시스템은 **항상** category=system인 Seeds를 먼저 실행해야 한다 | 의존성 보장 |

### 2.2 Event-Driven Requirements (이벤트 기반)

| ID | 요구사항 | 트리거 |
|----|----------|--------|
| REQ-E01 | **WHEN** UNIQUE constraint 오류 발생 **THEN** 해당 레코드 스킵하고 계속 진행 | 데이터 중복 |
| REQ-E02 | **WHEN** seeds.manifest.json 없음 **THEN** 기본 동작 (전체 SQL 실행) 유지 | 하위 호환 |
| REQ-E03 | **WHEN** core:pull 실행 **THEN** 새 Seeds 파일만 자동 적용 | 업데이트 |
| REQ-E04 | **WHEN** --seed-category=sample 옵션 **THEN** sample 카테고리만 실행 | 선택적 적용 |
| REQ-E05 | **WHEN** SQLITE_BUSY 오류 발생 **THEN** Exponential Backoff로 최대 3회 재시도 | DB 락 충돌 |
| REQ-E06 | **WHEN** Seeds 적용 완료 **THEN** Health Check 실행하여 필수 데이터 존재 확인 | 데이터 무결성 |
| REQ-E07 | **WHEN** --reset 옵션 **THEN** is_sample=true 데이터 삭제 후 Seeds 재적용 | 초기화 |
| REQ-E08 | **WHEN** Seed 파일 checksum 변경 감지 **THEN** 경고 출력 및 재적용 여부 확인 | 변경 추적 |

### 2.3 State-Driven Requirements (조건 기반)

| ID | 요구사항 | 조건 |
|----|----------|------|
| REQ-S01 | **IF** seeds.manifest.json 존재 **THEN** manifest 기반 실행 순서 적용 | 명시적 관리 |
| REQ-S02 | **IF** Seed 파일에 `-- min-version: v1.2.0` 주석 **THEN** 해당 버전 이상에서만 실행 | 버전 호환 |
| REQ-S03 | **IF** 환경이 production **THEN** category=sample Seeds 기본 스킵 | 운영 안전 |
| REQ-S04 | **IF** seeds.lock 파일 존재 **THEN** lockfile 기반 변경 감지 및 동기화 | 상태 추적 |
| REQ-S05 | **IF** Health Check 실패 **THEN** 경고 출력 및 문제 파일 목록 제공 | 검증 |

### 2.4 Unwanted Behavior Requirements (금지 사항)

| ID | 요구사항 | 리스크 |
|----|----------|--------|
| REQ-N01 | 시스템은 이미 적용된 Seed를 재실행**하지 않아야 한다** | 데이터 중복 |
| REQ-N02 | 시스템은 UNIQUE 오류를 치명적 실패로 처리**하지 않아야 한다** | Idempotency |
| REQ-N03 | 시스템은 production에서 sample Seeds를 자동 적용**하지 않아야 한다** | 데이터 오염 |
| REQ-N04 | 시스템은 SQLITE_BUSY 오류를 즉시 실패로 처리**하지 않아야 한다** | 운영 안정성 |
| REQ-N05 | 시스템은 production에서 --reset 옵션을 경고 없이 실행**하지 않아야 한다** | 데이터 보호 |

---

## 3. Seeds Manifest 설계

### 3.1 seeds.manifest.json 스키마

```json
{
  "$schema": "https://clinic-os.dev/schemas/seeds-manifest.json",
  "version": "1.0.0",
  "min_core_version": "v1.2.0",
  "categories": {
    "system": {
      "description": "시스템 필수 데이터 (모든 환경)",
      "auto_apply": true,
      "order": 1
    },
    "translation": {
      "description": "다국어 번역 데이터",
      "auto_apply": true,
      "order": 2
    },
    "sample": {
      "description": "개발/데모용 샘플 데이터",
      "auto_apply": false,
      "environments": ["development", "staging"],
      "order": 3
    },
    "plugin": {
      "description": "플러그인 초기 데이터",
      "auto_apply": false,
      "order": 4
    }
  },
  "seeds": [
    {
      "file": "seed_templates.sql",
      "category": "system",
      "description": "메시지 템플릿 초기값",
      "min_version": "v1.0.0",
      "idempotent": true
    },
    {
      "file": "terms_definitions.sql",
      "category": "system",
      "description": "이용약관 정의",
      "min_version": "v1.0.0",
      "idempotent": true
    },
    {
      "file": "sample_patients.sql",
      "category": "sample",
      "description": "샘플 환자 데이터 (50명)",
      "min_version": "v1.1.0",
      "idempotent": true,
      "depends_on": ["seed_templates.sql"]
    },
    {
      "file": "program_translations_complete.sql",
      "category": "translation",
      "description": "프로그램 다국어 번역",
      "min_version": "v1.2.0",
      "idempotent": true
    }
  ]
}
```

### 3.2 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | string | Y | SQL 파일명 |
| category | enum | Y | system, translation, sample, plugin |
| description | string | N | 설명 |
| min_version | semver | N | 최소 요구 코어 버전 |
| idempotent | boolean | N | 멱등성 보장 여부 (기본: true) |
| depends_on | string[] | N | 의존 Seed 파일 목록 |
| environments | string[] | N | 적용 환경 제한 |

---

## 4. 기술 제약사항

### 4.1 기술 스택 제약

| 항목 | 제약 | 근거 |
|------|------|------|
| Database | Cloudflare D1 (SQLite) | 프로젝트 표준 |
| 파일 형식 | SQL (기존 유지) + JSON (manifest) | 하위 호환 |
| 추적 테이블 | d1_seeds | 기존 스키마 활용 |

### 4.2 폴더 구조

```
seeds/
├── seeds.manifest.json      # 신규: 메타데이터
├── _README.md               # 신규: Seeds 가이드
│
├── # System (필수)
├── seed_templates.sql
├── terms_definitions.sql
├── terms_versions.sql
│
├── # Translation (번역)
├── program_translations_complete.sql
├── program_translations_sample.sql
├── program_translations_overlay.sql
│
├── # Sample (개발용)
├── sample_data.sql
├── sample_clinic.sql
├── sample_patients.sql
├── sample_faqs.sql
├── sample_notices.sql
├── sample_ops_data.sql
├── dummy_posts.sql
├── dummy_reviews.sql
│
├── # Plugin (플러그인)
├── add_plugins_local.sql
├── surveys.sql
├── self_diagnosis_templates.sql
│
└── # Other
    ├── knowledge_cards.sql
    ├── knowledge_seed.sql
    └── seed_system_manuals.sql
```

---

## 5. Idempotency 표준

### 5.1 SQL 패턴 가이드

**권장 패턴 (Idempotent):**

```sql
-- seeds/seed_templates.sql
-- category: system
-- min-version: v1.0.0
-- idempotent: true

INSERT OR IGNORE INTO message_templates (id, name, content, created_at)
VALUES
  ('tpl_001', '예약 확인', '{{patient_name}}님, 예약이 확인되었습니다.', datetime('now')),
  ('tpl_002', '예약 취소', '{{patient_name}}님, 예약이 취소되었습니다.', datetime('now'));
```

**비권장 패턴 (Non-idempotent):**

```sql
-- 중복 실행 시 오류 발생
INSERT INTO message_templates (id, name, content)
VALUES ('tpl_001', '예약 확인', '...');
```

### 5.2 UPSERT 패턴 (데이터 업데이트 필요 시)

```sql
INSERT INTO settings (key, value, updated_at)
VALUES ('app_version', '1.2.0', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
```

---

## 6. 영향 범위

### 6.1 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `.docking/engine/fetch.js` | 수정 | Manifest 기반 Seeds 실행, Retry, Health Check |
| `.docking/engine/seeds-manager.js` | 신규 | Seeds 관리 전용 모듈 |
| `seeds/seeds.manifest.json` | 신규 | Seeds 메타데이터 |
| `seeds/seeds.lock` | 신규 | Seeds 적용 상태 Lockfile |
| `seeds/_README.md` | 신규 | Seeds 작성 가이드 |
| 기존 seeds/*.sql | 검토 | Idempotency 주석 + is_sample 마킹 |

### 6.2 신규 CLI 옵션

```bash
# 전체 Seeds 실행 (기본)
npm run db:seed

# 카테고리별 실행
npm run db:seed -- --category=system
npm run db:seed -- --category=sample

# 특정 파일만 실행
npm run db:seed -- --file=sample_patients.sql

# Dry-run (실행 계획만 출력)
npm run db:seed -- --dry-run

# 환경 지정
npm run db:seed -- --env=production  # sample 스킵

# Health Check 실행
npm run db:seed -- --health-check

# 샘플 데이터 초기화 (개발 환경)
npm run db:seed -- --reset --category=sample

# Lockfile 동기화
npm run db:seed -- --sync-lock

# 변경된 Seeds만 재적용
npm run db:seed -- --changed-only
```

---

## 7. d1_seeds 테이블 확장

### 7.1 현재 스키마

```sql
CREATE TABLE d1_seeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
);
```

### 7.2 확장 스키마 (선택적)

```sql
-- 기존 테이블 유지, 새 컬럼 추가 (하위 호환)
ALTER TABLE d1_seeds ADD COLUMN category TEXT DEFAULT 'unknown';
ALTER TABLE d1_seeds ADD COLUMN core_version TEXT;
ALTER TABLE d1_seeds ADD COLUMN checksum TEXT;  -- 파일 해시
```

---

## 8. Seeds Lockfile 설계

### 8.1 seeds.lock 스키마

```json
{
  "version": "1.0.0",
  "generated_at": "2025-01-30T10:00:00Z",
  "core_version": "v1.6.2",
  "applied": [
    {
      "file": "seed_templates.sql",
      "category": "system",
      "checksum": "sha256:abc123...",
      "applied_at": "2025-01-30T10:00:01Z",
      "rows_affected": 15
    },
    {
      "file": "sample_patients.sql",
      "category": "sample",
      "checksum": "sha256:def456...",
      "applied_at": "2025-01-30T10:00:05Z",
      "rows_affected": 50
    }
  ],
  "health_check": {
    "last_run": "2025-01-30T10:00:10Z",
    "status": "passed",
    "checks": [
      { "table": "message_templates", "expected": 10, "actual": 10, "status": "pass" },
      { "table": "patients", "expected": 50, "actual": 50, "status": "pass" }
    ]
  }
}
```

### 8.2 Lockfile 활용

1. **변경 감지**: Seed 파일 checksum 비교로 변경 여부 파악
2. **동기화**: d1_seeds 테이블과 lockfile 간 상태 동기화
3. **리포팅**: 적용 이력 및 통계 제공
4. **롤백 참조**: 문제 발생 시 이전 상태 참조

---

## 9. Health Check 설계

### 9.1 필수 데이터 검증

```javascript
const HEALTH_CHECKS = [
    // System Seeds 검증
    { table: 'message_templates', minRows: 5, category: 'system' },
    { table: 'terms', minRows: 1, category: 'system' },
    { table: 'default_pages', minRows: 3, category: 'system' },

    // Translation Seeds 검증
    { table: 'program_translations', minRows: 10, category: 'translation' },

    // Sample Seeds 검증 (개발 환경만)
    { table: 'patients', minRows: 0, category: 'sample', envOnly: ['development'] },
];

async function runHealthCheck(dbName, isLocal = true) {
    const results = [];

    for (const check of HEALTH_CHECKS) {
        const count = await countRows(dbName, check.table, isLocal);
        const passed = count >= check.minRows;

        results.push({
            table: check.table,
            expected: check.minRows,
            actual: count,
            status: passed ? 'pass' : 'fail'
        });
    }

    return results;
}
```

### 9.2 Health Check 리포트

```
🏥 Seeds Health Check 결과:

   ✅ message_templates: 15 rows (최소 5)
   ✅ terms: 3 rows (최소 1)
   ✅ default_pages: 5 rows (최소 3)
   ✅ program_translations: 120 rows (최소 10)
   ⚠️  patients: 0 rows (최소 0, sample - 개발 환경만)

   상태: PASSED (4/4 필수 검증 통과)
```

---

## 10. Seeds Reset 설계

### 10.1 Reset 동작

```bash
# 샘플 데이터만 초기화 (안전)
npm run db:seed -- --reset --category=sample

# 전체 Seeds 재적용 (주의)
npm run db:seed -- --reset --all --force
```

### 10.2 Reset 구현

```javascript
async function resetSeeds(options = {}) {
    const { category = 'sample', all = false, force = false } = options;

    // Production 환경 보호
    if (process.env.ENVIRONMENT === 'production' && !force) {
        throw new Error('Production 환경에서 --reset은 --force 필수');
    }

    // is_sample=true 마킹된 데이터만 삭제 (안전)
    if (category === 'sample') {
        await runCommand(`DELETE FROM patients WHERE is_sample = 1`);
        await runCommand(`DELETE FROM posts WHERE is_sample = 1`);
        await runCommand(`DELETE FROM faqs WHERE is_sample = 1`);
        // ...
    }

    // d1_seeds에서 해당 카테고리 레코드 삭제
    await runCommand(`DELETE FROM d1_seeds WHERE category = '${category}'`);

    // Seeds 재적용
    await runSeedsByCategory(seedsDir, { category });
}
```

### 10.3 is_sample 마킹 표준

```sql
-- sample Seeds에서 데이터 삽입 시 is_sample=1 마킹
INSERT INTO patients (name, phone, is_sample, created_at)
VALUES
  ('샘플환자1', '010-0000-0001', 1, datetime('now')),
  ('샘플환자2', '010-0000-0002', 1, datetime('now'));
```

---

## 11. 성공 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|-----------|
| Seed 실행 실패율 | 추정 5% | < 1% | UNIQUE 오류 카운트 |
| 중복 데이터 발생 | 가끔 | 0 | 중복 레코드 검사 |
| 카테고리 분류율 | 0% | 100% | manifest 등록률 |
| Idempotency 적용률 | 추정 60% | 100% | INSERT OR IGNORE 사용률 |
| SQLITE_BUSY 복구율 | 0% | 90%+ | 재시도 후 성공 비율 |
| Health Check 통과율 | 미측정 | 100% | 필수 데이터 검증 통과 |
| Lockfile 동기화율 | 0% | 100% | d1_seeds vs seeds.lock 일치율 |

---

## 12. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| Manifest 파싱 오류 | 낮음 | 중간 | JSON Schema 검증 |
| 기존 Seeds 호환성 | 중간 | 중간 | manifest 없으면 기존 동작 |
| 카테고리 오분류 | 중간 | 낮음 | 리뷰 프로세스 |
| Production sample 적용 | 낮음 | 높음 | 환경 체크 필수화 |
| Reset으로 데이터 손실 | 낮음 | 높음 | --force 필수, Production 이중 확인 |
| Health Check 오탐 | 중간 | 낮음 | 검증 기준 점진적 조정 |
| Lockfile 손상 | 낮음 | 중간 | d1_seeds 테이블 기준 복구 |

---

## 13. 참조

- `seeds/` - 현재 Seeds 폴더 (27개 파일)
- `.docking/engine/fetch.js` - Seeds 실행 로직 (runAllSeeds 함수)
- `SPEC-CORE-001` - 마이그레이션 시스템 (연관 SPEC)
