# 클라이언트 로컬 Git 아키텍처 v1.2

> **Implementable Spec** - 이 문서는 구현 명세입니다.

---

## 0. 핵심 원칙

| 원칙 | 결정 |
|------|------|
| Git 소유권 | **클라이언트가 주인** (루트 단일 repo) |
| 설치 방식 (표준) | 패키지 기반 (starter-kit.zip → git init) |
| upstream 히스토리 | 클라이언트 repo에는 없음 (완전 분리) |
| core:pull 타겟 | **버전 태그** (upstream/main 사용 금지) |
| 덮어쓰기 전 | **항상 스냅샷** (dirty면 WIP 커밋) |
| 코어 수정 정책 | 코어 경로 수정 금지 (감지/백업/이전 가이드) |
| upstream 안전장치 | **push 물리적 차단** |

---

## 1. 디렉토리 구조

```
clinic-os/
├── .git/                      # 클라이언트 로컬 Git
├── .core/
│   └── version                # 현재 적용된 코어 태그 (예: v1.0.93)
│                              # ⚠️ 반드시 유효한 태그만 기록
├── src/
│   ├── pages/                 # 코어 (읽기 전용)
│   ├── components/            # 코어 (읽기 전용)
│   ├── layouts/               # 코어 (읽기 전용)
│   ├── styles/                # 코어 (읽기 전용)
│   ├── lib/                   # 코어 (읽기 전용, local/ 제외)
│   │   └── local/             # 클라이언트 (Git 추적)
│   ├── plugins/
│   │   ├── custom-homepage/   # 코어 제공
│   │   ├── survey-tools/      # 코어 제공
│   │   └── local/             # 클라이언트 (Git 추적)
│   └── survey-tools/
│       ├── stress-check/      # 코어 제공
│       └── local/             # 클라이언트 (Git 추적)
├── migrations/                # 코어 (읽기 전용)
├── public/
│   └── local/                 # 클라이언트 assets (Git 추적)
└── ...
```

### 경로 정의 (구현용)

```javascript
// ═══════════════════════════════════════════════════════════════
// 코어 경로: core:pull에서 업데이트 대상
// ═══════════════════════════════════════════════════════════════
export const CORE_PATHS = [
  // 앱 코드
  'src/pages/',
  'src/components/',
  'src/layouts/',
  'src/styles/',
  'src/lib/',
  'src/plugins/custom-homepage/',
  'src/plugins/survey-tools/',
  'src/survey-tools/stress-check/',
  'migrations/',
  'seeds/',
  'docs/',

  // 인프라 (Option D: starter 통합)
  'scripts/',
  '.docking/engine/',
  'package.json',
  'astro.config.mjs',
  'tsconfig.json',
];

// ═══════════════════════════════════════════════════════════════
// 클라이언트 전용 경로 (upstream에 없음, 절대 건드리지 않음)
// ═══════════════════════════════════════════════════════════════
export const LOCAL_PREFIXES = [
  'src/lib/local/',
  'src/plugins/local/',
  'src/survey-tools/local/',
  'public/local/',
];

// ═══════════════════════════════════════════════════════════════
// 보호 경로: 양쪽에 존재하지만 클라이언트 버전 보호 (restore/delete 모두 차단)
// ═══════════════════════════════════════════════════════════════
export const PROTECTED_EXACT = new Set([
  'wrangler.toml',           // 클라이언트 D1/R2 설정
  'clinic.json',             // 클라이언트 서명 파일
  '.docking/config.yaml',    // 클라이언트 인증 정보
]);

export const PROTECTED_PREFIXES = [
  '.env',                    // .env, .env.local, .env.production 등
  '.core/',                  // 버전 메타데이터
];

// ═══════════════════════════════════════════════════════════════
// 특수 머지 파일: 덮어쓰기 대신 정책 기반 머지
// ═══════════════════════════════════════════════════════════════
export const SPECIAL_MERGE_FILES = new Set([
  'package.json',            // HQ scripts/deps + 클라이언트 추가 deps 머지
]);
```

### package.json 머지 규칙

