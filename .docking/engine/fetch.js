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

function runCommand(cmd, cwd = PROJECT_ROOT) {
    return new Promise((resolve) => {
        exec(cmd, { cwd, shell: true }, (error) => {
            if (error) {
                console.error(`   ❌ Error: ${error.message}`);
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

async function updateViaGit(config, updateInfo) {
    const corePath = path.join(PROJECT_ROOT, 'core');
    const version = updateInfo.latest_version;
    const gitUrl = updateInfo.git_url;

    if (!fs.existsSync(path.join(corePath, '.git'))) {
        throw new Error('Git 저장소가 감지되지 않았습니다. setup-clinic을 다시 실행하세요.');
    }

    console.log(`   🚀 업데이트 패치 중: ${version}...`);
    await runCommand(`git remote set-url origin ${gitUrl}`, corePath);

    console.log("   📥 변경사항을 가져오는 중...");
    if (!(await runCommand(`git fetch --tags --force`, corePath))) throw new Error('Git fetch 실패');

    console.log(`   🛠️  버전 전환 (Checkout): ${version}...`);
    if (!(await runCommand(`git checkout v${version} || git checkout ${version}`, corePath))) throw new Error('Git checkout 실패');

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

        await updateViaGit(config, updateInfo);

        console.log('\n════════════════════════════════════════════');
        console.log(`✅ Update Successful: ${updateInfo.latest_version} (${channel})`);
        console.log('');
        console.log('Next steps:');
        console.log('  1. npm install (if package.json changed)');
        console.log('  2. npx wrangler d1 execute ... (apply migrations)');
        console.log('════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
