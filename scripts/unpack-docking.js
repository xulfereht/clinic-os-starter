import fs from 'fs-extra';
import unzipper from 'unzipper';
import path from 'path';
import { fileURLToPath } from 'url';
import { Writable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// --- Configuration ---
const HQ_SERVER_URL = process.env.HQ_SERVER_URL || 'http://localhost:8787';
const LICENSE_KEY = process.env.LICENSE_KEY || 'test-license-key-123';
const BACKUP_DIR = path.join(PROJECT_ROOT, 'archive/backups');
const INCOMING_DIR = path.join(PROJECT_ROOT, '.docking/incoming');

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
    'hq/' // Don't overwrite HQ folder if exists
];

// --- Helpers ---

function getVersion() {
    try {
        const pkg = fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json'));
        return pkg.version;
    } catch {
        return '0.0.0';
    }
}

async function checkForUpdates() {
    console.log(`🔍 Checking for updates from HQ (${HQ_SERVER_URL})...`);

    const currentVersion = getVersion();
    console.log(`   Current version: ${currentVersion}`);

    const response = await fetch(`${HQ_SERVER_URL}/api/v1/check-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: LICENSE_KEY, current_version: currentVersion })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to check updates');
    }

    return response.json();
}

async function downloadPackage(version) {
    console.log(`📥 Downloading version ${version}...`);

    await fs.ensureDir(INCOMING_DIR);
    const targetPath = path.join(INCOMING_DIR, `clinic-os-${version}.zip`);

    const response = await fetch(`${HQ_SERVER_URL}/api/v1/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: LICENSE_KEY, version })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to download package');
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(targetPath, Buffer.from(buffer));

    console.log(`   Downloaded to: ${targetPath}`);
    return targetPath;
}

async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `pre-docking-backup-${timestamp}`);

    console.log(`💾 Creating backup at ${backupPath}...`);
    await fs.ensureDir(backupPath);

    // Copy critical files for rollback
    if (await fs.pathExists(path.join(PROJECT_ROOT, 'src'))) {
        await fs.copy(path.join(PROJECT_ROOT, 'src'), path.join(backupPath, 'src'));
    }
    await fs.copy(path.join(PROJECT_ROOT, 'package.json'), path.join(backupPath, 'package.json'));

    console.log(`✅ Backup complete.`);
    return backupPath;
}

async function applyPackage(packagePath) {
    console.log("🛠️  Unpacking and merging...");

    const directory = await unzipper.Open.file(packagePath);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const file of directory.files) {
        const targetPath = path.join(PROJECT_ROOT, file.path);

        // Check Safe Zones
        const isSafe = SAFE_ZONES.some(zone => file.path.startsWith(zone));
        if (isSafe) {
            skippedCount++;
            continue;
        }

        if (file.type === 'Directory') {
            await fs.ensureDir(targetPath);
        } else {
            const buffer = await file.buffer();
            await fs.outputFile(targetPath, buffer);
            updatedCount++;
        }
    }

    console.log(`   Updated: ${updatedCount} files`);
    console.log(`   Skipped (Safe Zone): ${skippedCount} files`);
}

// --- Main ---

async function unpackDocking() {
    console.log("🚢 Initiating Docking Procedure...\n");

    try {
        // 1. Check for Updates
        const updateInfo = await checkForUpdates();

        if (!updateInfo.update_available) {
            console.log("✅ You are already on the latest version!");
            return;
        }

        console.log(`📦 New version available: ${updateInfo.latest_version} (${updateInfo.type})`);
        if (updateInfo.release_notes) {
            console.log(`   Release Notes: ${updateInfo.release_notes}`);
        }
        console.log('');

        // 2. Download Package
        const packagePath = await downloadPackage(updateInfo.latest_version);

        // 3. Create Backup
        await createBackup();

        // 4. Apply Package
        await applyPackage(packagePath);

        // 5. Post-Docking Tasks
        console.log("\n📝 Post-Docking Tasks:");
        console.log("   1. Run 'npm install' to update dependencies");
        console.log("   2. Check migrations in 'migrations/' folder");
        console.log("   3. Run 'npm run dev' to test locally");
        console.log("   4. Run 'npm run deploy' to push to production");

        console.log("\n✅ Docking sequence complete. System updated to v" + updateInfo.latest_version);

    } catch (error) {
        console.error("❌ Docking failed:", error.message);
        process.exit(1);
    }
}

unpackDocking();