| 소유자 | 필드 | 정책 |
|--------|------|------|
| HQ | `scripts`, `engines`, `type`, `bin`, `version` | upstream 우선 |
| 클라이언트 | `scripts.local:*` | 로컬 유지 |
| 머지 | `dependencies`, `devDependencies` | HQ 버전 우선 + 클라이언트 추가분 유지 |
| 제거 | HQ 전용 스크립트 | `core:push`, `publish`, `hq:deploy` 등 |

---

## 2. Setup 플로우 (표준: 패키지 기반)

### 목표

- 클라이언트 루트에 단일 Git 생성
- upstream remote 추가하되 push는 물리적으로 차단
- `.core/version`을 반드시 생성하고, 그 값이 실존 태그인지 검증

### setupProject() 의사코드

```javascript
async function setupProject({ starterVersion, upstreamUrl }) {
  // 1) starter-kit.zip 다운로드 & 압축 해제 (외부에서 완료)

  // 2) 로컬 Git init
  await exec(['git', 'init']);

  // 3) 커밋 실패 방지용 최소 config
  await exec(['git', 'config', 'user.name', 'ClinicOS Local']);
  await exec(['git', 'config', 'user.email', 'local@clinic-os.local']);

  // 4) 초기 커밋
  await exec(['git', 'add', '-A']);
  await exec(['git', 'commit', '-m', `Initial: Clinic-OS ${starterVersion} 기반 프로젝트`, '--no-verify']);

  // 5) upstream remote 추가 + push 차단
  await exec(['git', 'remote', 'add', 'upstream', upstreamUrl]);
  await exec(['git', 'remote', 'set-url', '--push', 'upstream', 'DISABLE']);

  // 6) upstream tags fetch
  await exec(['git', 'fetch', 'upstream', '--tags']);

  // 7) starterVersion 태그 존재 검증 (필수)
  await assertTagExists(starterVersion);

  // 8) .core/version 생성 (반드시 "유효 태그명"만 기록)
  await writeCoreVersion(starterVersion);

  // 9) pre-commit 훅 설치 (코어 파일 수정 경고)
  await installPreCommitHook();

  console.log('✅ 프로젝트 초기화 완료');
}
```

### 태그 존재 검증 (필수)

```javascript
async function assertTagExists(tag) {
  try {
    await exec(['git', 'rev-parse', '--verify', `refs/tags/${tag}`]);
  } catch {
    throw new Error(`코어 태그 ${tag}를 찾을 수 없습니다. upstream에 해당 태그가 있는지 확인하세요.`);
  }
}
```

---

## 3. core:pull 알고리즘

### 목표

- "업데이트 대상 파일"과 "클라이언트가 코어를 건드린 파일"을 교차해 충돌 판정
- 충돌 파일은 `.core-backup/`에 백업 + local 이전 가이드 출력
- 코어 경로는 `git restore --source=<tag>`로만 갱신
- `.core/version` 갱신은 업데이트 성공 이후 수행

### corePull() 의사코드

