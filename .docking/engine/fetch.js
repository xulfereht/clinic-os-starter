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
let errorRecoveryModulePromise = null;

// ═══════════════════════════════════════════════════════════════
// 에러 보고 시스템 — .agent/last-error.json
// 에이전트가 프로젝트를 열면 이 파일을 감지하여 자동 복구 진입
// ═══════════════════════════════════════════════════════════════

async function loadErrorRecoveryModule() {
    if (!errorRecoveryModulePromise) {
        const moduleUrl = pathToFileURL(path.join(PROJECT_ROOT, 'scripts', 'lib', 'error-recovery.mjs')).href;
        errorRecoveryModulePromise = import(moduleUrl).catch(() => null);
    }
    return errorRecoveryModulePromise;
}

async function reportError({ phase, error, recovery, version, command }) {
    try {
        const helpers = await loadErrorRecoveryModule();
        const resolvedCommand = command || `npm run core:pull -- ${process.argv.slice(2).join(' ')}`.trim();

        if (helpers?.recordStructuredError) {
            await helpers.recordStructuredError({
                projectRoot: PROJECT_ROOT,
                phase: phase || 'unknown',
                error,
                command: resolvedCommand,
                context: {
                    coreVersion: version || null,
                    isStarterKit: typeof IS_STARTER_KIT !== 'undefined' ? IS_STARTER_KIT : null,
                    projectRoot: PROJECT_ROOT,
                },
                recovery: recovery || {
                    workflow: '.agent/workflows/troubleshooting.md',
                    commands: ['npm run health'],
                },
                source: 'core-pull',
            });
        } else {
            const errorReport = {
                timestamp: new Date().toISOString(),
                command: resolvedCommand,
                phase: phase || 'unknown',
                error: {
                    message: typeof error === 'string' ? error : error?.message || String(error),
                    stack: typeof error === 'object' ? error?.stack || null : null,
                    code: typeof error === 'object' ? error?.code || 'UNKNOWN' : 'UNKNOWN',
                },
                context: {
                    coreVersion: version || null,
                    isStarterKit: typeof IS_STARTER_KIT !== 'undefined' ? IS_STARTER_KIT : null,
                    projectRoot: PROJECT_ROOT,
                },
                recovery: recovery || {
                    workflow: '.agent/workflows/troubleshooting.md',
                    commands: ['npm run health'],
                },
                attempts: [],
            };

            const errorPath = path.join(PROJECT_ROOT, '.agent', 'last-error.json');
            fs.ensureDirSync(path.dirname(errorPath));
            fs.writeJsonSync(errorPath, errorReport, { spaces: 2 });
        }

        console.log('\n   ╔══════════════════════════════════════════════════╗');
        console.log('   ║  📋 에러 보고서: .agent/last-error.json         ║');
        console.log('   ║  🤖 에이전트는 이 파일을 읽고 자동 복구하세요   ║');
        console.log('   ║  📖 참조: .agent/workflows/troubleshooting.md   ║');
        console.log('   ╚══════════════════════════════════════════════════╝');
    } catch (e) {
        // 에러 보고서 저장 실패는 무시 (원래 에러가 더 중요)
    }
}

/**
 * 에러 보고서 삭제 (성공적 완료 후)
 */
async function clearErrorReport() {
    try {
        const helpers = await loadErrorRecoveryModule();
        if (helpers?.clearLastError) {
            await helpers.clearLastError(PROJECT_ROOT);
        } else {
            const errorPath = path.join(PROJECT_ROOT, '.agent', 'last-error.json');
            if (fs.existsSync(errorPath)) {
                fs.removeSync(errorPath);
            }
        }
    } catch (e) {
        // 삭제 실패는 무시
    }
}

