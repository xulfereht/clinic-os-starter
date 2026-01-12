import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function preflight() {
    console.log("🔍 Dev Preflight Check...");

    const corePath = path.join(PROJECT_ROOT, 'core');
    const corePkg = path.join(corePath, 'package.json');
    const coreModules = path.join(corePath, 'node_modules');
    const wranglerState = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1');

    // 1. Check if core exists
    if (!fs.existsSync(corePkg)) {
        console.log("   ⚠️ Core code missing. Running auto-setup...");
        try {
            execSync('node scripts/setup-clinic.js --auto', { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            console.error("   ❌ Auto-setup failed. Please run 'npm run setup' manually.");
            process.exit(1);
        }
    }

    // 2. Check if node_modules exist in core
    if (!fs.existsSync(coreModules)) {
        console.log("   ⚠️ Core dependencies missing. Installing...");
        try {
            execSync('npm install', { stdio: 'inherit', cwd: corePath });
        } catch (e) {
            console.error("   ❌ Dependency installation failed.");
            process.exit(1);
        }
    }

    // 3. Check if DB exists
    if (!fs.existsSync(wranglerState)) {
        console.log("   ⚠️ Local database missing. Initializing...");
        try {
            // Re-run setup in auto mode to init DB
            execSync('node scripts/setup-clinic.js --auto', { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            console.error("   ❌ Database initialization failed.");
            process.exit(1);
        }
    }

    // 4. Run Check-In (Ping HQ)
    if (fs.existsSync(path.join(PROJECT_ROOT, 'scripts/check-in.js'))) {
        try {
            execSync('node scripts/check-in.js', { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            // Ignore check-in failures
        }
    }

    console.log("✅ Preflight complete. Starting dev server...\n");
}

preflight().catch(err => {
    console.error("❌ Preflight error:", err.message);
    process.exit(1);
});
