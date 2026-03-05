# SPEC: clinic-os Atomic Core Update (Blue-Green Deployment)

## Concept

기존 방식: "덮어쓰기" (위험)
- 문제 발생 시 복구 어려움
- 중간 상태에서 롤백 불가

새 방식: "원자적 교체" (안전)
```
[현재 워크트리 - Blue]
        ↓
   새 워크트리 생성 (Green)
        ↓
   새 버전 설치 + 마이그레이션
        ↓
   빌드 테스트 + 검증
        ↓
   ┌─────────┴─────────┐
   ↓                   ↓
통과              실패
   ↓                   ↓
스왑 실행          롤백
(Blue→Green)    (Green 삭제)
   ↓                   ↓
원본 보관        원본 유지
(backup/)        (무손실)
```

## Goals

1. **Zero-Downtime Update** — 검증 완료 전까지 현재 버전 유지
2. **Lossless Rollback** — 실패 시 원래 상태로 즉시 복원
3. **Pre-flight Validation** — 빌드/테스트 통과 전 교체 금지
4. **Backup Guarantee** — 성공/실패 관계없이 원본 보관

## Definition of Done

- [ ] Blue-Green 워크트리 구조 구현
- [ ] Pre-flight 검증 (빌드 + 테스트 + 마이그레이션 dry-run)
- [ ] 원자적 스왑 메커니즘
- [ ] 자동 롤백 (검증 실패 시)
- [ ] 수동 롤백 명령어 (core:rollback)
- [ ] 에이전트/CI 완전 자동화

## Architecture

### Directory Structure

```
~/clinic-os/                    # 프로젝트 루트
├── src/                        # 현재 소스 (Blue)
├── core/                       # 현재 코어 (Blue)
├── dist/                       # 현재 빌드 출력
├── .core/
│   ├── version                 # 현재 버전
│   ├── schema-state.json       # 스키마 상태
│   └── atomic-update/          # 원자적 업데이트 작업공간
│       ├── green-worktree/     # 새 버전 임시 설치
│       ├── backup/
│       │   └── pre-update-{timestamp}/  # 원본 백업
│       └── state.json          # 업데이트 상태 추적
```

### Update Flow

```javascript
async function atomicCoreUpdate(targetVersion) {
    const updateId = generateUpdateId();
    const worktreePath = `.core/atomic-update/green-worktree/${updateId}`;
    const backupPath = `.core/atomic-update/backup/pre-update-${timestamp}`;
    
    try {
        // Phase 1: 준비
        console.log('🔵 Phase 1: Preparation');
        await createWorktree(worktreePath, targetVersion);
        await backupCurrentState(backupPath);
        
        // Phase 2: 설치 (Green 워크트리에서)
        console.log('🟢 Phase 2: Installation (Green)');
        await installCoreInWorktree(worktreePath, targetVersion);
        await runMigrationsInWorktree(worktreePath, { dryRun: true }); // 검증만
        
        // Phase 3: 검증
        console.log('🧪 Phase 3: Validation');
        const buildResult = await buildInWorktree(worktreePath);
        const testResult = await testInWorktree(worktreePath);
        
        if (!buildResult.success || !testResult.success) {
            throw new ValidationError('Pre-flight validation failed');
        }
        
        // Phase 4: 원자적 스왑
        console.log('🔄 Phase 4: Atomic Swap');
        await atomicSwap({
            from: 'current',      // Blue
            to: worktreePath,     // Green
            backup: backupPath
        });
        
        // Phase 5: 마무리
        console.log('✅ Phase 5: Cleanup');
        await updateVersionMetadata(targetVersion);
        await cleanupWorktree(worktreePath);
        
        return { success: true, version: targetVersion };
        
    } catch (error) {
        // 롤백
        console.log('❌ Update failed, rolling back...');
        await rollbackToBackup(backupPath);
        await cleanupWorktree(worktreePath);
        return { success: false, error: error.message, backup: backupPath };
    }
}
```

### Atomic Swap Implementation

```javascript
async function atomicSwap({ from, to, backup }) {
    // Unix: mv 명령어는 원자적
    // Windows: rename 명령어는 원자적
    
    const tempOld = `${from}.old.${Date.now()}`;
    
    // 1. 현재 → 임시 이름
    await fs.rename(from, tempOld);
    
    // 2. 새 버전 → 원래 이름
    await fs.rename(to, from);
    
    // 3. 임시 이름 → 백업
    await fs.rename(tempOld, backup);
    
    // 실패 시 복구:
    // - rename은 파일시스템 레벨에서 원자적
    // - 중간에 실패핼도 fs.rename은 트랜잭션처럼 동작
}
```

## Implementation

### 1. Core Command

```bash
# 원자적 업데이트 실행
npm run core:update -- v1.23.0

# 또는 기존 core:pull에 통합
npm run core:pull -- --atomic

# 롤백
npm run core:rollback

# 상태 확인
npm run core:status
```

### 2. Worktree Management

