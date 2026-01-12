import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Mirror Starter Script
 * -------------------
 * This script pushes the 'Starter Kit' (Shell) to a public mirror repository.
 * Usage: node scripts/mirror-starter.js [MIRROR_REPO_URL]
 */

const STARTER_FILES = [
    'package.json',
    'GEMINI.md',
    '.gitignore',
    '.docking',
    '.client',
    '.agent',
    'scripts',
    'docs'
];

const EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/.DS_Store',
    'core/',           // IMPORTANT: Use trailing slash to match directory
    'data/',           // Exclude user data
    'dist/',
    'archive/',
    '**/*.zip',
    '**/*.log',
    '.docking/checkpoints/', // Exclude local checkpoints from public mirror
    '.git/'
];

function mirrorStarter() {
    const mirrorUrl = process.argv[2];
    if (!mirrorUrl) {
        console.error("❌ Error: Mirror repository URL is required.");
        console.log("   Usage: node scripts/mirror-starter.js [MIRROR_REPO_URL]");
        process.exit(1);
    }

    const pkg = fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json'));
    const version = pkg.version;
    const tagName = `v${version}`;
    const STAGING_DIR = path.join(PROJECT_ROOT, '.starter-staging');

    console.log(`🚀 Mirroring Starter Kit to ${mirrorUrl}`);
    console.log(`📦 Version: ${tagName}`);

    try {
        // 1. Prepare Staging Area
        if (fs.existsSync(STAGING_DIR)) fs.removeSync(STAGING_DIR);
        fs.ensureDirSync(STAGING_DIR);

        console.log("   📂 Preparing staging area...");
        for (const item of STARTER_FILES) {
            const src = path.join(PROJECT_ROOT, item);
            const dest = path.join(STAGING_DIR, item);

            if (fs.existsSync(src)) {
                fs.copySync(src, dest, {
                    filter: (src) => {
                        const rel = path.relative(PROJECT_ROOT, src).replace(/\\/g, '/');

                        // Strict check for core/ exclusion to prevent leaking source
                        if (rel.startsWith('core') || rel === 'core') return false;

                        return !EXCLUDE_PATTERNS.some(p => {
                            // Simple glob-like matching
                            if (p.endsWith('/')) return rel.startsWith(p.slice(0, -1));
                            return rel.includes(p.replace(/\*\*/g, ''));
                        });
                    }
                });
            }
        }

        // Add empty core placeholder
        fs.ensureDirSync(path.join(STAGING_DIR, 'core'));
        fs.writeFileSync(path.join(STAGING_DIR, 'core', '.gitkeep'), '');

        // Add empty data placeholder
        fs.ensureDirSync(path.join(STAGING_DIR, 'data'));
        fs.writeFileSync(path.join(STAGING_DIR, 'data', '.gitkeep'), '');

        // Create Setup Helper for Linux/Mac
        const setupSh = `#!/bin/bash
# Clinic-OS Setup Helper
echo "🚀 Starting Clinic-OS Setup..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v18+"
    exit 1
fi
node scripts/setup-clinic.js
`;
        fs.writeFileSync(path.join(STAGING_DIR, 'setup.sh'), setupSh, { mode: 0o755 });

        // Update package.json for the starter (remove dev/local scripts if needed, or keep as is)
        // For now, we keep it as is, but ensure 'dev' works (whch we did with preflight)

        // 2. Initialize and Push
        console.log("   🔗 Initializing Git in staging area...");
        execSync(`git init`, { cwd: STAGING_DIR });
        execSync(`git config http.postBuffer 524288000`, { cwd: STAGING_DIR });

        execSync(`git remote add origin ${mirrorUrl}`, { cwd: STAGING_DIR });
        execSync(`git add .`, { cwd: STAGING_DIR });
        execSync(`git commit -m "Release ${tagName}"`, { cwd: STAGING_DIR });
        execSync(`git branch -M main`, { cwd: STAGING_DIR });

        console.log("   📤 Pushing to mirror repository...");
        execSync(`git push origin main --force`, { cwd: STAGING_DIR });

        console.log(`   🏷️  Tagging with ${tagName}...`);
        execSync(`git tag ${tagName}`, { cwd: STAGING_DIR });
        execSync(`git push origin ${tagName} --force`, { cwd: STAGING_DIR });

        console.log(`\n✅ Starter Mirroring Complete!`);

    } catch (error) {
        console.error("\n❌ Starter Mirroring Failed:");
        console.error(error.message);
    } finally {
        console.log("   🧹 Cleaning up...");
        fs.removeSync(STAGING_DIR);
    }
}

mirrorStarter();
