# SPEC-CORE-001: core:pull 마이그레이션 시스템 고도화

---
id: SPEC-CORE-001
version: "1.0.0"
status: draft
created: "2025-01-30"
updated: "2025-01-30"
author: "Claude"
priority: HIGH
lifecycle: spec-anchored
related_specs:
  - SPEC-MIGRATION-001
  - SPEC-SEEDS-001
tags:
  - migration
  - d1-database
  - fetch-engine
  - reliability
---

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2025-01-30 | Claude | 초안 작성 |
| 1.1.0 | 2025-01-30 | Claude | Atomic Engine Update 요구사항 추가 |

---

## 1. 개요

### 1.1 배경

Clinic-OS의 `core:pull` 워크플로우는 `.docking/engine/fetch.js`와 `.docking/engine/migrate.js`를 통해 upstream 코어 업데이트를 클라이언트에 동기화합니다. 현재 시스템에서 다음과 같은 핵심 문제가 식별되었습니다:

**마이그레이션 시스템 이슈:**
- 의존성 없는 숫자 정렬 기반 마이그레이션 순서
- Bootstrap 레이스 컨디션 (d1_migrations 테이블 비어있을 때 검증 없이 적용)
- 롤백 메커니즘 부재
- SQLITE_BUSY 오류 자동 재시도 없음
- d1_migrations 테이블과 실제 스키마 상태 불일치 가능성

**엔진 Self-Update 이슈:**
- `.docking/engine/` 파일이 실행 중 덮어쓰기됨 (비원자적)
- 중간 실패 시 엔진 파일 손상 가능성
- 부분 업데이트로 인한 불일치 상태 발생 위험

### 1.2 목표

1. **신뢰성 향상**: 마이그레이션 실패 시 자동 롤백 및 재시도 메커니즘 도입
2. **검증 강화**: Pre-flight 스키마 상태 검증으로 불일치 방지
3. **의존성 관리**: 마이그레이션 간 의존성 그래프 지원
4. **운영 안정성**: SQLITE_BUSY 등 일시적 오류에 대한 Exponential Backoff 재시도
5. **엔진 안전성**: Atomic Engine Update로 Self-update 안전성 보장

### 1.3 비목표

- 기존 마이그레이션 파일 구조 변경 (하위 호환성 유지)
- 원격(remote) D1 마이그레이션 자동화 (local 환경 우선)
- 스키마 자동 생성 도구 개발

---

## 2. 요구사항 (EARS Format)

### 2.1 Ubiquitous Requirements (항상 활성)

| ID | 요구사항 | 근거 |
|----|----------|------|
| REQ-U01 | 시스템은 **항상** 마이그레이션 실행 전 d1_migrations 테이블 존재를 확인해야 한다 | Bootstrap 안정성 |
| REQ-U02 | 시스템은 **항상** 마이그레이션 결과를 d1_migrations 테이블에 기록해야 한다 | 추적성 |
| REQ-U03 | 시스템은 **항상** 마이그레이션 파일을 숫자 순서로 정렬 후 실행해야 한다 | 일관성 |

### 2.2 Event-Driven Requirements (이벤트 기반)

| ID | 요구사항 | 트리거 |
|----|----------|--------|
| REQ-E01 | **WHEN** SQLITE_BUSY 오류 발생 **THEN** Exponential Backoff로 최대 3회 재시도 | DB 락 충돌 |
| REQ-E02 | **WHEN** 마이그레이션 실패 **THEN** 실패 로그와 함께 중단하고 상태 리포트 출력 | 오류 발생 |
| REQ-E03 | **WHEN** d1_migrations 테이블이 비어있음 **THEN** 기존 스키마 해시 검증 후 Bootstrap 실행 | 최초 실행 |
| REQ-E04 | **WHEN** 스키마 해시 불일치 감지 **THEN** 사용자에게 경고 메시지 출력 및 수동 확인 요청 | 상태 불일치 |
| REQ-E05 | **WHEN** .docking/engine/ 파일 업데이트 필요 **THEN** Staging 디렉토리에 먼저 추출 후 Atomic Swap 수행 | 엔진 업데이트 |
| REQ-E06 | **WHEN** 엔진 Atomic Swap 실패 **THEN** 기존 엔진 파일 보존하고 오류 리포트 출력 | 엔진 롤백 |

### 2.3 State-Driven Requirements (조건 기반)

