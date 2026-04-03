import fs from 'fs-extra';
import path from 'path';
import http from 'http';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { buildNpmCommand } from './lib/npm-cli.js';
import { buildLocalDbBootstrapReport } from './lib/setup-db-bootstrap.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const CLI_ARGS = new Set(process.argv.slice(2));
const IS_AUTO = CLI_ARGS.has('--auto') || !process.stdin.isTTY || process.env.CI === 'true' || process.env.CLINIC_OS_AUTO === 'true';
const FORCE_PARALLEL_INSTALL = CLI_ARGS.has('--parallel-install') || process.env.CLINIC_OS_SETUP_PARALLEL === 'true';
const FORCE_SEQUENTIAL_INSTALL = CLI_ARGS.has('--sequential-install') || process.env.CLINIC_OS_SETUP_SEQUENTIAL === 'true';

// ... Imports ...
import { runCheck } from './check-system.js';
import { runMigrations } from '../.docking/engine/migrate.js';

// ═══════════════════════════════════════════════════════════════
// SQLITE_BUSY 재시도 설정 및 헬퍼
// ═══════════════════════════════════════════════════════════════

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 200, // ms
    retryableErrors: ['SQLITE_BUSY', 'database is locked', 'SQLITE_LOCKED']
};

/**
 * Exponential Backoff 재시도 래퍼
 * SQLITE_BUSY 등 일시적 오류 발생 시 자동 재시도
 * 지연 시간: 200ms, 400ms, 800ms
 */
async function executeWithRetry(fn, config = RETRY_CONFIG) {
    let lastError;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const errorMessage = error.message || error.stderr || String(error);

            const isRetryable = config.retryableErrors.some(
                pattern => errorMessage.includes(pattern)
            );

            if (isRetryable && attempt < config.maxRetries) {
                const delay = Math.pow(2, attempt) * config.baseDelay;
                console.log(`   ⏳ SQLITE_BUSY - ${delay}ms 후 재시도 (${attempt}/${config.maxRetries})`);
                await sleep(delay);
                continue;
            }

            throw error;
        }
    }

    throw lastError;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function execCommandChecked(cmd, options = {}) {
    const cwd = options.cwd || PROJECT_ROOT;
    const timeout = options.timeout;

    try {
        await execAsync(cmd, {
            cwd,
            timeout,
            maxBuffer: 10 * 1024 * 1024,
        });
        return true;
    } catch (error) {
        const message = [
            typeof error.stderr === 'string' ? error.stderr.trim() : error.stderr?.toString?.('utf8')?.trim?.(),
            typeof error.stdout === 'string' ? error.stdout.trim() : error.stdout?.toString?.('utf8')?.trim?.(),
            error.message,
        ].filter(Boolean).join('\n');

        throw new Error(message || `Command failed: ${cmd}`);
    }
}

// ... Configuration ...
const CONFIG_PATH = path.join(PROJECT_ROOT, '.docking/config.yaml');
const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

// Zones that should NEVER be overwritten by a package update
const SAFE_ZONES = [
    '.env',
    'wrangler.toml',
    'data/',
    'dist/',
    'archive/',
    'node_modules/',
    '.git/',
    '.docking/',
    'hq/'
];

// --- Helpers ---

function ask(question, defaultValue = '') {
    if (IS_AUTO) return defaultValue;
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim() || defaultValue);
        });
    });
}

function runCommand(cmd, cwd = PROJECT_ROOT, options = {}) {
    console.log(`   Running: ${cmd}`);
    return new Promise((resolve) => {
        const child = spawn(cmd, {
            cwd,
            stdio: 'inherit',
            shell: true,
            env: {
                ...process.env,
                ...(options.env || {})
            }
        });

        child.on('close', (code) => {
            if (code === 0) resolve(true);
            else {
                console.log(`   ⚠️  Command failed with exit code ${code}`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            console.error(`   ❌ Spawn error: ${err.message}`);
            resolve(false);
        });
    });
}

function shouldUseParallelInstall() {
    if (FORCE_SEQUENTIAL_INSTALL) return false;
    if (FORCE_PARALLEL_INSTALL) return true;

    const totalMemGb = os.totalmem() / 1024 / 1024 / 1024;
    return process.platform !== 'win32' && totalMemGb >= 8;
}

const INSTALL_SMOKE_CHECKS = [
    {
        packageDir: 'node_modules/yargs-parser',
        relativePath: 'node_modules/yargs-parser/build/lib/string-utils.js',
        minBytes: 32,
        requiredSnippets: ['camelCase', 'decamelize', 'looksLikeNumber']
    }
];

function createInstallRuntime(label) {
    const safeLabel = label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `clinic-os-npm-cache-${safeLabel}-`));
    return {
        label,
        cacheDir,
        env: {
            npm_config_cache: cacheDir
        }
    };
}

async function cleanupInstallRuntimes(runtimes) {
    for (const runtime of runtimes) {
        if (!runtime?.cacheDir) continue;
        try {
            await fs.remove(runtime.cacheDir);
        } catch {
            // ignore temp cache cleanup errors
        }
    }
}

export function runInstallSmokeChecks(packageRoot, checks = INSTALL_SMOKE_CHECKS) {
    const issues = [];

    for (const check of checks) {
        const packageDir = path.join(packageRoot, check.packageDir);
        if (!fs.existsSync(packageDir)) continue;

        const targetPath = path.join(packageRoot, check.relativePath);
        if (!fs.existsSync(targetPath)) {
            issues.push(`${check.relativePath} 파일이 없습니다.`);
            continue;
        }

        const content = fs.readFileSync(targetPath);
        if (content.length < (check.minBytes || 1)) {
            issues.push(`${check.relativePath} 파일 크기가 비정상적으로 작습니다 (${content.length} bytes).`);
            continue;
        }

        if (check.requiredSnippets?.length) {
            const text = content.toString('utf8');
            const missing = check.requiredSnippets.filter((snippet) => !text.includes(snippet));
            if (missing.length > 0) {
                issues.push(`${check.relativePath} 파일에서 필요한 식별자를 찾지 못했습니다: ${missing.join(', ')}`);
            }
        }
    }

    return issues;
}

