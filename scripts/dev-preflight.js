import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function preflight() {
    const corePath = path.join(PROJECT_ROOT, 'core');
    const corePkg = path.join(corePath, 'package.json');
    const coreModules = path.join(corePath, 'node_modules');
    const wranglerState = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1');

    // 1. Core 코드 존재 확인 — 없으면 안내 후 중단
    if (!fs.existsSync(corePkg)) {
        console.log("\n❌ Core 코드가 없습니다.");
        console.log("   → npm run setup    (초기 설치)");
        console.log("   → npm run core:pull (코어 업데이트)\n");
        process.exit(1);
    }

    // 2. 의존성 확인 — 없으면 자동 설치
    if (!fs.existsSync(coreModules)) {
        console.log("📦 의존성 설치 중...");
        try {
            execSync('npm install', { stdio: 'inherit', cwd: corePath });
        } catch (e) {
            console.error("❌ npm install 실패:", e.message);
            process.exit(1);
        }
    }

    // 3. DB 존재 확인 — 없으면 안내만 (dev는 DB 없이도 시작 가능)
    if (!fs.existsSync(wranglerState)) {
        console.log("\n⚠️  로컬 데이터베이스가 없습니다.");
        console.log("   → npm run db:init && npm run db:seed\n");
    }

    // 4. Check-In (HQ 핑) — 실패해도 무시
    const checkInScript = path.join(PROJECT_ROOT, 'scripts', 'check-in.js');
    if (fs.existsSync(checkInScript)) {
        try {
            execSync(`node "${checkInScript}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            // Ignore check-in failures
        }
    }
}

preflight().catch(err => {
    console.error("❌ Preflight error:", err.message);
    process.exit(1);
});