| ID | 요구사항 | 조건 |
|----|----------|------|
| REQ-S01 | **IF** 마이그레이션 파일에 `-- depends: 0001_xxx.sql` 주석 존재 **THEN** 의존성 순서 적용 | 의존성 선언 |
| REQ-S02 | **IF** dry-run 모드 활성화 **THEN** 실제 SQL 실행 없이 계획만 출력 | 검증 모드 |
| REQ-S03 | **IF** 마이그레이션 batch 내 하나라도 실패 **THEN** 해당 batch 전체 롤백 (트랜잭션 범위) | 원자성 보장 |

### 2.4 Unwanted Behavior Requirements (금지 사항)

| ID | 요구사항 | 리스크 |
|----|----------|--------|
| REQ-N01 | 시스템은 검증 없이 기존 마이그레이션을 "적용됨"으로 등록**하지 않아야 한다** | 데이터 무결성 |
| REQ-N02 | 시스템은 SQLITE_BUSY 오류를 단순 실패로 처리**하지 않아야 한다** | 운영 안정성 |
| REQ-N03 | 시스템은 마이그레이션 중 fetch.js 자체를 직접 덮어쓰기**하지 않아야 한다** (Atomic Swap 사용) | Self-update 안전 |
| REQ-N04 | 시스템은 엔진 파일을 부분적으로만 업데이트**하지 않아야 한다** (All-or-Nothing) | 엔진 무결성 |

---

## 3. 기술 제약사항

### 3.1 기술 스택 제약

| 항목 | 제약 | 근거 |
|------|------|------|
| Database | Cloudflare D1 (SQLite) | 프로젝트 표준 |
| CLI | Wrangler 4.x | D1 접근 도구 |
| Runtime | Bun 1.0+ / Node.js 18+ | 패키지 매니저 |
| 언어 | JavaScript (ES Modules) | 기존 fetch.js 호환 |

### 3.2 아키텍처 제약

```
.docking/engine/
├── fetch.js       # core:pull 메인 (수정 대상)
├── migrate.js     # 마이그레이션 유틸 (수정 대상)
└── schema-validator.js  # 신규: 스키마 검증 모듈
```

### 3.3 하위 호환성 요구사항

- 기존 `migrations/` 폴더 구조 유지
- 기존 `d1_migrations` 테이블 스키마 유지
- 기존 CLI 인터페이스 (`npm run core:pull`) 유지

---

## 4. 설계 방향

### 4.1 Pre-flight 스키마 검증

```
1. 마이그레이션 시작 전:
   - d1_migrations 테이블에서 적용된 목록 조회
   - 실제 테이블 목록 조회 (sqlite_master)
   - 스키마 해시 계산 및 비교

2. 불일치 감지 시:
   - 경고 메시지 출력
   - --force 플래그로 강제 진행 옵션 제공
```

### 4.2 재시도 메커니즘

```javascript
// Exponential Backoff 패턴
async function executeWithRetry(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (error.message.includes('SQLITE_BUSY') && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }
}
```

### 4.3 의존성 그래프

```sql
-- migrations/0100_create_users.sql
-- depends: 0000_initial_schema.sql

-- migrations/0101_add_user_email.sql
-- depends: 0100_create_users.sql
```

파서가 `-- depends:` 주석을 읽어 위상 정렬(Topological Sort) 적용

### 4.4 트랜잭션 배치

D1은 단일 쿼리 트랜잭션만 지원하므로:
- 각 마이그레이션 파일을 개별 트랜잭션으로 실행
- 실패 시 해당 파일의 변경만 롤백 (이전 파일은 유지)
- 배치 롤백은 `-- batch: migration-batch-001` 그룹 단위로 구현 (선택적)

### 4.5 Atomic Engine Update

현재 `.docking/engine/` 파일들은 `git restore`로 직접 덮어쓰기되어 중간 실패 시 손상 위험이 있습니다.

**Atomic Swap 패턴:**

```
1. Staging 단계:
   - .docking/.engine-staging/ 디렉토리 생성
   - upstream 태그에서 엔진 파일들을 staging에 추출
   - 모든 파일 추출 완료 확인

2. Validation 단계:
   - staging 내 필수 파일 존재 확인 (fetch.js, migrate.js 등)
   - 파일 크기 및 구문 검증 (optional: basic syntax check)

3. Atomic Swap 단계:
   - 기존 .docking/engine/ → .docking/.engine-backup/ 이동
   - .docking/.engine-staging/ → .docking/engine/ 이동
   - 성공 시 backup 삭제

4. Rollback 단계 (실패 시):
   - .docking/.engine-backup/ → .docking/engine/ 복원
   - staging 정리
   - 오류 리포트 출력
```

