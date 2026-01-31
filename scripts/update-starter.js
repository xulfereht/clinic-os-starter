/**
 * Clinic-OS Starter Infrastructure Updater
 *
 * HQ API에서 최신 인프라 파일을 다운로드하여 로컬에 적용
 * - Git 인증 없이 업데이트 가능
 * - core:pull 실패 시 이 스크립트로 복구 가능
 *
 * Usage: npm run update:starter
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

// Fallback 파일 목록 (manifest.json 로드 실패 시)
const FALLBACK_INFRA_FILES = [
    '.docking/engine/fetch.js',

    // 설정 및 초기화
    'scripts/setup-clinic.js',
    'scripts/check-system.js',
    'scripts/dev-preflight.js',
    'scripts/deploy-guard.js',
    'scripts/update-starter.js'
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
    try {
        const manifest = await fetchManifest(hqUrl, deviceToken);
        infraFiles = manifest.files || FALLBACK_INFRA_FILES;
        manifestVersion = manifest.version || 'unknown';
        console.log(`   최신 버전: v${manifestVersion} (${infraFiles.length}개 파일)`);
    } catch (e) {
        console.log(`   ⚠️  manifest 로드 실패, fallback 사용 (${FALLBACK_INFRA_FILES.length}개 파일)`);
    }

    // 3. 파일 다운로드 및 적용
    console.log('\n📦 인프라 파일 업데이트 중...\n');

    let successCount = 0;
    let failCount = 0;

    for (const file of infraFiles) {
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

    // 4. core/ 폴더가 있으면 인프라 파일 복사 (스타터킷 구조 지원)
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
                    fs.ensureDirSync(path.dirname(destPath));
                    fs.copyFileSync(srcPath, destPath);
                    coreCopyCount++;
                } catch (e) {
                    // 복사 실패해도 계속 진행
                }
            }
        }
        console.log(`   ✅ ${coreCopyCount}개 파일 core/에 동기화 완료`);
    }

    // 5. 결과 출력
    console.log('\n════════════════════════════════════════════');
    if (failCount === 0) {
        console.log(`✅ 업데이트 완료! (${successCount}개 파일)`);
        console.log('\n다음 단계:');
        console.log('  npm run dev         # 개발 서버 시작');
    } else {
        console.log(`⚠️  일부 파일 업데이트 실패 (성공: ${successCount}, 실패: ${failCount})`);
        console.log('\n문제가 계속되면:');
        console.log('  1. HQ 서버 상태 확인');
        console.log('  2. 네트워크 연결 확인');
        console.log('  3. device_token 유효성 확인');
    }
    console.log('════════════════════════════════════════════');
}

updateStarterFiles().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
