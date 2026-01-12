import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        const { stdout } = await execAsync('node -e "fetch(\'https://registry.npmjs.org\').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"');
        return true;
    } catch (error) {
        return false;
    }
}

async function runDoctor() {
    console.log('\n🏥 Clinic-OS Environment Doctor\n');
    console.log('──────────────────────────────────────────────────────────');

    const platform = os.platform();
    const arch = os.arch();
    console.log(`💻 OS: ${platform} (${arch})`);

    let hasError = false;

    // 1. Node.js Check
    const nodeCheck = await checkCommand('node');
    if (nodeCheck.installed) {
        const versionMatch = nodeCheck.version.match(/v(\d+)/);
        const versionMajor = versionMatch ? parseInt(versionMatch[1]) : 0;
        if (versionMajor < 18) {
            console.log('❌ Node.js: ' + nodeCheck.version + ' (v18+ Required)');
            hasError = true;
        } else {
            console.log('✅ Node.js: ' + nodeCheck.version);
        }
    } else {
        console.log('❌ Node.js: Not installed');
        hasError = true;
    }

    // 2. Git Check
    const gitCheck = await checkCommand('git');
    if (gitCheck.installed) {
        console.log('✅ Git: ' + gitCheck.version);
    } else {
        console.log('❌ Git: Not installed');
        hasError = true;
    }

    // 3. NPM/PNPM/Bun Check
    const npmCheck = await checkCommand('npm');
    console.log(npmCheck.installed ? `✅ NPM: ${npmCheck.version}` : '❌ NPM: Not installed');

    // 4. Wrangler Check
    const wranglerCheck = await checkCommand('npx wrangler', '--version');
    if (wranglerCheck.installed) {
        console.log('✅ Wrangler: ' + wranglerCheck.version);
    } else {
        console.log('⚠️  Wrangler: Not installed (will be used via npx)');
    }

    // 5. Network Check
    process.stdout.write('🌐 Network (Registry): Checking...');
    const isOnline = await checkNetwork();
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    if (isOnline) {
        console.log('✅ Network: Connected to npm registry');
    } else {
        console.log('❌ Network: Connection failed');
        hasError = true;
    }

    console.log('──────────────────────────────────────────────────────────');

    if (hasError) {
        console.log('\n❗ Some issues were found. Please fix them to ensure stability:');

        if (!nodeCheck.installed || (nodeCheck.version && parseInt(nodeCheck.version.match(/v(\d+)/)[1]) < 18)) {
            if (platform === 'win32') {
                console.log('\n🔹 Node.js 설치 (Windows):');
                console.log('   가이드: https://nodejs.org 에서 18.x 또는 20.x(LTS) 버전을 다운로드하여 설치하세요.');
            } else if (platform === 'darwin') {
                console.log('\n🔹 Node.js 설치 (macOS):');
                console.log('   명령어: brew install node@20');
            }
        }

        if (!gitCheck.installed) {
            if (platform === 'win32') {
                console.log('\n🔹 Git 설치 (Windows):');
                console.log('   가이드: https://git-scm.com/download/win 에서 설치하세요.');
            } else if (platform === 'darwin') {
                console.log('\n🔹 Git 설치 (macOS):');
                console.log('   명령어: brew install git');
            }
        }

        console.log('\n💡 모든 도구를 설치한 후 다시 `npm run doctor`를 실행하세요.\n');
        process.exit(1);
    } else {
        console.log('\n🎉 Your environment is ready for Clinic-OS development!');
        console.log('💡 Try `npm run dev` to start the local server.\n');
        process.exit(0);
    }
}

runDoctor().catch(err => {
    console.error('Fatal error in doctor:', err);
    process.exit(1);
});
