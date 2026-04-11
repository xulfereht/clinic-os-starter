/**
 * Clinic-OS Core Pull (Local Git Architecture v1.4)
 *
 * 클라이언트 소유 Git에서 upstream 태그 기반으로 코어 파일만 업데이트
 * - git diff --name-status 기반 파일단위 적용 (삭제 포함)
 * - LOCAL_PREFIXES는 절대 건드리지 않음
 * - WIP 스냅샷 자동 생성
 * - Channel Tags (latest-stable, latest-beta) 기반 버전 결정
 * - 스타터킷 구조 (core/ 폴더) 자동 감지 및 지원
 *
 * SPEC-CORE-001 추가 기능:
 * - Pre-flight 스키마 검증
 * - SQLITE_BUSY 재시도 메커니즘 (Exponential Backoff)
 * - Atomic Engine Update (Self-update 안전성)
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import yaml from 'js-yaml';
import { exec, execFileSync } from 'child_process';
import { promisify } from 'util';

// Extracted modules (Phase: fetch.js decomposition)
import * as gitUtils from './git-utils.js';
import * as pathRulesModule from './path-rules.js';
import * as versionResolver from './version-resolver.js';
import { createDbOperations } from './db-operations.js';
import { createConflictDetection } from './conflict-detection.js';
import { createErrorReporting } from './error-reporting.js';
import { promptUserConfirmation, isAutoMode, calculateVersionDiff } from './cli-helpers.js';

// ═════════════════════════════════════════════════════════════════════════════
// CORE WRITE PROTECTION GUARD (AC-8)
// Prevents accidental writes to core/ directory which is a git submodule
// ═════════════════════════════════════════════════════════════════════════════

const CORE_WRITE_PROTECTION = {
  enabled: true,
  forbiddenPaths: ['core/', 'core\\'],
  
  validateWritePath(filePath) {
    if (!this.enabled) return;
    const normalized = filePath.replace(/\\/g, '/');
    // Block core/ (git submodule) but allow .core/ (metadata directory)
    // In starter kit mode, core/ IS the app directory — core:pull writes there legitimately.
    // The guard is for agent coders, not for fetch.js itself.
    // When IS_STARTER_KIT is true (detected later), this.enabled is set to false.
    if (/^core\//.test(normalized) || /\/core\//.test(normalized)) {
      const error = `
❌ WRITE TO core/ DIRECTORY BLOCKED
   Path: ${filePath}
   
   core/ is a git submodule (mode 160000). Changes here CANNOT be committed.
   Your work WILL BE LOST on the next core:pull.
   
   ✅ SAFE alternatives:
      - src/plugins/local/     (for plugins)
      - src/pages/_local/      (for page overrides)
      - src/lib/local/         (for utilities)
   `;
      throw new Error(error);
    }
  },
  
  wrapFsModule(fsModule) {
    const guard = this;
    const originalWriteFile = fsModule.writeFileSync;
    const originalMkdir = fsModule.mkdirSync;
    const originalCopy = fsModule.copySync;
    
    fsModule.writeFileSync = function(file, ...args) {
      guard.validateWritePath(String(file));
      return originalWriteFile.call(this, file, ...args);
    };
    
    fsModule.mkdirSync = function(dir, ...args) {
      guard.validateWritePath(String(dir));
      return originalMkdir.call(this, dir, ...args);
    };
    
    fsModule.copySync = function(src, dest, ...args) {
      guard.validateWritePath(String(dest));
      return originalCopy.call(this, src, dest, ...args);
    };
    
    return fsModule;
  }
};

// fs wrapper applied after IS_STARTER_KIT detection (see line ~202)
// ═════════════════════════════════════════════════════════════════════════════


// SPEC-CORE-001: 신규 모듈 (optional - 없으면 기본 동작)
let executeWithRetry, verifyMigrationState, printStateReport;
let atomicEngineUpdate, recoverFromPreviousFailure;

// Dynamic import to handle bootstrap scenario (files may not exist yet)
try {
    const schemaValidator = await import('./schema-validator.js');
    executeWithRetry = schemaValidator.executeWithRetry;
    verifyMigrationState = schemaValidator.verifyMigrationState;
    printStateReport = schemaValidator.printStateReport;
} catch (e) {
    // Module not found - use fallback implementations
    executeWithRetry = async (fn) => fn(); // No retry, just execute
    verifyMigrationState = async () => ({ valid: true });
    printStateReport = () => {};
}

try {
    const engineUpdater = await import('./engine-updater.js');
    atomicEngineUpdate = engineUpdater.atomicEngineUpdate;
    recoverFromPreviousFailure = engineUpdater.recoverFromPreviousFailure;
} catch (e) {
    // Module not found - use fallback implementations
    atomicEngineUpdate = async () => ({ success: true, updated: [] });
    recoverFromPreviousFailure = async () => {};
}

// Smart Update Strategy 모듈 임포트
let selectUpdateStrategy, extractClientChanges, executeFreshWithMigration;
try {
    const smartUpdate = await import('./smart-update.js');
    selectUpdateStrategy = smartUpdate.selectUpdateStrategy;
    extractClientChanges = smartUpdate.extractClientChanges;
    executeFreshWithMigration = smartUpdate.executeFreshWithMigration;
} catch (e) {
    // 모듈 없으면 기본 구현 (fetch.js 내부에 있는 함수 사용)
    console.log('   ℹ️  smart-update.js 모듈 없음, 기본 구현 사용');
}

// 통합 마이그레이션 엔진 (PRAGMA 기반 컬럼 안전 체크 포함)
let migrateEngine;
try {
    migrateEngine = await import('./migrate.js');
} catch (e) {
    console.log('   ℹ️  migrate.js 모듈 없음, 내장 마이그레이션 사용');
    migrateEngine = null;
}

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find actual project root by looking for wrangler.toml first (has DB config)
 * Then falls back to other markers if wrangler.toml not found.
 * Traverses up from script location to handle both:
 * - Direct run from root (/.docking/engine/fetch.js)
 * - Run from core (/core/.docking/engine/fetch.js)
 */
