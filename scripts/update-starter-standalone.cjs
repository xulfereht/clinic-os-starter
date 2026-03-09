#!/usr/bin/env node
/**
 * Clinic-OS Starter Infrastructure Updater (Standalone)
 *
 * 의존성 없이 실행 가능한 버전
 * curl로 다운로드 후 바로 실행 가능
 *
 * Usage:
 *   curl -sO https://clinic-os-hq.pages.dev/api/v1/starter-files/update-starter-standalone.js
 *   node update-starter-standalone.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

// fallback 업데이트 대상 starter 파일 목록
const INFRA_FILES = [
    // 코어 엔진
    '.docking/engine/fetch.js',
    '.docking/engine/migrate.js',
    '.docking/engine/schema-validator.js',
    '.docking/engine/engine-updater.js',
    // 설정 및 초기화
    'scripts/setup-clinic.js',
    'scripts/check-system.js',
    'scripts/dev-preflight.js',
    'scripts/dev-start.js',
    'scripts/deploy-guard.js',
    // DB 관련
    'scripts/db-helper.js',
    'scripts/doctor.js',
    'scripts/db-sync.js',
    // 기능 관련
    'scripts/feature-migrate.js',
    'scripts/create-feature.js',
    // 복구 도구
    'scripts/core-repair.js',
    // 업데이터
    'scripts/update-starter.js',
    'scripts/update-starter-standalone.cjs'
];

const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';
const GENERATED_COMPATIBILITY_DATES = new Set([
    '2024-11-01',
    '2025-01-01',
]);
const TARGET_COMPATIBILITY_DATE = '2026-03-01';
const STARTER_BUNDLE_THRESHOLD = 8;
const STARTER_UPDATE_BUNDLE_FORMAT = 'clinic-os-starter-update-bundle.v1';

function mergeObject(localValue, upstreamValue) {
    return {
        ...(localValue || {}),
        ...(upstreamValue || {}),
    };
}

function mergeStarterPackageJson(localPackageJson = {}, upstreamPackageJson = {}) {
    const merged = {
        ...localPackageJson,
        ...upstreamPackageJson,
    };

    merged.scripts = mergeObject(localPackageJson.scripts, upstreamPackageJson.scripts);
    merged.dependencies = mergeObject(localPackageJson.dependencies, upstreamPackageJson.dependencies);
    merged.devDependencies = mergeObject(localPackageJson.devDependencies, upstreamPackageJson.devDependencies);
    merged.bin = mergeObject(localPackageJson.bin, upstreamPackageJson.bin);
    merged.engines = upstreamPackageJson.engines
        ? { ...upstreamPackageJson.engines }
        : (localPackageJson.engines || undefined);

    return merged;
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return httpsGet(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function httpsGetBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return httpsGetBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function hashBufferSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFileSha256(filePath) {
    return hashBufferSha256(fs.readFileSync(filePath));
}

function getChangedStarterFiles(projectRoot, files, manifestHashes) {
    if (!manifestHashes || Object.keys(manifestHashes).length === 0) {
        return [...files];
    }

    return files.filter((file) => {
        const expectedHash = manifestHashes[file];
        if (!expectedHash) return true;

        const filePath = path.join(projectRoot, file);
        if (!fs.existsSync(filePath)) return true;

        try {
            return hashFileSha256(filePath) !== expectedHash;
        } catch (e) {
            return true;
        }
    });
}

function applyStarterUpdateBundle(projectRoot, bundleBuffer, onlyFiles) {
    const bundle = JSON.parse(zlib.gunzipSync(bundleBuffer).toString('utf8'));
    if (bundle.format !== STARTER_UPDATE_BUNDLE_FORMAT || !bundle.files || typeof bundle.files !== 'object') {
        throw new Error('starter bundle 형식이 올바르지 않습니다.');
    }

    const targetFiles = onlyFiles ? new Set(onlyFiles) : null;
    let appliedCount = 0;
    for (const [file, content] of Object.entries(bundle.files)) {
        if (targetFiles && !targetFiles.has(file)) continue;
        const filePath = path.join(projectRoot, file);
        ensureDir(filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        appliedCount += 1;
    }

    return appliedCount;
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function syncStarterPackageJson(projectRoot) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const localPackageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        : {};
    const rawUpstreamPackageJson = await httpsGet(`${DEFAULT_HQ_URL}/api/v1/starter-files/package.json`);
    const upstreamPackageJson = JSON.parse(rawUpstreamPackageJson);
    const mergedPackageJson = mergeStarterPackageJson(localPackageJson, upstreamPackageJson);
    const changed = JSON.stringify(localPackageJson) !== JSON.stringify(mergedPackageJson);

    if (changed) {
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(mergedPackageJson, null, 2)}\n`);
    }

    return {
        changed,
        fromVersion: localPackageJson.version || '(없음)',
        toVersion: mergedPackageJson.version || '(없음)',
    };
}

function refreshGeneratedWranglerDefaults(projectRoot) {
    const wranglerPath = path.join(projectRoot, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        return { changed: false, updates: [] };
    }

    let content = fs.readFileSync(wranglerPath, 'utf8');
    const updates = [];

    const compatibilityMatch = content.match(/compatibility_date\s*=\s*"([^"]+)"/);
    if (compatibilityMatch && GENERATED_COMPATIBILITY_DATES.has(compatibilityMatch[1])) {
        content = content.replace(
            /compatibility_date\s*=\s*"([^"]+)"/,
            `compatibility_date = "${TARGET_COMPATIBILITY_DATE}"`
        );
        updates.push(`compatibility_date ${compatibilityMatch[1]} → ${TARGET_COMPATIBILITY_DATE}`);
    }

    if (content.includes('pages_build_output_dir = "dist"')) {
        content = content.replace('pages_build_output_dir = "dist"', 'pages_build_output_dir = "core/dist"');
        updates.push('pages_build_output_dir dist → core/dist');
    }

    if (updates.length > 0) {
        fs.writeFileSync(wranglerPath, content);
    }

    return { changed: updates.length > 0, updates };
}

function findProjectRoot() {
    let current = process.cwd();
    while (current !== '/') {
        if (fs.existsSync(path.join(current, 'package.json'))) {
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8'));
                if (pkg.name === 'clinic-os-client' || pkg.name === 'clinic-os') {
                    return current;
                }
            } catch (e) {}
        }
        current = path.dirname(current);
    }
    return process.cwd();
}

/**
 * Git 명령 실행 (silent)
 */
