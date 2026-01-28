import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

const execAsync = promisify(exec);

async function checkCommand(command, versionArg = '--version') {
    try {
        const { stdout } = await execAsync(`${command} ${versionArg}`);
        return { installed: true, version: stdout.trim() };
    } catch (error) {
        return { installed: false };
    }
}

async function checkNetwork() {
    try {
        // Test connectivity to npm registry
        const { stdout } = await execAsync('curl -Is https://registry.npmjs.org --connect-timeout 5');
        return true;
    } catch (error) {
        return false;
    }
}

function isWSL() {
    try {
        if (os.platform() !== 'linux') return false;
        const release = fs.readFileSync('/proc/version', 'utf8');
        return release.toLowerCase().includes('microsoft');
    } catch (e) {
        return false;
    }
}

function checkPathConflict() {
    // Check if the current node executable is actually a Windows path
    // In WSL, process.execPath should be something like /usr/bin/node
    // If it's something like /mnt/c/..., it's a Windows node running in WSL
    const execPath = process.execPath;
    if (execPath.startsWith('/mnt/c/') || execPath.includes(':\\')) {
        return { conflict: true, path: execPath };
    }
    return { conflict: false };
}

async function askToInstall(question, command) {
    const rl = (await import('readline')).createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(`\n❓ ${question} (y/n): `, async (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
                console.log(`   Running: ${command}`);
                try {
                    const { stdout, stderr } = await execAsync(command);
                    if (stdout) console.log(stdout);
                    resolve(true);
                } catch (e) {
                    console.error(`   ❌ 설치 실패: ${e.message}`);
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    });
}

async function runCheck() {
    console.log('🔍 System Health Check...\n');

    const platform = os.platform();
    const inWSL = isWSL();

    // 1. Platform Identification
    if (platform === 'win32' && !inWSL) {
        console.log('🪟 Windows Native 환경 확인됨.');
        console.log('💡 Antigravity의 원활한 동작을 위해 네이티브 환경(CMD/PowerShell) 사용을 권장합니다.\n');
    } else if (inWSL) {
        console.log('🐧 WSL(Linux) 환경 확인됨.');
    } else {
        console.log(`🍎 Native ${platform === 'darwin' ? 'macOS' : 'Linux'} 확인됨.`);
    }

    // 2. Platform-specific setup
    const results = {
        node: await checkCommand('node'),
        git: await checkCommand('git'),
        wrangler: await checkCommand('npx wrangler', '--version'),
        os: platform,
        isWSL: inWSL
    };

    if (inWSL) {
        const pathConflict = checkPathConflict();
        if (pathConflict.conflict) {
            console.log('\n⚠️  **경로 충돌 주의 (Path Conflict)**');
            console.log(`   현재 윈도우용 Node가 리눅스 환경에서 실행되고 있습니다: ${pathConflict.path}`);
            console.log('   이 경우 파일 경로 인식 오류(ENOENT)가 발생할 수 있습니다.');
            console.log('\n👉 **해결 방법**:');
            console.log('   1. 리눅스 내부에서 `sudo apt install nodejs`가 완료되었는지 확인하세요.');
            console.log('   2. `npm run setup` 대신 `node scripts/setup-clinic.js`를 직접 입력하세요.\n');
        }

        // WSL 재접속 가이드
        console.log('💡 WSL 재접속 팁: CMD/PowerShell에서 `wsl ~` 명령으로 홈 디렉토리로 진입하세요.');
        console.log('   (`wsl`만 입력하면 /mnt/c/... Windows 경로로 시작될 수 있습니다)\n');
    }

    let hasError = false;

    // Node.js Check
    if (results.node.installed) {
        const versionMatch = results.node.version.match(/v(\d+)/);
        const versionMajor = versionMatch ? parseInt(versionMatch[1]) : 0;
        if (versionMajor < 18) {
            console.log('❌ Node.js 버전이 낮습니다 (18+ 필요). 현재:', results.node.version);
            if (platform === 'win32') {
                console.log('   👉 해결 방법: https://nodejs.org 에서 최신 LTS 버전을 설치하거나, fnm/nvm-windows를 사용하세요.');
            }
            hasError = true;
        } else {
            console.log('✅ Node.js:', results.node.version);
        }
    } else {
        console.log('❌ Node.js가 설치되어 있지 않습니다.');
        if (inWSL) {
            const ok = await askToInstall(
                'WSL 내부에 Node.js를 설치하시겠습니까?',
                'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs'
            );
            if (ok) return runCheck(); // Re-run check
        } else if (platform === 'win32') {
            console.log('   👉 해결 방법: https://nodejs.org 에서 최신 LTS 버전을 설치하세요.');
        }
        hasError = true;
    }

    // Git Check
    if (results.git.installed) {
        console.log('✅ Git:', results.git.version);
    } else {
        console.log('❌ Git이 설치되어 있지 않습니다.');
        if (inWSL) {
            const ok = await askToInstall('WSL 내부에 Git을 설치하시겠습니까?', 'sudo apt update && sudo apt install -y git');
            if (ok) return runCheck();
        } else if (platform === 'win32') {
            console.log('   👉 해결 방법: https://git-scm.com 에서 Git for Windows를 설치하세요.');
        } else if (platform === 'darwin') {
            const ok = await askToInstall('macOS에 Git을 설치하시겠습니까? (Xcode Tools 사용)', 'xcode-select --install');
            if (ok) console.log('💡 설치 창이 떴습니다. 설치를 완료한 후 다시 실행하세요.');
        }
        hasError = true;
    }

    // Unzip Check (WSL/Linux only - required for starter kit download)
    if (inWSL || platform === 'linux') {
        const unzip = await checkCommand('unzip', '-v');
        if (unzip.installed) {
            console.log('✅ unzip: 설치됨');
        } else {
            console.log('⚠️  unzip이 설치되어 있지 않습니다. (스타터킷 다운로드에 필요)');
            const ok = await askToInstall('unzip을 설치하시겠습니까?', 'sudo apt update && sudo apt install -y unzip');
            if (ok) return runCheck();
        }
    }

    // 3. Network Check
    console.log('🌐 네크워크 연결 확인 중 (npm registry)...');
    const isOnline = await checkNetwork();
    if (isOnline) {
        console.log('✅ Network: 정상');
    } else {
        console.log('❌ Network: 연결 오류 또는 매우 느림');
        if (inWSL) {
            console.log('   💡 WSL DNS 설정 문제일 수 있습니다.');
            console.log('   💡 해결 방법: `sudo rm /etc/resolv.conf && echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf`');
        }
        hasError = true;
    }

    // Wrangler Check
    if (results.wrangler.installed) {
        console.log('✅ Wrangler:', results.wrangler.version);
    } else {
        console.log('⚠️  Wrangler CLI가 감지되지 않았습니다. (npx를 통해 자동 실행됩니다.)');
    }

    if (!hasError) console.log('\n✅ System is ready!');
    return !hasError;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runCheck().then(ok => process.exit(ok ? 0 : 1));
}

export { runCheck };
