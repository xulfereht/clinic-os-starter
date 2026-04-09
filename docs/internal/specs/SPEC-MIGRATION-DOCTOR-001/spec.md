# SPEC-MIGRATION-DOCTOR-001: Schema Migration Doctor

## 1. Overview

### 1.1 Problem Statement

v1.1.1에서 v1.8.1로 대규모 버전 점프 시 `npm run core:pull`이 누락된 마이그레이션을 감지하거나 적용하지 못함.

**에러 증상:**
- `no such column: show_popup` (posts 테이블)
- `no such table: rate_limit_events`
- `no such column: failed_login_attempts` (staff/super_admins 테이블)
- `no such column: password_hash_format` (staff/super_admins 테이블)

### 1.2 Root Cause Analysis

1. **Archive 폴더 문제**: 핵심 마이그레이션 파일들이 `archive/migrations/`로 이동됨
   - `0100_password_security.sql` - rate_limit_events 테이블, 보안 컬럼들
   - `0903_add_notice_popup.sql` - show_popup 컬럼

2. **마이그레이션 추적 방식의 한계**: `d1_migrations` 테이블이 파일명만 추적
   - 실제 스키마 상태를 검증하지 않음
   - "기록됨 = 적용됨"으로 가정하지만, 실제 스키마가 존재하는지 확인하지 않음

3. **버전 점프 시나리오 미지원**:
   - 순차적 업데이트(v1.1 → v1.2 → ... → v1.8)만 고려
   - 대규모 점프(v1.1 → v1.8) 시 중간 마이그레이션 누락

### 1.3 Scope

- **In Scope**:
  - 스키마 상태 검증 도구 (Schema Doctor)
  - 누락 스키마 자동 복구
  - core:pull 프로세스 개선

- **Out of Scope**:
  - 리모트 DB 마이그레이션 (로컬 개발 환경만)
  - 데이터 마이그레이션 (스키마만)

---

## 2. Requirements (EARS Format)

### 2.1 Core Requirements

**REQ-001**: Schema Validation
- WHEN `npm run core:pull` 실행 시
- THE SYSTEM SHALL 현재 DB 스키마와 코드에서 필요한 스키마를 비교해야 한다
- SO THAT 누락된 컬럼/테이블을 감지할 수 있다

**REQ-002**: Auto-Recovery Migration
- WHEN 누락된 스키마가 감지되면
- THE SYSTEM SHALL 누락된 스키마를 자동으로 생성하는 SQL을 실행해야 한다
- SO THAT 애플리케이션이 정상 작동할 수 있다

**REQ-003**: Schema State Report
- WHEN 스키마 불일치가 감지되면
- THE SYSTEM SHALL 사용자에게 누락된 항목과 복구 방법을 명확히 표시해야 한다
- SO THAT 문제를 이해하고 조치할 수 있다

### 2.2 Optional Requirements

**REQ-004**: Standalone Doctor Command
- WHEN 사용자가 `npm run doctor` 실행 시
- THE SYSTEM SHALL 전체 스키마 상태 점검 및 복구를 수행해야 한다
- SO THAT core:pull 없이도 스키마 문제를 해결할 수 있다

**REQ-005**: Dry-Run Mode
- WHEN `npm run doctor --dry-run` 실행 시
- THE SYSTEM SHALL 실제 변경 없이 문제점만 리포트해야 한다
- SO THAT 변경 전 영향을 파악할 수 있다

---

## 3. Technical Approach

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    core:pull 프로세스                     │
├─────────────────────────────────────────────────────────┤
│  1. fetch upstream tags                                 │
│  2. apply file changes                                  │
│  3. run migrations (기존)                               │
│  4. [NEW] schema doctor check ← 여기에 추가              │
│  5. npm install reminder                                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Schema Doctor                          │
├─────────────────────────────────────────────────────────┤
│  1. Load required schema definition                      │
│  2. Query current DB schema (PRAGMA table_info)          │
│  3. Compare & detect missing                             │
│  4. Generate recovery SQL                                │
│  5. Execute or report                                    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Required Schema Definition

코드에서 필요한 스키마를 정의하는 새 파일 생성:

```javascript
// scripts/schema-requirements.js
export const REQUIRED_SCHEMA = {
  tables: {
    rate_limit_events: {
      columns: ['id', 'identifier', 'event_type', 'created_at'],
      indexes: ['idx_rate_limit_events_identifier', 'idx_rate_limit_events_created_at']
    }
  },
  columns: {
    posts: ['show_popup', 'popup_start_date', 'popup_end_date'],
    staff: ['password_hash_format', 'password_salt', 'failed_login_attempts', 'locked_until'],
    super_admins: ['password_hash_format', 'password_salt', 'failed_login_attempts', 'locked_until']
  }
};
```

### 3.3 Doctor Implementation