function runGit(cmd, cwd) {
    try {
        return { success: true, output: execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() };
    } catch (e) {
        return { success: false, output: e.message };
    }
}

/**
 * device_token 읽기 (clinic.json 또는 .docking/config.yaml)
 */
function getDeviceToken(projectRoot) {
    // 1. clinic.json
    const clinicJsonPath = path.join(projectRoot, 'clinic.json');
    if (fs.existsSync(clinicJsonPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(clinicJsonPath, 'utf8'));
            if (config.license_key) return config.license_key;
        } catch (e) {}
    }

    // 2. .docking/config.yaml
    const configYamlPath = path.join(projectRoot, '.docking/config.yaml');
    if (fs.existsSync(configYamlPath)) {
        try {
            const content = fs.readFileSync(configYamlPath, 'utf8');
            const match = content.match(/device_token:\s*["']?([^"'\n]+)["']?/);
            if (match) return match[1];
        } catch (e) {}
    }

    return null;
}

/**
 * HQ API에서 인증된 Git URL 가져오기
 */
function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = JSON.stringify(body);

        const req = https.request({
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * upstream remote 자동 등록
 */
async function ensureUpstreamRemote(projectRoot, hqUrl) {
    // upstream 존재 확인
    const checkResult = runGit('git remote get-url upstream', projectRoot);
    if (checkResult.success) {
        console.log('   ✅ upstream remote 이미 존재');
        return true;
    }

    // device_token 확인
    const deviceToken = getDeviceToken(projectRoot);
    if (!deviceToken) {
        console.log('   ⚠️  device_token 없음 - upstream 등록 스킵 (npm run setup 필요)');
        return false;
    }

    // HQ API에서 git URL 가져오기
    console.log('   🔑 HQ에서 인증된 Git URL 가져오는 중...');
    try {
        const data = await httpsPost(`${hqUrl}/api/v1/update/git-url`, {
            device_token: deviceToken,
            channel: 'stable'
        });

        if (!data.git_url) {
            console.log('   ⚠️  Git URL 획득 실패');
            return false;
        }

        // upstream 등록
        const addResult = runGit(`git remote add upstream "${data.git_url}"`, projectRoot);
        if (!addResult.success) {
            console.log(`   ❌ upstream 등록 실패: ${addResult.output}`);
            return false;
        }

        // push 차단
        runGit('git remote set-url --push upstream DISABLE', projectRoot);
        console.log('   ✅ upstream remote 자동 등록 완료');
        return true;
    } catch (e) {
        console.log(`   ⚠️  HQ 인증 실패: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log('🔄 Clinic-OS Starter Infrastructure Updater\n');

    const PROJECT_ROOT = findProjectRoot();
    console.log(`   Project Root: ${PROJECT_ROOT}`);
    console.log(`   HQ Server: ${DEFAULT_HQ_URL}`);

    // manifest/버전 정보 조회
    console.log('\n📥 최신 버전 확인 중...');
    let manifest = null;
    let infraFiles = INFRA_FILES;
    try {
        const manifestData = await httpsGet(`${DEFAULT_HQ_URL}/api/v1/starter-files/manifest.json`);
        manifest = JSON.parse(manifestData);
        infraFiles = manifest.files || INFRA_FILES;
        console.log(`   최신 버전: v${manifest.version} (${infraFiles.length}개 파일)`);
    } catch (e) {
        try {
            const versionData = await httpsGet(`${DEFAULT_HQ_URL}/api/v1/update/channel-version?channel=stable`);
            const version = JSON.parse(versionData);
            console.log(`   최신 버전: v${version.version}`);
        } catch {
            console.log('   버전 확인 실패 (계속 진행)');
        }
        console.log(`   ⚠️  starter manifest 로드 실패, fallback 사용 (${infraFiles.length}개 파일)`);
    }

    const changedFiles = getChangedStarterFiles(PROJECT_ROOT, infraFiles, manifest?.hashes || {});
    const skippedFiles = infraFiles.length - changedFiles.length;

    // 파일 다운로드 및 적용
    console.log('\n📦 인프라 파일 업데이트 중...\n');
    console.log(`   변경 파일: ${changedFiles.length}개 / 전체 ${infraFiles.length}개`);
    if (skippedFiles > 0) {
        console.log(`   해시 일치로 건너뜀: ${skippedFiles}개`);
    }

    let successCount = 0;
    let failCount = 0;
    let bundleApplied = false;

    if (changedFiles.length > 0 && manifest && manifest.bundle && manifest.bundle.path && changedFiles.length >= STARTER_BUNDLE_THRESHOLD) {
        try {
            console.log(`\n📦 starter bundle 다운로드 중... (${manifest.bundle.path})`);
            const bundleBuffer = await httpsGetBuffer(`${DEFAULT_HQ_URL}/api/v1/starter-files/${encodeURIComponent(manifest.bundle.path)}`);
            if (manifest.bundle.sha256 && hashBufferSha256(bundleBuffer) !== manifest.bundle.sha256) {
                throw new Error('starter bundle 무결성 검증 실패');
            }
            successCount += applyStarterUpdateBundle(PROJECT_ROOT, bundleBuffer, changedFiles);
            bundleApplied = true;
            console.log(`   ✅ starter bundle 적용 완료 (${successCount}개 파일)`);
        } catch (e) {
            console.log(`   ⚠️  starter bundle 적용 실패, 개별 다운로드로 폴백: ${e.message}`);
        }
    }

    for (const file of bundleApplied ? [] : changedFiles) {
        process.stdout.write(`   ${file}... `);

        try {
            const url = `${DEFAULT_HQ_URL}/api/v1/starter-files/${encodeURIComponent(file)}`;
            const content = await httpsGet(url);

            const filePath = path.join(PROJECT_ROOT, file);
            ensureDir(filePath);
            fs.writeFileSync(filePath, content);

            console.log('✅');
            successCount++;
        } catch (e) {
            console.log(`❌ ${e.message}`);
            failCount++;
        }
    }

    console.log('\n📦 starter package.json 동기화 중...\n');
    try {
        const packageSync = await syncStarterPackageJson(PROJECT_ROOT);
        if (packageSync.changed) {
            console.log(`   package.json... ✅ (${packageSync.fromVersion} → ${packageSync.toVersion})`);
        } else {
            console.log('   package.json... ✅ (이미 최신)');
        }
    } catch (e) {
        console.log(`   package.json... ❌ ${e.message}`);
        failCount++;
    }

    const wranglerRefresh = refreshGeneratedWranglerDefaults(PROJECT_ROOT);
    if (wranglerRefresh.changed) {
        console.log('\n🛠️  wrangler.toml 생성 기본값 보정...');
        for (const update of wranglerRefresh.updates) {
            console.log(`   ✅ ${update}`);
        }
    }

    // core/ 폴더가 있으면 인프라 파일 복사 (스타터킷 구조 지원)
    const coreDir = path.join(PROJECT_ROOT, 'core');
    if (fs.existsSync(coreDir)) {
        console.log('\n🔄 core/ 폴더에 인프라 파일 동기화 중...');
        const coreInfraFiles = [
            '.docking/engine/migrate.js',
            '.docking/engine/fetch.js',
            '.docking/engine/schema-validator.js',
            '.docking/engine/engine-updater.js',
            'scripts/dev-start.js'
        ];
        let coreCopyCount = 0;
        for (const file of coreInfraFiles) {
            const srcPath = path.join(PROJECT_ROOT, file);
            const destPath = path.join(coreDir, file);
            if (fs.existsSync(srcPath)) {
                try {
                    ensureDir(destPath);
                    fs.copyFileSync(srcPath, destPath);
                    coreCopyCount++;
                } catch (e) {
                    // 복사 실패해도 계속 진행
                }
            }
        }
        console.log(`   ✅ ${coreCopyCount}개 파일 core/에 동기화 완료`);
    }

    // upstream remote 자동 등록 (이전 버전 클라이언트 지원)
    console.log('\n🔗 upstream remote 확인 중...');
    await ensureUpstreamRemote(PROJECT_ROOT, DEFAULT_HQ_URL);

    // 결과 출력
    console.log('\n════════════════════════════════════════════');
    if (failCount === 0) {
        console.log(`✅ 업데이트 완료! (적용: ${successCount}개, 건너뜀: ${skippedFiles}개)`);
        if (fs.existsSync(path.join(PROJECT_ROOT, 'scripts/update-starter-core.js'))) {
            console.log('\n다음 단계:');
            console.log('  node scripts/update-starter-core.js --stable  # starter + core 묶음 업데이트');
        }
    } else {
        console.log(`⚠️  일부 파일 업데이트 실패 (성공: ${successCount}, 건너뜀: ${skippedFiles}, 실패: ${failCount})`);
    }
    console.log('════════════════════════════════════════════');
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
