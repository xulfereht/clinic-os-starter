import fs from 'fs-extra';
import path from 'path';
import http from 'http';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const IS_AUTO = process.argv.includes('--auto');

// ... Imports ...
import { runCheck } from './check-system.js';

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

async function setupCoreViaGit(hqUrl, deviceToken) {
    console.log("   📂 Git을 통한 애플리케이션 설치를 시작합니다...");

    // 1. Get authenticated Git URL from HQ
    const response = await fetch(`${hqUrl}/api/v1/update/git-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: deviceToken })
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
        console.log("   🔄 기존 Git 저장소를 업데이트합니다...");
        const updateCmd = `git fetch --tags --force && (git checkout v${version} || git checkout ${version})`;
        if (!(await runCommand(updateCmd, corePath))) {
            throw new Error('Git 업데이트 중 오류가 발생했습니다.');
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
    if (hasSignedConfig) {
        try {
            const signed = fs.readJsonSync(signedPath);
            defaultClinicName = signed.organization || "";
            licenseKey = signed.license_key || "";
            console.log(`   ✨ Zero-Touch: [clinic.json] 서명된 파일에서 설정을 불러왔습니다.`);
            console.log(`   ✅ 기관명: ${defaultClinicName}`);
            console.log(`   ✅ 라이선스: ${licenseKey.substring(0, 8)}... (매칭됨)`);
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
            await setupCoreViaGit(hqUrl, deviceToken);
        } catch (error) {
            console.error(`\n   ❌ 설치 실패: ${error.message}`);
            console.log("   Git 설치 여부와 네트워크 상태를 확인해 주세요.");
            process.exit(1);
        }
    }

    // 6. Generate Configuration (Local First)
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');

    // Standardized DB/Bucket names
    let dbName = 'local-clinic-db';
    const bucketName = 'local-clinic-uploads';
    let dbId = "local-db-placeholder"; // Default for local dev

    // ⚠️ CRITICAL Fix: If wrangler.toml exists, respect its database_name to avoid mismatch
    if (fs.existsSync(wranglerPath)) {
        try {
            const tomlContent = await fs.readFile(wranglerPath, 'utf-8');
            const match = tomlContent.match(/database_name\s*=\s*["']([^"']+)["']/);
            if (match && match[1]) {
                const existingDbName = match[1];
                if (existingDbName !== dbName) {
                    console.log(`   ℹ️  기존 설정 감지: DB 이름 유지 (${existingDbName})`);
                    dbName = existingDbName;
                }
            }
        } catch (e) {
            console.warn("   ⚠️  wrangler.toml 파싱 중 오류 (무시됨):", e.message);
        }
    }

    // Sanitize clinic name for the 'name' field in wrangler.toml (just for identification)
    let cleanName = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    while (cleanName.startsWith('-')) cleanName = cleanName.substring(1);
    while (cleanName.endsWith('-')) cleanName = cleanName.slice(0, -1);
    if (!cleanName) cleanName = 'local-clinic';

    // Function to write wrangler.toml
    const writeWrangler = async (dId) => {
        const content = `# Clinic-OS Configuration for ${clinicName}
name = "${cleanName}"
main = "core/dist/_worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = "./core/dist"

[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "${dId}"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "${bucketName}"

[[kv_namespaces]]
binding = "SESSION"
id = "local-session-placeholder"

[vars]
CLINIC_NAME = "${clinicName}"
`;
        await fs.writeFile(wranglerPath, content);
    };

    if (!fs.existsSync(wranglerPath)) {
        await writeWrangler(dbId);
        console.log("   ✅ 로컬용 wrangler.toml 생성 완료");
    }

    // 7. Install Dependencies (moved up)
    console.log("\n📦 Step 7: 의존성 설치\n");

    console.log("   [1/2] 프로젝트 루트 의존성 설치...");
    await runCommand('npm install');

    await runCommand('npm install', path.join(PROJECT_ROOT, 'core'));

    // --- Git Injection for Zip Users (Self-Healing Git) ---
    const injectGitSupport = async () => {
        const gitDir = path.join(PROJECT_ROOT, '.git');
        const STARTER_REPO = 'https://github.com/xulfereht/clinic-os-starter.git';

        if (!fs.existsSync(gitDir)) {
            console.log("\n🔗 Step 7.5: Git 업데이트 시스템 활성화 (Zip-to-Git)...");
            console.log("   다운로드된 버전을 Git 추적 모드로 업그레이드합니다.");

            await runCommand(`git init`);
            await runCommand(`git remote add origin ${STARTER_REPO}`);
            await runCommand(`git fetch --depth=1 origin main`);

            // Hard reset to sync with remote (local-only files protected by .gitignore)
            await runCommand(`git branch -M main`);
            await runCommand(`git reset --hard origin/main`);

            console.log("   ✅ Git 연동 완료! 이제 'npm run update:starter'로 업데이트할 수 있습니다.");
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
    const migrationPath = path.join(PROJECT_ROOT, 'core/migrations/0000_initial_schema.sql');
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
        console.log(`   🚀 스키마 생성 중 (${wranglerCmd.includes('node_modules') ? 'Local binary' : 'npx'})...`);
        const initOk = await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=core/migrations/0000_initial_schema.sql --yes`);

        // 마이그레이션 기록 초기화
        console.log("   🚀 마이그레이션 기록 초기화 중...");

        // migrations 폴더 찾기
        let migrationsDir = path.join(PROJECT_ROOT, 'core/migrations');
        if (!fs.existsSync(migrationsDir)) {
            migrationsDir = path.join(PROJECT_ROOT, 'migrations');
        }

        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
                .sort();

            // d1_migrations 테이블 생성 (없으면)
            await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --command "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))" --yes`);

            // 샘플 데이터 시딩 전에 실행해야 할 필수 마이그레이션들
            const requiredMigrations = [
                '0500_add_is_sample_column.sql',
                '0505_add_is_sample_to_leads.sql',
                '0511_add_is_sample_to_ops.sql',
                '0512_add_is_sample_to_faq.sql'
            ];

            console.log("   🚀 필수 마이그레이션 실행 중 (is_sample 컬럼 등)...");
            for (const migFile of requiredMigrations) {
                const migPath = path.join(migrationsDir, migFile);
                if (fs.existsSync(migPath)) {
                    console.log(`   📜 실행: ${migFile}`);
                    await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=${migPath} --yes`);
                    await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${migFile}')" --yes`);
                }
            }

            // 나머지 마이그레이션 파일들은 기록만 (이미 0000_initial_schema에 포함된 것들)
            for (const migFile of migrationFiles) {
                if (!requiredMigrations.includes(migFile) && migFile !== '0000_initial_schema.sql') {
                    await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${migFile}')" --yes`);
                }
            }
            console.log(`   ✅ ${migrationFiles.length}개 마이그레이션 기록 완료 (초기 설치)`);
        }

        console.log("   🚀 샘플 데이터 삽입 중...");
        const seedOk = await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=core/seeds/sample_clinic.sql --yes`);

        // Additional Local Seeds (Restoration)
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

        for (const seedFile of additionalSeeds) {
            // 1. Try finding in PROJECT_ROOT (local override)
            let finalPath = path.join(PROJECT_ROOT, seedFile);
            let displayPath = seedFile;

            if (!fs.existsSync(finalPath)) {
                // 2. Try finding in core directory (standard distribution)
                finalPath = path.join(PROJECT_ROOT, 'core', seedFile);
                displayPath = path.join('core', seedFile);
            }

            if (fs.existsSync(finalPath)) {
                console.log(`   🌱 추가 데이터 시딩: ${displayPath}...`);
                await runCommand(`${wranglerCmd} d1 execute ${dbName} --local --file=${displayPath} --yes`);
            } else {
                // Optional: Log warning if critical seeds are missing, but for now silent skip is safer for optional seeds
                // console.log(`   ⚠️  Seed skipped (not found): ${seedFile}`);
            }
        }

        if (initOk && seedOk) {
            console.log("   ✅ 데이터베이스 초기화 및 전체 시딩 완료");
        } else {
            console.log("   ❌ 데이터베이스 초기화 실패. 위 오류를 확인해 주세요.");
        }
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

    // Done
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("   🎉  설정 완료!  🎉");
    // ... rest of the logs


    // 11. Done!
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("   🎉  설정 완료!  🎉");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`
   디바이스가 HQ에 등록되었습니다.
   
   다음 명령어로 시작하세요:

   1. 로컬 개발 서버 실행:
      npm run dev

   2. 업데이트 확인:
      node .docking/engine/fetch.js

   3. 프로덕션 배포:
      npm run deploy

   문제가 생기면 '/help' 명령어로 도움을 요청하세요.
  `);
}

setupClinic().catch(console.error);
