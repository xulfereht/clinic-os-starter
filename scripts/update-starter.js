/**
 * Clinic-OS Starter Infrastructure Updater
 *
 * HQ API에서 최신 starter 파일 세트를 다운로드하여 로컬에 적용
 * - Git 인증 없이 업데이트 가능
 * - core:pull 실패 시 이 스크립트로 복구 가능
 *
 * Usage: npm run update:starter
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { mergeStarterPackageJson, writeStarterPackageJson } from './lib/starter-package-merge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';
const GENERATED_COMPATIBILITY_DATES = new Set([
    '2024-11-01',
    '2025-01-01',
]);
const TARGET_COMPATIBILITY_DATE = '2026-03-01';
const STARTER_BUNDLE_THRESHOLD = 8;
const STARTER_UPDATE_BUNDLE_FORMAT = 'clinic-os-starter-update-bundle.v1';
const CORE_INFRA_SYNC_PATHS = [
    '.docking/engine/migrate.js',
    '.docking/engine/fetch.js',
    '.docking/engine/schema-validator.js',
    '.docking/engine/engine-updater.js',
    'scripts/check-in.js',
    'scripts/check-system.js',
    'scripts/db-sync.js',
    'scripts/dev-preflight.js',
    'scripts/dev-start.js',
    'scripts/postbuild-local-override.js',
    'scripts/setup-clinic.js',
    'scripts/db-backup.js',
    'scripts/db-backup-watch.js',
    'scripts/generate-schema-doc.js',
    'scripts/check-core-imports.js',
    'scripts/shared-file-lists.js',
    'scripts/cos-ask',
    'scripts/build-with-support.sh',
    'scripts/lib',
];

function hashBufferSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFileSha256(filePath) {
    return hashBufferSha256(fs.readFileSync(filePath));
}

function getChangedStarterFiles({ projectRoot, files, manifestHashes = {} }) {
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
        } catch {
            return true;
        }
    });
}

function applyStarterUpdateBundle({ projectRoot, bundleBuffer, onlyFiles = null }) {
    const bundle = JSON.parse(zlib.gunzipSync(bundleBuffer).toString('utf8'));
    if (bundle?.format !== STARTER_UPDATE_BUNDLE_FORMAT || !bundle.files || typeof bundle.files !== 'object') {
        throw new Error('starter bundle 형식이 올바르지 않습니다.');
    }

    const targetFiles = onlyFiles ? new Set(onlyFiles) : null;
    let appliedCount = 0;

    for (const [file, content] of Object.entries(bundle.files)) {
        if (targetFiles && !targetFiles.has(file)) continue;

        const filePath = path.join(projectRoot, file);
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        appliedCount += 1;
    }

    return { appliedCount };
}

export function syncCoreInfrastructure(projectRoot = PROJECT_ROOT) {
    const coreDir = path.join(projectRoot, 'core');
    if (!fs.existsSync(coreDir)) {
        return { copied: 0, skipped: 0, missingCore: true };
    }

    let copied = 0;
    let skipped = 0;

    for (const relativePath of CORE_INFRA_SYNC_PATHS) {
        const srcPath = path.join(projectRoot, relativePath);
        const destPath = path.join(coreDir, relativePath);

        if (!fs.existsSync(srcPath)) {
            skipped++;
            continue;
        }

        try {
            fs.ensureDirSync(path.dirname(destPath));
            fs.copySync(srcPath, destPath, { overwrite: true });
            copied++;
        } catch (_) {
            skipped++;
        }
    }

    return { copied, skipped, missingCore: false };
}

// Fallback starter 파일 목록 (manifest.json 로드 실패 시)
const FALLBACK_INFRA_FILES = [
    '.docking/engine/fetch.js',

    // 설정 및 초기화
    'scripts/setup-clinic.js',
    'scripts/check-system.js',
    'scripts/dev-preflight.js',
    'scripts/deploy-guard.js',
    'scripts/update-starter.js',

    // 건강 진단
    'scripts/health-audit.js',
    'scripts/doctor.js'
];

async function fetchManifest(hqUrl, deviceToken) {
    const url = `${hqUrl}/api/v1/starter-files/manifest.json`;
    const headers = { 'Content-Type': 'application/json' };
    if (deviceToken) {
        headers['Authorization'] = `Bearer ${deviceToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Manifest fetch failed: ${response.status}`);
    }

    return await response.json();
}

async function getConfig() {
    const configPath = path.join(PROJECT_ROOT, '.docking/config.yaml');

    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return yaml.load(content);
        } catch (e) {
            console.log('   ⚠️  config.yaml 파싱 실패, 기본값 사용');
        }
    }

    // clinic.json fallback
    const clinicJsonPath = path.join(PROJECT_ROOT, 'clinic.json');
    if (fs.existsSync(clinicJsonPath)) {
        try {
            const clinicConfig = fs.readJsonSync(clinicJsonPath);
            return {
                hq_url: clinicConfig.hq_url || DEFAULT_HQ_URL,
                device_token: null  // clinic.json에는 device_token이 없음
            };
        } catch (e) {
            // ignore
        }
    }

    return { hq_url: DEFAULT_HQ_URL, device_token: null };
}

async function downloadFile(hqUrl, filename, deviceToken) {
    const url = `${hqUrl}/api/v1/starter-files/${encodeURIComponent(filename)}`;

    const headers = {
        'Content-Type': 'application/json'
    };

    if (deviceToken) {
        headers['Authorization'] = `Bearer ${deviceToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`${filename} 다운로드 실패: ${response.status} - ${error}`);
    }

    return await response.text();
}

async function downloadBinaryFile(hqUrl, filename, deviceToken) {
    const url = `${hqUrl}/api/v1/starter-files/${encodeURIComponent(filename)}`;
    const headers = { 'Content-Type': 'application/json' };

    if (deviceToken) {
        headers['Authorization'] = `Bearer ${deviceToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`${filename} 다운로드 실패: ${response.status} - ${error}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function syncStarterPackageJson(hqUrl, deviceToken) {
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const localPackageJson = fs.existsSync(packageJsonPath) ? fs.readJsonSync(packageJsonPath) : {};

    const rawPackageJson = await downloadFile(hqUrl, 'package.json', deviceToken);
    const upstreamPackageJson = JSON.parse(rawPackageJson);
    const mergedPackageJson = mergeStarterPackageJson(localPackageJson, upstreamPackageJson);
    const changed = JSON.stringify(localPackageJson) !== JSON.stringify(mergedPackageJson);

    if (changed) {
        writeStarterPackageJson(packageJsonPath, mergedPackageJson);
    }

    return {
        changed,
        fromVersion: localPackageJson.version || '(없음)',
        toVersion: mergedPackageJson.version || '(없음)',
    };
}

async function refreshGeneratedWranglerDefaults() {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        return { changed: false, updates: [] };
    }

    let content = await fs.readFile(wranglerPath, 'utf8');
    const updates = [];

    const compatibilityMatch = content.match(/compatibility_date\s*=\s*"([^"]+)"/);
    if (compatibilityMatch?.[1] && GENERATED_COMPATIBILITY_DATES.has(compatibilityMatch[1])) {
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
        await fs.writeFile(wranglerPath, content);
    }

    return { changed: updates.length > 0, updates };
}

async function updateStarterFiles() {
    console.log('🔄 Clinic-OS Starter Infrastructure Updater\n');

    // 1. 설정 로드
    const config = await getConfig();
    const hqUrl = config.hq_url || DEFAULT_HQ_URL;
    const deviceToken = config.device_token;

    console.log(`   HQ Server: ${hqUrl}`);
    if (deviceToken) {
        console.log(`   Device Token: ${deviceToken.substring(0, 8)}...`);
    } else {
        console.log('   ⚠️  Device Token 없음 (공개 파일만 다운로드 가능)');
    }

    // 2. manifest.json에서 파일 목록 로드
    console.log('\n📥 파일 목록 확인 중...');
    let infraFiles = FALLBACK_INFRA_FILES;
    let manifestVersion = 'unknown';
    let manifest = null;
    try {
        manifest = await fetchManifest(hqUrl, deviceToken);
        infraFiles = manifest.files || FALLBACK_INFRA_FILES;
        manifestVersion = manifest.version || 'unknown';
        console.log(`   최신 버전: v${manifestVersion} (${infraFiles.length}개 파일)`);
    } catch (e) {
        console.log(`   ⚠️  manifest 로드 실패, fallback 사용 (${FALLBACK_INFRA_FILES.length}개 파일)`);
    }

    const manifestHashes = manifest?.hashes || {};
    const changedFiles = getChangedStarterFiles({
        projectRoot: PROJECT_ROOT,
        files: infraFiles,
        manifestHashes,
    });
    const skippedFiles = infraFiles.length - changedFiles.length;

    console.log('\n📦 starter 파일 업데이트 중...\n');
    console.log(`   변경 파일: ${changedFiles.length}개 / 전체 ${infraFiles.length}개`);
    if (skippedFiles > 0) {
        console.log(`   해시 일치로 건너뜀: ${skippedFiles}개`);
    }

    let successCount = 0;
    let failCount = 0;
    let bundleApplied = false;

    if (changedFiles.length > 0 && manifest?.bundle?.path && changedFiles.length >= STARTER_BUNDLE_THRESHOLD) {
        try {
            console.log(`\n📦 starter bundle 다운로드 중... (${manifest.bundle.path})`);
            const bundleBuffer = await downloadBinaryFile(hqUrl, manifest.bundle.path, deviceToken);
            if (manifest.bundle.sha256 && hashBufferSha256(bundleBuffer) !== manifest.bundle.sha256) {
                throw new Error('starter bundle 무결성 검증 실패');
            }

            const bundleResult = applyStarterUpdateBundle({
                projectRoot: PROJECT_ROOT,
                bundleBuffer,
                onlyFiles: changedFiles,
            });
            successCount += bundleResult.appliedCount;
            bundleApplied = true;
            console.log(`   ✅ starter bundle 적용 완료 (${bundleResult.appliedCount}개 파일)`);
        } catch (error) {
            console.log(`   ⚠️  starter bundle 적용 실패, 개별 다운로드로 폴백: ${error.message}`);
        }
    }

    if (!bundleApplied) {
        for (const file of changedFiles) {
            process.stdout.write(`   ${file}... `);

            try {
                const content = await downloadFile(hqUrl, file, deviceToken);
                const filePath = path.join(PROJECT_ROOT, file);

                // 디렉토리 생성
                fs.ensureDirSync(path.dirname(filePath));

                // 파일 저장
                fs.writeFileSync(filePath, content);

                console.log('✅');
                successCount++;
            } catch (e) {
                console.log(`❌ ${e.message}`);
                failCount++;
            }
        }
    }

    // 3.1 package.json 스크립트/버전 동기화
    console.log('\n📦 starter package.json 동기화 중...\n');
    try {
        const packageSync = await syncStarterPackageJson(hqUrl, deviceToken);
        if (packageSync.changed) {
            console.log(`   package.json... ✅ (${packageSync.fromVersion} → ${packageSync.toVersion})`);
        } else {
            console.log('   package.json... ✅ (이미 최신)');
        }
    } catch (e) {
        console.log(`   package.json... ❌ ${e.message}`);
        failCount++;
    }

    const wranglerRefresh = await refreshGeneratedWranglerDefaults();
    if (wranglerRefresh.changed) {
        console.log('\n🛠️  wrangler.toml 생성 기본값 보정...');
        for (const update of wranglerRefresh.updates) {
            console.log(`   ✅ ${update}`);
        }
    }

    // 4. core/ 폴더가 있으면 핵심 엔진 파일 동기화 (스타터킷 구조 지원)
    const coreInfraSync = syncCoreInfrastructure(PROJECT_ROOT);
    if (!coreInfraSync.missingCore) {
        console.log('\n🔄 core/ 폴더에 인프라 파일 동기화 중...');
        console.log(`   ✅ ${coreInfraSync.copied}개 경로 core/에 동기화 완료`);
    }

    // 4.1 루트 .git 확인 (core:pull에 필요)
    const rootGitDir = path.join(PROJECT_ROOT, '.git');
    if (!fs.existsSync(rootGitDir)) {
        console.log('\n🔧 루트 .git 초기화 중 (core:pull에 필요)...');
        try {
            const { execFileSync } = await import('child_process');
            execFileSync('git', ['init'], { cwd: PROJECT_ROOT, stdio: 'pipe' });
            console.log('   ✅ git init 완료');
        } catch (e) {
            console.log(`   ⚠️  git init 실패: ${e.message}`);
            console.log('   💡 수동으로 실행하세요: cd ' + PROJECT_ROOT + ' && git init');
        }
    }

    // 5. 결과 출력
    console.log('\n════════════════════════════════════════════');
    if (failCount === 0) {
        console.log(`✅ 업데이트 완료! (적용 ${successCount}개, 건너뜀 ${skippedFiles}개)`);
        console.log('\n다음 단계:');
        if (fs.existsSync(path.join(PROJECT_ROOT, 'scripts', 'update-starter-core.js'))) {
            console.log('  node scripts/update-starter-core.js --stable  # starter + core 묶음 업데이트');
        } else {
            console.log('  npm run dev         # 개발 서버 시작');
        }
    } else {
        console.log(`⚠️  일부 파일 업데이트 실패 (성공: ${successCount}, 건너뜀: ${skippedFiles}, 실패: ${failCount})`);
        console.log('\n문제가 계속되면:');
        console.log('  1. HQ 서버 상태 확인');
        console.log('  2. 네트워크 연결 확인');
        console.log('  3. device_token 유효성 확인');
    }
    console.log('════════════════════════════════════════════');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    updateStarterFiles().catch(err => {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    });
}
