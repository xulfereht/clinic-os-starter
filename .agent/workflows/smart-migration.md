# Smart Migration (스마트 업데이트/마이그레이션)

> 코어/스타터킷 업데이트 시 기존 작업물을 자동 감지, 보존, 마이그레이션하는 지능형 업데이트 시스템

---

## 개요

**문제**: `core:pull` 또는 `update:starter` 실행 시
- ✅ 새 기능/버그픽스를 받아옴
- ⚠️ **기존 커스텀 작업물이 덮어씌워질 위험**

**Smart Migration 해결책**:
```
[업데이트 감지] → [사용자 작업물 스캔] → [보존 계획 생성] → 
[백업] → [업데이트] → [자동 마이그레이션] → [충돌 해결] → [검증]
```

**에이전트 역할**: 전 과정을 주도하고, 사용자는 검토/승인만

시작 전에 먼저 실행:

```bash
npm run agent:lifecycle -- --json
```

- `legacy_reinstall_migration`이면 인플레이스 업데이트보다 신규 설치 + snapshot 이관을 우선
- 신규 스타터킷을 다시 내려받아 원 폴더가 형제 디렉터리 백업으로 남아 있으면 `npm run agent:restore -- --dry-run --json` 으로 코드 local 수정본, data, public/local 이미지, 로컬 R2 상태까지 추출 가능한 복원 계획을 먼저 확인
- `safe_update_in_place`이면 snapshot 후 core/starter 업데이트 진행

---

## 6단계 마이그레이션 게이트

### Gate 1: Discovery (발견)

**에이전트가 자동 스캔:**

```javascript
const discovery = {
  // 1. 로컬 파일 스캔
  localFiles: scanDirectory('src/lib/local/'),
  localPlugins: scanDirectory('src/plugins/local/'),
  localPages: scanDirectory('src/pages/_local/'),
  
  // 2. DB 커스텀 스캔
  customTables: queryDB("SELECT name FROM sqlite_master WHERE name LIKE 'custom_%'"),
  customMigrations: scanDirectory('migrations/local/'),
  
  // 3. 설정 파일 스캔
  configChanges: compareConfig('wrangler.toml'),
  envChanges: compareConfig('.env'),
  
  // 4. 플러그인 상태
  installedPlugins: readJSON('.agent/plugin-state.json'),
  
  // 5. Git 상태 (있는 경우)
  uncommittedChanges: checkGitStatus(),
  customBranches: listGitBranches()
};
```

**발견 결과 분류:**

| 카테고리 | 예시 | 위험도 |
|----------|------|--------|
| 🟢 Safe Zone | `src/lib/local/utils.js` | 낮음 (자동 보존) |
| 🟡 Merge Required | `wrangler.toml` 수정 | 중간 (병합 필요) |
| 🔴 High Risk | `src/components/Button.tsx` 직접 수정 | 높음 (덮어쓰임 위험) |
| ⚠️  Unknown | 새로운 파일, 출처 불명 | 확인 필요 |

**사용자 보고:**
```
[에이전트] "업데이트 전 기존 작업물을 스캔했습니다."

┌─────────────────────────────────────────────┐
│  🔍 발견된 사용자 작업물                      │
├─────────────────────────────────────────────┤
│  🟢 안전하게 보존 (5개)                       │
│     - src/lib/local/helpers.ts              │
│     - src/plugins/local/vip-system/         │
│     - migrations/local/001_custom_table.sql │
│                                            │
│  🟡 병합 필요 (2개)                          │
│     - wrangler.toml [vars] 섹션 수정        │
│     - .env (새 환경변수 3개 추가)            │
│                                            │
│  🔴 위험! 직접 수정된 코어 파일 (1개)         │
│     - src/components/ui/Button.tsx          │
│       → _local/로 마이그레이션 권장          │
│                                            │
│  ⚠️  확인 필요 (1개)                          │
│     - src/pages/custom-page.astro (출처 불명)│
└─────────────────────────────────────────────┘
```

---

### Gate 2: Preservation Planning (보존 계획)

**에이전트가 마이그레이션 전략 생성:**

