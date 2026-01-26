/**
 * Clinic-OS Core Pull (Local Git Architecture v1.3)
 *
 * 클라이언트 소유 Git에서 upstream 태그 기반으로 코어 파일만 업데이트
 * - git diff --name-status 기반 파일단위 적용 (삭제 포함)
 * - LOCAL_PREFIXES는 절대 건드리지 않음
 * - WIP 스냅샷 자동 생성
 * - Channel Tags (latest-stable, latest-beta) 기반 버전 결정
 * - 스타터킷 구조 (core/ 폴더) 자동 감지 및 지원
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

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
    'src/survey-tools/local/',
    'public/local/',
];

// 클라이언트 설정 파일 (양쪽에 존재하지만 클라이언트 버전 보호)
const PROTECTED_EXACT = new Set([
    'wrangler.toml',
    'clinic.json',
    '.docking/config.yaml',
]);

const PROTECTED_PREFIXES = [
    '.env',           // .env, .env.local, .env.production 등
    '.core/',         // 버전 메타데이터
];

// 특수 머지가 필요한 파일
const SPECIAL_MERGE_FILES = new Set([
    'package.json',
]);

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

    // 앱 코드 경로만 core/ 안으로 이동
    const appPaths = ['src/', 'migrations/', 'seeds/', 'public/'];
    const isAppPath = appPaths.some(p => upstreamPath.startsWith(p));

    if (isAppPath) {
        return CORE_DIR + upstreamPath;
    }

    // 인프라 파일은 루트에 유지
    // scripts/, .docking/, docs/, package.json, astro.config.mjs, tsconfig.json
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
    // Exact match
    if (PROTECTED_EXACT.has(filePath)) return true;
    // Prefix match
    return PROTECTED_PREFIXES.some(prefix => filePath.startsWith(prefix));
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
        return { success: false, stdout: '', stderr: error.message };
    }
}

async function isDirty() {
    const result = await runCommand('git status --porcelain', true);
    return result.stdout.length > 0;
}

async function hasStagedChanges() {
    const result = await runCommand('git diff --cached --name-only', true);
    return result.stdout.length > 0;
}

async function createWipSnapshot() {
    console.log('📸 현재 상태 스냅샷(WIP) 저장 중...');
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
 * HQ API에서 채널별 버전 조회
 */