```javascript
async function corePull(targetVersion = 'latest') {
  // ═══════════════════════════════════════════════
  // 0. 사전 체크: dirty면 WIP 스냅샷 커밋
  // ═══════════════════════════════════════════════
  if (await isDirty()) {
    await createWipSnapshot();
  }

  // ═══════════════════════════════════════════════
  // 1. fetch tags
  // ═══════════════════════════════════════════════
  await exec(['git', 'fetch', 'upstream', '--tags']);

  // ═══════════════════════════════════════════════
  // 2. 타겟 태그 결정 + 존재 검증
  // ═══════════════════════════════════════════════
  const version = (targetVersion === 'latest')
    ? await getLatestStableTag()
    : targetVersion;

  await assertTagExists(version);

  // ═══════════════════════════════════════════════
  // 3. 현재 적용된 코어 태그 (반드시 유효 태그여야 함)
  // ═══════════════════════════════════════════════
  const current = await readCoreVersion();
  await assertTagExists(current);

  // ═══════════════════════════════════════════════
  // 4. 업데이트 대상 파일 (HEAD ↔ target 태그) 계산
  // ═══════════════════════════════════════════════
  const filesToUpdate = await gitDiffNameOnly(['HEAD', version, '--', ...CORE_PATHS]);

  if (filesToUpdate.length === 0) {
    console.log(`✅ 이미 최신입니다. (현재: ${current}, 타겟: ${version})`);
    return;
  }

  // ═══════════════════════════════════════════════
  // 5. 클라이언트가 코어를 수정한 파일 (현재코어태그 ↔ HEAD) 계산
  // ═══════════════════════════════════════════════
  const clientTouchedCore = await gitDiffNameOnly([current, 'HEAD', '--', ...CORE_PATHS]);

  // ═══════════════════════════════════════════════
  // 6. 충돌 = (업데이트 대상 ∩ 클라이언트 수정)
  // ═══════════════════════════════════════════════
  const conflicts = intersect(filesToUpdate, clientTouchedCore);

  if (conflicts.length > 0) {
    console.log(`⚠️ 충돌 감지: 코어 파일 ${conflicts.length}개가 로컬에서 수정됨`);
    await backupModifiedFiles(conflicts);   // .core-backup/<timestamp>/
    await printMigrationGuide(conflicts);   // local 이전 가이드
  }

  // ═══════════════════════════════════════════════
  // 7. 파일 단위 적용 (4단계 분류)
  //    PROTECTED → LOCAL → SPECIAL_MERGE → 일반 적용
  // ═══════════════════════════════════════════════
  const fileOps = await gitDiffNameStatus([current, version, '--', ...CORE_PATHS]);
  const mergeQueue = [];

  for (const { status, path: filePath } of fileOps) {
    // 1) PROTECTED: restore/delete 모두 차단
    if (isProtectedPath(filePath)) {
      console.log(`🔒 Protected: ${filePath}`);
      continue;
    }

    // 2) LOCAL: 클라이언트 소유
    if (isLocalPath(filePath)) {
      console.log(`⏭️  Skip (local): ${filePath}`);
      continue;
    }

    // 3) SPECIAL_MERGE: 머지 큐에 추가
    if (isSpecialMergeFile(filePath)) {
      mergeQueue.push({ status, path: filePath });
      continue;
    }

    // 4) 일반: restore/delete 적용
    if (status === 'D') {
      await exec(['rm', '-f', filePath]);
      console.log(`🗑️  Deleted: ${filePath}`);
    } else {
      await exec(['git', 'restore', '--source', version, '--', filePath]);
      console.log(`📄 Applied: ${filePath}`);
    }
  }

  // ═══════════════════════════════════════════════
  // 7.5. 특수 머지 파일 처리 (package.json 등)
  // ═══════════════════════════════════════════════
  for (const { path: filePath } of mergeQueue) {
    if (filePath === 'package.json') {
      await mergePackageJson(version);
      console.log(`🔀 Merged: ${filePath}`);
    }
  }

  // ═══════════════════════════════════════════════
  // 8. 메타데이터 업데이트 (.core/version)
  // ═══════════════════════════════════════════════
  await writeCoreVersion(version);

  // ═══════════════════════════════════════════════
  // 9. 자동 커밋 (변경 없으면 커밋 생략)
  // ═══════════════════════════════════════════════
  await exec(['git', 'add', '-A']);

  if (await hasStagedChanges()) {
    await exec(['git', 'commit', '-m', `Core update: ${version}`, '--no-verify']);
    console.log(`✅ 완료: ${version} 적용됨`);
  } else {
    console.log(`ℹ️ 적용 결과 변경사항이 없어 커밋을 생략했습니다. (버전: ${version})`);
  }
}
```

### Helper 함수들

