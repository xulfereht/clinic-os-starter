# SPEC: clinic-os core:pull 심리스 업데이트 시스템

> **⚠️ Historical Spec** — 이 문서의 제안 중 상당수가 v1.24.2~v1.24.3에서 구현되었습니다.
> 최신 구현 상태: `docs/specs/2026-02-27-atomic-core-update.md`
> 추가 변경사항 (v1.24.3):
> - `--prefix core` 위임 패턴 → root 엔진 직접 실행으로 변경 (이중 엔진 문제 해결)
> - `findProjectRoot()`에 `core/package.json` 마커 추가
> - wrangler.toml 전제 조건 검증 추가 (migrate.js)
> - 마이그레이션 실패 시 seeds 자동 스킵
> - `.agent/last-error.json` 에러 보고 시스템 추가

## Background

현재 `npm run core:pull`은 다음 문제들이 있음:

1. **에이전트 통합 어려움** — 인터랙티브 프롬프트로 인해 자동화 불가
2. **대규모 버전 차이 시 문제** — 코어만 덮어쓰면 클라이언트 수정사항 손실
3. **설치 당시 상태 불일치** — 클라이언트별 스타터킷/코어 형태, DB 스키마가 제각각
4. **마이그레이션 에러** — 새 스키마 마이그레이션 시 충돌/에러 빈번

## Goals

1. **Zero-Interaction Mode** — 에이전트/CI 환경에서 완전 자동화
2. **Smart Migration** — 버전 차이가 클 때 클라이언트 수정사항 추출 → 새 버전에 적용
3. **Schema State Normalization** — 설치 당시 스키마 상태를 추적하여 마이그레이션 경로 자동 계산
4. **Conflict-Free Migration** — 마이그레이션 충돌 사전 감지 및 자동 해결

## Definition of Done

- [ ] `core:pull --auto` 또는 환경 변수로 완전 자동화
- [ ] 버전 차이 2개 이상 시 "incremental" vs "fresh" 전략 자동 선택
- [ ] 클라이언트 수정사항 자동 추출 (git diff 기반)
- [ ] 추출된 수정사항을 새 버전에 재적용 (patch 또는 manual merge)
- [ ] 설치 당시 스키마 버전 추적 (`.core/schema-version` 또는 마이그레이션 메타데이터)
- [ ] 스키마 상태 불일치 시 자동 복구 (doctor.js 연동)
- [ ] 롤백 메커니즘 — 실패 시 원래 상태로 복원

## Architecture

### 1. Update Strategy Selector

```javascript
async function selectUpdateStrategy(currentVersion, targetVersion) {
    const versionDiff = calculateVersionDiff(currentVersion, targetVersion);
    const clientModifications = await detectClientModifications();
    
    if (versionDiff.major >= 1 || versionDiff.migrations > 10) {
        // 대규모 업데이트: fresh install + client migration
        return {
            type: 'fresh-with-migration',
            backup: true,
            extractClientChanges: true,
            schemaReset: true
        };
    }
    
    // 소규모 업데이트: incremental
    return {
        type: 'incremental',
        backup: false,
        extractClientChanges: clientModifications.length > 0,
        schemaReset: false
    };
}
```

### 2. Client Changes Extractor

```javascript
async function extractClientChanges() {
    // 1. 현재 HEAD에서 클라이언트가 수정한 파일 목록
    const modifiedFiles = await gitDiffNameOnly('upstream/current', 'HEAD');
    
    // 2. 코어 파일만 필터링 (local/*, _local/* 제외)
    const coreModifications = modifiedFiles.filter(f => 
        isCorePath(f) && !isLocalPath(f)
    );
    
    // 3. 각 파일의 diff 추출 및 저장
    const changes = [];
    for (const file of coreModifications) {
        const diff = await gitDiff('upstream/current', 'HEAD', file);
        changes.push({
            file,
            diff,
            type: classifyChange(diff), // 'add', 'modify', 'delete'
            suggestedLocalPath: suggestLocalMigration(file)
        });
    }
    
    // 4. 마이그레이션 패키지 생성
    await saveClientChangesPackage(changes);
    return changes;
}
```