```javascript
// scripts/doctor.js
export async function runDbDoctor(options = {}) {
  const { fix = false, verbose = true } = options;

  // 1. 현재 스키마 조회
  const currentSchema = await getCurrentSchema();

  // 2. 필요 스키마와 비교
  const missing = detectMissingSchema(currentSchema, REQUIRED_SCHEMA);

  // 3. 복구 SQL 생성
  const recoverySQL = generateRecoverySQL(missing);

  // 4. 실행 또는 리포트
  if (fix && recoverySQL.length > 0) {
    await executeRecoverySQL(recoverySQL);
  }

  return { ok: missing.length === 0, missing, recoverySQL };
}
```

### 3.4 Recovery SQL Templates

누락된 스키마 유형별 SQL 템플릿:

```sql
-- 테이블 생성
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 컬럼 추가 (IF NOT EXISTS 불가능하므로 try-catch로 처리)
ALTER TABLE posts ADD COLUMN show_popup INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN password_hash_format TEXT DEFAULT 'legacy_sha256';
```

---

## 4. Implementation Plan

### Phase 1: Schema Requirements Definition
- [ ] `scripts/schema-requirements.js` 생성
- [ ] 모든 필수 테이블/컬럼 정의
- [ ] 버전별 스키마 요구사항 매핑

### Phase 2: Doctor Core Implementation
- [ ] `scripts/doctor.js` 생성
- [ ] `getCurrentSchema()` 구현 (PRAGMA 쿼리)
- [ ] `detectMissingSchema()` 구현
- [ ] `generateRecoverySQL()` 구현
- [ ] `executeRecoverySQL()` 구현

### Phase 3: Integration
- [ ] `fetch.js`의 `runDbDoctorCheck()` 연동
- [ ] `package.json`에 `npm run doctor` 스크립트 추가
- [ ] `--fix` 및 `--dry-run` 플래그 지원

### Phase 4: Testing
- [ ] v1.1.1 → v1.8.1 시나리오 테스트
- [ ] 누락 스키마 복구 검증
- [ ] 에러 핸들링 테스트

---

## 5. Acceptance Criteria

- [ ] `npm run core:pull` 후 `show_popup` 컬럼 에러 없음
- [ ] `npm run core:pull` 후 `rate_limit_events` 테이블 에러 없음
- [ ] `npm run core:pull` 후 `failed_login_attempts` 컬럼 에러 없음
- [ ] `npm run doctor` 단독 실행 가능
- [ ] `npm run doctor --dry-run`으로 미리보기 가능
- [ ] 복구 후 애플리케이션 정상 작동

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 복구 SQL 실행 실패 | High | 트랜잭션으로 묶어 롤백 가능하게 |
| 스키마 정의 누락 | Medium | 코드에서 사용하는 테이블/컬럼 자동 스캔 고려 |
| 기존 데이터 손실 | High | ALTER TABLE만 사용, DROP 금지 |

---

## 7. Files to Create/Modify

### New Files
- `scripts/schema-requirements.js` - 필수 스키마 정의
- `scripts/doctor.js` - Doctor 메인 로직

### Modified Files
- `.docking/engine/fetch.js` - Doctor 호출 강화
- `package.json` - `npm run doctor` 스크립트 추가

---

## 8. References

- `archive/migrations/0100_password_security.sql` - 누락된 보안 스키마
- `archive/migrations/0903_add_notice_popup.sql` - 누락된 팝업 스키마
- `.docking/engine/fetch.js` - 현재 마이그레이션 로직

---

**Status**: Implemented
**Created**: 2026-02-02
**Author**: MoAI
**Implemented**: 2026-02-02

---

## 9. Implementation Summary

### Modified Files
- `scripts/doctor.js` - 스키마 검증 기능 추가

### New Functions
- `parseCreateTables(sql)` - CREATE TABLE 문 파싱
- `parseAlterTables(sql)` - ALTER TABLE ADD COLUMN 파싱
- `buildRequiredSchema()` - migrations 폴더에서 필요 스키마 구축
- `runD1Query(dbName, command)` - D1 쿼리 실행 헬퍼
- `getCurrentTables(dbName)` - 현재 DB 테이블 목록 조회
- `getTableColumns(dbName, tableName)` - 테이블 컬럼 목록 조회
- `compareSchemas(dbName, required)` - 스키마 비교
- `generateRecoverySQL(missing)` - 복구 SQL 생성
- `executeRecoverySQL(dbName, statements)` - 복구 SQL 실행
- `runSchemaDoctor(dbName, options)` - 스키마 Doctor 메인 함수

### Usage
```bash
# 스키마 검증만 (dry-run)
npm run doctor

# 스키마 검증 + 자동 복구
npm run doctor -- --fix

# DB 검사만 (환경 검사 스킵)
npm run doctor -- --db-only

# 조용한 모드
npm run doctor -- --quiet --fix
```

### How It Works
1. `migrations/` 폴더의 모든 SQL 파일을 순서대로 파싱
2. CREATE TABLE, ALTER TABLE ADD COLUMN 문에서 필요 스키마 추출
3. 실제 로컬 DB에서 PRAGMA table_info로 현재 스키마 조회
4. 차이점(누락된 테이블/컬럼) 감지
5. `--fix` 플래그 시 복구 SQL 자동 실행