**구현 코드 예시:**

```javascript
async function atomicEngineUpdate(tag, engineFiles) {
    const stagingDir = path.join(PROJECT_ROOT, '.docking/.engine-staging');
    const backupDir = path.join(PROJECT_ROOT, '.docking/.engine-backup');
    const engineDir = path.join(PROJECT_ROOT, '.docking/engine');

    try {
        // 1. Staging: 새 엔진 파일 추출
        fs.ensureDirSync(stagingDir);
        for (const file of engineFiles) {
            const result = await runCommand(`git show ${tag}:"${file}"`, true);
            if (!result.success) throw new Error(`Failed to extract ${file}`);
            const targetPath = path.join(stagingDir, path.basename(file));
            fs.writeFileSync(targetPath, result.stdout);
        }

        // 2. Validation: 필수 파일 확인
        const requiredFiles = ['fetch.js', 'migrate.js'];
        for (const req of requiredFiles) {
            if (!fs.existsSync(path.join(stagingDir, req))) {
                throw new Error(`Required file missing: ${req}`);
            }
        }

        // 3. Atomic Swap
        if (fs.existsSync(backupDir)) fs.removeSync(backupDir);
        fs.moveSync(engineDir, backupDir);  // 기존 → backup
        fs.moveSync(stagingDir, engineDir); // staging → engine

        // 4. Cleanup
        fs.removeSync(backupDir);
        console.log('   ✅ 엔진 Atomic Update 완료');

    } catch (error) {
        // Rollback
        console.log(`   ⚠️ 엔진 업데이트 실패: ${error.message}`);
        if (fs.existsSync(backupDir) && !fs.existsSync(engineDir)) {
            fs.moveSync(backupDir, engineDir);
            console.log('   🔄 기존 엔진 복원 완료');
        }
        fs.removeSync(stagingDir);
        throw error;
    }
}
```

**디렉토리 구조:**

```
.docking/
├── engine/              # 실제 엔진 파일 (런타임)
│   ├── fetch.js
│   ├── migrate.js
│   └── schema-validator.js
├── .engine-staging/     # 임시: 새 버전 추출 (업데이트 중에만 존재)
├── .engine-backup/      # 임시: 롤백용 백업 (업데이트 중에만 존재)
├── config.yaml
└── logs/
```

---

## 5. 영향 범위

### 5.1 수정 대상 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `.docking/engine/fetch.js` | 수정 | 재시도 로직, Pre-flight 검증, Atomic Engine Update 추가 |
| `.docking/engine/migrate.js` | 수정 | 의존성 파서, 재시도 래퍼 추가 |
| `.docking/engine/schema-validator.js` | 신규 | 스키마 해시 검증 모듈 |
| `.docking/engine/engine-updater.js` | 신규 | Atomic Engine Update 모듈 |

### 5.2 의존 시스템

- D1 Local Database (Wrangler)
- Git upstream remote
- HQ API (버전 조회)

---

## 6. 성공 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|-----------|
| SQLITE_BUSY 복구율 | 0% (즉시 실패) | 90%+ | 재시도 후 성공 비율 |
| Bootstrap 정확도 | 미검증 | 100% 검증 | 스키마 해시 일치율 |
| 마이그레이션 추적 정확도 | 추정 95% | 100% | d1_migrations vs 실제 스키마 |
| 엔진 업데이트 성공률 | 추정 95% | 100% | Atomic Swap 성공 비율 |
| 엔진 손상 발생률 | 가끔 | 0% | 부분 업데이트 오류 카운트 |

---

## 7. 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 기존 클라이언트 호환성 깨짐 | 낮음 | 높음 | 하위 호환 테스트 철저히 |
| 재시도로 인한 지연 | 중간 | 낮음 | 최대 재시도 횟수 제한 (3회) |
| 의존성 순환 참조 | 낮음 | 중간 | 위상 정렬 시 순환 감지 경고 |
| Atomic Swap 중 디스크 부족 | 낮음 | 높음 | Pre-check로 디스크 공간 확인 |
| 엔진 롤백 실패 | 매우 낮음 | 치명적 | 백업 디렉토리 무결성 검증 |

---

## 8. 참조

- `.docking/engine/fetch.js` - 현재 코어 동기화 로직
- `.docking/engine/migrate.js` - 현재 마이그레이션 유틸
- `SPEC-MIGRATION-001` - brd-clinic 마이그레이션 (관련 컨텍스트)
- `SPEC-SEEDS-001` - Seeds 관리 시스템 (연관 SPEC)