### 3. Schema State Tracker

```javascript
// .core/schema-state.json
{
    "installedAt": "2026-02-26T10:00:00Z",
    "initialSchema": "0000_initial_schema",
    "appliedMigrations": ["0001_...", "0002_..."],
    "customTables": ["client_custom_table"],
    "schemaHash": "sha256:abc123..."
}
```

### 4. Smart Migration Runner

```javascript
async function runSmartMigrations(strategy) {
    if (strategy.schemaReset) {
        // Fresh install 시나리오
        // 1. 현재 DB 백업
        await backupDatabase();
        
        // 2. 새 스키마로 초기화
        await resetToNewSchema();
        
        // 3. 데이터 마이그레이션 (새 스키마에 맞게 변환)
        await migrateDataToNewSchema();
    } else {
        // Incremental: 기존 마이그레이션 체인 실행
        await runIncrementalMigrations();
    }
}
```

## Files to Modify/Create

### 수정 대상

| 파일 | 변경 내용 |
|------|----------|
| `.docking/engine/fetch.js` | `--auto` 모드, 전략 선택, 변경사항 추출 |
| `.docking/engine/migrate.js` | 스마트 마이그레이션, 상태 추적 |
| `scripts/doctor.js` | 스키마 상태 검증 및 복구 강화 |

### 신규 생성

| 파일 | 목적 |
|------|------|
| `.docking/engine/update-strategy.js` | 업데이트 전략 선택 로직 |
| `.docking/engine/client-changes.js` | 클라이언트 변경사항 추출/적용 |
| `.docking/engine/schema-state.js` | 스키마 상태 관리 |
| `scripts/core-migrate-smooth.js` | 심리스 마이그레이션 CLI |

## Implementation Phases

### Phase 1: Zero-Interaction (즉시 필요)
- fetch.js에 `--auto` / `CI=true` 환경 변수 지원
- 모든 프롬프트 자동 처리 (기본값 사용 또는 스킵)

### Phase 2: Client Changes Extraction
- git diff 기반 변경사항 추출
- `.core/client-changes/`에 패키지 저장
- 자동 local/* 마이그레이션 제안

### Phase 3: Schema State Management
- 설치 시 스키마 상태 스냅샷 생성
- 마이그레이션 실행 시 상태 업데이트
- 버전 불일치 감지 및 복구

### Phase 4: Smart Migration
- 데이터 백업/복원 메커니즘
- 스키마 변경 시 데이터 마이그레이션
- 롤백 지원

## Tests

### Test 1: Auto Mode
```bash
export CI=true
npm run core:pull
# 사용자 입력 없이 완료되어야 함
```

### Test 2: Major Version Update
```bash
# 현재 v1.20.0 → v1.23.0 (대규모 차이)
npm run core:pull -- --auto
# 1. 기존 클라이언트 수정사항 추출 확인
# 2. 새 버전 설치 확인
# 3. 수정사항 재적용 확인
```

### Test 3: Schema Drift Recovery
```bash
# 스키마 상태 불일치 시뮬레이션
rm .core/schema-state.json
npm run core:pull -- --auto
# 자동 복구 및 재동기화 확인
```

## Risk Mitigation

- **Always Backup**: 모든 업데이트 전 DB 백업 필수
- **Dry-run Mode**: `--dry-run`으로 변경사항 미리 확인
- **Rollback**: 실패 시 자동 롤백 (Git + DB 백업)
- **Manual Override**: `--strategy=incremental` 또는 `--strategy=fresh`로 강제

## References

- `.docking/engine/fetch.js` (기존 로직)
- `scripts/doctor.js` (스키마 검증)
- `memory/ops/ccq-bypass-runbook.md`