async function getVersionFromHQ(channel = 'stable') {
    // clinic.json에서 HQ URL 읽기
    const clinicJsonPath = path.join(PROJECT_ROOT, 'clinic.json');
    if (!fs.existsSync(clinicJsonPath)) {
        return null;
    }

    try {
        const clinicConfig = fs.readJsonSync(clinicJsonPath);
        const hqUrl = clinicConfig.hq_url || 'https://clinic-os-hq.pages.dev';

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
 * Channel 태그 기반으로 최신 버전 조회
 * latest-stable 또는 latest-beta 태그가 가리키는 실제 v-tag를 반환
 * 태그가 없으면 HQ API에서 조회
 */
async function getChannelVersion(channel = 'stable') {
    const channelTag = channel === 'beta' ? 'latest-beta' : 'latest-stable';

    // 1. channel 태그가 존재하는지 확인
    const tagCheck = await runCommand(`git rev-parse --verify refs/tags/${channelTag}`, true);
    if (!tagCheck.success) {
        console.log(`   ⚠️  ${channelTag} 태그가 없습니다. HQ API 조회 중...`);

        // HQ API에서 채널 버전 조회
        const hqVersion = await getVersionFromHQ(channel);
        if (hqVersion) {
            console.log(`   ✅ HQ에서 ${channel} 버전 확인: ${hqVersion}`);
            return hqVersion;
        }

        throw new Error(`${channelTag} 태그가 없고 HQ API 조회도 실패했습니다. core:push:stable을 먼저 실행하세요.`);
    }

    // 2. channel 태그가 가리키는 커밋 SHA 획득
    const commitResult = await runCommand(`git rev-list -n 1 ${channelTag}`, true);
    if (!commitResult.success) {
        throw new Error(`${channelTag} 커밋을 읽을 수 없습니다.`);
    }
    const commitSha = commitResult.stdout.trim();

    // 3. 해당 커밋의 실제 v-tag 찾기 (latest-* 제외)
    const tagsResult = await runCommand(`git tag --points-at ${commitSha}`, true);
    const tags = tagsResult.stdout.split('\n').filter(t => t && t.startsWith('v') && !t.startsWith('latest'));

    if (tags.length === 0) {
        // 동일 커밋에 v-tag가 없으면 channel 태그의 메시지에서 버전 확인 시도
        // 또는 describe로 가장 가까운 v-tag 찾기
        const describeResult = await runCommand(`git describe --tags --match "v*" ${channelTag}`, true);
        if (describeResult.success) {
            const described = describeResult.stdout.trim();
            // v1.0.93 형식이면 그대로 반환, v1.0.93-5-g12345 형식이면 v1.0.93 추출
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
        throw new Error('.core/version 파일이 없습니다. setup을 다시 실행하세요.');
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
        const [status, ...pathParts] = line.split('\t');
        return { status: status.charAt(0), path: pathParts.join('\t') };
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
 * upstream 태그에서 파일 내용을 가져와 로컬 경로에 저장
 * 스타터킷 구조에서는 경로 변환 적용
 */
async function restoreFileFromUpstream(tag, upstreamPath) {
    const localPath = toLocalPath(upstreamPath);
    const fullLocalPath = path.join(PROJECT_ROOT, localPath);

    // 파일 내용 가져오기
    const result = await runCommand(`git show ${tag}:"${upstreamPath}"`, true);
    if (!result.success) {
        console.log(`   ⚠️  ${upstreamPath}: 파일 내용을 가져올 수 없음`);
        return false;
    }

    // 디렉토리 생성 및 파일 저장
    fs.ensureDirSync(path.dirname(fullLocalPath));
    fs.writeFileSync(fullLocalPath, result.stdout);
    return true;
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
    console.log(`   ✅ 백업 완료: ${backupDir}`);

    return backupDir;
}

function suggestLocalPath(filePath) {
    if (filePath.startsWith('src/pages/')) {
        return filePath.replace('src/pages/', 'src/plugins/local/pages/');
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
    console.log('│  💡 다음 단계:                                               │');
    console.log('│  AI에게 "백업 확인하고 local로 이전해줘" 라고 요청하세요.     │');
    console.log('│                                                             │');
    console.log('│  또는 수동으로:                                              │');
    console.log('│  1. .core-backup/*/manifest.json 확인                       │');
    console.log('│  2. 변경 내용을 src/lib/local/ 등으로 이동                   │');
    console.log('│  3. 백업 폴더 삭제                                          │');
    console.log('└─────────────────────────────────────────────────────────────┘');
}

// ═══════════════════════════════════════════════════════════════
// package.json 머지 (정책 기반)
// ═══════════════════════════════════════════════════════════════

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

        // 5. 스타터킷 구조: 루트 package.json 버전도 동기화
        if (IS_STARTER_KIT && merged.version) {
            const rootPkgPath = path.join(PROJECT_ROOT, 'package.json');
            if (fs.existsSync(rootPkgPath)) {
                const rootPkg = fs.readJsonSync(rootPkgPath);
                if (rootPkg.version !== merged.version) {
                    rootPkg.version = merged.version;
                    fs.writeJsonSync(rootPkgPath, rootPkg, { spaces: 4 });
                    console.log(`   🔄 루트 package.json 버전 동기화: ${merged.version}`);
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

// ═══════════════════════════════════════════════════════════════
// 새 마이그레이션 실행
// ═══════════════════════════════════════════════════════════════

async function runNewMigrations(migrationFiles) {
    if (migrationFiles.length === 0) {
        console.log('\n✅ 새 마이그레이션 없음');
        return;
    }

    console.log(`\n🗃️  새 마이그레이션 ${migrationFiles.length}개 감지됨`);

    // wrangler.toml에서 DB 이름 가져오기
    let dbName = 'local-clinic-db';
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) dbName = match[1];
    }

    for (const migFile of migrationFiles) {
        const fileName = path.basename(migFile);
        // 스타터킷 구조에서는 로컬 경로로 변환
        const localMigFile = toLocalPath(migFile);
        const filePath = path.join(PROJECT_ROOT, localMigFile);

        if (!fs.existsSync(filePath)) {
            console.log(`   ⚠️  ${fileName}: 파일 없음 (스킵)`);
            continue;
        }

        process.stdout.write(`   🔄 ${fileName}... `);

        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes`,
            true
        );

        if (result.success || result.stderr?.includes('already exists')) {
            console.log('✅');
        } else {
            console.log(`❌ ${result.stderr}`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// core:pull 메인 알고리즘
// ═══════════════════════════════════════════════════════════════

async function corePull(targetVersion = 'latest') {
    console.log('🚢 Clinic-OS Core Pull v4.2 (Local Git Architecture v1.3)\n');

    // 스타터킷 구조 감지 로그
    if (IS_STARTER_KIT) {
        console.log('📦 스타터킷 구조 감지됨 (core/ 폴더 사용)\n');
    }

    // ═══════════════════════════════════════════════
    // 0. 사전 체크: dirty면 WIP 스냅샷 커밋
    // ═══════════════════════════════════════════════
    if (await isDirty()) {
        await createWipSnapshot();
    }

    // ═══════════════════════════════════════════════
    // 1. fetch tags (with --force for moving tags like latest-stable, latest-beta)
    // ═══════════════════════════════════════════════
    console.log('📥 upstream 태그를 가져오는 중...');
    // --force: moving tags (latest-stable, latest-beta)가 로컬에 업데이트되도록 함
    const fetchResult = await runCommand('git fetch upstream --tags --force');
    if (!fetchResult.success) {
        throw new Error('upstream fetch 실패. upstream remote가 설정되어 있는지 확인하세요.');
    }

    // ═══════════════════════════════════════════════
    // 2. 타겟 태그 결정 + 존재 검증
    //    - 'latest' (기본) → latest-stable 채널
    //    - 'beta' → latest-beta 채널
    //    - 'v1.0.93' → 직접 지정
    // ═══════════════════════════════════════════════
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
        console.log(`\n✅ 이미 최신입니다. (현재: ${current})`);
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
    // 6. 충돌 = (업데이트 대상 ∩ 클라이언트 수정)
    // ═══════════════════════════════════════════════
    const conflicts = intersect(filesToUpdate, clientTouchedCore)
        .filter(f => !isLocalPath(f)); // LOCAL은 충돌 대상 아님

    let backupDir = null;
    if (conflicts.length > 0) {
        console.log(`\n⚠️  충돌 감지: 코어 파일 ${conflicts.length}개가 로컬에서 수정됨`);
        backupDir = await backupModifiedFiles(conflicts, current, version);
    }

    // ═══════════════════════════════════════════════
    // 7. 파일 단위 적용 (삭제 포함)
    //    순서: PROTECTED → LOCAL → SPECIAL_MERGE → 일반 → ENGINE (마지막)
    //    ⚠️ .docking/engine/ 는 self-update 안전을 위해 마지막에 적용
    // ═══════════════════════════════════════════════
    console.log('\n🔄 코어 파일 적용 중...');

    const fileOps = await gitDiffNameStatus(current, version, CORE_PATHS);
    let appliedCount = 0;
    let deletedCount = 0;
    let protectedCount = 0;
    let localCount = 0;
    const mergeQueue = [];
    const engineQueue = [];  // .docking/engine/ 파일은 마지막에 처리

    for (const { status, path: filePath } of fileOps) {
        // 1. PROTECTED_PATHS → 절대 건드리지 않음 (restore/delete 모두 차단)
        if (isProtectedPath(filePath)) {
            console.log(`   🔒 Protected: ${filePath}`);
            protectedCount++;
            continue;
        }

        // 2. LOCAL_PREFIXES → 클라이언트 소유
        if (isLocalPath(filePath)) {
            localCount++;
            continue;
        }

        // 3. SPECIAL_MERGE_FILES → 머지 큐에 추가
        if (isSpecialMergeFile(filePath)) {
            mergeQueue.push({ status, path: filePath });
            continue;
        }

        // 4. .docking/engine/ → 엔진 큐에 추가 (마지막에 처리)
        if (filePath.startsWith('.docking/engine/')) {
            engineQueue.push({ status, path: filePath });
            continue;
        }

        // 5. 일반 파일: restore/delete 적용
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
    // 7.6. 엔진 파일 처리 (self-update, 마지막에 적용)
    // ⚠️ 현재 실행 중인 스크립트가 업데이트될 수 있음
    // ═══════════════════════════════════════════════
    if (engineQueue.length > 0) {
        console.log(`\n⚙️  엔진 파일 업데이트 중... (${engineQueue.length}개)`);
        for (const { status: opStatus, path: filePath } of engineQueue) {
            if (opStatus === 'D') {
                // 엔진 파일은 루트에 있으므로 경로 변환 불필요
                const fullPath = path.join(PROJECT_ROOT, filePath);
                if (fs.existsSync(fullPath)) {
                    fs.removeSync(fullPath);
                    deletedCount++;
                }
            } else {
                // 엔진 파일은 루트에 있으므로 git restore 사용 가능
                await runCommand(`git restore --source ${version} -- "${filePath}"`, true);
                appliedCount++;
            }
        }
        console.log(`   ✅ 엔진 업데이트 완료`);
    }

    console.log(`\n   ✅ 적용: ${appliedCount}개, 삭제: ${deletedCount}개`);
    console.log(`   ⏭️  스킵: protected=${protectedCount}, local=${localCount}`);

    // ═══════════════════════════════════════════════
    // 8. 새 마이그레이션 감지 및 실행
    // ═══════════════════════════════════════════════
    const newMigrations = fileOps
        .filter(op => op.status === 'A' && op.path.startsWith('migrations/') && op.path.endsWith('.sql'))
        .map(op => op.path);

    await runNewMigrations(newMigrations);

    // ═══════════════════════════════════════════════
    // 9. 메타데이터 업데이트 (.core/version)
    // ═══════════════════════════════════════════════
    await writeCoreVersion(version);

    // ═══════════════════════════════════════════════
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
// CLI Entry Point
// ═══════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);
    let targetVersion = 'latest';  // 기본값: stable 채널

    for (const arg of args) {
        if (arg === '--beta') {
            targetVersion = 'beta';
        } else if (arg === '--stable') {
            targetVersion = 'stable';
        } else if (arg.startsWith('--version=')) {
            targetVersion = arg.split('=')[1];
        } else if (arg.startsWith('v')) {
            targetVersion = arg;
        }
    }

    try {
        await corePull(targetVersion);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// 사용법:
// npm run core:pull              → latest-stable 채널 (기본)
// npm run core:pull -- --beta    → latest-beta 채널
// npm run core:pull -- v1.0.93   → 특정 버전 직접 지정

main();