```javascript
const preservationPlan = {
  // 자동 보존 (Safe Zone)
  autoPreserve: [
    { from: 'src/lib/local/', to: 'src/lib/local/', action: 'keep' },
    { from: 'src/plugins/local/', to: 'src/plugins/local/', action: 'keep' },
  ],
  
  // 병합 필요
  mergeRequired: [
    {
      file: 'wrangler.toml',
      action: 'three-way-merge',
      localChanges: extractLocalChanges('wrangler.toml'),
      upstreamChanges: extractUpstreamChanges('wrangler.toml'),
      strategy: 'local-priority'  // 또는 'upstream-priority', 'manual'
    }
  ],
  
  // 코어 파일 커스텀 → _local 마이그레이션
  migrateToLocal: [
    {
      from: 'src/components/ui/Button.tsx',
      to: 'src/components/_local/ui/Button.tsx',
      action: 'move-and-patch-imports',
      note: '코어 파일 수정은 _local/로 이동해야 업데이트 후에도 유지됨'
    }
  ],
  
  // DB 마이그레이션
  dbMigrations: [
    {
      name: 'custom_patient_fields',
      action: 'preserve-and-verify',
      compatibility: 'check'  // 새 스키마와 충돌 여부 확인
    }
  ]
};
```

**사용자 확인:**
```
[에이전트] "보존 계획을 생성했습니다."

┌─────────────────────────────────────────────┐
│  📋 마이그레이션 계획                        │
├─────────────────────────────────────────────┤
│  1. 자동 보존 (5개 항목)                      │
│     → 업데이트 후 그대로 유지됩니다          │
│                                            │
│  2. 병합 필요 (2개 항목)                      │
│     → wrangler.toml: 로컬 설정 우선 적용      │
│     → .env: 새 변수 추가 + 기존 값 유지       │
│                                            │
│  3. 코어 파일 → _local 이동 (1개)            │
│     → Button.tsx를 안전한 위치로 이동        │
│     → import 경로 자동 수정                  │
│                                            │
│  [✅ 계획 승인 후 진행] [🔍 상세 보기]        │
│  [⚙️ 병합 전략 변경] [⏸️ 취소]               │
└─────────────────────────────────────────────┘
```

---

### Gate 3: Snapshot Backup (스냅샷 백업)

**업데이트 직전 완전한 스냅샷 생성:**

```bash
# 표준 보호 스냅샷
npm run agent:snapshot -- --reason=pre-update

# 1. Git 스냅샷 (있는 경우)
git stash push -m "pre-update-snapshot-$(date +%Y%m%d-%H%M%S)"
git tag "before-core-update-$(date +%Y%m%d)"

# 2. 파일 시스템 스냅샷
mkdir -p .backups/pre-update-$(date +%Y%m%d-%H%M%S)
cp -r src/lib/local .backups/pre-update-.../src-lib-local/
cp -r src/plugins/local .backups/pre-update-.../src-plugins-local/
cp wrangler.toml .backups/pre-update-.../
cp .env .backups/pre-update-.../

# 3. DB 스냅샷
npm run db:backup -- --label="pre-update-$(date +%Y%m%d)"

# 4. 마이그레이션 상태 저장
echo '{"phase": "backup", "timestamp": "...", "plan": {...}}' \
  > .agent/migration-state.json
```

**백업 확인:**
```
[에이전트] "✅ 스냅샷 백업 완료"

백업 위치:
- Git stash: pre-update-snapshot-20260305-143022
- Git tag: before-core-update-20260305
- 파일 백업: .backups/pre-update-20260305-143022/
- DB 백업: my-clinic-db-20260305-143022.sql

⚠️  업데이트 중 문제 발생 시 자동 롤백 가능합니다.
```

---

### Gate 4: Update Execution (업데이트 실행)

**에이전트가 순차적으로 진행:**