function parseJsonSafely(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function runNpmLsReport(packageRoot) {
    const lsCmd = buildNpmCommand('ls --json --depth=1');

    try {
        const stdout = execSync(lsCmd, {
            cwd: packageRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8'
        });
        return {
            ok: true,
            tree: parseJsonSafely(stdout),
            error: null
        };
    } catch (error) {
        const stdout = typeof error.stdout === 'string' ? error.stdout : error.stdout?.toString?.('utf8');
        const stderr = typeof error.stderr === 'string' ? error.stderr : error.stderr?.toString?.('utf8');

        return {
            ok: false,
            tree: parseJsonSafely(stdout),
            error: stderr || error.message || 'npm ls failed'
        };
    }
}

export function buildInstallValidationReport(packageRoot, options = {}) {
    const packageName = options.packageName || path.basename(packageRoot);
    const lsReport = options.npmLsReport || runNpmLsReport(packageRoot);
    const smokeIssues = runInstallSmokeChecks(packageRoot, options.smokeChecks);
    const npmProblems = Array.isArray(lsReport.tree?.problems) ? lsReport.tree.problems : [];
    const issues = [...npmProblems, ...smokeIssues];

    if (!lsReport.ok && !lsReport.tree) {
        issues.unshift(lsReport.error || `${packageName} npm ls 검증 실패`);
    }

    return {
        packageName,
        ok: issues.length === 0,
        issues,
        npmProblems,
        smokeIssues
    };
}

async function repairDependencies(packageRoot, packageName) {
    const nodeModulesPath = path.join(packageRoot, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        await fs.remove(nodeModulesPath);
    }

    const runtime = createInstallRuntime(`${packageName}-repair`);
    try {
        const installCmd = buildNpmCommand('install --no-audit --no-fund');
        const repaired = await runCommand(installCmd, packageRoot, { env: runtime.env });
        if (!repaired) {
            throw new Error(`${packageName} 의존성 재설치 실패`);
        }
    } finally {
        await cleanupInstallRuntimes([runtime]);
    }

    const validation = buildInstallValidationReport(packageRoot, { packageName });
    if (!validation.ok) {
        throw new Error(`${packageName} 의존성 재설치 후에도 무결성 문제가 남아 있습니다: ${validation.issues.join(' | ')}`);
    }
}

async function installDependenciesForSetup() {
    const installCmd = buildNpmCommand('install --no-audit --no-fund');
    const corePath = path.join(PROJECT_ROOT, 'core');
    const hasCorePackage = fs.existsSync(path.join(corePath, 'package.json'));
    const useParallelInstall = shouldUseParallelInstall() && hasCorePackage;

    if (useParallelInstall) {
        console.log('   🚀 병렬 설치 모드 사용');
        console.log('   - 루트 의존성과 core 의존성을 동시에 설치합니다.');
        console.log('   - 저사양 환경은 --sequential-install 로 순차 실행 가능합니다.');

        const rootRuntime = createInstallRuntime('root');
        const coreRuntime = createInstallRuntime('core');
        let rootOk = false;
        let coreOk = false;

        try {
            [rootOk, coreOk] = await Promise.all([
                runCommand(installCmd, PROJECT_ROOT, { env: rootRuntime.env }),
                runCommand(installCmd, corePath, { env: coreRuntime.env })
            ]);
        } finally {
            await cleanupInstallRuntimes([rootRuntime, coreRuntime]);
        }

        if (!rootOk || !coreOk) {
            throw new Error(`병렬 의존성 설치 실패 (root=${rootOk ? 'ok' : 'fail'}, core=${coreOk ? 'ok' : 'fail'})`);
        }

        const validations = [
            buildInstallValidationReport(PROJECT_ROOT, { packageName: 'root' }),
            buildInstallValidationReport(corePath, { packageName: 'core' })
        ];
        const failed = validations.filter((entry) => !entry.ok);

        if (failed.length === 0) {
            return;
        }

        console.log('   ⚠️  병렬 설치 후 무결성 문제 감지 — 순차 재설치로 복구합니다.');
        for (const entry of failed) {
            console.log(`   - ${entry.packageName}: ${entry.issues.join(' | ')}`);
            await repairDependencies(entry.packageName === 'root' ? PROJECT_ROOT : corePath, entry.packageName);
        }

        return;
    }

    console.log('   🐢 순차 설치 모드 사용');
    const rootOk = await runCommand(installCmd, PROJECT_ROOT);
    if (!rootOk) {
        throw new Error('루트 의존성 설치 실패');
    }

    if (!hasCorePackage) {
        console.log('   ⏭️  core/package.json 없음, core 의존성 설치 생략');
        return;
    }

    const coreOk = await runCommand(installCmd, corePath);
    if (!coreOk) {
        throw new Error('core 의존성 설치 실패');
    }

    const validations = [
        buildInstallValidationReport(PROJECT_ROOT, { packageName: 'root' }),
        buildInstallValidationReport(corePath, { packageName: 'core' })
    ];
    const failed = validations.filter((entry) => !entry.ok);

    if (failed.length > 0) {
        const summary = failed.map((entry) => `${entry.packageName}: ${entry.issues.join(' | ')}`).join(' / ');
        throw new Error(`의존성 설치 무결성 검증 실패 (${summary})`);
    }
}

function getMachineId() {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const userInfo = os.userInfo().username;
    const raw = `${hostname}-${platform}-${arch}-${userInfo}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function getOsInfo() {
    return `${os.platform()} ${os.release()} (${os.arch()})`;
}

function openBrowser(url) {
    const platform = os.platform();
    let cmd;
    if (platform === 'darwin') cmd = `open "${url}"`;
    else if (platform === 'win32') cmd = `start "" "${url}"`;
    else cmd = `xdg-open "${url}"`;

    exec(cmd, (err) => {
        if (err) console.log('   ⚠️  브라우저를 수동으로 열어주세요:', url);
    });
}

// --- Browser-based Device Registration ---

async function registerDeviceViaBrowser(hqUrl) {
    return new Promise((resolve, reject) => {
        const port = 8765; // Local callback port
        const machineId = getMachineId();
        const osInfo = getOsInfo();

        console.log('\n🔐 디바이스 등록을 위해 브라우저가 열립니다...');
        console.log(`   Machine ID: ${machineId.substring(0, 8)}...`);
        console.log(`   OS: ${osInfo}\n`);

        // Create local callback server
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);

            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token');

                if (token) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>등록 완료</title>
                            <style>
                                body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                                .box { text-align: center; padding: 2rem; }
                                h1 { color: #10b981; }
                            </style>
                        </head>
                        <body>
                            <div class="box">
                                <h1>✅ 디바이스 등록 완료!</h1>
                                <p>이 창을 닫고 터미널로 돌아가세요.</p>
                            </div>
                        </body>
                        </html>
                    `);

                    setTimeout(() => {
                        server.close();
                        resolve(token);
                    }, 500);
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Token missing');
                    server.close();
                    reject(new Error('Token not received'));
                }
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        server.listen(port, '127.0.0.1', () => {
            const callbackUrl = encodeURIComponent(`http://127.0.0.1:${port}/callback`);
            const registerUrl = `${hqUrl}/register?callback=${callbackUrl}&machine_id=${machineId}&os_info=${encodeURIComponent(osInfo)}`;

            console.log('   브라우저에서 라이선스 키를 입력하세요.\n');
            openBrowser(registerUrl);
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('Registration timeout (5 minutes)'));
        }, 5 * 60 * 1000);
    });
}

// --- Manual License Key Registration (fallback) ---

async function registerDeviceManually(hqUrl) {
    const licenseKey = await ask('   라이선스 키: ');
    const machineId = getMachineId();
    const osInfo = getOsInfo();
    const deviceName = await ask('   디바이스 이름 (예: 개발용 맥북): ');

    const response = await fetch(`${hqUrl}/api/v1/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            license_key: licenseKey,
            machine_id: machineId,
            os_info: osInfo,
            name: deviceName || undefined
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Registration failed');
    }

    const data = await response.json();
    return data.device_token;
}

// --- Git Core Setup ---

async function setupCoreViaGit(hqUrl, deviceToken, channel = 'stable') {
    console.log("   📂 Git을 통한 애플리케이션 설치를 시작합니다...");

    // 1. Get authenticated Git URL from HQ
    const response = await fetch(`${hqUrl}/api/v1/update/git-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: deviceToken, channel: channel })
    });

    if (!response.ok) {
        throw new Error('Git 다운로드 정보를 가져오지 못했습니다. HQ 서버 상태를 확인하세요.');
    }

    const { git_url, latest_version: version } = await response.json();
    const corePath = path.join(PROJECT_ROOT, 'core');

    // 2. Initialize or Clone
    if (!fs.existsSync(path.join(corePath, '.git'))) {
        console.log(`   🚀 신규 설치: ${version} 버전을 가져오는 중...`);

        // Remove existing core dir if it's not a git repo to avoid conflicts
        if (fs.existsSync(corePath)) await fs.remove(corePath);
        await fs.ensureDir(corePath);

        // Core git setup
        const cloneCmd = `git clone --filter=blob:none --no-checkout ${git_url} .`;
        const checkoutCmd = `git checkout v${version} || git checkout ${version}`;

        const ok = await runCommand(cloneCmd, corePath)
            && await runCommand(checkoutCmd, corePath);

        if (!ok) throw new Error('Git 설치 중 오류가 발생했습니다.');
    } else {
        console.log("   🔄 기존 Git 저장소가 감지되었습니다.");
        console.log(`   현재 버전에서 ${version}(으)로 업데이트합니다.\n`);

        const updateMode = await ask("   업데이트 모드를 선택하세요:\n   [p] Pull - 로컬 변경사항 보존 (충돌 시 Gemini/Claude에게 해결 요청)\n   [r] Reinstall - 클린 재설치 (로컬 변경사항 삭제)\n   선택 (p/r, default: p): ", "p");

        let updateCmd;
        if (updateMode.toLowerCase() === 'r') {
            console.log("\n   🔄 클린 재설치를 진행합니다...");
            updateCmd = `git fetch --tags --force && git reset --hard HEAD && git clean -fd && (git checkout v${version} || git checkout ${version})`;
        } else {
            console.log("\n   🔄 로컬 변경사항을 보존하며 업데이트합니다...");
            updateCmd = `git fetch --tags --force && git stash && (git checkout v${version} || git checkout ${version}) && git stash pop || true`;
        }

        if (!(await runCommand(updateCmd, corePath))) {
            throw new Error('Git 업데이트 중 오류가 발생했습니다. 충돌이 있다면 수동으로 해결해주세요.');
        }
    }

    console.log(`\n   ✅ ${version} 설치 완료!`);
    return true;
}

