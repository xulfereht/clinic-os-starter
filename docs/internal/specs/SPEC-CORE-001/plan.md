# SPEC-CORE-001: 구현 계획

---
spec_id: SPEC-CORE-001
version: "1.0.0"
created: "2025-01-30"
---

## 1. 마일스톤

### Primary Goal: Pre-flight 검증 시스템

**범위**: REQ-E03, REQ-E04, REQ-N01

**산출물**:
- `schema-validator.js` 모듈 신규 생성
- `fetch.js`에 Pre-flight 검증 호출 추가

**작업 항목**:
1. 스키마 해시 계산 함수 구현 (sqlite_master 조회)
2. d1_migrations 테이블 상태 조회 함수
3. Bootstrap 검증 로직 (비어있을 때 스키마 해시 비교)
4. 불일치 시 경고 메시지 및 `--force` 옵션 지원

**의존성**: 없음 (독립 구현 가능)

---

### Secondary Goal: 재시도 메커니즘

**범위**: REQ-E01, REQ-N02

**산출물**:
- `migrate.js`에 Exponential Backoff 래퍼 추가
- `fetch.js`의 마이그레이션 호출부 수정

**작업 항목**:
1. `executeWithRetry()` 함수 구현
2. SQLITE_BUSY 오류 패턴 감지
3. 재시도 횟수 및 지연 시간 설정 (기본: 3회, 200ms/400ms/800ms)
4. 재시도 로그 출력

**의존성**: Primary Goal 완료 권장 (선택적)

---

### Tertiary Goal: 의존성 그래프

**범위**: REQ-S01

**산출물**:
- 의존성 주석 파서
- 위상 정렬 기반 마이그레이션 순서 결정

**작업 항목**:
1. `-- depends: xxx.sql` 주석 파서 구현
2. 위상 정렬(Topological Sort) 알고리즘 적용
3. 순환 의존성 감지 및 경고
4. 기존 숫자 정렬과의 하이브리드 모드 (의존성 없으면 숫자 순서)

**의존성**: Primary Goal, Secondary Goal 완료 후

---

### Optional Goal: 트랜잭션 배치 롤백

**범위**: REQ-S03

**산출물**:
- 배치 그룹 지원 (`-- batch: xxx`)
- 배치 단위 롤백 메커니즘

**작업 항목**:
1. 배치 주석 파서 구현
2. 배치 내 실패 시 해당 배치 전체 스킵 로직
3. 배치 상태 리포팅

**의존성**: Tertiary Goal 완료 후 (고급 기능)

---

### Critical Goal: Atomic Engine Update

**범위**: REQ-E05, REQ-E06, REQ-N03, REQ-N04

**산출물**:
- `engine-updater.js` 모듈 신규 생성
- `fetch.js`에서 기존 `git restore` 방식 → Atomic Swap 방식으로 변경

**작업 항목**:
1. Staging 디렉토리 생성 및 파일 추출 함수 구현
2. 필수 파일 검증 로직 (fetch.js, migrate.js 존재 확인)
3. Atomic Swap 함수 구현 (backup → swap → cleanup)
4. 롤백 함수 구현 (실패 시 backup에서 복원)
5. 기존 `engineQueue` 처리 로직을 `atomicEngineUpdate()` 호출로 대체

**의존성**: Secondary Goal 완료 후 권장 (재시도 메커니즘 활용)

**코드 구조**:

```javascript
// .docking/engine/engine-updater.js
import fs from 'fs-extra';
import path from 'path';

const ENGINE_DIR = '.docking/engine';
const STAGING_DIR = '.docking/.engine-staging';
const BACKUP_DIR = '.docking/.engine-backup';

export async function atomicEngineUpdate(tag, engineFiles, runCommand) {
    const projectRoot = path.join(__dirname, '../..');
    const stagingPath = path.join(projectRoot, STAGING_DIR);
    const backupPath = path.join(projectRoot, BACKUP_DIR);
    const enginePath = path.join(projectRoot, ENGINE_DIR);

    try {
        // Phase 1: Extract to staging
        await extractToStaging(tag, engineFiles, stagingPath, runCommand);

        // Phase 2: Validate staging
        validateStaging(stagingPath);

        // Phase 3: Atomic swap
        await atomicSwap(enginePath, stagingPath, backupPath);

        // Phase 4: Cleanup
        fs.removeSync(backupPath);

        return { success: true };
    } catch (error) {
        // Rollback
        await rollbackEngine(enginePath, backupPath, stagingPath);
        return { success: false, error: error.message };
    }
}

async function extractToStaging(tag, files, stagingPath, runCommand) {
    fs.ensureDirSync(stagingPath);
    for (const file of files) {
        const result = await runCommand(`git show ${tag}:"${file}"`, true);
        if (!result.success) throw new Error(`Extract failed: ${file}`);
        fs.writeFileSync(path.join(stagingPath, path.basename(file)), result.stdout);
    }
}

function validateStaging(stagingPath) {
    const required = ['fetch.js', 'migrate.js'];
    for (const file of required) {
        if (!fs.existsSync(path.join(stagingPath, file))) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
}

async function atomicSwap(enginePath, stagingPath, backupPath) {
    if (fs.existsSync(backupPath)) fs.removeSync(backupPath);
    fs.moveSync(enginePath, backupPath);    // engine → backup
    fs.moveSync(stagingPath, enginePath);   // staging → engine
}

async function rollbackEngine(enginePath, backupPath, stagingPath) {
    if (fs.existsSync(backupPath) && !fs.existsSync(enginePath)) {
        fs.moveSync(backupPath, enginePath);
    }
    if (fs.existsSync(stagingPath)) fs.removeSync(stagingPath);
}
```