async function refreshAgentRuntimeContext() {
    const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'generate-agent-context.js');
    if (!fs.existsSync(scriptPath)) return;

    const result = await runCommand('node scripts/generate-agent-context.js --quiet', true, 30000);
    if (!result.success) {
        console.log(`   ⚠️  agent runtime context 갱신 실패: ${result.stderr || 'unknown error'}`);
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

// ═══════════════════════════════════════════════════════════════
// 스타터킷 구조 감지
// ═══════════════════════════════════════════════════════════════

/**
 * 스타터킷 구조인지 감지
 * - core/package.json이 존재하면 스타터킷 구조
 * - HQ(flat)와 클라이언트(nested) 구조를 구분
 */
function detectStarterKitStructure() {
    const corePackageJson = path.join(PROJECT_ROOT, 'core', 'package.json');
    return fs.existsSync(corePackageJson);
}

// 스타터킷 구조 여부 (전역 상수로 한 번만 감지)
const IS_STARTER_KIT = detectStarterKitStructure();
const CORE_DIR = IS_STARTER_KIT ? 'core/' : '';

// ═══════════════════════════════════════════════════════════════
// Protection Rules — loaded from manifest (SOT)
// Fallback to hardcoded values if manifest not found (bootstrap)
// SOT: .docking/protection-manifest.yaml
// ═══════════════════════════════════════════════════════════════
let CORE_PATHS, LOCAL_PREFIXES, PROTECTED_EXACT, PROTECTED_PREFIXES, SPECIAL_MERGE_FILES;

try {
    const manifestPath = path.join(PROJECT_ROOT, '.docking/protection-manifest.yaml');
    const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
    CORE_PATHS = manifest.core_paths;
    LOCAL_PREFIXES = manifest.local_prefixes;
    PROTECTED_EXACT = new Set(manifest.protected_exact);
    PROTECTED_PREFIXES = manifest.protected_prefixes;
    SPECIAL_MERGE_FILES = new Set(manifest.special_merge);
} catch (e) {
    // Fallback: bootstrap 또는 manifest 미존재 시 (하드코딩 값 유지)
    CORE_PATHS = [
        'src/pages/', 'src/components/', 'src/layouts/', 'src/styles/',
        'src/lib/', 'src/plugins/custom-homepage/', 'src/plugins/survey-tools/',
        'src/survey-tools/stress-check/', 'src/content/aeo/',
        'migrations/', 'seeds/', 'docs/',
        '.agent/README.md', '.agent/manifests/',
        '.agent/onboarding-registry.json', '.agent/workflows/',
        '.claude/commands/', '.claude/rules/',
        'scripts/', '.docking/engine/', 'package.json', 'astro.config.mjs',
        'tsconfig.json', '.cursorrules', '.windsurfrules', '.clinerules',
    ];
    LOCAL_PREFIXES = [
        'src/lib/local/', 'src/plugins/local/', 'src/pages/_local/',
        'src/survey-tools/local/', 'public/local/', 'docs/internal/',
    ];
    PROTECTED_EXACT = new Set([
        'wrangler.toml', 'clinic.json', '.docking/config.yaml',
        'src/config.ts', 'src/styles/global.css',
        '.agent/onboarding-state.json',
    ]);
    PROTECTED_PREFIXES = ['.env', '.core/', 'src/plugins/local/'];
    SPECIAL_MERGE_FILES = new Set(['package.json']);
}

// ═══════════════════════════════════════════════════════════════
// 동적 보호: config.yaml의 protected_pages 로드
// 클라이언트별 커스텀 페이지 보호를 하드코딩 없이 처리
// ═══════════════════════════════════════════════════════════════
const CLIENT_PROTECTED_PAGES = new Set();
const CLIENT_PROTECTED_PREFIXES = [];

function loadClientProtectedPages() {
    const configPath = path.join(PROJECT_ROOT, '.docking/config.yaml');
    if (!fs.existsSync(configPath)) return;

    try {
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        const pages = config?.protected_pages || [];
        const prefixes = config?.protected_prefixes || [];

        for (const page of pages) {
            CLIENT_PROTECTED_PAGES.add(page);
        }
        for (const prefix of prefixes) {
            CLIENT_PROTECTED_PREFIXES.push(prefix);
        }

        if (CLIENT_PROTECTED_PAGES.size > 0 || CLIENT_PROTECTED_PREFIXES.length > 0) {
            console.log(`   📋 클라이언트 보호 설정 로드: ${CLIENT_PROTECTED_PAGES.size}개 페이지, ${CLIENT_PROTECTED_PREFIXES.length}개 prefix`);
        }
    } catch (e) {
        console.log(`   ⚠️  config.yaml 로드 실패: ${e.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// Starter Version 관리
// ═══════════════════════════════════════════════════════════════

/**
 * .core/starter-version 읽기
 * 없으면 현재 package.json 버전으로 자동 생성
 */
function readStarterVersion() {
    const starterVersionPath = path.join(PROJECT_ROOT, '.core', 'starter-version');
    if (fs.existsSync(starterVersionPath)) {
        return fs.readFileSync(starterVersionPath, 'utf8').trim();
    }

    // 자동 생성: 현재 package.json 버전 사용
    const pkgPath = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'package.json')
        : path.join(PROJECT_ROOT, 'package.json');

    let version = 'v0.0.0';
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = fs.readJsonSync(pkgPath);
            if (pkg.version) {
                version = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
            }
        } catch (e) { /* ignore */ }
    }

    const coreDir = path.join(PROJECT_ROOT, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeFileSync(starterVersionPath, version);
    console.log(`   ℹ️  .core/starter-version 자동 생성: ${version}`);
    return version;
}

/**
 * Semver 비교: a < b ?
 */
function semverLt(a, b) {
    const parse = (v) => (v || '').replace(/^v/, '').split('.').map(Number);
    const av = parse(a), bv = parse(b);
    for (let i = 0; i < 3; i++) {
        if ((av[i] || 0) !== (bv[i] || 0)) return (av[i] || 0) < (bv[i] || 0);
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════
// Helper 함수들
// ═══════════════════════════════════════════════════════════════

/**
 * upstream 경로를 로컬 경로로 변환
 * 스타터킷 구조에서는 src/, migrations/ 등에 core/ prefix 추가
 * 루트 레벨 파일(package.json 등)과 인프라 파일(.docking/, scripts/)은 그대로
 */
function toLocalPath(upstreamPath) {
    if (!IS_STARTER_KIT) return upstreamPath;

    // 앱 코드 경로 → core/ 안으로 이동
    const appPaths = ['src/', 'migrations/', 'seeds/', 'public/'];
    const isAppPath = appPaths.some(p => upstreamPath.startsWith(p));

    if (isAppPath) {
        return CORE_DIR + upstreamPath;
    }

    // 앱 설정 파일도 core/ 안으로 이동 (스타터킷에서 core/가 실제 앱)
    const appConfigFiles = ['tsconfig.json', 'astro.config.mjs', 'package.json'];
    if (appConfigFiles.includes(upstreamPath)) {
        return CORE_DIR + upstreamPath;
    }

    // 인프라 파일은 루트에 유지
    // scripts/, .docking/, docs/, package.json
    return upstreamPath;
}

/**
 * 로컬 경로를 upstream 경로로 변환 (역변환)
 */
function toUpstreamPath(localPath) {
    if (!IS_STARTER_KIT) return localPath;

    if (localPath.startsWith(CORE_DIR)) {
        return localPath.slice(CORE_DIR.length);
    }
    return localPath;
}

function isLocalPath(filePath) {
    return LOCAL_PREFIXES.some(prefix => filePath.startsWith(prefix));
}

function isProtectedPath(filePath) {
    // Static exact match
    if (PROTECTED_EXACT.has(filePath)) return true;
    // Static prefix match
    if (PROTECTED_PREFIXES.some(prefix => filePath.startsWith(prefix))) return true;
    // Dynamic: client config.yaml protected_pages
    if (CLIENT_PROTECTED_PAGES.has(filePath)) return true;
    // Dynamic: client config.yaml protected_prefixes
    return CLIENT_PROTECTED_PREFIXES.some(prefix => filePath.startsWith(prefix));
}

function isSpecialMergeFile(filePath) {
    return SPECIAL_MERGE_FILES.has(filePath);
}

function isCorePath(filePath) {
    return CORE_PATHS.some(corePath => filePath.startsWith(corePath));
}

async function runCommand(cmd, silent = false, timeoutMs = 120000) {
    if (!silent) console.log(`   > ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: PROJECT_ROOT,
            maxBuffer: 10 * 1024 * 1024,
            timeout: timeoutMs
        });
        return { success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' };
    } catch (error) {
        // exec 에러 시 stdout/stderr가 error 객체에 포함됨
        const stdout = error.stdout?.trim() || '';
        const stderr = error.stderr?.trim() || error.message || '';
        return { success: false, stdout, stderr };
    }
}

/**
 * AbortController 기반 fetch 타임아웃 래퍼
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function isDirty() {
    const result = await runCommand('git status --porcelain', true);
    return result.stdout.length > 0;
}

/**
 * upstream remote 존재 여부 확인
 */
async function hasUpstreamRemote() {
    const result = await runCommand('git remote get-url upstream', true);
    return result.success;
}

/**
 * upstream remote 자동 등록
 * 이전 버전 setup으로 설치된 클라이언트 지원
 */
async function ensureUpstreamRemote(gitUrl) {
    const hasUpstream = await hasUpstreamRemote();

    if (hasUpstream) {
        // 이미 있으면 URL만 업데이트
        const updateResult = await runCommand(`git remote set-url upstream "${gitUrl}"`, true);
        if (updateResult.success) {
            console.log('   ✅ upstream URL 업데이트 완료');
        }
        return true;
    }

    // upstream이 없으면 새로 등록
    console.log('   ⚠️  upstream remote가 없습니다. 자동 등록 중...');
    const addResult = await runCommand(`git remote add upstream "${gitUrl}"`, true);
    if (!addResult.success) {
        console.log(`   ❌ upstream 등록 실패: ${addResult.stderr}`);
        return false;
    }

    // push 차단 설정 (안전장치)
    await runCommand('git remote set-url --push upstream DISABLE', true);
    console.log('   ✅ upstream remote 자동 등록 완료');
    return true;
}

async function hasStagedChanges() {
    const result = await runCommand('git diff --cached --name-only', true);
    return result.stdout.length > 0;
}

async function createWipSnapshot() {
    console.log('��� 현재 상태 스냅샷(WIP) 저장 중...');
    await runCommand('git add -A', true);

    if (!(await hasStagedChanges())) {
        console.log('   ℹ️  staged 변경이 없어 WIP 커밋을 생략합니다.');
        return;
    }

    await runCommand('git commit -m "WIP: core:pull 전 자동 스냅샷" --no-verify', true);
    console.log('   ✅ WIP 스냅샷 저장 완료');
}

async function assertTagExists(tag) {
    const result = await runCommand(`git rev-parse --verify refs/tags/${tag}`, true);
    if (!result.success) {
        throw new Error(`코어 태그 ${tag}를 찾을 수 없습니다. upstream에 해당 태그가 있는지 확인하세요.`);
    }
}

/**
 * 설정 파일에서 HQ URL, device_token, license_key 읽기
 */
function getConfig() {
    const clinicJsonPath = path.join(PROJECT_ROOT, 'clinic.json');
    const configYamlPath = path.join(PROJECT_ROOT, '.docking/config.yaml');

    let hqUrl = 'https://clinic-os-hq.pages.dev';
    let licenseKey = null;
    let deviceToken = null;
    let channel = 'stable';

    // 1. clinic.json에서 license_key 읽기
    if (fs.existsSync(clinicJsonPath)) {
        try {
            const clinicConfig = fs.readJsonSync(clinicJsonPath);
            hqUrl = clinicConfig.hq_url || hqUrl;
            licenseKey = clinicConfig.license_key || null;
            channel = clinicConfig.channel || channel;
        } catch (e) {
            // ignore
        }
    }

    // 2. .docking/config.yaml에서 device_token 읽기
    if (fs.existsSync(configYamlPath)) {
        try {
            const configContent = fs.readFileSync(configYamlPath, 'utf8');
            const config = yaml.load(configContent);
            hqUrl = config.hq_url || hqUrl;
            deviceToken = config.device_token || null;
        } catch (e) {
            // ignore
        }
    }

    return { hqUrl, deviceToken, licenseKey, channel };
}

/**
 * HQ API에서 인증된 Git URL 가져오기
 * setup-clinic.js와 동일한 인증 방식 사용
 */
async function getAuthenticatedGitUrl() {
    const { hqUrl, deviceToken, licenseKey, channel } = getConfig();

    if (!deviceToken && !licenseKey) {
        console.log('   ⚠️  인증 정보가 없습니다. npm run setup을 먼저 실행하세요.');
        return null;
    }

    try {
        const response = await fetchWithTimeout(`${hqUrl}/api/v1/update/git-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_token: deviceToken, license_key: licenseKey, channel: channel })
        }, 15000);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.log(`   ⚠️  HQ 인증 실패: ${err.error || response.status}`);
            return null;
        }

        const data = await response.json();
        return data.git_url || null;
    } catch (e) {
        console.log(`   ⚠️  HQ 연결 실패: ${e.message}`);
        return null;
    }
}

/**
 * HQ API에서 채널별 버전 조회
 */
async function getVersionFromHQ(channel = 'stable') {
    const { hqUrl } = getConfig();

    try {
        // HQ API 호출 (간단한 fetch)
        const response = await fetchWithTimeout(`${hqUrl}/api/v1/update/channel-version?channel=${channel}`, {}, 10000);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.version ? `v${data.version}` : null;
    } catch (e) {
        return null;
    }
}

/**
 * 채널별 최신 버전 조회
 * Primary: HQ API (release_channels 테이블)
 * Fallback: Git 태그 (latest-stable, latest-beta)
 */
async function getChannelVersion(channel = 'stable') {
    const channelTag = channel === 'beta' ? 'latest-beta' : 'latest-stable';

    // 1. HQ API 조회 (Primary Source)
    console.log(`   🔍 HQ API에서 ${channel} 버전 조회 중...`);
    const hqVersion = await getVersionFromHQ(channel);
    if (hqVersion) {
        console.log(`   ✅ HQ ${channel} 버전: ${hqVersion}`);
        return hqVersion;
    }

    // 2. HQ API 실패 시 Git 태그 fallback
    console.log(`   ⚠️  HQ API 조회 실패. Git 태그(${channelTag})로 fallback...`);

    const tagCheck = await runCommand(`git rev-parse --verify refs/tags/${channelTag}`, true);
    if (!tagCheck.success) {
        throw new Error(`HQ API 조회 실패, ${channelTag} 태그도 없습니다.`);
    }

    // channel 태그가 가리키는 커밋 SHA 획득
    const commitResult = await runCommand(`git rev-list -n 1 ${channelTag}`, true);
    if (!commitResult.success) {
        throw new Error(`${channelTag} 커밋을 읽을 수 없습니다.`);
    }
    const commitSha = commitResult.stdout.trim();

    // 해당 커밋의 실���� v-tag 찾기 (latest-* 제외)
    const tagsResult = await runCommand(`git tag --points-at ${commitSha}`, true);
    const tags = tagsResult.stdout.split('\n').filter(t => t && t.startsWith('v') && !t.startsWith('latest'));

    if (tags.length === 0) {
        // describe로 가장 가까운 v-tag 찾기
        const describeResult = await runCommand(`git describe --tags --match "v*" ${channelTag}`, true);
        if (describeResult.success) {
            const described = describeResult.stdout.trim();
            const vTag = described.split('-')[0];
            if (vTag.startsWith('v')) {
                return vTag;
            }
        }
        throw new Error(`${channelTag}에서 v-tag를 찾을 수 없습니다.`);
    }

    // v-tag가 여러 개면 가장 최신 semver 선택
    const sortedTags = tags.sort((a, b) => {
        const aParts = a.replace('v', '').split('.').map(Number);
        const bParts = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
                return (bParts[i] || 0) - (aParts[i] || 0);
            }
        }
        return 0;
    });

    return sortedTags[0];
}

/**
 * Fallback: semver 정렬 기반 최신 stable 태그 (channel 태그가 없는 경우)
 */
async function getLatestStableTagFallback() {
    const result = await runCommand('git tag --list "v*" --sort=-v:refname', true);
    const tags = result.stdout.split('\n').filter(Boolean);

    // pre-release 제외 (-rc, -beta, -alpha)
    const stable = tags.find(t => !/-/.test(t));
    if (!stable) {
        throw new Error('사용 가능한 안정 태그(v*)를 찾지 못했습니다.');
    }
    return stable;
}

async function readCoreVersion() {
    const versionFile = path.join(PROJECT_ROOT, '.core', 'version');
    if (!fs.existsSync(versionFile)) {
        // 이전 버전 클라이언트: .core/version 파일이 없는 경우
        // package.json에서 버전을 읽어 자동 생성
        console.log('   ⚠️  .core/version 파일이 없습니다. 자동 생성 중...');

        const pkgPath = IS_STARTER_KIT
            ? path.join(PROJECT_ROOT, 'core', 'package.json')
            : path.join(PROJECT_ROOT, 'package.json');

        let fallbackVersion = 'v0.0.0';  // 최악의 경우 전체 업데이트

        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = fs.readJsonSync(pkgPath);
                if (pkg.version) {
                    fallbackVersion = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
                }
            } catch (e) {
                // ignore
            }
        }

        // .core/version 자동 생성
        await writeCoreVersion(fallbackVersion);
        console.log(`   ✅ .core/version 생성됨: ${fallbackVersion}`);
        return fallbackVersion;
    }
    return fs.readFileSync(versionFile, 'utf8').trim();
}

async function writeCoreVersion(version) {
    const coreDir = path.join(PROJECT_ROOT, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeFileSync(path.join(coreDir, 'version'), version);
}

async function gitDiffNameStatus(fromTag, toTag, paths) {
    const pathArgs = paths.map(p => `"${p}"`).join(' ');
    const cmd = `git diff --name-status ${fromTag} ${toTag} -- ${pathArgs}`;
    const result = await runCommand(cmd, true);

    if (!result.stdout) return [];

    return result.stdout.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        const status = parts[0].charAt(0);
        if (status === 'R' || status === 'C') {
            // Rename/Copy: git outputs "R100\told_path\tnew_path"
            return { status, oldPath: parts[1], path: parts[2] };
        }
        return { status, path: parts.slice(1).join('\t') };
    });
}

async function gitDiffNameOnly(fromRef, toRef, paths) {
    const pathArgs = paths.map(p => `"${p}"`).join(' ');
    const cmd = `git diff --name-only ${fromRef} ${toRef} -- ${pathArgs}`;
    const result = await runCommand(cmd, true);
    return result.stdout.split('\n').filter(Boolean);
}

function intersect(arr1, arr2) {
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
}

/**
 * Drift 감지: upstream과 로컬이 다른 파일 찾기
 * - 버전 간 diff에 포함되지 않았지만, 이전에 보호되어 로컬이 upstream과 다른 파일 감지
 * - protected/local 파일은 제외
 */
async function detectDriftedFiles(targetTag, alreadyInDiff) {
    const diffSet = new Set(alreadyInDiff);
    const drifted = [];

    // upstream 타겟 버전의 전체 파일 목록
    const result = await runCommand(`git ls-tree -r --name-only ${targetTag}`, true);
    if (!result.success || !result.stdout) return drifted;

    const allUpstreamFiles = result.stdout.split('\n').filter(Boolean);

    // CORE_PATHS에 속하면서 diff에 없고, protected/local이 아닌 파일만 체크
    const candidates = allUpstreamFiles.filter(f => {
        if (diffSet.has(f)) return false;
        if (isProtectedPath(f)) return false;
        if (isLocalPath(f)) return false;
        if (f.startsWith('seeds/')) return false;
        // CORE_PATHS에 속하는지 확인
        return CORE_PATHS.some(cp => f.startsWith(cp));
    });

    // 로컬과 upstream 내용 비교 (텍스트 파일만)
    // 비교 시 trailing whitespace를 normalize (기존 runCommand.trim()으로 저장된 파일 호환)
    for (const upstreamPath of candidates) {
        const localPath = toLocalPath(upstreamPath);
        const fullLocalPath = path.join(PROJECT_ROOT, localPath);

        if (!fs.existsSync(fullLocalPath)) {
            // Missing locally but exists in upstream → treat as drifted
            drifted.push(upstreamPath);
            continue;
        }

        // 바이너리 확장자 스킵
        if (/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|svg|mp4|webm|pdf)$/i.test(upstreamPath)) continue;

        try {
            const { stdout: upstreamContent } = await execAsync(
                `git show ${targetTag}:"${upstreamPath}"`,
                { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024 }
            );

            const localContent = fs.readFileSync(fullLocalPath, 'utf8');
            // 앞뒤 공백 차이는 무시 (기존 runCommand.trim()으로 저장된 파일 호환)
            if (localContent.trim() !== upstreamContent.trim()) {
                drifted.push(upstreamPath);
            }
        } catch {
            continue;
        }
    }

    return drifted;
}

/**
 * 실제 내용이 다른 충돌만 필터링
 * - upstream 타겟 버전의 파일 내용
 * - 로컬 파일 내용
 * 둘이 동일하면 "이미 동기화됨"으로 충돌 아님
 */
async function filterRealConflicts(conflicts, targetTag) {
    const realConflicts = [];
    const alreadySynced = [];

    for (const upstreamPath of conflicts) {
        const localPath = toLocalPath(upstreamPath);
        const fullLocalPath = path.join(PROJECT_ROOT, localPath);

        // 로컬 파일이 없으면 충돌 아님 (새 파일)
        if (!fs.existsSync(fullLocalPath)) {
            continue;
        }

        // upstream 내용 가져오기
        const result = await runCommand(`git show ${targetTag}:"${upstreamPath}"`, true);
        if (!result.success) {
            // upstream에서 가져올 수 없으면 충돌로 간주
            realConflicts.push(upstreamPath);
            continue;
        }

        const upstreamContent = result.stdout;
        const localContent = fs.readFileSync(fullLocalPath, 'utf8');

        // 내용 비교 (줄바꿈 정규화)
        const normalizedUpstream = upstreamContent.replace(/\r\n/g, '\n').trim();
        const normalizedLocal = localContent.replace(/\r\n/g, '\n').trim();

        if (normalizedUpstream === normalizedLocal) {
            alreadySynced.push(upstreamPath);
        } else {
            realConflicts.push(upstreamPath);
        }
    }

    return { realConflicts, alreadySynced };
}

/**
 * upstream 태그에서 파일 내용을 가져와 로컬 경로에 저장
 * 스타터킷 구조에서는 경로 변환 적용
 */
async function restoreFileFromUpstream(tag, upstreamPath) {
    const localPath = toLocalPath(upstreamPath);
    const fullLocalPath = path.join(PROJECT_ROOT, localPath);

    // 파일 내용 가져오기 (trim 없이 원본 보존)
    try {
        const { stdout } = await execAsync(
            `git show ${tag}:"${upstreamPath}"`,
            { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024 }
        );

        // 디렉토리 생성 및 파일 저장
        fs.ensureDirSync(path.dirname(fullLocalPath));
        fs.writeFileSync(fullLocalPath, stdout);
        return true;
    } catch (e) {
        console.log(`   ⚠️  ${upstreamPath}: 파일 내용을 가져올 수 없음`);
        return false;
    }
}

/**
 * 바이너리 파일 여부 확인 (이미지, 폰트 등)
 */
function isBinaryFile(filePath) {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.pdf', '.zip', '.tar', '.gz',
        '.mp3', '.mp4', '.wav', '.ogg', '.webm'
    ];
    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
}

/**
 * upstream 태그에서 바이너리 파일을 가져와 로컬 경로에 저장
 */
async function restoreBinaryFromUpstream(tag, upstreamPath) {
    const localPath = toLocalPath(upstreamPath);
    const fullLocalPath = path.join(PROJECT_ROOT, localPath);

    // 바이너리 파일은 git show로 가져와서 저장
    const result = await execAsync(
        `git show ${tag}:"${upstreamPath}"`,
        { cwd: PROJECT_ROOT, encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }
    );

    fs.ensureDirSync(path.dirname(fullLocalPath));
    fs.writeFileSync(fullLocalPath, result.stdout);
    return true;
}

// ═══════════════════════════════════════════════════════════════
// 백업 및 마이그레이션 가이드
// ═══════════════════════════════════════════════════════════════

async function backupModifiedFiles(conflicts, currentVersion, targetVersion) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const backupDir = path.join(PROJECT_ROOT, `.core-backup/${dateStr}_${timeStr}`);

    console.log(`\n📦 충돌 파일 백업 중... (${conflicts.length}개 파일)`);
    fs.ensureDirSync(backupDir);

    const manifest = {
        date: new Date().toISOString(),
        previousVersion: currentVersion,
        newVersion: targetVersion,
        files: [],
        migrationGuide: 'AI에게 "백업 확인하고 local로 이전해줘"라고 요청하세요.'
    };

    for (const file of conflicts) {
        // 스타터킷 구조에서는 로컬 경로로 변환
        const localFile = toLocalPath(file);
        const srcPath = path.join(PROJECT_ROOT, localFile);
        const destPath = path.join(backupDir, file);  // 백업은 upstream 경로 기준으로 저장

        if (fs.existsSync(srcPath)) {
            fs.ensureDirSync(path.dirname(destPath));
            fs.copySync(srcPath, destPath);
            manifest.files.push({
                path: file,
                localPath: localFile,
                suggestedLocalPath: suggestLocalPath(file)
            });
            console.log(`   📄 ${localFile}`);
        }
    }

    fs.writeJsonSync(path.join(backupDir, 'manifest.json'), manifest, { spaces: 2 });
    console.log(`   �� 백업 완료: ${backupDir}`);

    return backupDir;
}

function suggestLocalPath(filePath) {
    // 페이지는 _local/ 오버라이드 (Vite 플러그인 자동 적용)
    // 단, admin 페이지는 제외 (Core 버전을 항상 사용)
    if (filePath.startsWith('src/pages/')) {
        if (filePath.startsWith('src/pages/admin/')) {
            // Admin 페이지는 _local로 이전하지 않음 (백업만 유지)
            return null;
        }
        return filePath.replace('src/pages/', 'src/pages/_local/');
    }
    if (filePath.startsWith('src/components/')) {
        return filePath.replace('src/components/', 'src/plugins/local/components/');
    }
    if (filePath.startsWith('src/lib/')) {
        return filePath.replace('src/lib/', 'src/lib/local/');
    }
    if (filePath.startsWith('src/layouts/')) {
        return filePath.replace('src/layouts/', 'src/plugins/local/layouts/');
    }
    return `src/plugins/local/${filePath}`;
}

function printMigrationGuide(conflicts, backupDir) {
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  ⚠️  코어 파일 충돌 발생                                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  충돌 파일 ${conflicts.length}개가 백업되었습니다.`);
    console.log(`│  백업 위치: ${backupDir.replace(PROJECT_ROOT, '.')}`);
    console.log('│                                                             │');
    console.log('│  💡 페이지(src/pages/) 충돌은 자동으로 _local/에 보존됩니다.  │');
    console.log('│  빌드 시 _local/ 버전이 우선 적용됩니다.                     │');
    console.log('│  ⚠️  단, admin 페이지는 Core 버전을 항상 사용합니다.          │');
    console.log('│                                                             │');
    console.log('│  기타 파일 충돌은 수동 이전이 필요합니다:                     │');
    console.log('│  1. .core-backup/*/manifest.json 확인                       │');
    console.log('│  2. 변경 내용을 src/lib/local/ 등으로 이동                   │');
    console.log('│  3. 백업 폴더 삭제                                          │');
    console.log('│                                                             │');
    console.log('│  또는 AI에게 "백업 확인하고 local로 이전해줘"                 │');
    console.log('└─────────────────────────────────────────────────────────────┘');
}

// ═══════════════════════════════════════════════════════════════
// package.json 머지 (정책 기반)
// ═══════════════════════════════════════════���═══════════════════

/**
 * package.json 머지 규칙:
 * - HQ 소유 (upstream 우선): scripts, engines, packageManager, type, bin
 * - 클라이언트 소유 (local 우선): name, description, private
 * - 머지 (합집합): dependencies, devDependencies
 *   - HQ deps는 upstream 버전으로 덮어씀
 *   - 클라이언트 추가 deps는 유지
 *
 * 스타터킷 구조에서는:
 * - core/package.json이 앱의 실제 package.json
 * - 루트 package.json은 스타터킷 래퍼 (별도 관리)
 */
async function mergePackageJson(targetTag) {
    // 스타터킷 구조에서는 core/package.json을 대상으로
    const localPkgPath = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'package.json')
        : path.join(PROJECT_ROOT, 'package.json');

    // 1. 로컬 package.json 백업 (머지 실패 시 복구용)
    const localPkg = fs.readJsonSync(localPkgPath);
    const localBackup = JSON.parse(JSON.stringify(localPkg));

    // 2. upstream package.json 가져오기
    const result = await runCommand(`git show ${targetTag}:package.json`, true);
    if (!result.success) {
        console.log(`   ⚠️  upstream package.json을 읽을 수 없습니다. 스킵합니다.`);
        return;
    }

    let upstreamPkg;
    try {
        upstreamPkg = JSON.parse(result.stdout);
    } catch (e) {
        console.log(`   ⚠️  upstream package.json 파싱 실패. 스킵합니다.`);
        return;
    }

    // 3. 머지 시작
    const merged = { ...localPkg };

    // HQ 소유 필드: upstream 우선
    const hqOwnedFields = ['engines', 'packageManager', 'type', 'bin', 'version'];
    for (const field of hqOwnedFields) {
        if (upstreamPkg[field] !== undefined) {
            merged[field] = upstreamPkg[field];
        }
    }

    // Scripts 머지: HQ 스크립트 기반 + 클라이언트 추가분 보존
    const upstreamScripts = upstreamPkg.scripts || {};
    const localScripts = localPkg.scripts || {};

    // 1. upstream 스크립트를 기본으로
    merged.scripts = { ...upstreamScripts };

    // 2. 클라이언트가 추가한 스크립트 보존 (upstream에 없는 것)
    const preservedScripts = [];
    for (const [key, value] of Object.entries(localScripts)) {
        if (!(key in upstreamScripts)) {
            merged.scripts[key] = value;
            preservedScripts.push(key);
        }
    }

    if (preservedScripts.length > 0) {
        console.log(`   📌 클라이언트 스크립트 보존: ${preservedScripts.join(', ')}`);
        // local: 접두사 권장 안내
        const nonPrefixed = preservedScripts.filter(s => !s.startsWith('local:'));
        if (nonPrefixed.length > 0) {
            console.log(`   💡 팁: 커스텀 스크립트는 'local:' 접두사 권장 (예: local:${nonPrefixed[0]})`);
        }
    }

    // 3. HQ 전용 스크립트 제거 (클라이언트에게 필요 없음)
    const hqOnlyScripts = ['core:push', 'core:push:stable', 'starter:push', 'publish', 'hq:deploy', 'release'];
    for (const script of hqOnlyScripts) {
        delete merged.scripts[script];
    }

    // dependencies 머지: HQ deps + 클라이언트 추가 deps
    merged.dependencies = mergeDeps(
        localPkg.dependencies || {},
        upstreamPkg.dependencies || {}
    );

    merged.devDependencies = mergeDeps(
        localPkg.devDependencies || {},
        upstreamPkg.devDependencies || {}
    );

    // 4. 저장
    try {
        fs.writeJsonSync(localPkgPath, merged, { spaces: 4 });
        console.log(`   ✅ package.json 머지 완료`);

        // 변경된 deps 수 출력
        const addedDeps = countNewDeps(localPkg.dependencies, merged.dependencies);
        const addedDevDeps = countNewDeps(localPkg.devDependencies, merged.devDependencies);
        if (addedDeps > 0 || addedDevDeps > 0) {
            console.log(`   📦 새 의존성: deps=${addedDeps}, devDeps=${addedDevDeps}`);
        }

        // 5. 스타터킷 구조: 루트 package.json 버전 및 스크립트 동기화
        if (IS_STARTER_KIT && merged.version) {
            const rootPkgPath = path.join(PROJECT_ROOT, 'package.json');
            if (fs.existsSync(rootPkgPath)) {
                const rootPkg = fs.readJsonSync(rootPkgPath);
                let rootUpdated = false;

                // 버전 동기화
                if (rootPkg.version !== merged.version) {
                    rootPkg.version = merged.version;
                    rootUpdated = true;
                }

                // 스크립트 동기화 (core 스크립트를 루트에서도 실행 가능하게)
                if (merged.scripts) {
                    rootPkg.scripts = rootPkg.scripts || {};
                    for (const [key, value] of Object.entries(merged.scripts)) {
                        // 루트에 없는 스크립트만 추가 (기존 커스텀 스크립트 보존)
                        if (!(key in rootPkg.scripts)) {
                            rootPkg.scripts[key] = value;
                            rootUpdated = true;
                        }
                    }
                }


                if (rootUpdated) {
                    fs.writeJsonSync(rootPkgPath, rootPkg, { spaces: 4 });
                    console.log(`   🔄 루트 package.json 동기화: v${merged.version}`);
                }
            }
        }
    } catch (e) {
        // 실패 시 복구
        fs.writeJsonSync(localPkgPath, localBackup, { spaces: 4 });
        console.log(`   ❌ package.json 머지 실패, 원본 복구됨: ${e.message}`);
    }
}

/**
 * dependencies 머지:
 * - upstream에 있는 패키지는 upstream 버전으로 (HQ 우선)
 * - local에만 있는 패키지는 유지 (클라이언트 추가분 보존)
 */
function mergeDeps(localDeps, upstreamDeps) {
    const merged = { ...localDeps };

    // upstream deps로 덮어쓰기/추가
    for (const [pkg, version] of Object.entries(upstreamDeps)) {
        merged[pkg] = version;
    }

    return merged;
}

function countNewDeps(oldDeps = {}, newDeps = {}) {
    let count = 0;
    for (const pkg of Object.keys(newDeps)) {
        if (!(pkg in oldDeps)) count++;
    }
    return count;
}

// ════��══════════════════════════════════════════════════════════
// 새 마이그레이션 실행
// ═══════════════════════════════════════════════════════════════

async function runNewMigrations(migrationFiles) {
    // 이 함수는 하위 호환성을 위해 유지하지만, 실제로는 runAllMigrations 사용
    if (migrationFiles.length > 0) {
        console.log(`\n🗃️  새 마이그레이션 ${migrationFiles.length}개 감지됨 (전체 마이그레이션 체크로 처리)`);
    }
}

/**
 * 로컬 D1 DB 준비 상태 확인 및 자동 초기화
 *
 * 핵심 원칙: 기존 데이터는 절대 삭제하지 않는다.
 *
 * 1. 현재 wrangler 설정으로 DB 접근 가능 → 그대로 사용
 * 2. 접근 불가하지만 .wrangler/ 안에 고아 DB(이전 ID, 백업 등)가 있음
 *    → 데이터가 있는 DB를 현재 설정으로 복구 후 사용
 * 3. DB가 전혀 없고 wrangler.toml 유효 → 빈 DB 생성
 * 4. wrangler.toml 없거나 placeholder → 안내 메시지, false
 */
async function ensureLocalDb() {
    // wrangler.toml 확인
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        console.log('\n⚠️  wrangler.toml이 없습니다. npm run setup을 먼저 실행하세요.');
        return false;
    }

    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    const dbIdMatch = wranglerContent.match(/database_id\s*=\s*"([^"]+)"/);
    const dbNameMatch = wranglerContent.match(/database_name\s*=\s*"([^"]+)"/);

    // placeholder DB ID → setup 필요
    if (!dbIdMatch || dbIdMatch[1].includes('your-') || dbIdMatch[1].includes('placeholder')) {
        console.log('\n⚠️  D1 데이터베이스가 설정되지 않았습니다.');
        console.log('   npm run setup을 먼저 실행하세요.');
        console.log('   마이그레이션/시드를 건너뜁니다.\n');
        return false;
    }

    const dbName = dbNameMatch ? dbNameMatch[1] : 'clinic-os-db';
    const d1StateDir = path.join(PROJECT_ROOT, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

    // Case 1: 현재 설정으로 DB 접근 시도
    try {
        execFileSync(
            'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
            { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
        );

        // DB 접근 성공 — 이제 고아 DB에서 데이터 복구가 필요한지 확인
        await recoverOrphanedData(d1StateDir, dbName);
        return true;
    } catch {
        // DB 접근 실패 — 아래에서 복구 시도
    }

    // Case 2: .wrangler/ 안에 기존 DB 파일이 있는지 스캔
    if (fs.existsSync(d1StateDir)) {
        const recovered = await recoverExistingDb(d1StateDir, dbName);
        if (recovered) return true;
    }

    // Case 3: DB가 전혀 없음 → 빈 DB 생성
    console.log(`\n🔧 로컬 D1 데이터베이스 생성 중... (${dbName})`);
    try {
        execFileSync(
            'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
            { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
        );
        console.log('   ✅ 빈 DB 생성 완료');
        return true;
    } catch (e) {
        const errMsg = (e.stderr || e.message || '').slice(0, 200);
        console.log(`   ⚠️  DB 생성 실패: ${errMsg}`);
        console.log('   npm run db:init → npm run db:migrate → npm run db:seed\n');
        return false;
    }
}

/**
 * .wrangler/state/v3/d1/ 안에서 데이터가 있는 고아 SQLite 파일 찾기
 * → 현재 활성 DB에 데이터가 비어있으면, 고아 DB에서 데이터를 가져온다
 */
async function recoverOrphanedData(d1StateDir, dbName) {
    if (!fs.existsSync(d1StateDir)) return;

    try {
        const sqliteFiles = fs.readdirSync(d1StateDir)
            .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'));

        if (sqliteFiles.length <= 1) return; // 고아 DB 없음

        // 현재 활성 DB 파일 찾기 (SELECT 1 직후이므로 가장 최근 수정된 파일)
        const activeDbFile = findActiveDbFile(d1StateDir, dbName);

        // 현재 활성 DB의 테이블 수 확인
        let activeTableCount = 0;
        try {
            const result = execFileSync(
                'npx', ['wrangler', 'd1', 'execute', dbName, '--local',
                    '--command', "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
                    '--json', '--yes'],
                { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
            );
            const parsed = JSON.parse(result);
            if (parsed?.[0]?.results?.[0]?.cnt) {
                activeTableCount = parsed[0].results[0].cnt;
            }
        } catch { /* ignore */ }

        // 활성 DB에 이미 테이블이 충분히 있으면 복구 불필요
        if (activeTableCount > 10) return;

        // 활성 DB를 제외하고 가장 큰 고아 DB 파일 찾기
        let bestCandidate = null;
        let bestSize = 0;

        for (const file of sqliteFiles) {
            const filePath = path.join(d1StateDir, file);
            if (activeDbFile && filePath === activeDbFile) continue; // 활성 DB 제외
            const stat = fs.statSync(filePath);
            // 100KB 이상이면 실질적 데이터가 있다고 판단
            if (stat.size > 100 * 1024 && stat.size > bestSize) {
                bestSize = stat.size;
                bestCandidate = filePath;
            }
        }

        if (!bestCandidate) return;

        console.log(`\n🔍 고아 데이터베이스 발견 (${(bestSize / 1024 / 1024).toFixed(1)}MB)`);
        console.log(`   경로: ${path.basename(bestCandidate)}`);
        console.log('   기존 데이터를 현재 DB로 복구합니다...');

        // wrangler d1 execute로는 ATTACH가 안 되므로, 고아 파일을 현재 위치로 복사
        // 단, 현재 DB가 비어있을 때만 (데이터 충돌 방지)
        if (activeTableCount === 0 && activeDbFile) {
            // 빈 DB를 고아 DB로 대체 (백업 후)
            const backupPath = activeDbFile + '.empty-backup';
            fs.copySync(activeDbFile, backupPath);
            fs.copySync(bestCandidate, activeDbFile);
            console.log('   ✅ 기존 데이터 복구 완료 (스키마는 마이그레이션에서 업데이트)');

            // WAL/SHM 파일도 복사 (있으면)
            const walFile = bestCandidate + '-wal';
            const shmFile = bestCandidate + '-shm';
            if (fs.existsSync(walFile)) fs.copySync(walFile, activeDbFile + '-wal');
            if (fs.existsSync(shmFile)) fs.copySync(shmFile, activeDbFile + '-shm');
        } else if (activeTableCount > 0) {
            console.log(`   ℹ️  현재 DB에 ${activeTableCount}개 테이블 존재 — 고아 DB 복구 건너뜀`);
            console.log(`   💡 수동 복구가 필요하면: ${bestCandidate}`);
        }
    } catch (e) {
        // 복구 실패해도 core:pull 자체는 계속 진행
        console.log(`   ⚠️  고아 DB 복구 건너뜀: ${e.message}`);
    }
}

/**
 * .wrangler/ 안에 DB 파일은 있지만 현재 wrangler 설정으로 접근 안 되는 경우
 * → 가장 큰 DB 파일을 찾아서 현재 설정에 맞게 복구
 */
async function recoverExistingDb(d1StateDir, dbName) {
    try {
        const sqliteFiles = fs.readdirSync(d1StateDir)
            .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'));

        if (sqliteFiles.length === 0) return false;

        // 가장 큰 파일 = 데이터가 가장 많을 가능성
        let bestFile = null;
        let bestSize = 0;

        for (const file of sqliteFiles) {
            const filePath = path.join(d1StateDir, file);
            const stat = fs.statSync(filePath);
            if (stat.size > bestSize) {
                bestSize = stat.size;
                bestFile = filePath;
            }
        }

        if (!bestFile || bestSize < 1024) return false; // 1KB 미만이면 의미 없음

        const sizeMB = (bestSize / 1024 / 1024).toFixed(1);
        console.log(`\n🔍 기존 데이터베이스 발견 (${sizeMB}MB) — 현재 설정으로 연결 중...`);

        // wrangler로 새 DB를 만들면 파일이 생성됨 — 그걸 기존 데이터로 교체
        try {
            execFileSync(
                'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
                { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
            );
        } catch {
            console.log('   ⚠️  DB 생성 실패');
            return false;
        }

        // 방금 생성된 빈 DB 파일 찾기
        const newActiveFile = findActiveDbFile(d1StateDir, dbName);
        if (newActiveFile && newActiveFile !== bestFile) {
            fs.copySync(bestFile, newActiveFile);
            // WAL/SHM 파일도 복사
            const walFile = bestFile + '-wal';
            const shmFile = bestFile + '-shm';
            if (fs.existsSync(walFile)) fs.copySync(walFile, newActiveFile + '-wal');
            if (fs.existsSync(shmFile)) fs.copySync(shmFile, newActiveFile + '-shm');

            console.log('   ✅ 기존 데이터 연결 완료 (스키마는 마이그레이션에서 최신화)');
        } else {
            console.log('   ✅ 기존 DB 직접 사용');
        }

        return true;
    } catch (e) {
        console.log(`   ⚠️  DB 복구 실패: ${e.message}`);
        return false;
    }
}

/**
 * 현재 wrangler 설정으로 활성화된 DB 파일 경로 찾기
 * miniflare는 binding 이름을 해시하여 파일명으로 사용하므로,
 * 가장 최근에 수정된 파일이 현재 활성 DB일 가능성 높음
 */
function findActiveDbFile(d1StateDir, dbName) {
    try {
        const files = fs.readdirSync(d1StateDir)
            .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'))
            .map(f => ({
                name: f,
                path: path.join(d1StateDir, f),
                mtime: fs.statSync(path.join(d1StateDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime); // 최신순

        return files.length > 0 ? files[0].path : null;
    } catch {
        return null;
    }
}

/**
 * d1_migrations 테이블 존재 확인 및 생성
 */
async function ensureMigrationsTable(dbName) {
    const createTableSql = `CREATE TABLE IF NOT EXISTS d1_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
    )`;
    await runCommand(
        `npx wrangler d1 execute ${dbName} --local --command "${createTableSql}" --yes 2>&1`,
        true
    );
}

// parseAlterTableSql, isBootstrapMode, columnExists — migrate.js 통합 엔진으로 이관됨
// fetch.js에서 직접 사용하지 않음. fallback 경로에서도 불필요 (파일 전체 실행 방식)

/**
 * d1_migrations 테이블에서 적용된 마이그레이션 목록 조회
 */
async function getAppliedMigrations(dbName) {
    try {
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "SELECT name FROM d1_migrations ORDER BY id" --json 2>&1`,
            true
        );

        if (result.success && result.stdout) {
            const data = JSON.parse(result.stdout);
            if (data && data[0] && data[0].results) {
                return new Set(data[0].results.map(r => r.name));
            }
        }
    } catch (e) {
        // 테이블이 없거나 파싱 실패 시 빈 Set 반환
    }
    return new Set();
}

// bootstrapMigrationTracking — migrate.js 통합 엔진으로 이관됨

/**
 * 마이그레이션 적용 후 d1_migrations 테이블에 기록
 */
async function recordMigration(dbName, migrationName) {
    await runCommand(
        `npx wrangler d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${migrationName}')" --yes 2>&1`,
        true
    );
}

/**
 * 스키마 문서 자동 갱신 (마이그레이션 후)
 */
async function updateSchemaDoc() {
    const scriptPath = path.join(PROJECT_ROOT, 'scripts/generate-schema-doc.js');
    if (!fs.existsSync(scriptPath)) {
        return;
    }

    console.log('\n📝 스키마 문서 갱신 중...');
    const result = await runCommand(`node "${scriptPath}" 2>&1`, true);
    if (result.success) {
        console.log('   ✅ SCHEMA.md 갱신 완료');
    }
}

/**
 * 마이그레이션 실행 — migrate.js 통합 엔진 사용
 *
 * migrate.js의 runMigrations()로 위임:
 * - PRAGMA table_info 기반 컬럼 존재 확인 (모든 ALTER TABLE에 대해)
 * - 다중 ALTER TABLE 파일 지원 (parseAllAlterTableStatements)
 * - SQLITE_BUSY exponential backoff 재시도
 * - 혼합 파일(ALTER+UPDATE) 임시파일 분리 실행
 * - 부분 실패 시 미기록 → 재시도 가능
 *
 * migrate.js가 없으면 기본 fallback (파일 전체 실행)
 */
async function runAllMigrations(forceBootstrap = false) {
    // migrate.js 통합 엔진 사용
    if (migrateEngine) {
        console.log('\n🗃️  통합 마이그레이션 엔진 실행 (PRAGMA 안전 모드)');
        try {
            const result = await migrateEngine.runMigrations({
                local: true,
                verbose: true,
                verify: true
            });

            if (result.applied > 0) {
                await updateSchemaDoc();
            }

            if (!result.success) {
                console.log(`   ⚠️  일부 마이그레이션 실패 (${result.failed}개)`);
                if (result.errors) {
                    for (const err of result.errors) {
                        console.log(`      - ${err.file}: ${err.error}`);
                    }
                }
            }
            return result;
        } catch (e) {
            console.log(`   ⚠️  통합 엔진 오류, fallback 사용: ${e.message}`);
        }
    }

    // ── Fallback: migrate.js가 없을 때 기본 동작 ──
    let dbName = 'clinic-os-db';
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) dbName = match[1];
    }

    const migrationsDir = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'migrations')
        : path.join(PROJECT_ROOT, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('\n⚠️  마이그레이션 폴더 없음');
        return { success: false, applied: 0, failed: 0, error: '마이그레이션 폴더 없음' };
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (migrationFiles.length === 0) {
        console.log('\n✅ 마이그레이션 파일 없음');
        return { success: true, applied: 0, failed: 0 };
    }

    await ensureMigrationsTable(dbName);
    const appliedMigrations = await getAppliedMigrations(dbName);
    const pendingMigrations = migrationFiles.filter(f => !appliedMigrations.has(f));

    if (pendingMigrations.length === 0) {
        console.log(`\n🗃️  마이그레이션 (${migrationFiles.length}개 파일) — 모두 적용됨`);
        return { success: true, applied: 0, failed: 0 };
    }

    console.log(`\n🗃️  마이그레이션 (${pendingMigrations.length}개 적용 예정, fallback 모드)`);

    let applied = 0;
    let errors = 0;

    for (const fileName of pendingMigrations) {
        const filePath = path.join(migrationsDir, fileName);
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes 2>&1`,
            true
        );
        const output = (result.stdout || '') + (result.stderr || '');

        if (result.success || output.includes('already exists') || output.includes('duplicate')) {
            applied++;
            await recordMigration(dbName, fileName);
            console.log(`   ✅ ${fileName}`);
        } else {
            errors++;
            console.log(`   ❌ ${fileName}: ${output.substring(0, 100)}`);
        }
    }

    console.log(`   → 적용: ${applied}, 오류: ${errors}`);
    if (applied > 0) {
        await updateSchemaDoc();
    }

    return { success: errors === 0, applied, failed: errors };
}


/**
 * d1_seeds 테이블 존재 확인 및 생성
 */
async function ensureSeedsTable(dbName) {
    const createTableSql = `CREATE TABLE IF NOT EXISTS d1_seeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
    )`;
    await runCommand(
        `npx wrangler d1 execute ${dbName} --local --command "${createTableSql}" --yes 2>&1`,
        true
    );
}

/**
 * d1_seeds 테이블에서 적용된 seeds 목록 조회
 */
async function getAppliedSeeds(dbName) {
    try {
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "SELECT name FROM d1_seeds ORDER BY id" --json 2>&1`,
            true
        );

        if (result.success && result.stdout) {
            const data = JSON.parse(result.stdout);
            if (data && data[0] && data[0].results) {
                return new Set(data[0].results.map(r => r.name));
            }
        }
    } catch (e) {
        // 테이블이 없거나 파싱 실패 시 빈 Set 반환
    }
    return new Set();
}

/**
 * seed 적용 후 d1_seeds 테이블에 기록
 */
async function recordSeed(dbName, seedName) {
    await runCommand(
        `npx wrangler d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_seeds (name) VALUES ('${seedName}')" --yes 2>&1`,
        true
    );
}

/**
 * 모든 seeds 파일을 스캔하고 미적용 파일 실행
 * - d1_seeds 테이블로 적용 여부 트래킹
 * - migrations와 동일한 패턴으로 동작
 */
async function runAllSeeds() {
    // wrangler.toml에서 DB 이름 가져오기
    let dbName = 'clinic-os-db';
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) dbName = match[1];
    }

    // seeds 폴더 경로 (스타터킷 구조 지원)
    const seedsDir = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'seeds')
        : path.join(PROJECT_ROOT, 'seeds');

    if (!fs.existsSync(seedsDir)) {
        console.log(`\n🌱 Seeds 폴더 없음: ${seedsDir}`);
        return;
    }

    // 항상 제외되는 seeds
    const SKIP_SEEDS = [
        'go_live.sql',               // 프로덕션 전용 (수동 실행)
        'seed_digestive_content.sql', // 대용량 컨텐츠 (선택적)
    ];

    // 샘플/더미 데이터 seeds (개발용, 클라이언트 제외)
    const SAMPLE_SEEDS = [
        'generated_faqs.sql',              // sample_clinic 의존
        'prepare_samples.sql',             // 샘플 데이터 준비
        'knowledge_cards.sql',             // is_sample=1 데이터
        'knowledge_seed.sql',              // is_sample=1 데이터
        'program_translations_sample.sql', // 샘플 번역
    ];

    // 모든 .sql 파일 가져오기 (정렬됨, 제외 목록 필터링)
    const seedFiles = fs.readdirSync(seedsDir)
        .filter(f => f.endsWith('.sql'))
        .filter(f => !SKIP_SEEDS.includes(f))
        .filter(f => {
            // 스타터킷(클라이언트)에서는 sample_*, dummy_* 패턴 + SAMPLE_SEEDS 제외
            if (IS_STARTER_KIT) {
                if (f.startsWith('sample_') || f.startsWith('dummy_')) return false;
                if (SAMPLE_SEEDS.includes(f)) return false;
            }
            return true;
        })
        .sort();

    if (seedFiles.length === 0) {
        return;
    }

    // d1_seeds 테이블 존재 확인 및 생성
    await ensureSeedsTable(dbName);

    // 이미 적용된 seeds 조회
    const appliedSeeds = await getAppliedSeeds(dbName);

    // 새로 적용해야 할 seeds 필터링
    const pendingSeeds = seedFiles.filter(f => !appliedSeeds.has(f));

    if (pendingSeeds.length === 0) {
        console.log(`\n🌱 Seeds (${seedFiles.length}개 파일)`);
        console.log(`   → 모든 seeds 이미 적용됨`);
        return;
    }

    console.log(`\n🌱 Seeds 적용 중... (${pendingSeeds.length}/${seedFiles.length}개)`);

    let appliedCount = 0;
    let errorCount = 0;

    for (const fileName of pendingSeeds) {
        const filePath = path.join(seedsDir, fileName);

        try {
            const result = await runCommand(
                `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes 2>&1`,
                true
            );

            // wrangler 출력은 stderr에 오는 경우가 많음
            const output = result.stderr || result.stdout || '';

            if (result.success) {
                await recordSeed(dbName, fileName);
                console.log(`   ✅ ${fileName}`);
                appliedCount++;
            } else {
                // UNIQUE constraint 에러는 성공으로 처리 (데이터 이미 존재)
                if (output.includes('UNIQUE constraint failed')) {
                    await recordSeed(dbName, fileName);
                    console.log(`   ⏭️  ${fileName}: 데이터 이미 존재 (트래킹 등록)`);
                    appliedCount++;
                } else {
                    // 에러 메시지에서 핵심만 추출
                    const errorLines = output.split('\n').filter(l =>
                        l.includes('ERROR') || l.includes('error') || l.includes('Parse error') || l.includes('SQLITE')
                    );
                    const errorMsg = errorLines.length > 0
                        ? errorLines.slice(0, 3).join('\n      ')
                        : output.substring(0, 300) || '실행 실패 (상세 오류 없음)';
                    console.log(`   ⚠️  ${fileName}: 실행 실패`);
                    console.log(`      └─ ${errorMsg}`);
                    errorCount++;
                }
            }
        } catch (e) {
            console.log(`   ❌ ${fileName}: ${e.message}`);
            errorCount++;
        }
    }

    console.log(`   → 적용: ${appliedCount}, 오류: ${errorCount}`);

    // 스타터킷(클라이언트)에서 이전에 적용된 샘플 시드 데이터 정리
    if (IS_STARTER_KIT) {
        await cleanupSampleData(dbName);
    }
}

/**
 * 스타터킷에서 이전에 적용된 샘플/더미 데이터를 정리
 * - is_sample = 1 데이터를 모든 테이블에서 삭제
 * - d1_seeds에서 샘플 시드 기록 제거
 * - 한 번 정리되면 다시 실행되지 않음
 */
async function cleanupSampleData(dbName) {
    const appliedSeeds = await getAppliedSeeds(dbName);

    // 이전에 적용된 샘플/더미 시드가 있는지 확인
    const sampleSeedNames = [...appliedSeeds].filter(name =>
        name.startsWith('sample_') || name.startsWith('dummy_') ||
        name === 'generated_faqs.sql' || name === 'prepare_samples.sql' ||
        name === 'knowledge_cards.sql' || name === 'knowledge_seed.sql' ||
        name === 'program_translations_sample.sql'
    );

    if (sampleSeedNames.length === 0) return;

    console.log(`\n🧹 샘플 데이터 정리 중... (${sampleSeedNames.length}개 시드 감지)`);

    // is_sample = 1 데이터가 있는 모든 테이블에서 삭제 (임시 SQL 파일 사용)
    const cleanupSql = [
        'DELETE FROM patients WHERE is_sample = 1;',
        'DELETE FROM reservations WHERE is_sample = 1;',
        'DELETE FROM payments WHERE is_sample = 1;',
        'DELETE FROM posts WHERE is_sample = 1;',
        'DELETE FROM medical_records WHERE is_sample = 1;',
        'DELETE FROM knowledge_cards WHERE is_sample = 1;',
        'DELETE FROM faq_items WHERE is_sample = 1;',
        'DELETE FROM vendors WHERE is_sample = 1;',
        'DELETE FROM inventory_items WHERE is_sample = 1;',
        'DELETE FROM products WHERE is_sample = 1;',
        'DELETE FROM promotions WHERE is_sample = 1;',
        'DELETE FROM manual_pages WHERE is_sample = 1;',
        'DELETE FROM tasks WHERE is_sample = 1;',
        'DELETE FROM task_templates WHERE is_sample = 1;',
        'DELETE FROM leads WHERE is_sample = 1;',
        'DELETE FROM programs WHERE is_sample = 1;',
        "DELETE FROM web_members WHERE id LIKE 'member_sample_%';",
        "DELETE FROM site_settings WHERE category = 'features' AND key = 'sample_mode';",
    ].join('\n');

    const tmpFile = path.join(PROJECT_ROOT, '.cleanup_sample_data.sql');
    try {
        fs.writeFileSync(tmpFile, cleanupSql, 'utf8');
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --file="${tmpFile}" --yes 2>&1`,
            true
        );
        const output = result.stderr || result.stdout || '';
        if (result.success) {
            console.log(`   ✅ is_sample = 1 데이터 삭제 완료`);
        } else {
            console.log(`   ⚠️  일부 테이블 정리 실패 (무시): ${output.substring(0, 200)}`);
        }
    } catch (e) {
        console.log(`   ⚠️  샘플 데이터 정리 실패 (무시): ${e.message}`);
    } finally {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
    }

    // d1_seeds에서 샘플 시드 기록 제거 (재적용 방지)
    for (const seedName of sampleSeedNames) {
        try {
            await runCommand(
                `npx wrangler d1 execute ${dbName} --local --command "DELETE FROM d1_seeds WHERE name = '${seedName}'" --yes 2>&1`,
                true
            );
        } catch (e) { /* ignore */ }
    }

    console.log(`   ✅ ${sampleSeedNames.length}개 샘플 시드 기록 제거 완료`);
}

// ═══════════════════════════════════════════════════════════════
// core:pull 메인 알고리즘
// ═══════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════
    // 0. 클라이언트 보호 설정 로드 (config.yaml)
    // ═══════════════════════════════════════════════
    loadClientProtectedPages();

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
                    throw new Error(`건강 점수 ${health.score}/100 — npm run health:fix 후 재시도`);
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

        // 완료 메시지
        console.log('\n════════════════════════════════════════════');
        console.log(`✅ Core Pull 완료: ${current} → ${version} (Fresh-with-Migration)`);
        if (freshResult.backupTag) {
            console.log(`🏷️  복구 태그: ${freshResult.backupTag}`);
        }
        console.log('');
        console.log('Next steps:');
        console.log('  1. npm install (if package.json changed)');
        console.log('  2. npm run dev (to test locally)');
        if (freshResult.changes?.length > 0) {
            console.log('  3. .core/client-changes/ 에서 추출된 변경사항 확인');
        }
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
        // Auto-migration: 페이지 충돌 시 자동으로 _local/에 보존
        // config 없이도 클라이언트 수정 사항이 보호됨
        // Vite clinicLocalOverrides 플러그인이 _local/ 우선 적용
        // ═══════════════════════════════════════════════
        if (!dryRun) {
            const autoMigrated = [];
            for (const file of conflicts) {
                // src/pages/ 파일만 자동 마이그레이션 (_local/ Vite 오버라이드 지원)
                // 단, admin 페이지는 제외 (Core 버전 항상 사용)
                if (!file.startsWith('src/pages/')) continue;
                if (file.startsWith('src/pages/admin/')) {
                    console.log(`   ⏭️  ${file} (admin 페이지는 Core 버전 사용, _local로 이전하지 않음)`);
                    continue;
                }
                // 이미 _local에 있으면 스킵
                const relativePage = file.replace(/^src\/pages\//, '');
                const localOverridePath = path.join(
                    PROJECT_ROOT,
                    toLocalPath('src/pages/_local/' + relativePage)
                );
                if (fs.existsSync(localOverridePath)) continue;

                // 현재 클라이언트 버전을 _local/에 복사
                const clientFilePath = path.join(PROJECT_ROOT, toLocalPath(file));
                if (fs.existsSync(clientFilePath)) {
                    fs.ensureDirSync(path.dirname(localOverridePath));
                    fs.copySync(clientFilePath, localOverridePath);
                    autoMigrated.push(file);
                }
            }
            if (autoMigrated.length > 0) {
                console.log(`\n🔀 Auto-migration: ${autoMigrated.length}개 페이지를 _local/로 보존`);
                autoMigrated.forEach(f => {
                    const rel = f.replace(/^src\/pages\//, '');
                    console.log(`   📄 ${f} → src/pages/_local/${rel}`);
                });
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
                }
            }
        }
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
            const manifestPath = path.join(PROJECT_ROOT, '.docking/protection-manifest.yaml');
            if (fs.existsSync(manifestPath)) {
                const newManifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));
                const newCorePaths = newManifest?.core_paths || [];
                const oldCorePathsSet = new Set(CORE_PATHS);
                const addedPaths = newCorePaths.filter(p => !oldCorePathsSet.has(p));

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
    // 11. 완료 메시지
    // ═══════════════════════════════════════════════
    console.log('\n════════════════════════════════════════════');
    console.log(`✅ Core Pull 완료: ${current} → ${version}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. npm install (if package.json changed)');
    console.log('  2. npm run dev (to test locally)');
    console.log('════════════════════════════════════════════');

    await refreshAgentRuntimeContext();

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

async function promptUserConfirmation(message = '계속 진행하시겠습니까?', autoMode = false) {
    // Auto 모드에서는 자동으로 true 반환
    if (autoMode || isAutoMode(process.argv.slice(2))) {
        console.log(`   🤖 Auto 모드: "${message}" → 예`);
        return true;
    }

    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Zero-Interaction Mode & Smart Update Strategy
// ═══════════════════════════════════════════════════════════════

/**
 * Auto 모드 감지
 * --auto 플래그 또는 CI/CLINIC_OS_AUTO 환경 변수
 */
function isAutoMode(args) {
    if (args.includes('--auto')) return true;
    if (process.env.CI === 'true' || process.env.CI === '1') return true;
    if (process.env.CLINIC_OS_AUTO === 'true' || process.env.CLINIC_OS_AUTO === '1') return true;
    return false;
}

/**
 * 버전 차이 계산
 * @returns {Object} { major, minor, patch, totalMigrations }
 */
function calculateVersionDiff(currentVersion, targetVersion, migrationCount = 0) {
    const parse = (v) => {
        const cleaned = (v || '0.0.0').replace(/^v/, '');
        const parts = cleaned.split('.').map(Number);
        return {
            major: parts[0] || 0,
            minor: parts[1] || 0,
            patch: parts[2] || 0
        };
    };

    const current = parse(currentVersion);
    const target = parse(targetVersion);

    return {
        major: target.major - current.major,
        minor: target.minor - current.minor,
        patch: target.patch - current.patch,
        totalMigrations: migrationCount
    };
}

// ═══════════════════════════════════════════════════════════════
// Smart Update Fallback 함수들
// smart-update.js가 없을 때 사용되는 내장 구현
// 상단의 let 변수에 할당됨 (smart-update.js import 실패 시)
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
            await corePull(targetVersion, { dryRun: true, forceBootstrap });
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
        await corePull(result.target, { dryRun: false, forceBootstrap, autoMode });

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
// npm run core:pull -- --force-bootstrap → 마이그레이션 bootstrap 모드 강제 실행
//
// 환경 변수:
// CI=true 또는 CLINIC_OS_AUTO=true    → --auto 플래그와 동일

main();