function findProjectRoot(startDir) {
    let current = startDir;

    // 1차: wrangler.toml 또는 core/package.json 탐색 (스타터킷 구조 포함)
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'wrangler.toml'))) {
            return current;
        }
        if (fs.existsSync(path.join(current, 'core', 'package.json'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // 2차: 다른 마커로 fallback
    current = startDir;
    const fallbackMarkers = ['.docking/config.yaml', 'clinic.json'];
    for (let i = 0; i < 5; i++) {
        for (const marker of fallbackMarkers) {
            if (fs.existsSync(path.join(current, marker))) {
                return current;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // Fallback to original behavior (2 levels up from .docking/engine/)
    return path.join(startDir, '../..');
}

const PROJECT_ROOT = findProjectRoot(__dirname);

// ═══════════════════════════════════════════════════════════════
// Bound wrappers — bridge global PROJECT_ROOT to extracted modules
// Call sites unchanged; modules accept projectRoot as parameter.
// ═══════════════════════════════════════════════════════════════

// --- Starter kit detection (must come first, others depend on IS_STARTER_KIT) ---
const { isStarterKit: IS_STARTER_KIT, coreDir: CORE_DIR } = pathRulesModule.detectStarterKit(PROJECT_ROOT);

// In starter kit mode, core/ is the app dir — disable write protection
// (core:pull legitimately writes to core/src/, core/migrations/, etc.)
if (IS_STARTER_KIT) {
    CORE_WRITE_PROTECTION.enabled = false;
}
// Apply fs wrapper AFTER starter kit detection (guard already configured)
CORE_WRITE_PROTECTION.wrapFsModule(fs);

// --- Path rules (loads protection-manifest.yaml + client config) ---
const pathRules = pathRulesModule.loadPathRules(PROJECT_ROOT);
const { CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES,
        SPECIAL_MERGE_FILES, CLIENT_PROTECTED_PAGES, CLIENT_PROTECTED_PREFIXES } = pathRules;
const isLocalPath = pathRules.isLocalPath;
const isProtectedPath = pathRules.isProtectedPath;
const isSpecialMergeFile = pathRules.isSpecialMergeFile;
const isCorePath = pathRules.isCorePath;
const toLocalPath = (p) => pathRulesModule.toLocalPath(p, IS_STARTER_KIT, CORE_DIR);
const toUpstreamPath = (p) => pathRulesModule.toUpstreamPath(p, IS_STARTER_KIT, CORE_DIR);
const isBinaryFile = pathRulesModule.isBinaryFile;
const suggestLocalPath = pathRulesModule.suggestLocalPath;

// --- Git utilities ---
const runCommand = (cmd, silent, timeout) => gitUtils.runCommand(cmd, PROJECT_ROOT, silent, timeout);
const fetchWithTimeout = gitUtils.fetchWithTimeout;
const isDirty = () => gitUtils.isDirty(PROJECT_ROOT);
const hasUpstreamRemote = () => gitUtils.hasUpstreamRemote(PROJECT_ROOT);
const ensureUpstreamRemote = (gitUrl) => gitUtils.ensureUpstreamRemote(gitUrl, PROJECT_ROOT);
const hasStagedChanges = () => gitUtils.hasStagedChanges(PROJECT_ROOT);
const createWipSnapshot = () => gitUtils.createWipSnapshot(PROJECT_ROOT);
const assertTagExists = (tag) => gitUtils.assertTagExists(tag, PROJECT_ROOT);
const gitDiffNameStatus = (from, to, paths) => gitUtils.gitDiffNameStatus(from, to, paths, PROJECT_ROOT);
const gitDiffNameOnly = (from, to, paths) => gitUtils.gitDiffNameOnly(from, to, paths, PROJECT_ROOT);

// --- Version resolver ---
const getConfig = () => versionResolver.getConfig(PROJECT_ROOT);
const getAuthenticatedGitUrl = () => versionResolver.getAuthenticatedGitUrl(PROJECT_ROOT);
const getVersionFromHQ = (ch) => versionResolver.getVersionFromHQ(PROJECT_ROOT, ch);
const readCoreVersion = () => versionResolver.readCoreVersion(PROJECT_ROOT, IS_STARTER_KIT);
const writeCoreVersion = (v) => versionResolver.writeCoreVersion(PROJECT_ROOT, v);
const readStarterVersion = () => versionResolver.readStarterVersion(PROJECT_ROOT, IS_STARTER_KIT);
const semverLt = versionResolver.semverLt;
const getChannelVersion = (ch) => versionResolver.getChannelVersion(PROJECT_ROOT, ch);
const getLatestStableTagFallback = () => versionResolver.getLatestStableTagFallback(PROJECT_ROOT);

// --- DB operations (factory — closes over projectRoot, isStarterKit, runCommand) ---
const dbOps = createDbOperations({ projectRoot: PROJECT_ROOT, isStarterKit: IS_STARTER_KIT, runCommand, migrateEngine });
const { runNewMigrations, ensureLocalDb, runAllMigrations, runAllSeeds, updateSchemaDoc } = dbOps;

// --- Conflict detection (factory) ---
const conflictOps = createConflictDetection({
    projectRoot: PROJECT_ROOT, isStarterKit: IS_STARTER_KIT, CORE_PATHS,
    runCommand, toLocalPath, isProtectedPath, isLocalPath, suggestLocalPath,
});
const { intersect, detectDriftedFiles, filterRealConflicts, restoreFileFromUpstream,
        restoreBinaryFromUpstream, backupModifiedFiles, printMigrationGuide, mergePackageJson } = conflictOps;

// --- Error reporting ---
const errorOps = createErrorReporting({ projectRoot: PROJECT_ROOT, isStarterKit: IS_STARTER_KIT });
const { reportError, clearErrorReport } = errorOps;

async function refreshAgentRuntimeContext() {
    const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'generate-agent-context.js');
    if (!fs.existsSync(scriptPath)) return;

    const result = await runCommand('node scripts/generate-agent-context.js --quiet', true, 30000);
    if (!result.success) {
        console.log(`   ⚠️  agent runtime context 갱신 실패: ${result.stderr || 'unknown error'}`);
    }
}

async function syncCoreInfrastructureForStarterKit() {
    if (!IS_STARTER_KIT) return null;

    const updateStarterPath = path.join(PROJECT_ROOT, 'scripts', 'update-starter.js');
    if (!fs.existsSync(updateStarterPath)) return null;

    try {
        const updater = await import(pathToFileURL(updateStarterPath).href);
        if (typeof updater.syncCoreInfrastructure !== 'function') return null;
        return updater.syncCoreInfrastructure(PROJECT_ROOT);
    } catch (e) {
        console.log(`   ⚠️  core 인프라 동기화 건너뜀: ${e.message}`);
        return null;
    }
}

// DB Doctor import (동적 import로 순환 의존성 방지)
async function runDbDoctorCheck() {
    try {
        const doctorPath = path.join(PROJECT_ROOT, 'scripts', 'doctor.js');
        if (fs.existsSync(doctorPath)) {
            const { runSchemaDoctor, getDbNameFromWrangler } = await import(doctorPath);
            const dbName = getDbNameFromWrangler();
            if (dbName) {
                return await runSchemaDoctor(dbName, { fix: true, verbose: true });
            }
        }
    } catch (e) {
        console.log('   ⚠️  DB Doctor 체크 건너뜀:', e.message);
    }
    return { ok: true };
}

async function corePull(targetVersion = 'latest', options = {}) {
    const { dryRun = false, force = false, forceBootstrap = false, autoMode = false } = options;

    if (dryRun) {
        console.log('\uD83D\uDD0D Clinic-OS Core Pull DRY-RUN \uBAA8\uB4DC\n');
        console.log('   \uC2E4\uC81C \uD30C\uC77C \uBCC0\uACBD \uC5C6\uC774 \uBCC0\uACBD \uC608\uC815 \uC0AC\uD56D\uB9CC \uCD9C\uB825\uD569\uB2C8\uB2E4.\n');
    } else {
        console.log('\uD83D\uDEA2 Clinic-OS Core Pull v4.3 (Local Git Architecture v1.4)\n');
    }

    // 스타터킷 구조 감지 로그
    if (IS_STARTER_KIT) {
        console.log('📦 스타터킷 구조 감지됨 (core/ 폴더 사용)\n');

        // core/.git 처리: 루트에 .git이 있어야 git 명령이 동작함
        const rootGitDir = path.join(PROJECT_ROOT, '.git');
        const coreGitDir = path.join(PROJECT_ROOT, 'core', '.git');
        if (!fs.existsSync(rootGitDir)) {
            // 루트에 .git이 없으면 → git init (core/.git은 보존)
            console.log('   ⚠️  루트에 .git이 없습니다. 초기화 중...');
            await runCommand('git init', true);
            if (fs.existsSync(coreGitDir)) {
                // core/.git이 있으면 embedded repo 문제 방지를 위해 제거
                // (루트 .git이 이제 생겼으므로 안전)
                console.log('   🧹 core/.git 제거 중 (embedded git repo 방지)...');
                fs.removeSync(coreGitDir);
            }
        } else if (fs.existsSync(coreGitDir)) {
            // 루트 .git도 있고 core/.git도 있으면 → embedded repo 제거
            console.log('   🧹 core/.git 제거 중 (embedded git repo 방지)...');
            fs.removeSync(coreGitDir);
        }
    }

    // 0. Client protection loaded at init (pathRulesModule.loadPathRules)

    // ═══════════════════════════════════════════════
    // 0.1 인프라 사전 동기화 (update:starter)
    // scripts/, .docking/engine/ 등 인프라 파일을 HQ에서 최신으로 갱신
    // ═══════════════════════════════════════════════
    if (!dryRun) {
        const updateStarterPath = path.join(PROJECT_ROOT, 'scripts', 'update-starter.js');
        if (fs.existsSync(updateStarterPath)) {
            console.log('🔄 인프라 파일 사전 동기화 중...');
            try {
                const { execSync } = await import('child_process');
                execSync(`node "${updateStarterPath}"`, {
                    cwd: PROJECT_ROOT,
                    stdio: 'inherit',
                    timeout: 60000
                });
                console.log('');
            } catch (e) {
                console.log(`   ⚠️  인프라 동기화 건너뜀: ${e.message}\n`);
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 0.5 사전 체크: dirty면 WIP 스냅샷 커밋 (dry-run에서는 스킵)
    // ═══════════════════════════════════════════════
    if (!dryRun && await isDirty()) {
        await createWipSnapshot();
    }

    // ═══════════════════════════════════════════════
    // 0.5 TASK-009: 이전 엔진 업데이트 실패 잔여 복구
    // ═══════════════════════════════════════════════
    if (!dryRun) {
        await recoverFromPreviousFailure(runCommand);
    }

    // ═══════════════════════════════════════════════
    // 0.6 Pre-pull 건강 검진 + 자동 수정
    // ═══════════════════════════════════════════════
    if (!dryRun) {
        try {
            const healthPath = path.join(PROJECT_ROOT, 'scripts/health-audit.js');
            if (fs.existsSync(healthPath)) {
                const { runHealthAudit } = await import(healthPath);
                const health = await runHealthAudit({ quiet: true, fix: true });
                if (health.score < 30 && !force) {
                    throw new Error(`건강 점수 ${health.score}/100 — npm run health:fix 후 재시도 (또는 --force로 강제 진행)`);
                }
                if (health.score < 70) {
                    console.log(`   ⚠️  건강 점수 ${health.score}/100 — 계속 진행합니다`);
                }
            }
        } catch (e) {
            if (e.message?.includes('건강 점수') && !force) throw e;
            // health-audit.js 로드 실패 → 건너뜀
        }
    }

    // ═══════════════════════════════════════════════
    // 1. HQ에서 인증된 Git URL 받아서 upstream 등록/업데이트 후 fetch
    // ═══════════════════════════════════════════════
    console.log('🔑 HQ에서 인증된 Git URL 가져오는 중...');
    const gitUrl = await getAuthenticatedGitUrl();

    if (gitUrl) {
        // upstream 자동 등록 또는 URL 업데이트
        await ensureUpstreamRemote(gitUrl);
    } else {
        // 인증 URL 획득 실패 시 upstream 존재 여부 확인
        const hasUpstream = await hasUpstreamRemote();
        if (!hasUpstream) {
            throw new Error('upstream remote가 없고 HQ 인증도 실패했습니다.\n   → npm run setup을 실행하여 디바이스를 등록하세요.');
        }
        console.log('   ⚠️  인증된 URL 획득 실패. 기존 upstream 설정으로 시도합니다.');
    }

    console.log('📥 upstream 태그를 가져오는 중...');
    // --force: moving tags (latest-stable, latest-beta)가 로컬에 업데이트되도록 함
    const fetchResult = await runCommand('git fetch upstream --tags --force');
    if (!fetchResult.success) {
        const stderr = fetchResult.stderr || '';
        if (stderr.includes('not a git repository')) {
            const msg = 'Git 저장소가 아닙니다. git init을 먼저 실행하세요.';
            await reportError({
                phase: 'git-fetch',
                error: msg,
                recovery: {
                    workflow: '.agent/workflows/troubleshooting.md',
                    section: '1',
                    suggestion: 'git init 후 npm run core:pull 재실행',
                    commands: ['git init', 'npm run core:pull']
                }
            });
            throw new Error(msg);
        }
        if (stderr.includes('No such remote')) {
            const msg = 'upstream remote가 등록되지 않았습니다.\n   → npm run setup을 실행하세요.';
            await reportError({
                phase: 'git-fetch',
                error: msg,
                recovery: {
                    workflow: '.agent/workflows/troubleshooting.md',
                    section: '1',
                    suggestion: 'npm run setup으로 upstream 등록',
                    commands: ['npm run setup']
                }
            });
            throw new Error(msg);
        }
        await reportError({
            phase: 'git-fetch',
            error: 'upstream fetch 실패. 네트워크 연결 또는 인증 문제.',
            recovery: {
                workflow: '.agent/workflows/troubleshooting.md',
                section: '4',
                suggestion: '네트워크 확인 후 재시도, device_token 유효성 점검',
                commands: ['npm run core:pull']
            }
        });
        throw new Error('upstream fetch 실패. 네트워크 연결 또는 인증을 확인하세요.\n   → device_token이 유효한지 확인하세요.');
    }

    // ═══════════════════════════════════════════════
    // 2. 타겟 태그 결정 + 존재 검증
    //    - 'latest' (기본) → latest-stable 채널
    //    - 'beta' → latest-beta 채널
    //    - 'v1.0.93' → 직접 지정
    // ════���══════════════════════════════════════════
    let version;
    if (targetVersion === 'latest' || targetVersion === 'stable') {
        version = await getChannelVersion('stable');
    } else if (targetVersion === 'beta') {
        version = await getChannelVersion('beta');
    } else {
        // 직접 v-tag 지정
        version = targetVersion;
    }

    await assertTagExists(version);
    console.log(`   🎯 타겟 버전: ${version}`);

    // ═══════════════════════════════════════════════
    // 3. 현재 적용된 코어 태그 (반드시 유효 태그여야 함)
    // ═══════════════════════════════════════════════
    const current = await readCoreVersion();
    await assertTagExists(current);
    console.log(`   📌 현재 버전: ${current}`);

    // ═══════════════════════════════════════════════
    // 3.1 스타터킷 호환성 검사 (차단)
    //     스타터 버전이 최소 요구보다 낮으면 update:starter 먼저 실행 강제
    // ═══════════════════════════════════════════════
    if (IS_STARTER_KIT) {
        try {
            const starterVer = readStarterVersion();
            const upstreamPkgResult = await runCommand(`git show upstream/${version}:package.json`, true);
            if (upstreamPkgResult.success) {
                const upstreamPkg = JSON.parse(upstreamPkgResult.stdout);
                const minStarter = upstreamPkg?.clinicOs?.minStarterVersion;
                if (minStarter && semverLt(starterVer, minStarter)) {
                    const msg = `\n❌ 스타터킷 업데이트가 필요합니다.\n` +
                        `   현재 스타터: ${starterVer}\n` +
                        `   최소 요구:   ${minStarter}\n\n` +
                        `   👉 먼저 실행: npm run update:starter\n` +
                        `   그 후 다시:  npm run core:pull`;
                    if (!force) {
                        throw new Error(msg);
                    }
                    console.log(`   ⚠️  스타터 ${starterVer} < 최소 요구 ${minStarter} (--force로 무시됨)`);
                }
            }
        } catch (e) {
            if (e.message?.includes('스타터킷 업데이트가 필요합니다')) throw e;
            // 호환성 검사 자체 실패는 무시 (네트워크 등)
        }
    }

    if (current === version) {
        // 이미 최신이지만, drift 감지로 로컬/upstream 불일치 파일 확인
        console.log(`\n✅ 이미 최신입니다. (현재: ${current})`);
        const driftedFiles = await detectDriftedFiles(version, []);
        if (driftedFiles.length > 0) {
            console.log(`\n🔄 Drift 감지: ${driftedFiles.length}개 파일이 upstream과 다름`);
            driftedFiles.forEach(f => console.log(`   📄 ${f}`));
            console.log(`\n🔧 Drift 파일 동기화 중...`);
            let syncCount = 0;
            for (const upstreamPath of driftedFiles) {
                try {
                    // package.json uses smart merge, not raw overwrite
                    if (upstreamPath === 'package.json') {
                        await mergePackageJson(version);
                        syncCount++;
                        continue;
                    }
                    const localPath = toLocalPath(upstreamPath);
                    const fullLocalPath = path.join(PROJECT_ROOT, localPath);
                    const { stdout: upstreamContent } = await execAsync(
                        `git show ${version}:"${upstreamPath}"`,
                        { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024 }
                    );
                    if (upstreamContent != null) {
                        fs.mkdirSync(path.dirname(fullLocalPath), { recursive: true });
                        fs.writeFileSync(fullLocalPath, upstreamContent, 'utf8');
                        console.log(`   ✅ ${localPath}`);
                        syncCount++;
                    }
                } catch (e) {
                    console.log(`   ⚠️ ${upstreamPath}: ${e.message}`);
                }
            }
            if (syncCount > 0) {
                console.log(`\n✅ ${syncCount}개 파일 동기화 완료.`);
            }
        }
        return;
    }

    // ═══════════════════════════════════════════════
    // 3.5. 업데이트 전략 선택 (incremental vs fresh-with-migration)
    //      Major 버전 diff ≥ 1 또는 마이그레이션 10개 초과 시
    //      fresh-with-migration 전략으로 전환
    // ═══════════════════════════════════════════════
    console.log('\n🎯 업데이트 전략 분석 중...');
    const strategy = await selectUpdateStrategy(
        current, version,
        `upstream/${current}`, `upstream/${version}`
    );
    console.log(`   전략: ${strategy.type}`);
    console.log(`   사유: ${strategy.reason}`);

    if (strategy.type === 'fresh-with-migration') {
        if (dryRun) {
            console.log('\n[DRY-RUN] Fresh-with-Migration 전략이 선택됨');
            console.log('   → 클라이언트 변경사항 추출 후 클린 설치 + DB 마이그레이션 실행 예정');
            return;
        }

        console.log('\n🔄 Fresh-with-Migration 전략으로 전환합니다...');
        const freshResult = await executeFreshWithMigration(
            current, version,
            { dryRun, forceBootstrap, autoMode }
        );

        // 스키마 Doctor 실행 (마이그레이션 후 누락 테이블/컬럼 보정)
        try {
            const doctorPath = path.join(PROJECT_ROOT, 'scripts', 'doctor.js');
            if (fs.existsSync(doctorPath)) {
                const { runSchemaDoctor, getDbNameFromWrangler } = await import(doctorPath);
                const dbNameForRepair = getDbNameFromWrangler();
                if (dbNameForRepair) {
                    await runSchemaDoctor(dbNameForRepair, { fix: true, verbose: true });
                }
            }
        } catch (e) {
            console.log(`   ⚠️  스키마 자동 복구 건너뜀: ${e.message}`);
        }

        // 자동 커밋
        await runCommand('git add -A', true);
        if (await hasStagedChanges()) {
            await runCommand(`git commit -m "Core update (fresh): ${current} → ${version}" --no-verify`, true);
            console.log(`\n✅ 완료: ${version} 적용됨 (Fresh-with-Migration)`);
        }

        // 후처리: npm install + db:migrate
        console.log('\n🔧 후처리: 배포 준비 완성 중...');
        try {
            console.log('   📦 npm install...');
            const npmRes = await runCommand('npm install', true, 120000);
            console.log(npmRes.success ? '   ✅ npm install 완료' : '   ⚠️  npm install 실패 — 수동 실행 필요');
        } catch { /* skip */ }
        try {
            const migRes = await runCommand('npm run db:migrate', true, 120000);
            console.log(migRes.success ? '   ✅ db:migrate 완료' : '   ⚠️  db:migrate 실패 — 수동 실행 필요');
        } catch { /* skip */ }

        console.log('\n════════════════════════════════════════════');
        console.log(`✅ Core Pull 완료: ${current} → ${version} (Fresh-with-Migration)`);
        if (freshResult.backupTag) {
            console.log(`🏷️  복구 태그: ${freshResult.backupTag}`);
        }
        if (freshResult.changes?.length > 0) {
            console.log('   .core/client-changes/ 에서 추출된 변경사항 확인');
        }
        console.log('   npm run dev 로 로컬 테스트하세요.');
        console.log('════════════════════════════════════════════');
        return;
    }

    // ═══════════════════════════════════════════════
    // 4. [Incremental] 업데이트 대상 파일 (현재태그 ↔ target 태그) 계산
    // ═══════════════════════════════════════════════
    const filesToUpdate = await gitDiffNameOnly(current, version, CORE_PATHS);

    if (filesToUpdate.length === 0) {
        console.log(`\n✅ 코어 파일 변경 없음. (${current} → ${version})`);
        await writeCoreVersion(version);
        return;
    }

    console.log(`\n📊 변경 대상 파일: ${filesToUpdate.length}개`);

    // ═══════════════════════════════════════════════
    // 5. 클라이언트가 코어를 수정한 파일 (현재코어태그 ↔ HEAD) 계산
    // ═══════════════════════════════════════════════
    const clientTouchedCore = await gitDiffNameOnly(current, 'HEAD', CORE_PATHS);

    // ═══════════════════════════════════════════════
    // 6. 충돌 = (업데이트 대상 ∩ 클라이언트 수정) - 실제 내용이 다른 것만
    // ═══════════════════════════════════════════════
    const potentialConflicts = intersect(filesToUpdate, clientTouchedCore)
        .filter(f => !isLocalPath(f)) // LOCAL은 충돌 대상 아님
        .filter(f => !f.startsWith('seeds/')); // seeds/*.sql은 항상 코어 우선 (데이터 추가용)

    // 실제 내용 비교로 진짜 충돌만 필터링
    const { realConflicts: conflicts, alreadySynced } = await filterRealConflicts(potentialConflicts, version);

    if (alreadySynced.length > 0) {
        console.log(`\n✅ 이미 동기화된 파일: ${alreadySynced.length}개 (충돌 아님)`);
    }

    let backupDir = null;
    if (conflicts.length > 0) {
        console.log(`\n⚠️  실제 충돌 감지: 코어 파일 ${conflicts.length}개가 로컬과 다름`);
        backupDir = await backupModifiedFiles(conflicts, current, version);

        // ═══════════════════════════════════════════════
        // Conflict handling (v1.35.7):
        // - Backup: always saved to .core-backup/ (above)
        // - _local auto-copy: REMOVED. Previously auto-copied conflicts
        //   to _local/, permanently blocking core updates.
        // - Decision: agent reviews after core:pull via audit-local.js
        //   and decides whether to restore from backup to _local/ or
        //   adopt the new core version.
        // ═══════════════════════════════════════════════
        if (!dryRun && conflicts.length > 0) {
            console.log(`\n   💡 충돌 파일 ${conflicts.length}개가 .core-backup/에 백업되었습니다.`);
            console.log(`   💡 이전 버전이 필요하면: .core-backup/ → src/pages/_local/ 로 복사`);
            console.log(`   💡 새 코어 버전을 사용하려면: 아무 작업 불필요 (기본값)`);
            for (const file of conflicts) {
                if (file.startsWith('src/pages/admin/')) {
                    console.log(`   ⏭️  ${file} (admin 페이지는 Core 버전 사용)`);
                }
                console.log(`   💡 코어는 정상 업데이트되고, 빌드 시 _local/ 버전이 우선 적용됩니다.`);
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 6.5. Drift 감지: 이전에 보호되었다가 해제된 파일 등
    //      upstream diff에 없지만 로컬과 upstream이 다른 파일 탐지
    // ═══════════════════════════════════════════════
    const driftedFiles = await detectDriftedFiles(version, filesToUpdate);
    if (driftedFiles.length > 0) {
        console.log(`\n🔄 Drift 감지: ${driftedFiles.length}개 파일이 upstream과 다름`);
        driftedFiles.forEach(f => console.log(`   📄 ${f}`));
    }

    // ═══════════════════════════════════════════════
    // 7. 파일 단위 적용 (삭제 포함)
    //    순서: PROTECTED → LOCAL → SPECIAL_MERGE → 일반 → ENGINE (마지막)
    //    ⚠️ .docking/engine/ 는 self-update 안전을 위해 마지막에 적용
    // ═══════════════════════════════════════════════
    const fileOps = await gitDiffNameStatus(current, version, CORE_PATHS);

    // Drift된 파일을 fileOps에 추가 (Add/Modify로 처리)
    for (const driftPath of driftedFiles) {
        if (!fileOps.some(op => op.path === driftPath)) {
            fileOps.push({ status: 'M', path: driftPath });
        }
    }
    let appliedCount = 0;
    let deletedCount = 0;
    let protectedCount = 0;
    let localCount = 0;
    const mergeQueue = [];
    const engineQueue = [];  // .docking/engine/ 파일은 마지막에 처리

    // dry-run용 분류
    const dryRunReport = {
        protected: [],
        local: [],
        willApply: [],
        willDelete: [],
        willMerge: [],
        engine: []
    };

    // ═══════════════════════════════════════════════
    // 4.5 Protected Pages Auto-Migration
    // config.yaml의 protected_pages에 지정된 페이지를
    // src/pages/_local/로 자동 복사 (이미 없는 경우에만)
    // Vite clinicLocalOverrides 플러그인이 빌드/dev 시 _local 우선 적용
    // ═══════════════════════════════════════════════
    const configYamlPath = path.join(PROJECT_ROOT, '.docking/config.yaml');
    if (fs.existsSync(configYamlPath)) {
        try {
            const configContent = fs.readFileSync(configYamlPath, 'utf8');
            const config = yaml.load(configContent);
            const protectedPages = config?.protected_pages || [];

            if (protectedPages.length > 0) {
                const localPagesDir = path.join(PROJECT_ROOT, 'src', 'pages', '_local');
                let migratedCount = 0;

                for (const pagePath of protectedPages) {
                    // pagePath example: "src/pages/doctors/index.astro"
                    if (!pagePath.startsWith('src/pages/')) continue;
                    // Admin 페이지는 protected_pages에 있어도 _local로 이전하지 않음
                    if (pagePath.startsWith('src/pages/admin/')) {
                        console.log(`   ⏭️  ${pagePath} (admin 페이지는 Core 버전 사용)`);
                        continue;
                    }

                    const relativePath = pagePath.replace(/^src\/pages\//, '');
                    const sourcePath = path.join(PROJECT_ROOT, pagePath);
                    const targetPath = path.join(localPagesDir, relativePath);

                    // Only migrate if source exists and target doesn't
                    if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
                        if (dryRun) {
                            console.log(`   📄 Would migrate: ${pagePath} → src/pages/_local/${relativePath}`);
                        } else {
                            fs.ensureDirSync(path.dirname(targetPath));
                            fs.copySync(sourcePath, targetPath);
                            console.log(`   📄 Migrated: ${pagePath} → src/pages/_local/${relativePath}`);
                        }
                        migratedCount++;
                    }
                }

                if (migratedCount > 0) {
                    console.log(`   ✅ ${migratedCount}개 페이지를 _local/로 보호 완료`);
                }
            }
        } catch (e) {
            console.log(`   ⚠️  protected_pages 처리 실패: ${e.message}`);
        }
    }

    if (dryRun) {
        console.log('\n📋 변경 예정 파일 분석 중...\n');
    } else {
        console.log('\n🔄 코어 파일 적용 중...');
    }

    // A1: Create rollback point before file application
    const rollbackTag = `core-pull-rollback-${Date.now()}`;
    if (!dryRun) {
        await runCommand('git add -A', true);
        if (await hasStagedChanges()) {
            await runCommand('git commit -m "checkpoint: pre-file-apply" --no-verify', true);
        }
        await runCommand(`git tag ${rollbackTag}`, true);
    }

    let fileApplyFailed = false;

    for (const op of fileOps) {
        const { status, path: filePath, oldPath } = op;

        // Rename: expand to delete old + add new
        if (status === 'R') {
            if (dryRun) {
                dryRunReport.willDelete.push({ status: 'D', path: oldPath });
                dryRunReport.willApply.push({ status: 'A', path: filePath });
            } else {
                // Delete old path
                const oldLocal = toLocalPath(oldPath);
                const fullOld = path.join(PROJECT_ROOT, oldLocal);
                if (fs.existsSync(fullOld)) {
                    fs.removeSync(fullOld);
                    deletedCount++;
                }
                // Restore new path from upstream
                try {
                    if (isBinaryFile(filePath)) {
                        await restoreBinaryFromUpstream(version, filePath);
                    } else {
                        await restoreFileFromUpstream(version, filePath);
                    }
                    appliedCount++;
                } catch (e) {
                    console.log(`   ⚠️  ${filePath}: 적용 실패 - ${e.message}`);
                }
            }
            continue;
        }

        // 1. PROTECTED_PATHS → 절대 건드리지 않음 (restore/delete 모두 차단)
        if (isProtectedPath(filePath)) {
            if (dryRun) {
                dryRunReport.protected.push({ status, path: filePath });
            } else {
                console.log(`   🔒 Protected: ${filePath}`);
            }
            protectedCount++;
            continue;
        }

        // 2. LOCAL_PREFIXES → 클라이언트 소유
        if (isLocalPath(filePath)) {
            if (dryRun) {
                dryRunReport.local.push({ status, path: filePath });
            }
            localCount++;
            continue;
        }

        // 3. SPECIAL_MERGE_FILES → 머지 큐에 추가
        if (isSpecialMergeFile(filePath)) {
            mergeQueue.push({ status, path: filePath });
            if (dryRun) {
                dryRunReport.willMerge.push({ status, path: filePath });
            }
            continue;
        }

        // 4. .docking/engine/ → 엔진 큐에 추가 (마지막에 처리)
        if (filePath.startsWith('.docking/engine/')) {
            engineQueue.push({ status, path: filePath });
            if (dryRun) {
                dryRunReport.engine.push({ status, path: filePath });
            }
            continue;
        }

        // 5. 일반 파일: restore/delete 적용
        if (dryRun) {
            if (status === 'D') {
                dryRunReport.willDelete.push({ status, path: filePath });
            } else {
                dryRunReport.willApply.push({ status, path: filePath });
            }
        } else {
            if (status === 'D') {
                // 삭제 시에는 로컬 경로 사용
                const localFilePath = toLocalPath(filePath);
                const fullPath = path.join(PROJECT_ROOT, localFilePath);
                if (fs.existsSync(fullPath)) {
                    fs.removeSync(fullPath);
                    deletedCount++;
                }
            } else {
                // 추가/수정: upstream에서 가져와서 로컬 경로에 저장
                try {
                    if (isBinaryFile(filePath)) {
                        await restoreBinaryFromUpstream(version, filePath);
                    } else {
                        await restoreFileFromUpstream(version, filePath);
                    }
                    appliedCount++;
                } catch (e) {
                    console.log(`   ⚠️  ${filePath}: 적용 실패 - ${e.message}`);
                    fileApplyFailed = true;
                }
            }
        }
    }

    // A1: Rollback if critical files failed during application
    if (fileApplyFailed && !dryRun) {
        console.log(`\n⚠️  일부 파일 적용 실패. 롤백 지점: ${rollbackTag}`);
        console.log('   자동 롤백을 수행하지 않습니다 (부분 적용은 대부분 안전).');
        console.log(`   수동 롤백: git reset --hard ${rollbackTag}`);
    }
    // Clean up rollback tag on success
    if (!fileApplyFailed && !dryRun) {
        await runCommand(`git tag -d ${rollbackTag}`, true);
    }

    // dry-run 리포트 출력
    if (dryRun) {
        console.log('═══════════════════════════════════════════════');
        console.log('📊 DRY-RUN 분석 결과');
        console.log('═══════════════════════════════════════════════\n');

        if (dryRunReport.protected.length > 0) {
            console.log(`🔒 보호됨 (변경 안 함): ${dryRunReport.protected.length}개`);
            dryRunReport.protected.forEach(f => console.log(`   - ${f.path}`));
            console.log('');
        }

        if (dryRunReport.willApply.length > 0) {
            console.log(`📝 적용 예정 (추가/수정): ${dryRunReport.willApply.length}개`);
            dryRunReport.willApply.forEach(f => console.log(`   - [${f.status}] ${f.path}`));
            console.log('');
        }

        if (dryRunReport.willDelete.length > 0) {
            console.log(`🗑️  삭제 예정: ${dryRunReport.willDelete.length}개`);
            dryRunReport.willDelete.forEach(f => console.log(`   - ${f.path}`));
            console.log('');
        }

        if (dryRunReport.willMerge.length > 0) {
            console.log(`🔀 머지 예정: ${dryRunReport.willMerge.length}개`);
            dryRunReport.willMerge.forEach(f => console.log(`   - ${f.path}`));
            console.log('');
        }

        if (dryRunReport.engine.length > 0) {
            console.log(`⚙️  엔진 업데이트 예정: ${dryRunReport.engine.length}개`);
            dryRunReport.engine.forEach(f => console.log(`   - [${f.status}] ${f.path}`));
            console.log('');
        }

        console.log('═══════════════════════════════════════════════');
        console.log('💡 실제 적용하려면: npm run core:pull');
        console.log('═══════════════════════════════════════════════\n');

        // JSON 출력 (AI 분석용)
        const jsonPath = path.join(PROJECT_ROOT, '.docking', 'dry-run-report.json');
        fs.writeJsonSync(jsonPath, {
            from: current,
            to: version,
            timestamp: new Date().toISOString(),
            ...dryRunReport
        }, { spaces: 2 });
        console.log(`📄 상세 리포트: ${jsonPath}`);

        return; // dry-run은 여기서 종료
    }

    // ═══════════════════════════════════════════════
    // 7.5. 특수 머지 파일 처리 (package.json 등)
    // ═══════════════════════════════════════════════
    for (const { status, path: filePath } of mergeQueue) {
        if (filePath === 'package.json') {
            console.log(`   🔀 Merging: ${filePath}`);
            await mergePackageJson(version);
            appliedCount++;
        }
    }

    // ═══════════════════════════════════════════════
    // 7.6. TASK-011: 엔진 파일 처리 (Atomic Update)
    // ⚠️ 현재 실행 중인 스크립트가 업데이트될 수 있음
    // Atomic Swap으로 안전하게 업데이트
    // ═══════════════════════════════════════════════
    if (engineQueue.length > 0) {
        const engineResult = await atomicEngineUpdate(version, engineQueue, runCommand);

        if (engineResult.success) {
            if (!engineResult.skipped) {
                appliedCount += engineQueue.length;
            }
        } else {
            console.log(`   \u26A0\uFE0F  \uC5D4\uC9C4 \uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328: ${engineResult.error}`);
            if (engineResult.rolledBack) {
                console.log('   \uD83D\uDD04 \uAE30\uC874 \uC5D4\uC9C4 \uBCF5\uC6D0\uB428 - \uC218\uB3D9 \uD655\uC778 \uD544\uC694');
            }
            if (engineResult.requiresManualRecovery) {
                console.log('   \u274C \uC218\uB3D9 \uBCF5\uAD6C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4!');
                console.log('   \u26A0\uFE0F  .docking/.engine-backup/ \uB514\uB809\uD1A0\uB9AC\uB97C \uD655\uC778\uD558\uC138\uC694.');
            }
        }
    }

    // ═══════════════════════════════════════════════
    // 7.7. CORE_PATHS Catch-Up Pass
    // 엔진 업데이트로 protection-manifest가 갱신되었을 수 있음
    // 새 CORE_PATHS에 추가된 경로의 파일을 보충 적용
    // (구 fetch.js의 CORE_PATHS에 없던 경로가 누락되는 문제 방지)
    // ═══════════════════════════════════════════════
    if (!dryRun && engineQueue.length > 0) {
        try {
            // Reload path rules from (possibly updated) manifest via SOT module
            const refreshedRules = pathRulesModule.loadPathRules(PROJECT_ROOT);
            const newCorePaths = refreshedRules.CORE_PATHS || [];
            const oldCorePathsSet = new Set(CORE_PATHS);
            const addedPaths = newCorePaths.filter(p => !oldCorePathsSet.has(p));

            if (addedPaths.length > 0) {

                if (addedPaths.length > 0) {
                    console.log(`\n   🔄 CORE_PATHS 확장 감지: ${addedPaths.length}개 신규 경로`);
                    addedPaths.forEach(p => console.log(`      + ${p}`));

                    const catchUpOps = await gitDiffNameStatus(current, version, addedPaths);
                    // Drift도 체크: diff에 없지만 upstream에 존재하는 파일
                    const catchUpResult = await runCommand(`git ls-tree -r --name-only ${version}`, true);
                    if (catchUpResult.success && catchUpResult.stdout) {
                        const allUpstream = catchUpResult.stdout.split('\n').filter(Boolean);
                        const catchUpDiffPaths = new Set(catchUpOps.map(op => op.path));
                        for (const f of allUpstream) {
                            if (catchUpDiffPaths.has(f)) continue;
                            if (!addedPaths.some(cp => f.startsWith(cp))) continue;
                            if (isProtectedPath(f) || isLocalPath(f)) continue;
                            const localFile = path.join(PROJECT_ROOT, toLocalPath(f));
                            if (!fs.existsSync(localFile)) {
                                catchUpOps.push({ status: 'A', path: f });
                            }
                        }
                    }

                    let catchUpCount = 0;
                    for (const op of catchUpOps) {
                        const filePath = op.path;
                        if (isProtectedPath(filePath) || isLocalPath(filePath)) continue;
                        if (op.status === 'D') {
                            const fullPath = path.join(PROJECT_ROOT, toLocalPath(filePath));
                            if (fs.existsSync(fullPath)) {
                                fs.removeSync(fullPath);
                                catchUpCount++;
                            }
                        } else {
                            try {
                                if (isBinaryFile(filePath)) {
                                    await restoreBinaryFromUpstream(version, filePath);
                                } else {
                                    await restoreFileFromUpstream(version, filePath);
                                }
                                catchUpCount++;
                            } catch (e) {
                                console.log(`   ⚠️  catch-up ${filePath}: ${e.message}`);
                            }
                        }
                    }

                    if (catchUpCount > 0) {
                        console.log(`   ✅ Catch-up: ${catchUpCount}개 파일 보충 적용`);
                        appliedCount += catchUpCount;
                    }
                }
            }
        } catch (e) {
            console.log(`   ⚠️  CORE_PATHS catch-up 건너뜀: ${e.message}`);
        }
    }

    if (!dryRun && IS_STARTER_KIT) {
        const coreInfraSync = await syncCoreInfrastructureForStarterKit();
        if (coreInfraSync?.copied > 0) {
            console.log(`   ✅ core 인프라 동기화: ${coreInfraSync.copied}개 경로`);
        }
    }

    console.log(`\n   \u2705 \uC801\uC6A9: ${appliedCount}\uAC1C, \uC0AD\uC81C: ${deletedCount}\uAC1C`);
    console.log(`   \u23ED\uFE0F  \uC2A4\uD0B5: protected=${protectedCount}, local=${localCount}`);

    // ═══════════════════════════════════════════════
    // 7.9. TASK-010: Pre-flight 스키마 검증
    // ═══════════════════════════════════════════════
    if (!dryRun) {
        const schemaState = await verifyMigrationState({ force });

        if (!schemaState.isValid) {
            printStateReport(schemaState);
            throw new Error('\uC2A4\uD0A4\uB9C8 \uC0C1\uD0DC \uBD88\uC77C\uCE58. --force \uC635\uC158\uC73C\uB85C \uAC15\uC81C \uC9C4\uD589 \uAC00\uB2A5\uD569\uB2C8\uB2E4.');
        }

        if (schemaState.hasSchemaConflict && force) {
            printStateReport(schemaState);
            console.log('\n   \u26A0\uFE0F  --force \uC635\uC158\uC73C\uB85C \uAC15\uC81C \uC9C4\uD589\uD569\uB2C8\uB2E4.\n');
        }
    }

    // ═══════════════════════════════════════════════
    // 8. 로컬 D1 DB 상태 확인 + 마이그레이션/시드
    // ═══════════════════════════════════════════════
    const dbReady = await ensureLocalDb();

    if (dbReady) {
        const migResult = await runAllMigrations(forceBootstrap);

        // 8.1. 스키마 자동 복구 (마이그레이션 후 누락 테이블/컬럼 보정)
        try {
            const doctorPath = path.join(PROJECT_ROOT, 'scripts', 'doctor.js');
            if (fs.existsSync(doctorPath)) {
                const { runSchemaDoctor, getDbNameFromWrangler } = await import(doctorPath);
                const dbNameForRepair = getDbNameFromWrangler();
                if (dbNameForRepair) {
                    const schemaResult = await runSchemaDoctor(dbNameForRepair, { fix: true, verbose: true });
                    if (schemaResult.ok) {
                        console.log('   ✅ 스키마 검증 완료');
                    }
                }
            }
        } catch (e) {
            console.log(`   ⚠️  스키마 자동 복구 건너뜀: ${e.message}`);
        }

        // 8.5. Seeds 실행 (마이그레이션 성공 시에만)
        if (migResult?.success !== false) {
            await runAllSeeds();
        } else {
            console.log('   ⚠️  마이그레이션 실패로 seeds를 건너뜁니다.');
            console.log('   💡 문제 해결 후 npm run db:seed로 수동 실행하세요.');
            await reportError({
                phase: 'migration',
                error: '마이그레이션 실패로 seeds 실행을 건너뜀',
                version,
                recovery: {
                    workflow: '.agent/workflows/troubleshooting.md',
                    section: '6',
                    suggestion: 'DB 상태 확인 후 마이그레이션 재실행',
                    commands: ['npm run doctor', 'npm run db:migrate', 'npm run db:seed']
                }
            });
        }
    }

    // ═══════════════════════════════════════════════
    // 9. 메타데이터 업데이트 (.core/version)
    // ═══════════════════════════════════════════════
    await writeCoreVersion(version);

    // ═══════════════════════════════════════════════
    // 9.0.1. CLAUDE.local.md → CLAUDE.md 매핑
    // 마스터 CLAUDE.md는 메타 에이전트용. 클라이언트는 CLAUDE.local.md를 CLAUDE.md로 사용.
    // ═══════════════════════════════════════════════
    try {
        const claudeLocalPath = path.join(PROJECT_ROOT, 'CLAUDE.local.md');
        const claudeMdPath = path.join(PROJECT_ROOT, 'CLAUDE.md');
        if (fs.existsSync(claudeLocalPath)) {
            fs.copyFileSync(claudeLocalPath, claudeMdPath);
            console.log('   📝 CLAUDE.local.md → CLAUDE.md (agent execution guide updated)');
        }
    } catch (e) {
        console.log(`   ⚠️  CLAUDE.md 매핑 실패: ${e.message}`);
    }

    // ═══════════════════════════════════════════════
    // 9.1. Content Doctor: prevent recurring build breaks
    // - Some files have historically been corrupted into a single path string
    //   (e.g. "../../../features/.../members.ts") or symlink loops.
    // - Fix by restoring the real upstream content.
    // ═══════════════════════════════════════════════
    try {
        const DOCTOR_TARGETS = [
            'src/pages/api/vip-management/members.ts',
            'src/features/vip-management/api/members.ts',
        ];

        for (const upstreamPath of DOCTOR_TARGETS) {
            const localPath = toLocalPath(upstreamPath);
            const fullLocalPath = path.join(PROJECT_ROOT, localPath);

            if (!fs.existsSync(fullLocalPath)) continue;

            // If it's a symlink, unlink and restore (avoids ELOOP during Astro route scan)
            try {
                const st = fs.lstatSync(fullLocalPath);
                if (st.isSymbolicLink()) {
                    fs.unlinkSync(fullLocalPath);
                    await restoreFileFromUpstream(version, upstreamPath);
                    console.log(`   🩺 Doctor: restored symlinked file from upstream: ${localPath}`);
                    continue;
                }
            } catch {
                // ignore
            }

            // If file content looks like a pointer/path-only stub, restore.
            try {
                const raw = String(fs.readFileSync(fullLocalPath, 'utf8') || '');
                const trimmed = raw.trim();
                const looksLikePointer =
                    trimmed.length > 0 &&
                    trimmed.length < 200 &&
                    (trimmed.startsWith('../') || trimmed.startsWith('./')) &&
                    !trimmed.includes('export') &&
                    !trimmed.includes('import');

                if (looksLikePointer) {
                    await restoreFileFromUpstream(version, upstreamPath);
                    console.log(`   🩺 Doctor: restored pointer-stub file from upstream: ${localPath}`);
                }
            } catch {
                // ignore
            }
        }
    } catch (e) {
        console.log(`   ⚠️  Content doctor skipped: ${e.message}`);
    }

    // ═══════════════════════════════════���═══════════
    // 10. 자동 커밋 (변경 없으면 커밋 생략)
    // ═══════════════════════════════════════════════
    await runCommand('git add -A', true);

    if (await hasStagedChanges()) {
        await runCommand(`git commit -m "Core update: ${version}" --no-verify`, true);
        console.log(`\n✅ 완료: ${version} 적용됨`);
    } else {
        console.log(`\nℹ️  적용 결과 변경사항이 없어 커밋을 생략했습니다. (버전: ${version})`);
    }

    // 충돌 안내
    if (backupDir) {
        printMigrationGuide(conflicts, backupDir);
    }

    // ═══════════════════════════════════════════════
    // 11. 후처리: npm install + db:migrate (배포 준비 완성)
    // ═══════════════════════════════════════════════
    console.log('\n🔧 후처리: 배포 준비 완성 중...');

    // npm install (package.json이 변경되었거나 node_modules가 오래된 경우)
    try {
        const pkgMtime = fs.statSync(path.join(PROJECT_ROOT, 'package.json')).mtimeMs;
        const nmPath = path.join(PROJECT_ROOT, 'node_modules');
        const nmExists = fs.existsSync(nmPath);
        const nmStale = nmExists && fs.statSync(nmPath).mtimeMs < pkgMtime;
        if (!nmExists || nmStale) {
            console.log('   📦 npm install (package.json 변경됨)...');
            const npmResult = await runCommand('npm install', true, 120000);
            if (npmResult.success) {
                console.log('   ✅ npm install 완료');
            } else {
                console.log('   ⚠️  npm install 실패 — 수동 실행 필요: npm install');
            }
        }
    } catch {
        // stat 실패 시 건너뜀
    }

    // db:migrate (로컬 DB 동기화)
    try {
        const migrateResult = await runCommand('npm run db:migrate', true, 120000);
        if (migrateResult.success) {
            console.log('   ✅ db:migrate 완료');
        } else {
            console.log('   ⚠️  db:migrate 실패 — 수동 실행 필요: npm run db:migrate');
        }
    } catch {
        // 건너뜀
    }

    console.log('\n════════════════════════════════════════════');
    console.log(`✅ Core Pull 완료: ${current} → ${version}`);
    console.log('   npm run dev 로 로컬 테스트하세요.');
    console.log('════════════════════════════════════════════');

    await refreshAgentRuntimeContext();

    // _local 감사 — stale 오버라이드 감지
    try {
        const auditPath = path.join(PROJECT_ROOT, 'scripts', 'audit-local.js');
        if (fs.existsSync(auditPath)) {
            console.log('\n🔍 _local 오버라이드 감사 실행 중...');
            const { execFileSync } = await import('child_process');
            execFileSync('node', [auditPath], { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 10000 });
        }
    } catch {
        // audit-local이 exit 1 (stale 발견)이면 정상 — 에이전트에게 보고됨
    }

    // 성공 시 이전 에러 보고서 삭제
    await clearErrorReport();
}

// ═══════════════════════════════════════════════════════════════
// Preflight Check (드라이런 + 사용자 확인)
// ═══════════════════════════════════════════════════════════════

async function preflightCheck(targetVersion = 'latest') {
    console.log('🔍 Clinic-OS Core Pull Preflight Check\n');

    // 스타터킷 구조 감지 로그
    if (IS_STARTER_KIT) {
        console.log('📦 스타터킷 구조 감지됨 (core/ 폴더 사용)\n');
    }

    // 1. HQ 인증 및 upstream 등록/업데이트 후 fetch tags
    console.log('🔑 HQ에서 인증된 Git URL 가져오는 중...');
    const gitUrl = await getAuthenticatedGitUrl();
    if (gitUrl) {
        await ensureUpstreamRemote(gitUrl);
    } else {
        const hasUpstream = await hasUpstreamRemote();
        if (!hasUpstream) {
            return { needsUpdate: false, error: 'upstream remote가 없고 HQ 인증도 실패했습니다.\n   → npm run setup을 실행하여 디바이스를 등록하세요.' };
        }
    }

    console.log('📥 upstream 태그를 가져오는 중...');
    const fetchResult = await runCommand('git fetch upstream --tags --force', true);
    if (!fetchResult.success) {
        return { needsUpdate: false, error: 'upstream fetch 실패. 네트워크 연결 또는 인증을 확인하세요.' };
    }

    // 2. 타겟 버전 결정
    let version;
    try {
        if (targetVersion === 'latest' || targetVersion === 'stable') {
            version = await getChannelVersion('stable');
        } else if (targetVersion === 'beta') {
            version = await getChannelVersion('beta');
        } else {
            version = targetVersion;
        }
        await assertTagExists(version);
    } catch (e) {
        return { needsUpdate: false, error: e.message };
    }

    // 3. 현재 버전 확인
    let current;
    try {
        current = await readCoreVersion();
        await assertTagExists(current);
    } catch (e) {
        return { needsUpdate: false, error: e.message };
    }

    console.log(`\n   📌 현재 버전: ${current}`);
    console.log(`   🎯 타겟 버전: ${version}`);

    // 3.5 스타터 호환성 검사 (차단)
    if (IS_STARTER_KIT) {
        try {
            const starterVer = readStarterVersion();
            const upstreamPkgResult = await runCommand(`git show upstream/${version}:package.json`, true);
            if (upstreamPkgResult.success) {
                const upstreamPkg = JSON.parse(upstreamPkgResult.stdout);
                const minStarter = upstreamPkg?.clinicOs?.minStarterVersion;
                if (minStarter && semverLt(starterVer, minStarter)) {
                    console.log(`\n   ❌ 스타터 ${starterVer} < 최소 요구 ${minStarter}`);
                    console.log(`   👉 먼저 실행: npm run update:starter`);
                    return { needsUpdate: false, blocked: true, reason: 'starter_outdated', starterVer, minStarter };
                }
            }
        } catch { /* 호환성 검사 실패 무시 */ }
    }

    // 4. 버전 동일 여부 확인
    if (current === version) {
        // Drift 감지: 버전은 같지만 누락/변경된 파일이 있을 수 있음
        const driftedFiles = await detectDriftedFiles(version, []);
        if (driftedFiles.length > 0) {
            console.log(`\n⚠️  버전은 최신이지만 ${driftedFiles.length}개 파일이 누락/변경됨`);
            driftedFiles.forEach(f => console.log(`   📄 ${f}`));
            return { needsUpdate: true, current, target: version, driftOnly: true };
        }
        console.log(`\n✅ 이미 최신 버전입니다. (${current})`);
        return { needsUpdate: false, current, target: version };
    }

    // 5. 변경 대상 파일 계산
    const filesToUpdate = await gitDiffNameOnly(current, version, CORE_PATHS);

    if (filesToUpdate.length === 0) {
        console.log(`\n✅ 코어 파일 변경 없음. (${current} → ${version})`);
        return { needsUpdate: false, current, target: version };
    }

    // 6. 클라이언트 수정 파일 계산
    const clientTouchedCore = await gitDiffNameOnly(current, 'HEAD', CORE_PATHS);

    // 7. 충돌 계산 - 실제 내용이 다른 것만
    const potentialConflicts = intersect(filesToUpdate, clientTouchedCore)
        .filter(f => !isLocalPath(f))
        .filter(f => !f.startsWith('seeds/')); // seeds/*.sql은 항상 코어 우선

    const { realConflicts: conflicts, alreadySynced } = await filterRealConflicts(potentialConflicts, version);

    // 7.5. Drift 감지
    const driftedFiles = await detectDriftedFiles(version, filesToUpdate);

    // 8. 상세 분석
    const fileOps = await gitDiffNameStatus(current, version, CORE_PATHS);

    // Drift된 파일을 fileOps에 추가
    for (const driftPath of driftedFiles) {
        if (!fileOps.some(op => op.path === driftPath)) {
            fileOps.push({ status: 'M', path: driftPath });
        }
    }

    const analysis = {
        protected: [],
        local: [],
        willApply: [],
        willDelete: [],
        willMerge: [],
        engine: [],
        drifted: []
    };

    for (const op of fileOps) {
        const { status, path: filePath, oldPath } = op;
        // Rename: treat as delete old + add new
        if (status === 'R') {
            analysis.willDelete.push({ status: 'D', path: oldPath });
            analysis.willApply.push({ status: 'A', path: filePath });
            continue;
        }
        if (isProtectedPath(filePath)) {
            analysis.protected.push({ status, path: filePath });
        } else if (isLocalPath(filePath)) {
            analysis.local.push({ status, path: filePath });
        } else if (isSpecialMergeFile(filePath)) {
            analysis.willMerge.push({ status, path: filePath });
        } else if (filePath.startsWith('.docking/engine/')) {
            analysis.engine.push({ status, path: filePath });
        } else if (status === 'D') {
            analysis.willDelete.push({ status, path: filePath });
        } else {
            analysis.willApply.push({ status, path: filePath });
        }
    }

    // Drift된 파일을 별도 표시
    analysis.drifted = driftedFiles;

    // 9. 결과 출력
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 Preflight 분석 결과');
    console.log('═══════════════════════════════════════════════\n');

    console.log(`📦 버전 업데이트: ${current} → ${version}\n`);

    if (alreadySynced.length > 0) {
        console.log(`✅ 이미 동기화됨: ${alreadySynced.length}개 파일 (충돌 아님)`);
    }

    if (conflicts.length > 0) {
        console.log(`⚠️  실제 충돌: ${conflicts.length}개 파일`);
        conflicts.forEach(f => console.log(`   - ${f}`));
        console.log('   → 업데이트 시 로컬 변경사항이 백업됩니다.\n');
    } else {
        console.log('✅ 실제 충돌 없음\n');
    }

    if (driftedFiles.length > 0) {
        console.log(`🔄 Drift 감지: ${driftedFiles.length}개 파일 (upstream과 로컬 불일치)`);
        driftedFiles.forEach(f => console.log(`   - ${f}`));
        console.log('   → 업데이트 시 upstream 버전으로 동기화됩니다.\n');
    }

    console.log(`📝 적용 예정: ${analysis.willApply.length}개 (추가/수정)`);
    console.log(`🗑️  삭제 예정: ${analysis.willDelete.length}개`);
    console.log(`🔀 머지 예정: ${analysis.willMerge.length}개`);
    console.log(`⚙️  엔진 업데이트: ${analysis.engine.length}개`);
    console.log(`🔒 보호됨 (변경 안 함): ${analysis.protected.length}개`);

    console.log('\n═══════════════════════════════════════════════\n');

    return {
        needsUpdate: true,
        current,
        target: version,
        conflicts,
        analysis,
        summary: {
            apply: analysis.willApply.length,
            delete: analysis.willDelete.length,
            merge: analysis.willMerge.length,
            engine: analysis.engine.length,
            protected: analysis.protected.length
        }
    };
}


// ═══════════════════════════════════════════════════════════════
// Smart Update Fallback 함수들
// smart-update.js가 없을 때 사용되는 내장 구현
// ⚠️ POSITION: Must be AFTER wrapper bindings (line ~210) because fallbacks
//    use runCommand, isCorePath, isLocalPath, suggestLocalPath, etc.
//    Must be BEFORE main() call. ESM top-level executes sequentially.
// ═══════════════════════════════════════════════════════════════

if (!selectUpdateStrategy) {
    selectUpdateStrategy = async function(currentVersion, targetVersion, currentTag, targetTag) {
        const migrationResult = await runCommand(
            `git diff --name-only ${currentTag} ${targetTag} -- migrations/`,
            true
        );
        const migrationCount = migrationResult.success
            ? migrationResult.stdout.split('\n').filter(f => f.endsWith('.sql')).length
            : 0;

        const diff = calculateVersionDiff(currentVersion, targetVersion, migrationCount);
        const isMajorUpdate = diff.major >= 1;
        const isManyMigrations = migrationCount > 10;

        if (isMajorUpdate || isManyMigrations) {
            return {
                type: 'fresh-with-migration', backup: true, extractClientChanges: true,
                schemaReset: true,
                reason: isMajorUpdate ? `Major version diff (${diff.major})` : `Too many migrations (${migrationCount} > 10)`
            };
        }
        return {
            type: 'incremental', backup: false, extractClientChanges: false,
            schemaReset: false,
            reason: `Minor update (${diff.major}.${diff.minor}.${diff.patch}, migrations: ${migrationCount})`
        };
    };
}

if (!extractClientChanges) {
    extractClientChanges = async function(currentTag) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const changesDir = path.join(PROJECT_ROOT, '.core', 'client-changes', timestamp);
        console.log(`\n📦 클라이언트 변경사항 추출 중...`);
        const diffResult = await runCommand(`git diff upstream/${currentTag} HEAD --name-only`, true);
        if (!diffResult.success || !diffResult.stdout) {
            console.log('   ⚠️  변경사항 추출 실패');
            return { changes: [], changesDir: null, timestamp };
        }
        const allFiles = diffResult.stdout.split('\n').filter(Boolean);
        const coreModifications = allFiles.filter(f => isCorePath(f) && !isLocalPath(f) && !isProtectedPath(f));
        if (coreModifications.length === 0) {
            console.log('   ℹ️  추출할 클라이언트 변경사항 없음');
            return { changes: [], changesDir: null, timestamp };
        }
        fs.ensureDirSync(changesDir);
        const changes = [];
        for (const file of coreModifications) {
            const dr = await runCommand(`git diff upstream/${currentTag} HEAD -- "${file}"`, true);
            if (dr.success && dr.stdout) {
                changes.push({
                    file, diff: dr.stdout,
                    type: dr.stdout.startsWith('new file') ? 'add' : dr.stdout.includes('deleted file') ? 'delete' : 'modify',
                    suggestedLocalPath: suggestLocalPath(file)
                });
                fs.writeFileSync(path.join(changesDir, `${file.replace(/[\/\\]/g, '_')}.diff`), dr.stdout, 'utf8');
            }
        }
        fs.writeJsonSync(path.join(changesDir, 'manifest.json'), {
            timestamp, extractedAt: new Date().toISOString(), currentTag,
            changes: changes.map(c => ({ file: c.file, type: c.type, suggestedLocalPath: c.suggestedLocalPath }))
        }, { spaces: 2 });
        console.log(`   ✅ ${changes.length}개 파일 추출 완료: .core/client-changes/${timestamp}/`);
        return { changes, changesDir, timestamp };
    };
}

if (!executeFreshWithMigration) {
    executeFreshWithMigration = async function(currentVersion, targetVersion, options = {}) {
        const { dryRun = false, forceBootstrap = false, autoMode = false } = options;
        console.log('\n═══════════════════════════════════════════════');
        console.log('🔄 Fresh-with-Migration 전략 실행');
        console.log('═══════════════════════════════════════════════\n');

        // 1. 클라이언트 변경사항 추출 (리셋 전)
        const { changes, changesDir, timestamp } = await extractClientChanges(currentVersion);

        // 2. 백업 태그 생성
        let backupTag = null;
        if (!dryRun) {
            const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
            const tagName = `backup/pre-update-${currentVersion}-${ts}`;
            const tagResult = await runCommand(`git tag -a "${tagName}" -m "Auto backup before core update from ${currentVersion}"`, true);
            if (tagResult.success) { backupTag = tagName; console.log(`   ✅ 백업 태그: ${tagName}`); }
        }

        if (!dryRun) {
            // 3. 새 버전 클린 설치
            console.log(`\n📥 새 버전 클린 설치: ${targetVersion}`);
            const filesResult = await runCommand(`git ls-tree -r --name-only upstream/${targetVersion} -- ${CORE_PATHS.join(' ')}`, true);
            if (filesResult.success && filesResult.stdout) {
                let cnt = 0;
                for (const file of filesResult.stdout.split('\n').filter(Boolean)) {
                    if (isProtectedPath(file) || isLocalPath(file)) continue;
                    try {
                        if (isBinaryFile(file)) await restoreBinaryFromUpstream(targetVersion, file);
                        else await restoreFileFromUpstream(targetVersion, file);
                        cnt++;
                    } catch (e) { console.log(`   ⚠️  ${file}: ${e.message}`); }
                }
                console.log(`   ✅ ${cnt}개 파일 설치 완료`);
            }

            // 4. 추출된 변경사항을 _local/ 경로로 자동 마이그레이션
            if (changes.length > 0) {
                console.log(`\n🔄 변경사항을 local/* 경로로 마이그레이션...`);
                let migratedCount = 0;
                for (const change of changes) {
                    const { file: changeFile, suggestedLocalPath } = change;
                    if (!suggestedLocalPath) continue;
                    const sourcePath = path.join(PROJECT_ROOT, toLocalPath(changeFile));
                    const targetPath = path.join(PROJECT_ROOT, suggestedLocalPath);
                    // 원본이 없거나 대상이 이미 있으면 스킵
                    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) continue;
                    try {
                        fs.ensureDirSync(path.dirname(targetPath));
                        fs.copySync(sourcePath, targetPath);
                        migratedCount++;
                        console.log(`   ✅ ${changeFile} → ${suggestedLocalPath}`);
                    } catch (e) {
                        console.log(`   ⚠️  ${changeFile}: ${e.message}`);
                    }
                }
                if (migratedCount > 0) {
                    console.log(`   → ${migratedCount}개 파일 마이그레이션 완료`);
                }
            }

            // 5. package.json 스마트 머지 + DB 마이그레이션 + 시드
            await mergePackageJson(targetVersion);
            const dbReady2 = await ensureLocalDb();
            if (dbReady2) {
                await runAllMigrations(forceBootstrap);
                await runAllSeeds();
            }
            await writeCoreVersion(targetVersion);
        }

        console.log('\n═══════════════════════════════════════════════');
        console.log('✅ Fresh-with-Migration 완료');
        if (changesDir) {
            console.log(`📦 변경사항 백업: .core/client-changes/${timestamp}/`);
        }
        if (backupTag) {
            console.log(`🏷️  복구 태그: ${backupTag}`);
        }
        console.log('═══════════════════════════════════════════════\n');
        return { success: true, changes, backupTag };
    };
}

async function main() {
    const args = process.argv.slice(2);
    let targetVersion = 'latest';  // 기본값: stable 채널
    let dryRun = false;
    let skipConfirm = false;
    let checkOnly = false;
    let force = false;
    let forceBootstrap = false;
    let autoMode = false;

    for (const arg of args) {
        if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--beta') {
            targetVersion = 'beta';
        } else if (arg === '--stable') {
            targetVersion = 'stable';
        } else if (arg.startsWith('--version=')) {
            targetVersion = arg.split('=')[1];
        } else if (arg.startsWith('v')) {
            targetVersion = arg;
        } else if (arg === '-y' || arg === '--yes') {
            skipConfirm = true;
        } else if (arg === '--check') {
            checkOnly = true;
        } else if (arg === '--force') {
            force = true;
        } else if (arg === '--force-bootstrap') {
            forceBootstrap = true;
        } else if (arg === '--auto') {
            autoMode = true;
        }
    }

    // Auto 모드 감지 (환경 변수 포함)
    autoMode = autoMode || isAutoMode(args);

    try {
        // --dry-run: 기존 동작 (상세 분석 후 종료)
        if (dryRun) {
            await corePull(targetVersion, { dryRun: true, force, forceBootstrap });
            return;
        }

        // --check: preflight만 실행하고 종료
        if (checkOnly) {
            const result = await preflightCheck(targetVersion);
            if (result.error) {
                console.error('\n❌ Error:', result.error);
                process.exit(1);
            }
            if (!result.needsUpdate) {
                process.exit(0);
            }
            console.log('💡 업데이트를 적용하려면: npm run core:pull');
            process.exit(0);
        }

        // 기본 동작: preflight → 확인 → 적용
        const result = await preflightCheck(targetVersion);

        if (result.error) {
            console.error('\n❌ Error:', result.error);
            process.exit(1);
        }

        if (!result.needsUpdate) {
            process.exit(0);
        }

        // 확인 프롬프트 (--yes 또는 --auto 또는 CI 환경에서는 스킵)
        if (!skipConfirm && !autoMode) {
            const confirmed = await promptUserConfirmation('업데이트를 진행하시겠습니까?');
            if (!confirmed) {
                console.log('\n⏹️  업데이트가 취소되었습니다.');
                process.exit(0);
            }
        } else if (autoMode) {
            console.log('   🤖 Auto 모드: 자동으로 진행합니다.');
        }

        // 실제 업데이트 진행
        console.log('\n');
        await corePull(result.target, { dryRun: false, force, forceBootstrap, autoMode });

        // 스키마 자동복구는 corePull 내부에서 이미 완료
        // 추가 Doctor 실행 불필요 (중복 실행 방지)

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        // 아직 보고되지 않은 에러만 보고 (이미 reportError 호출된 경우 중복 방지)
        const errorPath = path.join(PROJECT_ROOT, '.agent', 'last-error.json');
        if (!fs.existsSync(errorPath)) {
            await reportError({
                phase: 'unknown',
                error: error.message,
                recovery: {
                    workflow: '.agent/workflows/troubleshooting.md',
                    suggestion: 'npm run health로 전체 진단 실행',
                    commands: ['npm run health', 'npm run core:pull']
                }
            });
        }
        process.exit(1);
    }
}

// 사용법:
// npm run core:pull                   → preflight 체크 후 확인 받고 적용 (기본)
// npm run core:pull -- -y             → 확인 없이 바로 적용
// npm run core:pull -- --auto         → CI/에이전트 모드 (자동, 전략 선택)
// npm run core:pull -- --check        → preflight 체크만 (적용 안 함)
// npm run core:pull -- --beta         → latest-beta 채널
// npm run core:pull -- --dry-run      → 상세 변경 사항 미리보기 (기존 동작)
// npm run core:pull -- v1.0.93        → 특정 버전 직접 지정
// npm run core:pull -- --force           → 건강 점수 미달 시 강제 진행
// npm run core:pull -- --force-bootstrap → 마이그레이션 bootstrap 모드 강제 실행
//
// 환경 변수:
// CI=true 또는 CLINIC_OS_AUTO=true    → --auto 플래그와 동일

main();