**fetch.js 수정 사항**:

```javascript
// 변경 전 (현재)
for (const { status: opStatus, path: filePath } of engineQueue) {
    if (opStatus === 'D') {
        // 삭제 처리
    } else {
        await runCommand(`git restore --source ${version} -- "${filePath}"`, true);
    }
}

// 변경 후 (Atomic Update)
import { atomicEngineUpdate } from './engine-updater.js';

if (engineQueue.length > 0) {
    const engineFiles = engineQueue.map(e => e.path);
    const result = await atomicEngineUpdate(version, engineFiles, runCommand);
    if (!result.success) {
        console.log(`   ⚠️ 엔진 업데이트 실패: ${result.error}`);
        console.log(`   🔄 기존 엔진 복원됨 - 수동 확인 필요`);
    } else {
        console.log(`   ✅ 엔진 Atomic Update 완료 (${engineFiles.length}개 파일)`);
    }
}
```

---

## 2. 기술 접근

### 2.1 스키마 해시 계산

```javascript
async function calculateSchemaHash(dbName, isLocal = true) {
    const localFlag = isLocal ? '--local' : '--remote';

    // 1. 테이블 목록 조회
    const tablesResult = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} ` +
        `--command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json`,
        PROJECT_ROOT, true
    );

    // 2. 각 테이블의 CREATE 문 조회
    const tables = parseJsonResult(tablesResult);
    const schemas = [];

    for (const table of tables) {
        const schemaResult = await runCommand(
            `npx wrangler d1 execute ${dbName} ${localFlag} ` +
            `--command "SELECT sql FROM sqlite_master WHERE name='${table.name}'" --json`,
            PROJECT_ROOT, true
        );
        schemas.push(parseJsonResult(schemaResult)[0]?.sql || '');
    }

    // 3. 해시 계산
    const crypto = await import('crypto');
    return crypto.createHash('sha256')
        .update(schemas.join('\n'))
        .digest('hex')
        .substring(0, 16);
}
```

### 2.2 재시도 래퍼

```javascript
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 200,
    retryableErrors: ['SQLITE_BUSY', 'database is locked']
};

