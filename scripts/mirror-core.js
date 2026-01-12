import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Mirror Core Script
 * -------------------
 * This script pushes the 'core/' directory to a dedicated mirror repository.
 * Usage: node scripts/mirror-core.js [MIRROR_REPO_URL]
 */

const CORE_FILES = [
    'src',
    'public',
    'migrations',
    'seeds',
    'package.json',
    'GEMINI.md',
    'astro.config.mjs',
    'tsconfig.json',
    'scripts/setup-clinic.js',
    'scripts/check-system.js',
    'scripts/check-in.js',
    'scripts/dev-preflight.js',
    'scripts/dev-start.js',
    'scripts/db-sync.js',
    '.docking/engine/fetch.js'
];

const EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/.DS_Store',
    'migrations/skipped/**',
    'public/images/programs/diet/raw/**'
];

async function mirrorCore() {
    const mirrorUrl = process.argv[2];
    if (!mirrorUrl) {
        console.error("❌ Error: Mirror repository URL is required.");
        console.log("   Usage: node scripts/mirror-core.js [MIRROR_REPO_URL]");
        process.exit(1);
    }

    const pkg = fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json'));
    const version = pkg.version;
    const tagName = `v${version}`;
    const STAGING_DIR = path.join(PROJECT_ROOT, '.mirror-staging');

    console.log(`🚀 Mirroring core files to ${mirrorUrl}`);
    console.log(`📦 Version: ${tagName}`);

    try {
        // 1. Prepare Staging Area
        if (fs.existsSync(STAGING_DIR)) fs.removeSync(STAGING_DIR);
        fs.ensureDirSync(STAGING_DIR);

        console.log("   📂 Preparing staging area...");
        for (const item of CORE_FILES) {
            const src = path.join(PROJECT_ROOT, item);
            let destSubPath = item;

            // Map scripts to core/scripts/ for distribution
            if (item.endsWith('.js') && (item.includes('scripts/') || item.includes('engine/'))) {
                destSubPath = 'scripts/' + path.basename(item);
            }

            const dest = path.join(STAGING_DIR, destSubPath);

            if (fs.existsSync(src)) {
                fs.copySync(src, dest, {
                    filter: (src) => {
                        const rel = path.relative(PROJECT_ROOT, src).replace(/\\/g, '/');
                        return !EXCLUDE_PATTERNS.some(p => rel.includes(p.replace(/\*\*/g, '')));
                    }
                });
            }
        }

        // 2. Initialize and Push
        console.log("   🔗 Initializing Git in staging area...");
        execSync(`git init`, { cwd: STAGING_DIR });
        execSync(`git config http.postBuffer 524288000`, { cwd: STAGING_DIR }); // 500MB

        console.log("   📊 Staging area size:");
        try {
            console.log(execSync(`du -sh .`, { cwd: STAGING_DIR }).toString());
        } catch (e) { }

        execSync(`git remote add origin ${mirrorUrl}`, { cwd: STAGING_DIR });
        execSync(`git add .`, { cwd: STAGING_DIR });
        execSync(`git commit -m "Release ${tagName}"`, { cwd: STAGING_DIR });
        execSync(`git branch -M main`, { cwd: STAGING_DIR });

        console.log("   📤 Pushing to mirror repository...");
        execSync(`git push origin main --force`, { cwd: STAGING_DIR });

        console.log(`   🏷️  Tagging with ${tagName}...`);
        execSync(`git tag ${tagName}`, { cwd: STAGING_DIR });
        execSync(`git push origin ${tagName} --force`, { cwd: STAGING_DIR });

        console.log(`\n✅ Mirroring Complete!`);

    } catch (error) {
        console.error("\n❌ Mirroring Failed:");
        console.error(error.message);
    } finally {
        console.log("   🧹 Cleaning up...");
        fs.removeSync(STAGING_DIR);
    }
}

mirrorCore();
