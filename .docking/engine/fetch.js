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
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { exec } from 'child_process';
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

    // 1차: wrangler.toml 우선 탐색 (DB 설정이 여기 있음)
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'wrangler.toml'))) {
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
// 경로 정의 (LOCAL_GIT_ARCHITECTURE.md와 동기화)
// ═══════════════════════════════════════════════════════════════

const CORE_PATHS = [
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

// 클라이언트 전용 경로 (upstream에 없음, 절대 건드리지 않음)
const LOCAL_PREFIXES = [
    'src/lib/local/',
    'src/plugins/local/',
    'src/pages/_local/',
    'src/survey-tools/local/',
    'public/local/',
];

// 클라이언트 설정 파일 (양쪽에 존재하지만 클라이언트 버전 보호)
// ⚠️ 여기에는 모든 클라이언트에 공통되는 항목만 넣을 것
//    클라이언트별 커스텀 페이지는 .docking/config.yaml의 protected_pages 사용
const PROTECTED_EXACT = new Set([
    'wrangler.toml',
    'clinic.json',
    '.docking/config.yaml',
    // 클라이언트 설정/스타일 (모든 클라이언트가 커스터마이징하는 공통 파일)
    'src/config.ts',
    'src/styles/global.css',
]);

const PROTECTED_PREFIXES = [
    '.env',                  // .env, .env.local, .env.production 등
    '.core/',                // 버전 메타데이터
    'src/plugins/local/',    // 로컬 플러그인 (클라이언트 커스텀)
    // .docking/engine/는 보호하지 않음 - fetch.js 업데이트 필요
];

// 특수 머지가 필요한 파일
const SPECIAL_MERGE_FILES = new Set([
    'package.json',
]);

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

async function runCommand(cmd, silent = false) {
    if (!silent) console.log(`   > ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: PROJECT_ROOT,
            maxBuffer: 10 * 1024 * 1024
        });
        return { success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' };
    } catch (error) {
        // exec 에러 시 stdout/stderr가 error 객체에 포함됨
        const stdout = error.stdout?.trim() || '';
        const stderr = error.stderr?.trim() || error.message || '';
        return { success: false, stdout, stderr };
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
        const response = await fetch(`${hqUrl}/api/v1/update/git-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_token: deviceToken, license_key: licenseKey, channel: channel })
        });

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
        const response = await fetch(`${hqUrl}/api/v1/update/channel-version?channel=${channel}`);
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
    if (filePath.startsWith('src/pages/')) {
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

/**
 * Check if the system is in bootstrap mode
 * Bootstrap mode: d1_migrations table is missing OR empty (row count = 0)
 */
async function isBootstrapMode(dbName) {
    try {
        // First check if table exists and get row count in one query
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "SELECT COUNT(*) as count FROM d1_migrations" --json 2>&1`,
            true
        );

        if (result.success && result.stdout) {
            try {
                const data = JSON.parse(result.stdout);
                if (data && data[0] && data[0].results && data[0].results[0]) {
                    const rowCount = data[0].results[0].count;
                    // Table exists but empty = bootstrap mode
                    return rowCount === 0;
                }
            } catch (parseError) {
                // JSON parse failed - treat as bootstrap
                return true;
            }
        }
        // Query failed - likely table doesn't exist = bootstrap mode
        return true;
    } catch (e) {
        // Error checking = bootstrap mode
        return true;
    }
}

/**
 * Parse ALTER TABLE ADD COLUMN SQL to extract table name and column name
 * Supports: ALTER TABLE table_name ADD COLUMN column_name ...
 */
function parseAlterTableSql(sql) {
    // Normalize whitespace for easier parsing
    const normalized = sql.replace(/\s+/g, ' ').trim();

    // Regex pattern: ALTER TABLE table_name ADD COLUMN column_name ...
    const alterRegex = /ALTER\s+TABLE\s+([^\s(]+)\s+ADD\s+COLUMN\s+([^\s(]+)/i;
    const match = normalized.match(alterRegex);

    if (match && match.length >= 3) {
        return {
            tableName: match[1],
            columnName: match[2]
        };
    }

    return null;
}

/**
 * Check if a column exists in a table using PRAGMA table_info()
 * This is the ONLY reliable way to check column existence in SQLite
 */
async function columnExists(dbName, tableName, columnName) {
    try {
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "PRAGMA table_info(${tableName})" --json 2>&1`,
            true
        );

        if (result.success && result.stdout) {
            try {
                const data = JSON.parse(result.stdout);
                if (data && data[0] && data[0].results) {
                    // PRAGMA table_info returns array of column info objects
                    // Each has 'name' property containing column name
                    return data[0].results.some(col => col.name === columnName);
                }
            } catch (parseError) {
                // JSON parse failed - assume column doesn't exist
                return false;
            }
        }
        return false;
    } catch (e) {
        // Error checking = assume column doesn't exist
        return false;
    }
}

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