```javascript
// git diff --name-status: 파일별 변경 상태 (A/M/D/R) 반환
async function gitDiffNameStatus(args) {
  const { stdout } = await exec(['git', 'diff', '--name-status', ...args]);
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const [status, ...pathParts] = line.split('\t');
    return { status: status.charAt(0), path: pathParts.join('\t') };
  });
}

// git diff --name-only: 변경 파일 목록만
async function gitDiffNameOnly(args) {
  const { stdout } = await exec(['git', 'diff', '--name-only', ...args]);
  return stdout.trim().split('\n').filter(Boolean);
}

// Dirty 판정: git status --porcelain (안정적)
async function isDirty() {
  const { stdout } = await exec(['git', 'status', '--porcelain']);
  return stdout.trim().length > 0;
}

// Staged 여부 체크
async function hasStagedChanges() {
  const { stdout } = await exec(['git', 'diff', '--cached', '--name-only']);
  return stdout.trim().length > 0;
}

// WIP 스냅샷 (실패 케이스 처리)
async function createWipSnapshot() {
  console.log('📸 현재 상태 스냅샷(WIP) 저장 중...');
  await exec(['git', 'add', '-A']);

  if (!(await hasStagedChanges())) {
    console.log('ℹ️ staged 변경이 없어 WIP 커밋을 생략합니다.');
    return;
  }

  await exec(['git', 'commit', '-m', 'WIP: core:pull 전 자동 스냅샷', '--no-verify']);
}

// Latest stable tag (semver 정렬, pre-release 제외)
async function getLatestStableTag() {
  const { stdout } = await exec(['git', 'tag', '--list', 'v*', '--sort=-v:refname']);
  const tags = stdout.trim().split('\n').filter(Boolean);

  // pre-release 제외 (-rc, -beta, -alpha)
  const stable = tags.find(t => !/-/.test(t));
  if (!stable) {
    throw new Error('사용 가능한 안정 태그(v*)를 찾지 못했습니다.');
  }
  return stable;
}

// .core/version 읽기
async function readCoreVersion() {
  const versionFile = path.join(PROJECT_ROOT, '.core', 'version');
  if (!fs.existsSync(versionFile)) {
    throw new Error('.core/version 파일이 없습니다. setup을 다시 실행하세요.');
  }
  return fs.readFileSync(versionFile, 'utf8').trim();
}

// .core/version 쓰기
async function writeCoreVersion(version) {
  const coreDir = path.join(PROJECT_ROOT, '.core');
  fs.ensureDirSync(coreDir);
  fs.writeFileSync(path.join(coreDir, 'version'), version);
}
```

---

## 4. Pre-commit 훅 (코어 파일 수정 경고)

### 목적

- 클라이언트가 실수로 코어 파일을 수정하는 것을 방지
- core:pull은 `--no-verify`로 우회하므로 문제 없음

### 훅 스크립트

```bash
#!/bin/sh
# .git/hooks/pre-commit (또는 husky로 관리)

CORE_PATHS="src/pages src/components src/layouts src/styles src/lib migrations"
LOCAL_SKIP="src/lib/local src/plugins/local src/survey-tools/local public/local"

# 로컬 경로 체크 함수
is_local_path() {
  for skip in $LOCAL_SKIP; do
    case "$1" in
      "$skip"*) return 0 ;;
    esac
  done
  return 1
}

CORE_MODIFIED=""

for path in $CORE_PATHS; do
  staged=$(git diff --cached --name-only -- "$path")
  for file in $staged; do
    # LOCAL_SKIP에 해당하면 무시
    if is_local_path "$file"; then
      continue
    fi
    CORE_MODIFIED="$CORE_MODIFIED$file\n"
  done
done

if [ -n "$CORE_MODIFIED" ]; then
  echo "⚠️  경고: 코어 파일이 수정되었습니다."
  echo ""
  echo "   수정된 코어 파일:"
  printf "$CORE_MODIFIED" | sed 's/^/   - /'
  echo ""
  echo "   코어 파일은 core:pull 시 덮어쓰여집니다."
  echo "   커스터마이징이 필요하면 local/ 폴더를 사용하세요."
  echo ""
  echo "   계속하려면 'y'를 입력하세요: "
  read -r response
  if [ "$response" != "y" ]; then
    echo "커밋이 취소되었습니다."
    exit 1
  fi
fi

exit 0
```

### 정책

| 상황 | 훅 적용 |
|------|---------|
| 일반 개발/배포 커밋 | ✅ pre-commit 훅 적용 (코어 수정 경고) |
| core:pull 내부 커밋 | ❌ `--no-verify`로 우회 (업데이트 목적) |

---

## 5. .gitignore

