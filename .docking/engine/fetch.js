import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// --- Configuration ---
const CONFIG_PATH = path.join(PROJECT_ROOT, '.docking/config.yaml');

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`연결 시간 초과 (${timeout / 1000}초). HQ 서버가 응답하지 않거나 네트워크 상태를 확인해 주세요.`);
        }
        throw error;
    }
}

function getConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('❌ .docking/config.yaml not found. Run setup-clinic first:');
        console.error('   node scripts/setup-clinic.js');
        process.exit(1);
    }
    return yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

async function getCoreVersion() {
    const pkgPath = path.join(PROJECT_ROOT, 'core/package.json');
    if (!fs.existsSync(pkgPath)) {
        return '0.0.0';
    }

    // Try to get version from git tag if available
    const corePath = path.join(PROJECT_ROOT, 'core');
    if (fs.existsSync(path.join(corePath, '.git'))) {
        return new Promise((resolve) => {
            exec('git describe --tags --abbrev=0', { cwd: corePath }, (error, stdout) => {
                if (error) {
                    const pkg = fs.readJsonSync(pkgPath);
                    resolve(pkg.version || '0.0.0');
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    } else {
        const pkg = fs.readJsonSync(pkgPath);
        return pkg.version || '0.0.0';
    }
}

async function checkForUpdates(config, channel = 'stable') {
    console.log(`🔍 Checking for updates from HQ (channel: ${channel})...`);

    const currentVersion = await getCoreVersion();
    const body = {
        current_version: currentVersion,
        device_token: config.device_token || config.license_key,
        channel: channel
    };

    if (!body.device_token) {
        throw new Error('No authentication credentials found. Run setup-clinic first.');
    }

    const response = await fetchWithTimeout(`${config.hq_url}/api/v1/check-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to check updates');
    }

    return response.json();
}

function runCommand(cmd, cwd = PROJECT_ROOT, silent = false) {
    return new Promise((resolve) => {
        exec(cmd, { cwd, shell: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                if (!silent) console.error(`   ❌ Error: ${error.message}`);
                resolve({ success: false, stdout: '', stderr: stderr || error.message });
                return;
            }
            resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
        });
    });
}

/**
 * wrangler.toml에서 DB 이름 가져오기
 */
function getDbName() {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) return match[1];
    }
    return 'clinic-os-dev';
}

/**
 * 새로 추가된 마이그레이션 파일만 실행
 * @param {string[]} migrationFiles - git diff로 찾은 새 마이그레이션 파일 경로 배열
 * @param {string} corePath - core 디렉토리 경로
 */
async function runNewMigrations(migrationFiles, corePath) {
    const dbName = getDbName();

    for (const migFile of migrationFiles) {
        const fileName = path.basename(migFile);
        const filePath = path.join(corePath, migFile);

        if (!fs.existsSync(filePath)) {
            console.log(`   ⚠️  ${fileName}: 파일 없음 (스킵)`);
            continue;
        }

        process.stdout.write(`   🔄 ${fileName}... `);

        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes`,
            PROJECT_ROOT,
            true
        );

        if (result.success || result.stderr?.includes('already exists')) {
            console.log('✅');
        } else {
            console.log(`❌ ${result.stderr}`);
        }
    }
}

async function updateViaGit(config, updateInfo, currentVersion) {
    const corePath = path.join(PROJECT_ROOT, 'core');
    const version = updateInfo.latest_version;
    const gitUrl = updateInfo.git_url;

    if (!fs.existsSync(path.join(corePath, '.git'))) {
        throw new Error('Git 저장소가 감지되지 않았습니다. setup-clinic을 다시 실행하세요.');
    }

    console.log(`   🚀 업데이트 중: ${currentVersion} → ${version}`);
    await runCommand(`git remote set-url origin ${gitUrl}`, corePath);

    console.log("   📥 변경사항을 가져오는 중...");
    const fetchResult = await runCommand(`git fetch --tags --force`, corePath);
    if (!fetchResult.success) throw new Error('Git fetch 실패');

    // Get current commit before checkout
    const beforeCommit = await runCommand(`git rev-parse HEAD`, corePath, true);

    console.log(`   🛠️  버전 전환: v${version}...`);
    const checkoutResult = await runCommand(`git checkout v${version} || git checkout ${version}`, corePath);
    if (!checkoutResult.success) throw new Error('Git checkout 실패');

    // Get commit after checkout
    const afterCommit = await runCommand(`git rev-parse HEAD`, corePath, true);

    // Show change statistics
    if (beforeCommit.stdout && afterCommit.stdout && beforeCommit.stdout !== afterCommit.stdout) {
        const diffStat = await runCommand(
            `git diff --stat ${beforeCommit.stdout}..${afterCommit.stdout} 2>/dev/null | tail -1`,
            corePath, true
        );
        if (diffStat.stdout) {
            console.log(`   📊 ${diffStat.stdout}`);
        }

        // Show changed file count by type
        const diffFiles = await runCommand(
            `git diff --name-only ${beforeCommit.stdout}..${afterCommit.stdout} 2>/dev/null`,
            corePath, true
        );

        // 새로 추가된 마이그레이션 파일만 추출 (--diff-filter=A)
        const newMigrations = await runCommand(
            `git diff --name-only --diff-filter=A ${beforeCommit.stdout}..${afterCommit.stdout} -- migrations/*.sql 2>/dev/null`,
            corePath, true
        );

        if (diffFiles.stdout) {
            const files = diffFiles.stdout.split('\n').filter(f => f);
            const migrations = files.filter(f => f.startsWith('migrations/')).length;
            const src = files.filter(f => f.startsWith('src/')).length;
            const other = files.length - migrations - src;

            console.log(`   📁 변경된 파일: ${files.length}개 (src: ${src}, migrations: ${migrations}, 기타: ${other})`);
        }

        // 새로 추가된 마이그레이션만 실행
        if (newMigrations.stdout) {
            const newMigFiles = newMigrations.stdout.split('\n').filter(f => f && f.endsWith('.sql'));
            if (newMigFiles.length > 0) {
                console.log(`\n🗃️  새 마이그레이션 ${newMigFiles.length}개 감지됨`);
                await runNewMigrations(newMigFiles, corePath);
            } else {
                console.log('\n✅ 새 마이그레이션 없음');
            }
        } else {
            console.log('\n✅ 새 마이그레이션 없음');
        }
    } else {
        console.log(`   ℹ️  파일 변경 없음 (동일 커밋)`);
    }

    // Sync Shell Scripts (Starter Kit Maintenance)
    try {
        console.log("   🔄 유지보수 스크립트 동기화 중...");
        const shellScripts = ['scripts/setup-clinic.js'];
        for (const script of shellScripts) {
            const src = path.join(corePath, script);
            const dest = path.join(process.cwd(), script);
            if (fs.existsSync(src)) {
                fs.copySync(src, dest, { overwrite: true });
                console.log(`      ✨ Updated: ${script}`);
            }
        }
    } catch (e) {
        console.warn("   ⚠️  스크립트 동기화 실패 (무시됨):", e.message);
    }

    return true;
}

async function main() {
    console.log('🚢 Clinic-OS Package Fetcher v3.1 (Git-Native + Channels)\n');

    // Parse command line args for channel
    const args = process.argv.slice(2);
    let channel = 'stable'; // Default channel

    for (const arg of args) {
        if (arg.startsWith('--channel=')) {
            channel = arg.split('=')[1];
        } else if (arg === '--beta') {
            channel = 'beta';
        } else if (arg === '--stable') {
            channel = 'stable';
        }
    }

    try {
        const config = getConfig();
        const currentVersion = await getCoreVersion();

        console.log(`   Clinic: ${config.clinic_name || 'Unknown'}`);
        console.log(`   Current version: ${currentVersion}`);
        console.log(`   Channel: ${channel}`);
        console.log(`   HQ Server: ${config.hq_url}\n`);

        const updateInfo = await checkForUpdates(config, channel);

        if (!updateInfo.update_available) {
            console.log(`✅ You are already on the latest ${channel} version!`);
            return;
        }

        console.log(`📦 New ${channel} version available: ${updateInfo.latest_version} (${updateInfo.type})`);
        if (updateInfo.release_notes) console.log(`   Release Notes: ${updateInfo.release_notes}`);
        console.log('');

        await updateViaGit(config, updateInfo, currentVersion);

        console.log('\n════════════════════════════════════════════');
        console.log(`✅ Update Successful: ${updateInfo.latest_version} (${channel})`);
        console.log('');
        console.log('Next steps:');
        console.log('  1. npm install (if package.json changed)');
        console.log('  2. npm run dev (to test locally)');
        console.log('');
        console.log('💡 마이그레이션은 자동으로 적용되었습니다.');
        console.log('════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
