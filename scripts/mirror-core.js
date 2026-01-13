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

    // 0. Auto Bump Version
    const pkgPath = path.join(PROJECT_ROOT, 'package.json');
    const pkg = fs.readJsonSync(pkgPath);

    // Parse and Increment Version
    const oldVersion = pkg.version;
    const [program, major, minor, patch] = oldVersion.match(/(\d+)\.(\d+)\.(\d+)/);
    const newVersion = `${major}.${minor}.${parseInt(patch) + 1}`;
    pkg.version = newVersion;

    // Save new version to package.json
    fs.writeJsonSync(pkgPath, pkg, { spaces: 4 });
    console.log(`🆙 Bumped version: ${oldVersion} -> ${newVersion}`);

    const version = newVersion;
    const tagName = `v${version}`;
    const STAGING_DIR = path.join(PROJECT_ROOT, '.mirror-staging');

    console.log(`🚀 Mirroring core files to ${mirrorUrl}`);
    console.log(`📦 Version: ${tagName}`);

    try {
        // 1. Prepare Staging Area (Incremental)
        let isIncremental = false;
        if (fs.existsSync(path.join(STAGING_DIR, '.git'))) {
            console.log("   🔄 Detected existing staging area. Attempting incremental update...");
            try {
                // Reset staging area to match remote HEAD to avoid conflicts
                // We don't fetch here to save time, assuming we are the source of truth, 
                // but if we want to be safe we could fetch. 
                // Since this is a one-way mirror, we just treat local artifacts as truth.
                // But to reuse the .git folder, we need to be careful not to delete it.
                isIncremental = true;
            } catch (e) {
                console.warn("   ⚠️  Existing staging area corrupt, resetting...");
                fs.removeSync(STAGING_DIR);
            }
        } else {
            if (fs.existsSync(STAGING_DIR)) fs.removeSync(STAGING_DIR);
        }

        fs.ensureDirSync(STAGING_DIR);

        // If incremental, we clean everything EXCEPT .git
        if (isIncremental) {
            const files = fs.readdirSync(STAGING_DIR);
            for (const file of files) {
                if (file !== '.git') {
                    fs.removeSync(path.join(STAGING_DIR, file));
                }
            }
        }

        console.log("   📂 Copying files to staging...");
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
        if (!isIncremental) {
            console.log("   🔗 Initializing Git in staging area...");
            execSync(`git init`, { cwd: STAGING_DIR });
            execSync(`git config http.postBuffer 524288000`, { cwd: STAGING_DIR });
            try {
                execSync(`git remote add origin ${mirrorUrl}`, { cwd: STAGING_DIR });
            } catch (e) {
                execSync(`git remote set-url origin ${mirrorUrl}`, { cwd: STAGING_DIR });
            }

            // Try to fetch existing history to avoid force push of entire repo
            try {
                console.log("   📥 Fetching existing history...");
                execSync(`git fetch origin main --depth 1`, { cwd: STAGING_DIR });
                execSync(`git reset --soft origin/main`, { cwd: STAGING_DIR });
            } catch (e) {
                console.log("   ⚠️  No remote history found or fetch failed. Starting fresh.");
            }
        } else {
            console.log("   🔗 Reusing Git in staging area...");
            try {
                execSync(`git remote set-url origin ${mirrorUrl}`, { cwd: STAGING_DIR });
            } catch (e) {
                execSync(`git remote add origin ${mirrorUrl}`, { cwd: STAGING_DIR });
            }

            // Sync with remote to enable delta push
            try {
                console.log("   📥 Syncing with remote...");
                execSync(`git fetch origin main`, { cwd: STAGING_DIR, stdio: 'pipe' });
                execSync(`git reset --soft origin/main`, { cwd: STAGING_DIR });
            } catch (e) {
                console.log("   ⚠️  Remote sync failed, will force push.");
            }
        }
        execSync(`git config http.postBuffer 524288000`, { cwd: STAGING_DIR }); // 500MB

        console.log("   📊 Staging area size:");
        try {
            console.log(execSync(`du -sh .`, { cwd: STAGING_DIR }).toString());
        } catch (e) { }

        execSync(`git add .`, { cwd: STAGING_DIR });

        // Check if there are changes to commit
        const status = execSync(`git status --porcelain`, { cwd: STAGING_DIR }).toString().trim();
        if (!status) {
            console.log("   ℹ️  No changes to commit. Skipping push.");
            console.log(`\n✅ Already up to date!`);
            return;
        }
        execSync(`git commit -m "Release ${tagName}"`, { cwd: STAGING_DIR });

        // No forceful branch move if we are properly synced
        // But to be safe with local branch naming:
        try { execSync(`git branch -M main`, { cwd: STAGING_DIR }); } catch (e) { }

        console.log("   📤 Pushing to mirror repository...");
        // Try normal push first, fallback to force if needed
        try {
            execSync(`git push origin main`, { cwd: STAGING_DIR, stdio: 'pipe' });
        } catch (e) {
            console.log("   ⚠️  Normal push failed, trying force push...");
            execSync(`git push origin main --force`, { cwd: STAGING_DIR });
        }

        console.log(`   🏷️  Tagging with ${tagName}...`);
        try {
            execSync(`git tag -d ${tagName}`, { cwd: STAGING_DIR, stdio: 'pipe' });
        } catch (e) { /* tag doesn't exist locally */ }
        execSync(`git tag ${tagName}`, { cwd: STAGING_DIR });
        execSync(`git push origin ${tagName} --force`, { cwd: STAGING_DIR });

        console.log(`\n✅ Mirroring Complete!`);

    } catch (error) {
        console.error("\n❌ Mirroring Failed:");
        console.error(error.message);
        process.exit(1);
    } finally {
        console.log("   🧹 Cleaning up (Keeping staging for incremental updates)...");
        // fs.removeSync(STAGING_DIR); 
    }
}

mirrorCore();
