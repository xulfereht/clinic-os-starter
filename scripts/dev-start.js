import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname is .../core/scripts (inside distributed core) or .../scripts (locally)
const PROJECT_ROOT = path.join(__dirname, '..');

async function main() {
    // 1. Run Check-In if exists
    // This logs the usage to HQ
    const checkInScript = path.join(PROJECT_ROOT, 'scripts', 'check-in.js');
    if (fs.existsSync(checkInScript)) {
        try {
            execSync(`node "${checkInScript}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
        } catch (e) {
            // Ignore check-in errors, don't block dev
        }
    }
}

main().catch(console.error);