```
Step 1: 코어 파일 업데이트
  ↳ git fetch upstream
  ↳ git checkout v1.25.0
  ✅ 완료

Step 2: Safe Zone 복원
  ↳ src/lib/local/ 확인 → 그대로 유지
  ↳ src/plugins/local/ 확인 → 그대로 유지
  ✅ 완료

Step 3: 병합 실행
  ↳ wrangler.toml 병합 중...
    - [vars] 섹션: 로컬 값 유지
    - [d1_databases] 섹션: 업스트림 새 설정 적용
  ✅ 완료

Step 4: 코어 파일 마이그레이션
  ↳ Button.tsx → src/components/_local/ui/Button.tsx 이동
  ↳ import 경로 자동 수정
    - 수정: src/pages/index.astro
    - 수정: src/components/forms/ContactForm.tsx
  ✅ 완료

Step 5: 의존성 업데이트
  ↳ npm install (순차)
  ✅ 완료

Step 6: DB 마이그레이션
  ↳ 마이그레이션 실행
  ↳ 커스텀 테이블 호환성 확인
  ✅ 완료
```

**진행 상황 실시간 보고:**
```
[에이전트] "업데이트 진행 중... [4/6 단계]"

현재: 코어 파일 마이그레이션
  → Button.tsx 이동 및 import 수정 중...

남은 단계:
  - 의존성 업데이트
  - DB 마이그레이션
```

---

### Gate 5: Conflict Resolution (충돌 해결)

**충돌 발생 시 에이전트가 해결 전략 제시:**

```
[에이전트] "⚠️  병합 충돌이 발생했습니다."

┌─────────────────────────────────────────────┐
│  충돌: src/config.ts                         │
├─────────────────────────────────────────────┤
│  원인: 업스트림에서 새로운 설정 추가됨        │
│       로컬에서도 같은 파일 수정함             │
├─────────────────────────────────────────────┤
│  선택지:                                     │
│                                            │
│  1. 🟢 업스트림 우선 (권장)                  │
│     → 새 설정 적용 + 로컬 값은 .env로 이동   │
│                                            │
│  2. 🟡 로컬 우선                             │
│     → 기존 설정 유지 + 새 설정은 주석으로    │
│                                            │
│  3. 🔧 수동 병합                             │
│     → diff 표시 후 사용자가 직접 수정        │
│                                            │
│  4. 🗑️  새 파일로 분리                       │
│     → src/config.local.ts 생성              │
└─────────────────────────────────────────────┘
```

**자동 해결 가능한 충돌:**
```javascript
const autoResolvable = [
  'package.json dependencies',      // semver 기준 병합
  'wrangler.toml [vars]',           // 로컬 우선
  '.env.example',                   // 업스트림 우선
  'README.md',                      // 업스트림 우선
  'CHANGELOG.md',                   // prepend 방식
];
```

---

### Gate 6: Verification (검증)

**업데이트 후 자동 검증:**

```javascript
const verification = {
  // 1. 파일 존재 확인
  localFiles: checkFilesExist([
    'src/lib/local/',
    'src/plugins/local/',
    'src/components/_local/'
  ]),
  
  // 2. Import 경로 확인
  imports: verifyImports([
    'src/pages/index.astro',
    'src/components/forms/ContactForm.tsx'
  ]),
  
  // 3. 빌드 테스트
  build: runBuild(),
  
  // 4. DB 스키마 확인
  dbSchema: verifyDBSchema(),
  customTables: verifyCustomTables(),
  
  // 5. 핵심 기능 테스트
  smokeTests: [
    'npm run dev',           // 개발 서버 시작
    'curl http://localhost:4321',  // 홈페이지 응답
    'curl http://localhost:4321/admin',  // 관리자 페이지
  ]
};
```

**검증 결과:**
```
[에이전트] "✅ 검증 완료"

┌─────────────────────────────────────────────┐
│  마이그레이션 검증 결과                      │
├─────────────────────────────────────────────┤
│  ✅ 로컬 파일: 5/5 보존 완료                 │
│  ✅ 병합된 설정: 2/2 정상 적용               │
│  ✅ 마이그레이션된 파일: 1/1 정상 작동       │
│  ✅ DB: 커스텀 테이블 2개 호환 확인          │
│  ✅ 빌드: 성공                               │
│  ✅ 서버: 정상 시작                          │
├─────────────────────────────────────────────┤
│  확인 사항:                                  │
│  1. http://localhost:4321 접속 확인          │
│  2. 커스텀 기능 동작 확인                    │
│  3. 관리자 페이지 확인                       │
├─────────────────────────────────────────────┤
│  [✅ 정상 작동] [⚠️ 문제 있음]              │
└─────────────────────────────────────────────┘
```

