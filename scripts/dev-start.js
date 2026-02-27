/**
 * Development Server Starter
 *
 * npm run dev 실행 시:
 * 1. Check-in 로그 (HQ 전송)
 * 2. 로컬 DB 상태 확인 및 안내
 *
 * DB 초기화는 setup에서 처리됨.
 * 수동 초기화: npm run db:init && npm run db:seed
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbBackup = null;
try {
    const mod = await import('./db-backup.js');
    dbBackup = mod.backup;
} catch {
    // db-backup.js not available, skip backup features
}

/**
 * Find actual project root by looking for wrangler.toml first (has DB config)
 */
function findProjectRoot(startDir) {
    let current = startDir;

    // 1차: wrangler.toml 우선 탐색
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'wrangler.toml'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // 2차: 다른 마커로 fallback
    current = startDir;
    const fallbackMarkers = ['.docking/config.yaml', 'clinic.json'];
    for (let i = 0; i < 5; i++) {
        for (const marker of fallbackMarkers) {
            if (fs.existsSync(path.join(current, marker))) {
                return current;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    return path.join(startDir, '..');
}

const PROJECT_ROOT = findProjectRoot(__dirname);

/**
 * 로컬 D1 데이터베이스 존재 여부 확인
 */
function checkLocalDbExists() {
    const d1StatePath = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1');
    if (!fs.existsSync(d1StatePath)) return false;

    const dirs = fs.readdirSync(d1StatePath);
    return dirs.some(d => d.startsWith('miniflare-'));
}

/**
 * Auto-install dependencies if node_modules missing or package.json changed
 */
function ensureDependencies() {
    const nodeModules = path.join(PROJECT_ROOT, 'node_modules');
    const pkgJson = path.join(PROJECT_ROOT, 'package.json');

    let needsInstall = false;

    if (!fs.existsSync(nodeModules)) {
        needsInstall = true;
    } else if (fs.existsSync(pkgJson)) {
        const pkgMtime = fs.statSync(pkgJson).mtimeMs;
        const nmMtime = fs.statSync(nodeModules).mtimeMs;
        if (pkgMtime > nmMtime) {
            needsInstall = true;
        }
    }

    if (needsInstall) {
        console.log('\n📦 의존성 설치 중 (npm install)...');
        try {
            execSync('npm install', { stdio: 'inherit', cwd: PROJECT_ROOT });
            console.log('   ✅ 의존성 설치 완료\n');
        } catch (e) {
            console.error('   ❌ npm install 실패:', e.message);
            process.exit(1);
        }
    }
}

async function main() {
    // 0. Auto-install dependencies
    ensureDependencies();

    // 1. Run Check-In if exists
    const checkInScript = path.join(PROJECT_ROOT, 'scripts', 'check-in.js');
    if (fs.existsSync(checkInScript)) {
        try {
            execSync(`node "${checkInScript}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            // Ignore check-in errors
        }
    }

    // 1.5 건강 검진 (비차단 — 경고만 출력)
    try {
        const healthPath = path.join(PROJECT_ROOT, 'scripts', 'health-audit.js');
        if (fs.existsSync(healthPath)) {
            const { runHealthAudit } = await import(healthPath);
            const health = await runHealthAudit({ quiet: true });
            if (health.score < 70) {
                console.log(`\n⚠️  건강 점수: ${health.score}/100`);
                for (const issue of health.issues) {
                    console.log(`   → ${issue.issue}`);
                }
                console.log('   💡 npm run health:fix 로 자동 수정 가능\n');
            }

            // 캐시 저장 (.core/last-health.json) — check-in 텔레메트리용
            try {
                const coreDir = path.join(PROJECT_ROOT, '.core');
                fs.mkdirSync(coreDir, { recursive: true });
                fs.writeFileSync(
                    path.join(coreDir, 'last-health.json'),
                    JSON.stringify({ score: health.score, schemaHash: health.schemaHash, ts: Date.now() })
                );
            } catch { /* ignore */ }
        }
    } catch {
        // health-audit.js 없으면 건너뜀
    }

    // 2. DB 상태 확인 및 안내 (자동 초기화 없음)
    const dbExists = checkLocalDbExists();

    if (!dbExists) {
        console.log('\n⚠️  로컬 데이터베이스가 없습니다.');
        console.log('   초기화하려면: npm run db:init && npm run db:seed\n');
    } else if (dbBackup) {
        // 3. Auto-backup (only if DB changed since last backup)
        try {
            const created = dbBackup({ silent: false });
            if (created) {
                console.log('');
            }
        } catch (e) {
            console.log(`⚠️  DB 백업 실패 (무시됨): ${e.message}`);
        }

        // 4. Start background backup watcher (every 30 min)
        startBackupWatcher();
    }
}

const PID_FILE = path.join(PROJECT_ROOT, '.wrangler', '.backup-watch-pid');

function stopOldWatcher() {
    try {
        if (!fs.existsSync(PID_FILE)) return;
        const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
        if (oldPid) process.kill(oldPid, 'SIGTERM');
    } catch {
        // Process already dead, ignore
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
}

function startBackupWatcher() {
    try {
        stopOldWatcher();

        const watcherPath = path.join(__dirname, 'db-backup-watch.js');
        const child = spawn(process.execPath, [watcherPath], {
            detached: true,
            stdio: 'ignore',
            cwd: PROJECT_ROOT
        });
        child.unref();

        // Save PID for cleanup on next dev start
        fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
        fs.writeFileSync(PID_FILE, String(child.pid));
    } catch {
        // Non-critical, ignore
    }
}

main().catch(console.error);