async function executeWithRetry(fn, config = RETRY_CONFIG) {
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isRetryable = config.retryableErrors.some(
                pattern => error.message?.includes(pattern)
            );

            if (isRetryable && attempt < config.maxRetries) {
                const delay = Math.pow(2, attempt) * config.baseDelay;
                console.log(`   ⏳ SQLITE_BUSY - ${delay}ms 후 재시도 (${attempt}/${config.maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
}
```

### 2.3 의존성 파서

```javascript
function parseMigrationDependencies(migrationFiles, migrationsDir) {
    const graph = new Map(); // filename -> [dependencies]

    for (const file of migrationFiles) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const match = content.match(/^--\s*depends:\s*(.+)$/m);

        if (match) {
            const deps = match[1].split(',').map(d => d.trim());
            graph.set(file, deps);
        } else {
            graph.set(file, []);
        }
    }

    return topologicalSort(graph);
}

function topologicalSort(graph) {
    const visited = new Set();
    const result = [];
    const visiting = new Set(); // 순환 감지용

    function visit(node) {
        if (visiting.has(node)) {
            throw new Error(`Circular dependency detected: ${node}`);
        }
        if (visited.has(node)) return;

        visiting.add(node);
        for (const dep of graph.get(node) || []) {
            visit(dep);
        }
        visiting.delete(node);
        visited.add(node);
        result.push(node);
    }

    for (const node of graph.keys()) {
        visit(node);
    }

    return result;
}
```

---

## 3. 아키텍처 설계

### 3.1 모듈 구조

```
.docking/engine/
├── fetch.js                 # 메인 엔트리 (core:pull)
│   └── imports:
│       ├── migrate.js       # 마이그레이션 실행
│       ├── schema-validator.js  # 스키마 검증 (신규)
│       └── engine-updater.js    # 엔진 업데이트 (신규)
│
├── migrate.js               # 마이그레이션 유틸
│   └── exports:
│       ├── runMigrations()
│       ├── runPluginMigration()
│       └── executeWithRetry()  # 신규
│
├── schema-validator.js      # 스키마 검증 모듈 (신규)
│   └── exports:
│       ├── calculateSchemaHash()
│       ├── verifyMigrationState()
│       └── generateStateReport()
│
└── engine-updater.js        # 엔진 Atomic Update 모듈 (신규)
    └── exports:
        ├── atomicEngineUpdate()
        ├── validateStaging()
        └── rollbackEngine()
```

### 3.2 플로우 다이어그램

```
core:pull 시작
     │
     ▼
┌─────────────────────┐
│ Pre-flight 검증     │
│ (schema-validator)  │
└─────────────────────┘
     │
     ├─ 불일치 감지 ─► 경고 출력 ─► --force 없으면 중단
     │
     ▼
┌─────────────────────┐
│ 코어 파일 동기화    │
│ (git diff + restore)│
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ 마이그레이션 목록   │
│ 생성 (의존성 정렬)  │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ 각 마이그레이션     │◄─┐
│ 실행 (with retry)   │  │ 재시도
└─────────────────────┘  │
     │                   │
     ├─ SQLITE_BUSY ─────┘
     │
     ├─ 성공 ─► d1_migrations 기록
     │
     ├─ 실패 ─► 에러 로그 ─► 중단
     │
     ▼
┌─────────────────────┐
│ Atomic Engine       │
│ Update (마지막)     │
│ (engine-updater)    │
└─────────────────────┘
     │
     ├─ Staging 추출 ─► Validation ─► Atomic Swap
     │
     ├─ 실패 시 ─► 롤백 (backup 복원) ─► 경고 출력
     │
     ▼
완료 리포트 출력
```

---

## 4. 테스트 전략

### 4.1 단위 테스트

| 대상 | 테스트 케이스 |
|------|---------------|
| `calculateSchemaHash()` | 동일 스키마 → 동일 해시 |
| `executeWithRetry()` | SQLITE_BUSY 3회 후 성공 |
| `parseMigrationDependencies()` | 의존성 순서 정확성 |
| `topologicalSort()` | 순환 의존성 감지 |
| `atomicEngineUpdate()` | 정상 Swap 후 백업 삭제 확인 |
| `atomicEngineUpdate()` | 추출 실패 시 롤백 검증 |
| `validateStaging()` | 필수 파일 누락 시 오류 |
| `rollbackEngine()` | backup에서 engine 복원 검증 |

### 4.2 통합 테스트

```bash
# 1. 깨끗한 DB에서 전체 마이그레이션 실행
rm -rf .wrangler/state
npm run db:init

# 2. 부분 마이그레이션 상태에서 core:pull
# (d1_migrations에 일부만 등록된 상태)
npm run core:pull

# 3. SQLITE_BUSY 시뮬레이션
# (dev 서버 실행 중 마이그레이션)
npm run dev &
npm run core:pull
```

---

## 5. 배포 전략

### 5.1 점진적 롤아웃

1. **Alpha**: 개발 환경에서 전체 기능 테스트
2. **Beta**: 스타터킷 테스트 클라이언트에 배포
3. **GA**: clinic-os 메인 브랜치 머지 → 전체 클라이언트 자동 업데이트

### 5.2 롤백 계획

- `.docking/engine/` 파일들은 Git으로 버전 관리됨
- 문제 발생 시 이전 태그로 `git restore` 가능
- fetch.js는 엔진 큐 마지막에 처리되므로 부분 업데이트 위험 낮음

---

## 6. 리소스 추정

| 작업 | 복잡도 | 예상 노력 |
|------|--------|-----------|
| Pre-flight 검증 | 중 | 중간 |
| 재시도 메커니즘 | 저 | 낮음 |
| 의존성 그래프 | 중 | 중간 |
| Atomic Engine Update | 중 | 중간 |
| 트랜잭션 배치 | 고 | 높음 (선택적) |

---

## 7. 체크리스트

### 구현 전 확인사항

- [ ] 기존 fetch.js 로직 완전 이해
- [ ] d1_migrations 테이블 스키마 확인
- [ ] Wrangler D1 CLI 제약사항 파악

### 구현 후 확인사항

- [ ] 기존 core:pull 명령어 호환성 테스트
- [ ] 새 클라이언트 + 기존 클라이언트 모두 테스트
- [ ] SQLITE_BUSY 재현 테스트
- [ ] Atomic Engine Update 성공 테스트
- [ ] Atomic Engine Update 실패 → 롤백 테스트
- [ ] 중간 중단 시 상태 일관성 테스트
- [ ] 문서 업데이트 (README, ARCHITECTURE.md)