```javascript
class AtomicUpdateManager {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.atomicDir = path.join(projectRoot, '.core', 'atomic-update');
    }
    
    async createWorktree(version) {
        const worktreePath = path.join(this.atomicDir, 'green', version);
        
        // Git worktree 생성
        await execAsync(`git worktree add -d ${worktreePath}`);
        
        // 새 버전 체크아웃
        await execAsync(`git checkout v${version}`, { cwd: worktreePath });
        
        return worktreePath;
    }
    
    async validate(worktreePath) {
        const results = {
            build: false,
            migrations: false,
            tests: false
        };
        
        // 빌드 테스트
        try {
            await execAsync('npm run build', { cwd: worktreePath });
            results.build = true;
        } catch (e) {
            console.error('Build failed:', e.message);
        }
        
        // 마이그레이션 dry-run
        try {
            await execAsync('npm run db:migrate -- --dry-run', { cwd: worktreePath });
            results.migrations = true;
        } catch (e) {
            console.error('Migration validation failed:', e.message);
        }
        
        // 단위 테스트
        try {
            await execAsync('npm test', { cwd: worktreePath });
            results.tests = true;
        } catch (e) {
            console.error('Tests failed:', e.message);
        }
        
        return results;
    }
    
    async swap(worktreePath) {
        const currentPath = this.root;
        const backupPath = path.join(this.atomicDir, 'backup', `pre-update-${Date.now()}`);
        
        // 원자적 스왑
        await this.atomicRename(currentPath, worktreePath, backupPath);
        
        return backupPath;
    }
    
    async rollback() {
        const backups = await fs.readdir(path.join(this.atomicDir, 'backup'));
        const latestBackup = backups.sort().pop();
        
        if (!latestBackup) {
            throw new Error('No backup found for rollback');
        }
        
        const backupPath = path.join(this.atomicDir, 'backup', latestBackup);
        
        // 현재 상태 백업 (롤백 실패 대비)
        const emergencyBackup = path.join(this.atomicDir, 'emergency', Date.now());
        await fs.copy(this.root, emergencyBackup);
        
        // 롤백 실행
        await fs.remove(this.root);
        await fs.copy(backupPath, this.root);
        
        return latestBackup;
    }
}
```

### 3. State Tracking

```json
// .core/atomic-update/state.json
{
    "updates": [
        {
            "id": "upd-20260227-001",
            "timestamp": "2026-02-27T10:00:00Z",
            "fromVersion": "v1.20.0",
            "toVersion": "v1.23.0",
            "status": "completed",
            "backupPath": ".core/atomic-update/backup/pre-update-20260227-100000",
            "validationResults": {
                "build": true,
                "migrations": true,
                "tests": true
            }
        }
    ],
    "current": {
        "version": "v1.23.0",
        "updateId": "upd-20260227-001"
    }
}
```

## Files to Create/Modify

### 신규 파일

| 파일 | 설명 |
|------|------|
| `.docking/engine/atomic-update.js` | 원자적 업데이트 핵심 로직 |
| `.docking/engine/worktree-manager.js` | Git worktree 관리 |
| `scripts/core-atomic-update.js` | CLI 진입점 |
| `scripts/core-rollback.js` | 롤백 CLI |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `package.json` | 새 스크립트 추가: `core:update`, `core:rollback` |
| `.docking/engine/fetch.js` | `--atomic` 플래그 지원 |

## CLI Interface

```bash
# 원자적 업데이트 (권장)
npm run core:update [version]

# 옵션
npm run core:update v1.23.0 -- --validate-only  # 검증만, 스왑 안함
npm run core:update v1.23.0 -- --no-backup      # 백업 생략 (빠른 테스트용)
npm run core:update v1.23.0 -- --auto           # 자동 모드 (CI용)

# 롤백
npm run core:rollback              # 마지막 백업으로 롤백
npm run core:rollback -- --list    # 사용 가능한 백업 목록
npm run core:rollback -- v1.20.0   # 특정 버전으로 롤백

# 상태 확인
npm run core:status                # 현재 버전, 업데이트 히스토리
```

## Safety Guarantees

1. **Double Backup** — 업데이트 전 백업 + 롤백 시 emergency 백업
2. **Validation Gates** — 빌드/테스트/마이그레이션 모두 통과해야 스왑
3. **Atomic Swap** — 파일시스템 rename으로 원자적 교체
4. **State Persistence** — 업데이트 상태를 파일로 추적, 중단 시 복구 가능
5. **Dry-run Mode** — 실제 변경 없이 전체 프로세스 시뮬레이션

## Test Scenarios

### 1. Happy Path
```bash
npm run core:update v1.23.0 -- --auto
# 결과: 성공, 백업 생성, 원래 위치에 새 버전
```

### 2. Validation Failure
```bash
# 테스트: 의도적으로 깨진 버전으로 업데이트
npm run core:update v999.0.0 -- --auto
# 결과: 실패, 원본 유지, 롤백 메시지
```

### 3. Rollback
```bash
npm run core:rollback
# 결과: 마지막 백업으로 복원
```

### 4. CI Mode
```bash
export CI=true
npm run core:update
# 결과: 완전 자동화, 사용자 입력 없음
```

## Migration from Current System

1. 기존 `core:pull`은 deprecated (경고 메시지)
2. `core:update`를 권장 명령어로 안내
3. `--legacy` 플래그로 기존 동작 유지 가능

## References

- Git worktree: https://git-scm.com/docs/git-worktree
- Atomic rename: POSIX mv, Windows MoveFileEx
- Blue-green deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html