/**
 * 기존 마이그레이션을 d1_migrations 테이블에 일괄 등록 (최초 1회)
 * - 테이블이 비어있으면 모든 마이그레이션을 "이미 적용됨"으로 등록
 * - 이를 통해 기존 클라이언트도 새 트래킹 시스템으로 전환
 */
async function bootstrapMigrationTracking(dbName, migrationFiles) {
    // 각 마이그레이션을 등록 (INSERT OR IGNORE로 중복 방지)
    const values = migrationFiles.map(f => `('${f}')`).join(',');
    if (values) {
        await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ${values}" --yes 2>&1`,
            true
        );
    }
}

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
 * 마이그레이션 파일을 스캔하고 DB에 적용 (최적화 버전)
 * - d1_migrations 테이블로 적용 여부 추적
 * - 새 마이그레이션만 실행 (기존: 매번 전체 실행)
 * - 적용 후 스키마 문서 자동 갱신
 * - Bootstrap mode: Handles first run with PRAGMA-based column existence check
 */
async function runAllMigrations(forceBootstrap = false) {
    // wrangler.toml에서 DB 이름 가져오기
    let dbName = 'local-clinic-db';
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) dbName = match[1];
    }

    // 마이그레이션 폴더 경로 (스타터킷 구조 지원)
    const migrationsDir = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'migrations')
        : path.join(PROJECT_ROOT, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('\n⚠️  마이그레이션 폴더 없음');
        return;
    }

    // 모든 .sql 파일 가져오기 (정렬됨)
    const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (migrationFiles.length === 0) {
        console.log('\n✅ 마이그레이션 파일 없음');
        return;
    }

    // d1_migrations 테이블 존재 확인 및 생성
    await ensureMigrationsTable(dbName);

    // Check bootstrap mode: table is missing OR empty (row count = 0)
    const bootstrapMode = forceBootstrap || await isBootstrapMode(dbName);

    // 이미 적용된 마이그레이션 조회
    const appliedMigrations = await getAppliedMigrations(dbName);
    const isFirstRun = appliedMigrations.size === 0;

    // 새로 적용해야 할 마이그레이션 필터링
    const pendingMigrations = migrationFiles.filter(f => !appliedMigrations.has(f));

    if (pendingMigrations.length === 0) {
        console.log(`\n🗃️  마이그레이션 (${migrationFiles.length}개 파일)`);
        console.log(`   → 모든 마이그레이션 이미 적용됨`);
        return;
    }

    // Bootstrap mode 안내 메시지
    if (bootstrapMode) {
        console.log(`\n🗃️  Bootstrap Mode: 마이그레이션 (${pendingMigrations.length}개)`);
        console.log(`   → PRAMA 기반 컬럼 존재 확인으로 안전 실행`);
    } else if (isFirstRun) {
        console.log(`\n🗃️  마이그레이션 트래킹 초기화 + 누락분 적용 (${pendingMigrations.length}개)`);
        console.log(`   → 실행 후 결과 기반으로 트래킹 등록`);
    } else {
        console.log(`\n🗃️  마이그레이션 (${pendingMigrations.length}개 새 파일 / 전체 ${migrationFiles.length}개)`);
    }

    let newlyApplied = 0;      // 실제로 새로 적용됨
    let skippedExists = 0;     // 이미 존재하여 스킵 (bootstrap only)
    let alreadyExists = 0;     // 이미 존재 (기존 로직)
    let errorCount = 0;

    for (const fileName of pendingMigrations) {
        const filePath = path.join(migrationsDir, fileName);

        // Read migration SQL to determine type
        const migrationSql = fs.readFileSync(filePath, 'utf8');
        const parsedAlter = parseAlterTableSql(migrationSql);
        const isAlterTable = parsedAlter !== null;

        // Bootstrap mode: Handle ALTER TABLE ADD COLUMN with PRAGMA check
        if (bootstrapMode && isAlterTable) {
            const { tableName, columnName } = parsedAlter;
            const colExists = await columnExists(dbName, tableName, columnName);

            if (colExists) {
                // Column already exists - skip SQL, record as applied
                skippedExists++;
                await recordMigration(dbName, fileName);
                console.log(`   \u23ED\uFE0F  ${fileName} (컬럼 ${tableName}.${columnName} 이미 존재)`);
                continue;
            }
            // Column doesn't exist - proceed with execution
        }

        // TASK-002: SQLITE_BUSY 재시도 래퍼 적용 (Exponential Backoff)
        let result;
        let output;

        try {
            result = await executeWithRetry(async () => {
                const res = await runCommand(
                    `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes 2>&1`,
                    true
                );
                const out = res.stdout + res.stderr;

                // SQLITE_BUSY 오류는 재시도 가능하도록 throw
                if (!res.success && (out.includes('SQLITE_BUSY') || out.includes('database is locked'))) {
                    const error = new Error(`SQLITE_BUSY: ${fileName}`);
                    error.output = out;
                    throw error;
                }

                return { ...res, output: out };
            });
            output = result.output;
        } catch (retryError) {
            // 최대 재시도 후에도 실패
            console.log(`   \u26A0\uFE0F  ${fileName}: ${retryError.message}`);
            errorCount++;
            // Bootstrap mode failures should STOP execution
            if (bootstrapMode) {
                console.log(`   ⛔ Bootstrap mode 실패로 실행 중단`);
                break;
            }
            continue;
        }

        if (result.success) {
            // 성공적으로 새로 적용됨
            newlyApplied++;
            await recordMigration(dbName, fileName);
            console.log(`   \u2705 ${fileName} (\uC801\uC6A9\uB428)`);
        } else if (output.includes('already exists') || output.includes('duplicate')) {
            // 이미 존재 - 기록만 추가 (bootstrap mode에서는 여기 도달하지 않아야 함)
            alreadyExists++;
            await recordMigration(dbName, fileName);
            console.log(`   \u23ED\uFE0F  ${fileName} (\uC774\uBBF8 \uC874\uC7AC)`);
        } else {
            console.log(`   \u274C ${fileName}: ${output.substring(0, 100)}`);
            errorCount++;
            // Bootstrap mode failures should STOP execution
            if (bootstrapMode) {
                console.log(`   ⛔ Bootstrap mode 실패로 실행 중단`);
                break;
            }
        }
    }

    // 결과 요약
    if (bootstrapMode) {
        console.log(`   → 새로 적용: ${newlyApplied}, 스킵 (이미 존재): ${skippedExists}, 오류: ${errorCount}`);
        if (errorCount === 0) {
            console.log(`   ✅ Bootstrap 완료 - 정상 모드로 전환 가능`);
        } else {
            console.log(`   ⚠️  Bootstrap 실패 - 수동 확인 필요`);
        }
    } else if (isFirstRun) {
        console.log(`   → 새로 적용: ${newlyApplied}, 이미 존재: ${alreadyExists}, 오류: ${errorCount}`);
        console.log(`   ✅ 트래킹 초기화 완료 (총 ${newlyApplied + alreadyExists}개 등록)`);
    } else {
        console.log(`   → 적용: ${newlyApplied}, 오류: ${errorCount}`);
    }

    // 마이그레이션 적용 시 스키마 문서 갱신
    if (newlyApplied > 0) {
        await updateSchemaDoc();
    }
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
    let dbName = 'local-clinic-db';
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
    const { dryRun = false, force = false, forceBootstrap = false } = options;

    if (dryRun) {
        console.log('\uD83D\uDD0D Clinic-OS Core Pull DRY-RUN \uBAA8\uB4DC\n');
        console.log('   \uC2E4\uC81C \uD30C\uC77C \uBCC0\uACBD \uC5C6\uC774 \uBCC0\uACBD \uC608\uC815 \uC0AC\uD56D\uB9CC \uCD9C\uB825\uD569\uB2C8\uB2E4.\n');
    } else {
        console.log('\uD83D\uDEA2 Clinic-OS Core Pull v4.3 (Local Git Architecture v1.4)\n');
    }

    // 스타터킷 구조 감지 로그
    if (IS_STARTER_KIT) {
        console.log('📦 스타터킷 구조 감지됨 (core/ 폴더 사용)\n');

        // core/.git이 있으면 제거 (embedded git repo 문제 방지)
        // setup에서 제거되어야 하지만, 안전장치로 여기서도 체크
        const coreGitDir = path.join(PROJECT_ROOT, 'core', '.git');
        if (fs.existsSync(coreGitDir)) {
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
    // 4. 업데이트 대상 파일 (현재태그 ↔ target 태그) 계산
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
                if (!file.startsWith('src/pages/')) continue;
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
    // 8. 모든 마이그레이션 체크 및 적용
    // ═══════════════════════════════════════════════
    await runAllMigrations(forceBootstrap);

    // ═══════════════════════════════════════════════
    // 8.1. 스키마 자동 복구 (마이그레이션 후 누락 테이블/컬럼 보정)
    // - IF NOT EXISTS 미적용 상태에서 partial 실행된 경우 복구
    // - seeds 전에 실행해야 함 (seeds가 테이블 존재에 의존)
    // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════
    // 8.5. Seeds 실행 (샘플 데이터)
    // - seeds 폴더가 있으면 미적용 파일만 실행
    // - 없으면 스킵 (기존 클라이언트는 샘플 불필요)
    // ═══════════════════════════════════════════════
    await runAllSeeds();

    // ═══════════════════════════════════════════════
    // 9. 메타데이터 업데이트 (.core/version)
    // ═══════════════════════════════════════════════
    await writeCoreVersion(version);

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

async function promptUserConfirmation(message = '계속 진행하시겠습니까?') {
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

async function main() {
    const args = process.argv.slice(2);
    let targetVersion = 'latest';  // 기본값: stable 채널
    let dryRun = false;
    let skipConfirm = false;
    let checkOnly = false;
    let forceBootstrap = false;

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
        }
    }

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

        // 확인 프롬프트 (--yes 플래그로 스킵 가능)
        if (!skipConfirm) {
            const confirmed = await promptUserConfirmation('업데이트를 진행하시겠습니까?');
            if (!confirmed) {
                console.log('\n⏹️  업데이트가 취소되었습니다.');
                process.exit(0);
            }
        }

        // 실제 업데이트 진행
        console.log('\n');
        await corePull(result.target, { dryRun: false, forceBootstrap });

        // 스키마 자동복구는 corePull 내부에서 이미 완료
        // 추가 Doctor 실행 불필요 (중복 실행 방지)

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// 사용법:
// npm run core:pull                   → preflight 체크 후 확인 받고 적용 (기본)
// npm run core:pull -- -y             → 확인 없이 바로 적용
// npm run core:pull -- --check        → preflight 체크만 (적용 안 함)
// npm run core:pull -- --beta         → latest-beta 채널
// npm run core:pull -- --dry-run      → 상세 변경 사항 미리보기 (기존 동작)
// npm run core:pull -- v1.0.93        → 특정 버전 직접 지정
// npm run core:pull -- --force-bootstrap → 마이그레이션 bootstrap 모드 강제 실행

main();