**문제 발견 시 롤백 옵션:**
```
[에이전트] "❌ 검증 중 문제 발견"

문제:
- vip-system 플러그인 로딩 실패
- 오류: Module not found './utils'

[🔄 롤백 실행] [🔧 수동 수정] [📞 지원 요청]
```

---

## 롤백 전략

### 자동 롤백 트리거

```javascript
const autoRollbackTriggers = [
  'build_failed',
  'db_migration_failed',
  'custom_plugin_load_failed',
  'critical_file_missing',
  'import_resolution_failed'
];
```

### 수동 롤백

```bash
# 언제든지 롤백 가능
npm run migration:rollback -- --to=pre-update-20260305-143022

# 또는 Git으로 롤백
git reset --hard before-core-update-20260305
git stash pop  # 로컬 변경사항 복원
```

---

## 마이그레이션 타입별 전략

### Type A: Safe Zone (100% 자동)

```
src/lib/local/ → 그대로 유지
src/plugins/local/ → 그대로 유지
migrations/local/ → 그대로 유지
```

### Type B: Config Merge (전략 선택)

```
wrangler.toml → three-way merge
.env → append new, keep existing
package.json → semver merge
```

### Type C: Core File Migration (경고 + 자동)

```
src/components/Button.tsx → 
  src/components/_local/ui/Button.tsx
  
→ import 경로 자동 수정
→ 원본 파일은 새 버전으로 교체
```

### Type D: DB Schema Evolution (검증 필수)

```
1. 커스텀 테이블 백업
2. 새 마이그레이션 적용
3. 커스텀 테이블 호환성 확인
4. 문제 있으면 스키마 어댑터 실행
```

---

## 명령어 인터페이스

```bash
# 스마트 업데이트 (전체 자동)
npm run smart:update

# 단계별 진행
npm run smart:update -- --phase=discovery    # Gate 1
npm run smart:update -- --phase=plan         # Gate 2
npm run smart:update -- --phase=backup       # Gate 3
npm run smart:update -- --phase=execute      # Gate 4
npm run smart:update -- --phase=resolve      # Gate 5
npm run smart:update -- --phase=verify       # Gate 6

# 발견만 (변경사항 미리보기)
npm run smart:update -- --dry-run

# 롤백
npm run smart:rollback -- --to=<snapshot-id>
npm run smart:rollback -- --last  # 마지막 업데이트 직전으로

# 스냅샷 관리
npm run smart:snapshots -- --list
npm run smart:snapshots -- --clean  # 30일 이상 된 스냅샷 삭제
```

---

## 상태 파일

에이전트는 다음 파일로 마이그레이션 상태를 추적합니다:

```json
// .agent/migration-state.json
{
  "version": "1.0.0",
  "phase": "verification",  // discovery, planning, backup, execute, resolve, verify, completed, rolled_back
  "startedAt": "2026-03-05T14:30:00Z",
  "completedAt": null,
  
  "sourceVersion": "1.24.5",
  "targetVersion": "1.25.0",
  
  "discovery": {
    "localFiles": 5,
    "customTables": 2,
    "modifiedCoreFiles": 1,
    "mergeRequiredFiles": 2
  },
  
  "plan": {
    "autoPreserve": [...],
    "mergeRequired": [...],
    "migrateToLocal": [...]
  },
  
  "backup": {
    "gitStash": "pre-update-snapshot-20260305-143022",
    "gitTag": "before-core-update-20260305",
    "filesystem": ".backups/pre-update-20260305-143022",
    "db": "my-clinic-db-20260305-143022.sql"
  },
  
  "execution": {
    "completedSteps": ["fetch", "checkout", "preserve", "merge"],
    "currentStep": "verify",
    "failedSteps": []
  },
  
  "conflicts": [
    {
      "file": "src/config.ts",
      "type": "merge",
      "resolution": "upstream-priority",
      "resolvedAt": "2026-03-05T14:35:00Z"
    }
  ],
  
  "verification": {
    "build": "passed",
    "localFiles": "all_present",
    "imports": "all_resolved",
    "db": "compatible"
  }
}
```