// --- Main Setup Flow ---

export async function setupClinic() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("   🏥  Clinic-OS 초기 설정 마법사 v3.0  🏥");
    console.log("═══════════════════════════════════════════════════════════\n");

    // CF-First 안내: setup:step 권장
    console.log("💡 권장: 단계별 설치(npm run setup:step -- --next)를 사용하면");
    console.log("   Cloudflare 로그인이 Phase 1에서 자동으로 처리됩니다.");
    console.log("   📖 Cloudflare 셋업 가이드: docs/CLOUDFLARE_SETUP_GUIDE.md\n");

    // 0. System Health Check
    const isReady = await runCheck();
    if (!isReady) {
        console.log("\n❌ 환경 설정이 완료되지 않았습니다. 위 안내에 따라 필수 도구를 설치해주세요.");
        console.log("   공식 설치 기준은 macOS 또는 WSL Ubuntu 입니다.");
        console.log("   도움이 필요하시면 가이드를 확인하세요: https://clinic-os-hq.pages.dev/guide/setup\n");
        process.exit(1);
    }

    // 1. HQ Server URL
    console.log("📡 Step 1: HQ 서버 연결\n");

    let defaultHqUrl = DEFAULT_HQ_URL;
    let defaultClinicName = "";
    let licenseKey = "";

    // Auto-fill from signed clinic.json if exists
    const signedPath = path.join(PROJECT_ROOT, 'clinic.json');
    const hasSignedConfig = fs.existsSync(signedPath);
    let channel = 'stable'; // 기본값
    if (hasSignedConfig) {
        try {
            const signed = fs.readJsonSync(signedPath);
            defaultClinicName = signed.organization || "";
            licenseKey = signed.license_key || "";
            channel = signed.channel || 'stable';
            console.log(`   ✨ Zero-Touch: [clinic.json] 서명된 파일에서 설정을 불러왔습니다.`);
            console.log(`   ✅ 기관명: ${defaultClinicName}`);
            console.log(`   ✅ 라이선스: ${licenseKey.substring(0, 8)}... (매칭됨)`);
            if (channel === 'beta') {
                console.log(`   ✅ 채널: 🧪 Beta`);
            }
        } catch (e) {
            console.log(`   ⚠️  clinic.json 읽기 실패: ${e.message}`);
        }
    }

    let hqUrl = defaultHqUrl;
    if (!hasSignedConfig) {
        let inputHq = await ask(`   HQ 서버 URL (Enter for default [${defaultHqUrl}]): `);
        if (inputHq) hqUrl = inputHq;
    } else {
        console.log(`   → HQ 서버: ${hqUrl} (자동 설정됨)`);
    }

    // 2. Device Registration
    console.log("\n🔐 Step 2: 디바이스 등록\n");

    let deviceToken;
    if (licenseKey) {
        console.log(`   라이선스 키 발견 (${licenseKey.substring(0, 8)}...). 자동 등록을 시도합니다...`);
        try {
            const machineId = getMachineId();
            const osInfo = getOsInfo();
            const response = await fetch(`${hqUrl}/api/v1/register-device`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    license_key: licenseKey,
                    machine_id: machineId,
                    os_info: osInfo,
                    name: defaultClinicName || "Starter Device"
                })
            });
            if (response.ok) {
                const data = await response.json();
                deviceToken = data.device_token;
                console.log('   ✅ 원격 등록 성공!');
            } else {
                const err = await response.json();
                console.log(`   ⚠️  자동 등록 실패: ${err.error || '알 수 없는 오류'}`);
            }
        } catch (e) {
            console.log("   ⚠️  서버 연결 실패. 수동 입력을 진행합니다.");
        }
    }

    if (!deviceToken) {
        if (IS_AUTO) {
            console.error("   ❌ [Auto Mode] 디바이스가 등록되어 있지 않고 라이선스 키도 없습니다.");
            process.exit(1);
        }
        const authMethod = await ask("   인증 방법을 선택하세요:\n   [1] 브라우저에서 인증 (권장)\n   [2] 터미널에서 직접 입력\n   선택 (1/2): ", "1");
        try {
            if (authMethod === '2') {
                deviceToken = await registerDeviceManually(hqUrl);
            } else {
                deviceToken = await registerDeviceViaBrowser(hqUrl);
            }
            console.log('\n   ✅ 디바이스 등록 완료!\n');
        } catch (error) {
            console.error(`\n   ❌ 등록 실패: ${error.message}`);
            process.exit(1);
        }
    }

    // 3. Basic Info
    console.log("📋 Step 3: 기본 정보 확인\n");
    let clinicName = defaultClinicName;
    if (!clinicName) {
        clinicName = await ask(`   한의원 이름: `);
    } else {
        console.log(`   한의원 이름: ${clinicName} (자동 설정됨)`);
    }
    if (!clinicName) clinicName = "My Clinic";

    // 4. Create docking config
    console.log("\n📄 Step 4: 설정 파일 생성\n");

    await fs.ensureDir(path.join(PROJECT_ROOT, '.docking'));

    const configContent = `# Clinic-OS Docking Configuration
hq_url: "${hqUrl}"
device_token: "${deviceToken}"
clinic_name: "${clinicName}"
`;

    await fs.writeFile(CONFIG_PATH, configContent);
    console.log("   ✅ .docking/config.yaml 생성 완료");

    // 5. Fetch & Unpack (Docking via Git)
    console.log("\n🚢 Step 5: 애플리케이션 설치 (Git)\n");
    console.log("   HQ 서버로부터 코어 파일을 안전하고 빠르게 내려받습니다.\n");

    const doFetch = await ask("   애플리케이션 코드를 지금 설치하시겠습니까? (y/n, default: y): ", "y");
    if (IS_AUTO || doFetch.toLowerCase() !== 'n') {
        try {
            await setupCoreViaGit(hqUrl, deviceToken, channel);
        } catch (error) {
            console.error(`\n   ❌ 설치 실패: ${error.message}`);
            console.log("   Git 설치 여부와 네트워크 상태를 확인해 주세요.");
            process.exit(1);
        }
    }

    // 6. Generate Configuration (Local First)
    console.log("\n⚙️  Step 6: 데이터베이스 설정\n");

    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');

    // Sanitize clinic name for use as DB/bucket name
    let cleanName = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    while (cleanName.startsWith('-')) cleanName = cleanName.substring(1);
    while (cleanName.endsWith('-')) cleanName = cleanName.slice(0, -1);
    if (!cleanName) cleanName = 'my-clinic';

    // Default DB name based on clinic name
    let defaultDbName = `${cleanName}-db`;
    let dbName = defaultDbName;
    let dbId = "local-db-placeholder"; // Default for local dev

    // Check existing wrangler.toml first
    if (fs.existsSync(wranglerPath)) {
        try {
            const tomlContent = await fs.readFile(wranglerPath, 'utf-8');
            const match = tomlContent.match(/database_name\s*=\s*["']([^"']+)["']/);
            if (match && match[1]) {
                const existingDbName = match[1];
                console.log(`   ℹ️  기존 DB 설정 감지: ${existingDbName}`);

                if (!IS_AUTO) {
                    const keepExisting = await ask(`   기존 DB 이름을 유지하시겠습니까? (y/n, default: y): `);
                    if (keepExisting.toLowerCase() !== 'n') {
                        dbName = existingDbName;
                        console.log(`   → 기존 DB 이름 유지: ${dbName}`);
                    }
                } else {
                    dbName = existingDbName;
                }
            }
        } catch (e) {
            console.warn("   ⚠️  wrangler.toml 파싱 중 오류 (무시됨):", e.message);
        }
    }

    // If no existing DB or user wants new one, ask for DB name
    if (dbName === defaultDbName && !IS_AUTO) {
        console.log(`\n   데이터베이스 이름을 지정하세요.`);
        console.log(`   - 영문 소문자, 숫자, 하이픈만 사용 가능`);
        console.log(`   - 프로덕션 배포 시 Cloudflare D1 데이터베이스 이름이 됩니다`);
        console.log(`   - 예: ${cleanName}-db, my-clinic-db, seoul-clinic-db\n`);

        const inputDbName = await ask(`   DB 이름 (Enter for "${defaultDbName}"): `);
        if (inputDbName) {
            // Sanitize input
            dbName = inputDbName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            if (!dbName.endsWith('-db')) dbName += '-db';
        }
    }

    console.log(`   ✅ 데이터베이스 이름: ${dbName}`);

    // Bucket name follows DB name pattern
    const bucketName = dbName.replace(/-db$/, '-uploads');

    // DG7: Pages 형식 wrangler.toml 생성 (Workers 형식이 아님)
    const writeWrangler = async (dId) => {
        const content = `# Clinic-OS Configuration for ${clinicName}
name = "${cleanName}"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "core/dist"

# R2 버킷 (이미지/파일 업로드용)
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "${bucketName}"

# 환경 변수
[vars]
CLINIC_NAME = "${clinicName}"
ADMIN_PASSWORD = "change-me-in-production"
ALIGO_TESTMODE = "Y"
# 커스텀 도메인 연결 후 아래 주석 해제 및 URL 수정
# CLOUDFLARE_URL = "https://${cleanName}.pages.dev"

# D1 데이터베이스
[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "${dId}"
migrations_dir = "core/migrations"
`;
        await fs.writeFile(wranglerPath, content);
    };

    // DG7.1: config.ts 동적 생성 (clinic.json 기반 — 코어 폴백값 오버라이드)
    const writeConfigTs = async () => {
        const configTsPath = path.join(PROJECT_DIR, 'src', 'config.ts');
        const coreConfigTsPath = path.join(PROJECT_DIR, 'core', 'src', 'config.ts');
        const targetPath = fs.existsSync(path.join(PROJECT_DIR, 'core')) ? coreConfigTsPath : configTsPath;

        const content = `/**
 * Clinic-OS Configuration — Auto-generated by setup-clinic.js
 *
 * 이 파일은 setup 시 clinic.json 기반으로 자동 생성됩니다.
 * 실제 데이터는 DB의 clinics, site_settings 테이블에서 로드됩니다.
 * 아래 값들은 DB 에러 시 폴백용입니다.
 */

const CLINIC_NAME = ${JSON.stringify(clinicName)};

export const clinicConfig = {
    name: CLINIC_NAME,
    englishName: "",
    description: "",
    url: "",
    businessLicenseNumber: "",
    representativeName: "",

    contact: {
        phone: "",
        address: "",
        kakaoChannel: "",
        email: "",
        bookingUrl: "/intake"
    },

    hours: {
        weekdays: "",
        saturday: "",
        lunch: "",
        closed: ""
    },

    logoUrl: "/logo.png",
    faviconUrl: "/favicon.svg",

    theme: {
        primaryColor: "teal",
        logoText: CLINIC_NAME.charAt(0)
    },

    features: {
        intake: true,
        checklists: true,
        symptoms: true
    }
};
`;
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content);
    };

    if (!fs.existsSync(wranglerPath)) {
        await writeWrangler(dbId);
        console.log("   ✅ 로컬용 wrangler.toml 생성 완료");
    }

    // DG7.1: config.ts 생성 (clinic.json의 한의원 이름으로 폴백값 오버라이드)
    await writeConfigTs();
    console.log(`   ✅ config.ts 생성 완료 (폴백명: ${clinicName})`);

    // 6.5 Cloudflare 로그인 + D1/R2 생성 (CF-First: 필수)
    console.log("\n☁️  Step 6.5: Cloudflare 로그인 및 리소스 생성\n");
    console.log("   📖 Cloudflare 셋업 가이드: docs/CLOUDFLARE_SETUP_GUIDE.md");
    console.log("   📖 온라인: https://clinic-os-hq.pages.dev/guide/cloudflare-setup\n");

    let cfLoggedIn = false;
    if (process.env.CLOUDFLARE_API_TOKEN) {
        console.log("   🔑 CLOUDFLARE_API_TOKEN 감지 — 토큰 모드로 진행합니다.");
        cfLoggedIn = true;
    } else {
        const whoamiResult = await runCommand('npx wrangler whoami', true);
        if (whoamiResult.success) {
            console.log("   ✅ Cloudflare 로그인 확인됨.");
            cfLoggedIn = true;
        } else {
            console.log("   Cloudflare에 로그인되어 있지 않습니다.");
            console.log("   배포와 프로덕션 DB를 사용하려면 Cloudflare 로그인이 필요합니다.");
            console.log("   계정이 없으면: https://dash.cloudflare.com/sign-up (무료)\n");

            if (IS_AUTO) {
                console.log("   ⚠️  [Auto Mode] Cloudflare 미로그인 — 로컬 전용 모드로 계속합니다.");
            } else {
                const doLogin = await ask("   지금 Cloudflare에 로그인하시겠습니까? (y/n, default: y): ", "y");
                if (doLogin.toLowerCase() !== 'n') {
                    const loginResult = await runCommand('npx wrangler login');
                    if (loginResult.success) {
                        console.log("   ✅ Cloudflare 로그인 성공!");
                        cfLoggedIn = true;
                    } else {
                        console.log("   ⚠️  로그인 실패. 나중에 npx wrangler login으로 다시 시도하세요.");
                    }
                }
            }
        }
    }

    // CF 로그인 성공 시 D1 + R2 자동 생성
    if (cfLoggedIn && dbId === 'local-db-placeholder') {
        console.log(`\n   📦 D1 데이터베이스 생성: ${dbName}`);
        try {
            const { stdout } = await execAsync(`npx wrangler d1 create ${dbName}`, { cwd: PROJECT_ROOT });
            const match = stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
            if (match) {
                dbId = match[1];
                await writeWrangler(dbId);
                console.log(`   ✅ D1 생성 완료: ${dbId}`);
                console.log("   ✅ wrangler.toml 업데이트 완료");
            }
        } catch (error) {
            console.log(`   ⚠️  D1 생성 실패 또는 이미 존재 (기존 설정 유지).`);
        }

        console.log(`   📦 R2 버킷 생성: ${bucketName}`);
        try {
            await runCommand(`npx wrangler r2 bucket create ${bucketName}`, true);
            console.log(`   ✅ R2 버킷 생성 완료: ${bucketName}`);
        } catch (e) {
            console.log(`   ⏭️  R2 버킷 이미 존재하거나 생성 실패 (무시)`);
        }
    } else if (!cfLoggedIn) {
        console.log("\n   ⚠️  Cloudflare 미연결 — 로컬 개발은 가능하지만 배포 전 반드시 설정하세요.");
        console.log("   npx wrangler login → npm run setup:step -- --step=cf-login\n");
    }

    // 7. Install Dependencies (moved up)
    console.log("\n📦 Step 7: 의존성 설치\n");

    // 손상된 node_modules 감지 및 정리
    const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
    const packageLockPath = path.join(PROJECT_ROOT, 'package-lock.json');

    if (fs.existsSync(nodeModulesPath)) {
        // node_modules가 있지만 손상되었을 수 있음 (이전 설치 실패 등)
        const reactDomPath = path.join(nodeModulesPath, 'react-dom', 'package.json');
        const isCorrupted = fs.existsSync(nodeModulesPath) &&
            fs.readdirSync(nodeModulesPath).length > 0 &&
            fs.existsSync(path.join(nodeModulesPath, 'react-dom')) &&
            !fs.existsSync(reactDomPath);

        if (isCorrupted) {
            console.log("   ⚠️  손상된 node_modules 감지됨, 정리 중...");
            await fs.remove(nodeModulesPath);
            if (fs.existsSync(packageLockPath)) {
                await fs.remove(packageLockPath);
            }
            console.log("   ✓ node_modules 정리 완료");
        }
    }

    console.log(`   설치 모드: ${shouldUseParallelInstall() ? '병렬(자동/강제)' : '순차'}`);
    await installDependenciesForSetup();

    // --- Git Injection for Zip Users (Local Git Architecture v1.2) ---
    const injectGitSupport = async () => {
        const gitDir = path.join(PROJECT_ROOT, '.git');
        const coreVersionFile = path.join(PROJECT_ROOT, '.core', 'version');
        const UPSTREAM_REPO_FALLBACK = 'https://github.com/xulfereht/clinic-os-core.git';

        if (!fs.existsSync(gitDir)) {
            console.log("\n🔗 Step 7.5: 로컬 Git 아키텍처 초기화...");
            console.log("   클라이언트 소유 Git + HQ upstream 연결을 설정합니다.");

            // 0) core/.git 제거 (embedded git repo 문제 방지)
            // core가 별도 git repo면 git add -A 시 submodule처럼 처리되어 파일이 누락됨
            const coreGitDir = path.join(PROJECT_ROOT, 'core', '.git');
            if (fs.existsSync(coreGitDir)) {
                console.log("   🧹 core/.git 제거 중 (embedded git repo 방지)...");
                await fs.remove(coreGitDir);
            }

            // 1) Git init (클라이언트 소유)
            await runCommand(`git init -b main`);
            await runCommand(`git config user.name "ClinicOS Local"`);
            await runCommand(`git config user.email "local@clinic-os.local"`);

            // 2) 초기 커밋
            await runCommand(`git add -A`);
            await runCommand(`git commit -m "Initial: Clinic-OS 설치" --no-verify`);

            // 3) HQ API에서 인증된 Git URL 가져오기
            let upstreamUrl = UPSTREAM_REPO_FALLBACK;
            try {
                console.log("   🔑 HQ에서 인증된 Git URL 가져오는 중...");
                const gitUrlRes = await fetch(`${hqUrl}/api/v1/update/git-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: deviceToken, channel: channel })
                });
                if (gitUrlRes.ok) {
                    const gitUrlData = await gitUrlRes.json();
                    if (gitUrlData.git_url) {
                        upstreamUrl = gitUrlData.git_url;
                        console.log("   ✅ 인증된 Git URL 획득 완료");
                    }
                }
            } catch (e) {
                console.log("   ⚠️  인증된 URL 획득 실패, 기본 URL 사용");
            }

            // 4) upstream remote 추가 + push 차단
            await runCommand(`git remote add upstream ${upstreamUrl}`);
            await runCommand(`git remote set-url --push upstream DISABLE`);

            // 5) HQ API에서 채널 버전 조회 및 .core/version 생성
            try {
                console.log("   📥 HQ에서 채널 버전 조회 중...");
                const channelRes = await fetch(`${hqUrl}/api/v1/update/channel-version?channel=${channel}`);
                if (channelRes.ok) {
                    const channelData = await channelRes.json();
                    const targetVersion = `v${channelData.version}`;
                    await fs.ensureDir(path.join(PROJECT_ROOT, '.core'));
                    await fs.writeFile(coreVersionFile, targetVersion);
                    console.log(`   ✅ .core/version 생성: ${targetVersion} (${channel} 채널)`);
                } else {
                    console.log("   ⚠️  HQ API 조회 실패 - npm run core:pull 실행 시 자동 설정됩니다.");
                }
            } catch (e) {
                console.log("   ⚠️  버전 확인 실패 - npm run core:pull 실행 시 자동 설정됩니다.");
            }

            // 6) pre-commit 훅 설치
            await installPreCommitHook();

            console.log("   ✅ 로컬 Git 아키텍처 초기화 완료!");
            console.log("   → core:pull로 코어 업데이트 가능");
            console.log("   → src/lib/local/, src/plugins/local/ 등은 Git 추적됨");
        }
    };

    // Pre-commit 훅 설치 함수
    const installPreCommitHook = async () => {
        const hooksDir = path.join(PROJECT_ROOT, '.git', 'hooks');
        const hookPath = path.join(hooksDir, 'pre-commit');

        const hookScript = `#!/bin/sh
# Clinic-OS Pre-commit Hook: 코어 파일 수정 경고

CORE_PATHS="src/pages src/components src/layouts src/styles src/lib migrations"
LOCAL_SKIP="src/lib/local src/plugins/local src/survey-tools/local public/local"

# 로컬 경로 체크 함수
is_local_path() {
  for skip in $LOCAL_SKIP; do
    case "$1" in
      "$skip"*) return 0 ;;
    esac
  done
  return 1
}

CORE_MODIFIED=""

for path in $CORE_PATHS; do
  staged=$(git diff --cached --name-only -- "$path")
  for file in $staged; do
    # LOCAL_SKIP에 해당하면 무시
    if is_local_path "$file"; then
      continue
    fi
    CORE_MODIFIED="$CORE_MODIFIED$file\\n"
  done
done

if [ -n "$CORE_MODIFIED" ]; then
  echo "⚠️  경고: 코어 파일이 수정되었습니다."
  echo ""
  echo "   수정된 코어 파일:"
  printf "$CORE_MODIFIED" | sed 's/^/   - /'
  echo ""
  echo "   코어 파일은 core:pull 시 덮어쓰여집니다."
  echo "   커스터마이징이 필요하면 local/ 폴더를 사용하세요."
  echo ""
  # Non-interactive: 경고만 출력하고 커밋 진행
  # 대화형 필요시 아래 주석 해제
  # echo "   계속하려면 'y'를 입력하세요: "
  # read -r response
  # if [ "$response" != "y" ]; then
  #   echo "커밋이 취소되었습니다."
  #   exit 1
  # fi
fi

exit 0
`;

        try {
            await fs.ensureDir(hooksDir);
            await fs.writeFile(hookPath, hookScript);
            await fs.chmod(hookPath, 0o755);
            console.log("   ✅ pre-commit 훅 설치 완료");
        } catch (e) {
            console.log(`   ⚠️  pre-commit 훅 설치 실패: ${e.message}`);
        }
    };

    try {
        await injectGitSupport();
    } catch (e) {
        console.log("   ⚠️  Git 연동 건너뜀:", e.message);
    }

    // --- Helper for DB Optimization ---
    const cleanupProcesses = async () => {
        console.log("   🧹 관련 프로세스 정리 중 (wrangler, workerd)...");
        try {
            if (process.platform === 'win32') {
                execSync('taskkill /F /IM wrangler.exe /T', { stdio: 'ignore' });
                execSync('taskkill /F /IM workerd.exe /T', { stdio: 'ignore' });
            } else {
                execSync('pkill -f wrangler', { stdio: 'ignore' });
                execSync('pkill -f workerd', { stdio: 'ignore' });
            }
        } catch (e) {
            // Ignore errors if processes don't exist
        }
    };

    const getWranglerCmd = () => {
        const rootWrangler = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler' + (process.platform === 'win32' ? '.cmd' : ''));
        const coreWrangler = path.join(PROJECT_ROOT, 'core', 'node_modules', '.bin', 'wrangler' + (process.platform === 'win32' ? '.cmd' : ''));

        if (fs.existsSync(rootWrangler)) return rootWrangler;
        if (fs.existsSync(coreWrangler)) return coreWrangler;
        return 'npx wrangler';
    };

    // 8. Initialize Local Database
    console.log("\n🗃️  Step 8: 로컬 데이터베이스 초기화\n");

    // 마이그레이션 파일 탐색: core/migrations/ 또는 migrations/ (구조에 따라)
    let migrationPath = path.join(PROJECT_ROOT, 'core/migrations/0000_initial_schema.sql');
    if (!fs.existsSync(migrationPath)) {
        migrationPath = path.join(PROJECT_ROOT, 'migrations/0000_initial_schema.sql');
    }
    const localD1StatePath = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1');
    const bootstrapState = {
        skipped: false,
        hasMigrationFiles: fs.existsSync(migrationPath),
        migrationResult: null,
        schemaResult: null,
        seedResults: [],
    };

    const verifyLocalSchema = async () => {
        try {
            const { runSchemaDoctor } = await import('./doctor.js');
            const schemaResult = await runSchemaDoctor(dbName, { fix: false, verbose: false });
            if (schemaResult.ok) {
                console.log('   ✅ 로컬 DB 스키마 검증 완료');
            } else {
                const missingTables = schemaResult.missing?.tables?.length || 0;
                const missingColumns = schemaResult.missing?.columns?.length || 0;
                console.log(`   ❌ 로컬 DB 스키마 검증 실패: 테이블 ${missingTables}개, 컬럼 ${missingColumns}개 누락`);
            }
            return schemaResult;
        } catch (error) {
            console.log(`   ❌ 로컬 DB 스키마 검증 실패: ${error.message}`);
            return { ok: false, error: error.message };
        }
    };

    if (fs.existsSync(migrationPath)) {
        // Cleanup processes and state to avoid locks
        await cleanupProcesses();

        if (fs.existsSync(localD1StatePath)) {
            let doWipe = true;
            if (!IS_AUTO) {
                const answer = await ask("   ⚠️  기존 데이터베이스가 발견되었습니다. 초기화하시겠습니까? (y/N, default: N): ", "n");
                doWipe = answer.toLowerCase() === 'y';
            }

            if (doWipe) {
                console.log("   🧹 기존 로컬 DB 상태를 초기화합니다...");
                try {
                    await fs.remove(localD1StatePath);
                } catch (e) {
                    console.log("   ⚠️  상태 초기화 중 오류 (파일 잠금 등):", e.message);
                }
            } else {
                console.log("   ⏭️  기존 데이터를 보존합니다. (스키마/시드만 업데이트 시도)");
            }
        }

        const wranglerCmd = getWranglerCmd();

        // migrations 폴더 찾기
        let migrationsDir = path.join(PROJECT_ROOT, 'core/migrations');
        if (!fs.existsSync(migrationsDir)) {
            migrationsDir = path.join(PROJECT_ROOT, 'migrations');
        }

        // 통합 마이그레이션 엔진 사용 (PRAGMA 기반 컬럼 안전 체크 포함)
        // - ALTER TABLE ADD COLUMN: 컬럼 존재 여부 확인 후 실행/스킵
        // - CREATE TABLE IF NOT EXISTS: 그대로 실행 (멱등)
        // - 기존 데이터 보존 보장
        if (fs.existsSync(migrationsDir)) {
            // Step 1: 로컬 DB 마이그레이션
            console.log(`   🚀 통합 마이그레이션 엔진으로 실행 중... (PRAGMA 안전 모드)`);
            bootstrapState.migrationResult = await runMigrations({ local: true, verbose: true, verify: false });
            if (bootstrapState.migrationResult.success) {
                console.log(`   ✅ 로컬 DB: ${bootstrapState.migrationResult.applied}개 마이그레이션 적용 완료`);
                bootstrapState.schemaResult = await verifyLocalSchema();
            } else {
                console.log(`   ⚠️  마이그레이션 완료: ${bootstrapState.migrationResult.applied}개 성공, ${bootstrapState.migrationResult.failed}개 실패`);
                if (bootstrapState.migrationResult.errors?.length > 0) {
                    for (const err of bootstrapState.migrationResult.errors) {
                        console.log(`      - ${err.file}: ${err.error}`);
                    }
                }
            }

            // Step 2: 리모트 DB 마이그레이션 (로컬 성공 시 자동 적용)
            if (bootstrapState.migrationResult?.success && dbName) {
                console.log(`   🌐 리모트 DB 마이그레이션 적용 중...`);
                try {
                    const remoteResult = await runMigrations({ local: false, verbose: true, verify: false, dbName });
                    if (remoteResult.success) {
                        console.log(`   ✅ 리모트 DB: ${remoteResult.applied}개 마이그레이션 적용 완료`);
                    } else {
                        console.log(`   ⚠️  리모트 마이그레이션: ${remoteResult.applied}개 성공, ${remoteResult.failed}개 실패`);
                        if (remoteResult.errors?.length > 0) {
                            for (const err of remoteResult.errors) {
                                console.log(`      - ${err.file}: ${err.error}`);
                            }
                        }
                    }
                } catch (remoteErr) {
                    console.log(`   ⚠️  리모트 마이그레이션 스킵: ${remoteErr.message}`);
                    console.log(`      배포 시 deploy-guard가 자동 적용합니다.`);
                }
            }
        }

        // Additional Local Seeds (Restoration) — 마이그레이션 성공 시에만 실행
        if (bootstrapState.migrationResult?.success && bootstrapState.schemaResult?.ok !== false) {
            const additionalSeeds = [
                // 기존 시드 (초기 데이터)
                'seeds/terms_definitions.sql',
                'seeds/terms_versions.sql',
                'seeds/default_pages.sql',
                'seeds/prepare_samples.sql',
                'seeds/program_translations_sample.sql',
                'seeds/seed_manuals.sql',
                'seeds/seed_system_manuals.sql',
                'seeds/seed_templates.sql',
                'seeds/sample_ops_data.sql',
                'seeds/sample_patients.sql',
                'seeds/sample_faqs.sql',
                'seeds/dummy_posts.sql',
                'seeds/dummy_reviews.sql',
                'seeds/sample_notices.sql',
                'seeds/knowledge_seed.sql',
                // migrations/에서 이동된 DML (v1.33+)
                'seeds/0060_plugin_status_seed.sql',
                'seeds/0502_add_sample_data.sql',
                'seeds/0510_init_navigation_settings.sql',
                'seeds/0700_enable_telemedicine.sql',
                'seeds/0906_seed_patient_tags.sql',
                'seeds/0907_rename_segments_to_tags.sql',
                'seeds/0913_auto_approve_members.sql',
                'seeds/0915_repair_missing_data.sql',
                'seeds/0918_add_default_pages.sql',
                'seeds/0927_feature_toggles.sql',
                'seeds/0929_register_moved_seeds.sql',
                'seeds/0934_report_brand_seed.sql',
                'seeds/migrate_static_pages_to_db.sql',
                'seeds/seed_home_content.sql',
            ];

            // d1_seeds 테이블을 시드 실행 전에 생성 (중단 후 재실행 시 중복 방지)
            try {
                await executeWithRetry(() => execCommandChecked(`${wranglerCmd} d1 execute ${dbName} --local --command "CREATE TABLE IF NOT EXISTS d1_seeds (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))" --yes`, { cwd: PROJECT_ROOT, timeout: 60000 }));
            } catch { /* 테이블 이미 존재 시 무시 */ }

            console.log(`   🚀 샘플 데이터 삽입 중... (${additionalSeeds.length + 1}개 파일, ~${(additionalSeeds.length + 1) * 2}초 예상)`);
            // 시드 경로: core/seeds/ 또는 seeds/ (구조에 따라 다름)
            let sampleClinicPath = 'core/seeds/sample_clinic.sql';
            if (!fs.existsSync(path.join(PROJECT_ROOT, sampleClinicPath))) {
                sampleClinicPath = 'seeds/sample_clinic.sql';
            }
            if (!fs.existsSync(path.join(PROJECT_ROOT, sampleClinicPath))) {
                bootstrapState.seedResults.push({
                    name: 'sample_clinic.sql',
                    ok: false,
                    required: true,
                    error: '필수 시드 파일이 없습니다.',
                });
            } else {
                try {
                    await executeWithRetry(() => execCommandChecked(`${wranglerCmd} d1 execute ${dbName} --local --file=${sampleClinicPath} --yes`, { cwd: PROJECT_ROOT, timeout: 60000 }));
                    bootstrapState.seedResults.push({ name: 'sample_clinic.sql', ok: true, required: true });
                } catch (error) {
                    bootstrapState.seedResults.push({
                        name: 'sample_clinic.sql',
                        ok: false,
                        required: true,
                        error: error.message,
                    });
                }
            }

            const seedStartTime = Date.now();
            for (let i = 0; i < additionalSeeds.length; i++) {
                if (bootstrapState.seedResults.some((entry) => entry.required !== false && !entry.ok)) {
                    break;
                }
                const seedFile = additionalSeeds[i];
                // 1. Try finding in PROJECT_ROOT (local override)
                let finalPath = path.join(PROJECT_ROOT, seedFile);
                let displayPath = seedFile;

                if (!fs.existsSync(finalPath)) {
                    // 2. Try finding in core directory (standard distribution)
                    finalPath = path.join(PROJECT_ROOT, 'core', seedFile);
                    displayPath = path.join('core', seedFile);
                }

                if (fs.existsSync(finalPath)) {
                    const elapsed = (Date.now() - seedStartTime) / 1000;
                    const rate = i > 0 ? elapsed / i : 2;
                    const remaining = Math.ceil(rate * (additionalSeeds.length - i));
                    console.log(`   🌱 [${i + 1}/${additionalSeeds.length}] ${path.basename(seedFile)} (~${remaining}s 남음)`);
                    try {
                        await executeWithRetry(() => execCommandChecked(`${wranglerCmd} d1 execute ${dbName} --local --file=${displayPath} --yes`, { cwd: PROJECT_ROOT, timeout: 60000 }));
                        bootstrapState.seedResults.push({ name: path.basename(seedFile), ok: true, required: true });
                    } catch (error) {
                        bootstrapState.seedResults.push({
                            name: path.basename(seedFile),
                            ok: false,
                            required: true,
                            error: error.message,
                        });
                    }
                }
            }

            // 실행된 seeds를 d1_seeds 테이블에 기록 (core:pull 시 재실행 방지)
            // 테이블은 시드 실행 전에 이미 생성됨 (위쪽 참조)
            if (!bootstrapState.seedResults.some((entry) => entry.required !== false && !entry.ok)) {
                console.log("   📝 Seeds 기록 중...");

                // seeds 폴더의 모든 파일을 기록
                let seedsDir = path.join(PROJECT_ROOT, 'core/seeds');
                if (!fs.existsSync(seedsDir)) {
                    seedsDir = path.join(PROJECT_ROOT, 'seeds');
                }

                if (fs.existsSync(seedsDir)) {
                    const seedFiles = fs.readdirSync(seedsDir)
                        .filter(f => f.endsWith('.sql'))
                        .sort();

                    for (const seedFile of seedFiles) {
                        await executeWithRetry(() => execCommandChecked(`${wranglerCmd} d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_seeds (name) VALUES ('${seedFile}')" --yes`, { cwd: PROJECT_ROOT, timeout: 60000 }));
                    }
                    console.log(`   ✅ ${seedFiles.length}개 seeds 기록 완료 (초기 설치)`);
                }

                // API 키 자동 프로비저닝 — 위임 셋업 및 extract-content에서 사용
                const crypto = await import('crypto');
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let apiKey = 'cos_';
                const randomBytes = crypto.randomBytes(32);
                for (let i = 0; i < 32; i++) {
                    apiKey += chars[randomBytes[i] % chars.length];
                }
                try {
                    await executeWithRetry(() => execCommandChecked(
                        `${wranglerCmd} d1 execute ${dbName} --local --command "INSERT OR REPLACE INTO site_settings (category, key, value, updated_at) VALUES ('api', 'admin_api_key', '${apiKey}', strftime('%s', 'now'))" --yes`,
                        { cwd: PROJECT_ROOT, timeout: 60000 }
                    ));
                    console.log(`   🔑 API 키 자동 생성 완료: ${apiKey.slice(0, 8)}****`);
                } catch (error) {
                    console.log(`   ⚠️  API 키 생성 실패 (수동 생성 필요): ${error.message}`);
                }

                // 필수 site_settings 자동 설정 (clinic-info 온보딩 기반)
                try {
                    const essentialSettings = [
                        // clinics 테이블에 이름 설정
                        `INSERT OR REPLACE INTO clinics (id, name, updated_at) VALUES ('1', '${clinicName.replace(/'/g, "''")}', strftime('%s', 'now'))`,
                    ];
                    for (const sql of essentialSettings) {
                        await executeWithRetry(() => execCommandChecked(
                            `${wranglerCmd} d1 execute ${dbName} --local --command "${sql}" --yes`,
                            { cwd: PROJECT_ROOT, timeout: 60000 }
                        ));
                    }
                    console.log(`   📝 클리닉 기본 정보 설정 완료`);
                } catch (error) {
                    console.log(`   ⚠️  클리닉 기본 정보 설정 실패: ${error.message}`);
                }
            }
        }
    } else {
        console.log("   ⚠️  마이그레이션 파일을 찾을 수 없습니다.");
    }
    const bootstrapReport = buildLocalDbBootstrapReport(bootstrapState);
    if (!bootstrapReport.ok) {
        throw new Error(`로컬 데이터베이스 초기화 실패: ${bootstrapReport.issues.join(' / ')}`);
    }
    console.log("   ✅ 로컬 데이터베이스 초기화 및 전체 시딩 완료");

    // 8.5. 리모트 DB에도 시드 적용 (로컬 성공 + 리모트 마이그레이션 성공 시)
    if (bootstrapReport.ok && dbName && bootstrapState.migrationResult?.success) {
        console.log("\n🌐 Step 8.5: 리모트 DB 시드 적용\n");
        try {
            const allSeedFiles = [sampleClinicPath, ...additionalSeeds.map(s => {
                // 경로 해결: core/seeds/ 또는 seeds/
                const corePath = path.join(PROJECT_ROOT, 'core', s);
                return fs.existsSync(corePath) ? `core/${s}` : s;
            })].filter(Boolean);

            let remoteSeeded = 0;
            let remoteSkipped = 0;
            for (const seedFile of allSeedFiles) {
                const fullPath = path.join(PROJECT_ROOT, seedFile);
                if (!fs.existsSync(fullPath)) { remoteSkipped++; continue; }
                try {
                    await executeWithRetry(() => execCommandChecked(
                        `${wranglerCmd} d1 execute ${dbName} --remote --file=${seedFile} --yes`,
                        { cwd: PROJECT_ROOT, timeout: 60000 }
                    ));
                    remoteSeeded++;
                } catch (seedErr) {
                    remoteSkipped++;
                    // 시드 실패는 경고로 처리 (리모트 시드는 best-effort)
                }
            }
            console.log(`   ✅ 리모트 시드: ${remoteSeeded}개 적용, ${remoteSkipped}개 스킵`);
        } catch (remoteErr) {
            console.log(`   ⚠️  리모트 시드 스킵: ${remoteErr.message}`);
            console.log(`      배포 시 deploy-guard가 마이그레이션을 적용합니다. 시드는 수동 필요.`);
        }
    }

    // 9. Cloudflare 설정 확인 (Step 6.5에서 이미 처리됨)
    if (cfLoggedIn) {
        console.log("\n☁️  Step 9: Cloudflare 설정 ✅ (Step 6.5에서 완료됨)\n");
    } else {
        console.log("\n☁️  Step 9: Cloudflare 미연결 상태\n");
        console.log("   배포 전에 다음 명령어를 실행하세요:");
        console.log("   npx wrangler login");
        console.log("   npm run setup:step -- --step=cf-login\n");
    }

    // 10. Generate Claude Code protection settings
    console.log("\n🛡️  Step 10: AI 에이전트 보호 규칙 생성\n");

    const claudeDir = path.join(PROJECT_ROOT, '.claude');
    const claudeSettingsPath = path.join(claudeDir, 'settings.json');
    await fs.ensureDir(claudeDir);

    const claudeSettings = {
        permissions: {
            deny: [
                "Edit(src/pages/**)",
                "Edit(src/components/**)",
                "Edit(src/layouts/**)",
                "Edit(src/styles/**)",
                "Edit(src/lib/**)",
                "Edit(src/plugins/custom-homepage/**)",
                "Edit(src/plugins/survey-tools/**)",
                "Edit(src/survey-tools/stress-check/**)",
                "Edit(migrations/**)",
                "Edit(seeds/**)",
                "Edit(docs/**)",
                "Edit(scripts/**)",
                "Edit(.docking/engine/**)",
                "Write(wrangler.toml)",
                "Write(clinic.json)",
                "Write(.docking/config.yaml)",
                "Write(src/config.ts)",
                "Write(src/styles/global.css)",
                "Write(package.json)",
                "Write(astro.config.mjs)",
                "Write(tsconfig.json)"
            ],
            allow: [
                "Edit(src/lib/local/**)",
                "Edit(src/plugins/local/**)",
                "Edit(src/pages/_local/**)",
                "Edit(src/survey-tools/local/**)",
                "Edit(public/local/**)"
            ]
        }
    };

    await fs.writeFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2) + '\n');
    console.log("   ✅ .claude/settings.json 생성 완료");
    console.log("   → 코어 파일 수정 차단, local/ 경로만 허용");

    // 11. Auto-run core:pull to fetch initial core files
    // core:pull이 먼저 실행되어야 onboarding-registry.json이 최신 상태로 존재함
    console.log("\n📦 Step 11: 코어 파일 가져오기\n");
    try {
        const fetchChannel = channel || 'stable';
        const fetchArgs = fetchChannel === 'beta' ? '--beta' : (fetchChannel === 'stable' ? '--stable' : '');
        const fetchCmd = `node .docking/engine/fetch.js ${fetchArgs} --yes`;

        console.log(`   실행: ${fetchCmd}`);
        await execAsync(fetchCmd, { cwd: PROJECT_ROOT, timeout: 120000 });
        console.log("   ✅ 코어 파일 가져오기 완료");
    } catch (e) {
        console.log("   ⚠️  코어 파일 가져오기 실패 (나중에 npm run core:pull로 다시 시도하세요)");
    }

    // 12. Initialize onboarding state (core:pull 이후 실행 → registry 확보됨)
    console.log("\n📋 Step 12: 온보딩 상태 초기화\n");
    const agentDir = path.join(PROJECT_ROOT, '.agent');
    const onboardingStatePath = path.join(agentDir, 'onboarding-state.json');

    if (!fs.existsSync(onboardingStatePath)) {
        const registryPath = path.join(agentDir, 'onboarding-registry.json');
        let featureStates = {};

        if (fs.existsSync(registryPath)) {
            try {
                const registry = fs.readJsonSync(registryPath);
                for (const feature of registry.features) {
                    featureStates[feature.id] = {
                        status: "pending",
                        updated_at: null,
                        notes: null
                    };
                }
                console.log(`   ✅ 레지스트리에서 ${Object.keys(featureStates).length}개 기능 로드`);
            } catch (e) {
                console.log("   ⚠️  레지스트리 읽기 실패:", e.message);
            }
        } else {
            console.log("   ⚠️  onboarding-registry.json 미발견 (core:pull 후 다시 시도)");
        }

        await fs.ensureDir(agentDir);
        const state = {
            initialized_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            current_tier: 1,
            deployment_count: 0,
            briefing_completed_at: null,
            chosen_track: {
                mode: 'recommended',
                tier: 1,
                feature_id: null,
                updated_at: null,
                notes: null
            },
            current_focus: {
                feature_id: null,
                checkpoint: null,
                updated_at: null
            },
            session_notes: [],
            deferred_items: [],
            clinic_name: clinicName,
            features: featureStates
        };

        await fs.writeFile(onboardingStatePath, JSON.stringify(state, null, 2) + '\n');
        console.log("   ✅ .agent/onboarding-state.json 생성 완료");
    } else {
        console.log("   ⏭️  기존 온보딩 상태 유지");
    }

    try {
        await execAsync('node scripts/generate-agent-context.js --quiet', { cwd: PROJECT_ROOT, timeout: 30000 });
        console.log("   ✅ .agent/runtime-context.json 갱신 완료");
    } catch (e) {
        console.log("   ⚠️  agent runtime context 생성 실패:", e.message);
    }

    // Done
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("   🎉  설정 완료!  🎉");
    console.log("═══════════════════════════════════════════════════════════");

    console.log(`
   디바이스가 HQ에 등록되었습니다.

   다음 명령어로 시작하세요:

   1. 로컬 개발 서버 실행:
      npm run dev

   2. 온보딩 시작:
      AI 에이전트에게 "온보딩 시작" 이라고 말해주세요.

   3. 프로덕션 배포:
      npm run deploy

   문제가 생기면 '/help' 명령어로 도움을 요청하세요.
  `);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    setupClinic().catch(console.error);
}
