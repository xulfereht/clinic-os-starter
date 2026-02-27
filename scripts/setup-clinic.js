import fs from 'fs-extra';
import path from 'path';
import http from 'http';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const IS_AUTO = process.argv.includes('--auto') || process.env.CI === 'true' || process.env.CLINIC_OS_AUTO === 'true';

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

function runCommand(cmd, cwd = PROJECT_ROOT) {
    console.log(`   Running: ${cmd}`);
    return new Promise((resolve) => {
        const child = spawn(cmd, {
            cwd,
            stdio: 'inherit',
            shell: true
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

async function setupClinic() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("   🏥  Clinic-OS 초기 설정 마법사 v3.0  🏥");
    console.log("═══════════════════════════════════════════════════════════\n");

    // 0. System Health Check
    const isReady = await runCheck();
    if (!isReady) {
        console.log("\n❌ 환경 설정이 완료되지 않았습니다. 위 안내에 따라 필수 도구를 설치해주세요.");
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
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"

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
`;
        await fs.writeFile(wranglerPath, content);
    };

    if (!fs.existsSync(wranglerPath)) {
        await writeWrangler(dbId);
        console.log("   ✅ 로컬용 wrangler.toml 생성 완료");
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

    console.log("   [1/2] 프로젝트 루트 의존성 설치...");
    await runCommand('npm install');

    await runCommand('npm install', path.join(PROJECT_ROOT, 'core'));

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
            await runCommand(`git init`);
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
        let migrationFailed = false;
        if (fs.existsSync(migrationsDir)) {
            console.log(`   🚀 통합 마이그레이션 엔진으로 실행 중... (PRAGMA 안전 모드)`);
            const migResult = await runMigrations({ local: true, verbose: true, verify: false });
            if (migResult.success) {
                console.log(`   ✅ ${migResult.applied}개 마이그레이션 적용 완료`);
            } else {
                migrationFailed = true;
                console.log(`   ⚠️  마이그레이션 완료: ${migResult.applied}개 성공, ${migResult.failed}개 실패`);
                if (migResult.errors?.length > 0) {
                    for (const err of migResult.errors) {
                        console.log(`      - ${err.file}: ${err.error}`);
                    }
                }
                console.log('   ⚠️  마이그레이션 실패로 Seeds를 건너뜁니다.');
                console.log('   💡 npm run doctor로 진단하거나 npm run db:seed로 나중에 실행하세요.');
            }
        }

        // Additional Local Seeds (Restoration) — 마이그레이션 성공 시에만 실행
        if (!migrationFailed) {
        const additionalSeeds = [
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
            'seeds/knowledge_seed.sql'
        ];

        console.log(`   🚀 샘플 데이터 삽입 중... (${additionalSeeds.length + 1}개 파일, ~${(additionalSeeds.length + 1) * 2}초 예상)`);
        // 시드 경로: core/seeds/ 또는 seeds/ (구조에 따라 다름)
        let sampleClinicPath = 'core/seeds/sample_clinic.sql';
        if (!fs.existsSync(path.join(PROJECT_ROOT, sampleClinicPath))) {
            sampleClinicPath = 'seeds/sample_clinic.sql';
        }
        const seedOk = await executeWithRetry(() => runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=${sampleClinicPath} --yes`));

        const seedStartTime = Date.now();
        for (let i = 0; i < additionalSeeds.length; i++) {
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
                await executeWithRetry(() => runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=${displayPath} --yes`));
            }
        }

        // d1_seeds 테이블 생성 및 실행된 seeds 기록 (core:pull 시 재실행 방지)
        console.log("   📝 Seeds 기록 초기화 중...");
        await executeWithRetry(() => runCommand(`${wranglerCmd} d1 execute ${dbName} --local --command "CREATE TABLE IF NOT EXISTS d1_seeds (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))" --yes`));

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
                await executeWithRetry(() => runCommand(`${wranglerCmd} d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_seeds (name) VALUES ('${seedFile}')" --yes`));
            }
            console.log(`   ✅ ${seedFiles.length}개 seeds 기록 완료 (초기 설치)`);
        }

        if (seedOk) {
            console.log("   ✅ 데이터베이스 초기화 및 전체 시딩 완료");
        } else {
            console.log("   ❌ 데이터베이스 시딩 실패. 위 오류를 확인해 주세요.");
        }
        } // end if (!migrationFailed)
    } else {
        console.log("   ⚠️  마이그레이션 파일을 찾을 수 없습니다.");
    }

    // 9. Cloudflare Setup (Optional / Advanced)
    console.log("\n☁️  Step 9: Cloudflare 프로덕션 설정 (선택사항)\n");
    console.log("   실제 서버에 배포하려면 Cloudflare 연결이 필요합니다.");
    console.log("   로컬 개발만 진행하려면 건너뛰셔도 됩니다.\n");

    const doCloudflare = await ask("   지금 프로덕션 설정을 진행하시겠습니까? (y/n, default: n): ", "n");

    if (!IS_AUTO && doCloudflare.toLowerCase() === 'y') {
        const doLogin = await ask("   Cloudflare 로그인을 진행하시겠습니까? (y/n): ");
        if (doLogin.toLowerCase() === 'y') {
            await runCommand('npx wrangler login');
        }

        console.log(`\n   데이터베이스 생성: ${dbName}`);
        try {
            const { stdout } = await execAsync(`npx wrangler d1 create ${dbName}`, { cwd: PROJECT_ROOT });
            console.log(stdout);
            const match = stdout.match(/database_id\s*=\s*"([^"]+)"/);
            if (match) {
                dbId = match[1];
                console.log(`   ✅ DB ID 획득: ${dbId}`);
                await writeWrangler(dbId); // Update with real ID
                console.log("   ✅ wrangler.toml 업데이트 완료");
            }
        } catch (error) {
            console.log(`   ⚠️  DB 생성 실패 또는 이미 존재 (기존 ID 유지).`);
        }

        console.log(`\n   R2 버킷 생성: ${bucketName}`);
        try {
            await runCommand(`npx wrangler r2 bucket create ${bucketName}`);
        } catch (e) {
            // Ignore if exists
        }
    } else {
        console.log("   ⏭️  프로덕션 설정을 건너뜁니다.");
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
            clinic_name: clinicName,
            features: featureStates
        };

        await fs.writeFile(onboardingStatePath, JSON.stringify(state, null, 2) + '\n');
        console.log("   ✅ .agent/onboarding-state.json 생성 완료");
    } else {
        console.log("   ⏭️  기존 온보딩 상태 유지");
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

setupClinic().catch(console.error);