```gitignore
# ═══════════════════════════════════════════════
# Secrets (절대 커밋 금지 - tracked 되면 git rm --cached 필요)
# ═══════════════════════════════════════════════
.env
.env.local
.env.production
.env.*.local
*.pem
*.key
credentials.json
secrets.json
.dev.vars
.npmrc

# ═══════════════════════════════════════════════
# Build outputs
# ═══════════════════════════════════════════════
dist/
.astro/
node_modules/

# ═══════════════════════════════════════════════
# Cloudflare / Wrangler
# ═══════════════════════════════════════════════
.wrangler/

# ═══════════════════════════════════════════════
# Machine-specific
# ═══════════════════════════════════════════════
.DS_Store
*.local.json
.idea/
.vscode/

# ═══════════════════════════════════════════════
# Logs
# ═══════════════════════════════════════════════
*.log

# ═══════════════════════════════════════════════
# 로컬 DB (개발용)
# ═══════════════════════════════════════════════
*.sqlite
local_*.sql

# ═══════════════════════════════════════════════
# 주의: 아래는 이제 Git 추적됨 (gitignore에서 제거됨)
# - src/plugins/local/
# - src/survey-tools/local/
# - src/lib/local/
# - public/local/
# ═══════════════════════════════════════════════
```

---

## 6. 마이그레이션 가이드 (기존 클라이언트용)

### 6-1) secrets가 이미 tracked일 때 제거 (필수)

```bash
git rm --cached .env .env.local .env.production .dev.vars 2>/dev/null || true
git commit -m "chore: stop tracking secrets"
```

### 6-2) local 폴더 추적 시작

```bash
git add -A src/plugins/local/ src/survey-tools/local/ src/lib/local/ public/local/
git commit -m "chore: start tracking local customizations"
```

### 6-3) .core/version 생성 (필수)

```bash
mkdir -p .core
echo "v1.0.92" > .core/version   # 실제 설치된 코어 태그로
git add .core/version
git commit -m "chore: set current core version tag"
```

> ⚠️ `.core/version`은 반드시 upstream에 존재하는 태그여야 합니다.

---

## 7. 운영 가이드

### 7-1) 코어 경로 수정 금지

- 코어 경로는 **읽기 전용**
- 수정이 필요하면 local로 복사 후 오버라이드
- core:pull 시:
  - 충돌 감지 → `.core-backup/` 백업
  - 마이그레이션 가이드 출력
  - "백업 확인하고 local로 이전해줘" 워크플로우 유도

### 7-2) 되돌리기

```bash
# Core 업데이트만 되돌리기
git revert HEAD   # "Core update: vX.Y.Z" 커밋 revert

# 특정 파일 복구
git log --oneline -20
git checkout <commit> -- <path>

# WIP 스냅샷 찾기/복구
git log --oneline --grep="WIP"
git checkout <wip-commit> -- .
```

---

## 8. 반증 실험 체크리스트

**목표:** "코어+로컬 동시 수정 → core:pull → 되돌리기"에서 사고가 안 나는지 확인

### 기본 시나리오
- [ ] 코어+로컬 수정 후 커밋
- [ ] core:pull 실행 (자동 WIP 커밋 생성 확인)
- [ ] 충돌 파일이 `.core-backup/`에 백업되는지 확인
- [ ] local 변경이 core:pull로 덮어써지지 않는지 확인
- [ ] `git revert HEAD`로 Core update만 되돌렸을 때 로컬 작업이 유지되는지 확인

### 삭제 반영 시나리오
- [ ] HQ에서 코어 파일 삭제 후 새 태그 생성
- [ ] 클라이언트에서 core:pull 실행
- [ ] 삭제된 코어 파일이 로컬에서도 삭제되는지 확인
- [ ] `src/lib/local/` 파일은 삭제되지 않는지 확인

### LOCAL_PREFIXES 보호 시나리오
- [ ] `src/lib/local/my-util.ts` 생성 및 커밋
- [ ] 동일 경로가 upstream에 존재하지 않음을 확인
- [ ] core:pull 후에도 해당 파일이 유지되는지 확인

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-01-23 | v1.0 | 초기 문서 작성 |
| 2025-01-23 | v1.1 | Option B 적용: `src/lib/` 유지 + LOCAL_PREFIXES 제외 방식, `git diff --name-status` 기반 파일단위 적용(삭제 포함) |
| 2025-01-23 | v1.2 | Option D 적용: starter 통합 (CORE_PATHS에 scripts/, .docking/engine/ 추가), PROTECTED_PATHS 추가, package.json 정책 기반 머지 |
