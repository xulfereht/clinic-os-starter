import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Configuration
const HQ_DB = 'clinic-hq-db';
const PACKAGES_BUCKET = 'clinic-packages';
const DIST_DIR = path.join(PROJECT_ROOT, 'dist-packages');

async function runCommand(cmd) {
    console.log(`> ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, { cwd: PROJECT_ROOT, shell: '/bin/bash' }); // Ensure bash for PATH handling if needed
    if (stderr && !stderr.includes('Creating object') && !stderr.includes('Upload complete')) {
        // Wrangler outputs progress to stderr, ignore standard progress messages
        // console.warn(stderr); 
    }
    return stdout;
}

async function getLatestPackage(version) {
    const files = await fs.readdir(DIST_DIR);
    // Find clinic-os-v1.0.7-full-*.zip
    const fullPackage = files.find(f => f.startsWith(`clinic-os-v${version}-full`) && f.endsWith('.zip'));
    return fullPackage;
}

async function publishRelease() {
    console.log("🚀 Starting Clinic-OS Release Publisher (Git-Native Mode)...\n");

    const pkg = await fs.readJson(path.join(PROJECT_ROOT, 'package.json'));
    const version = pkg.version;
    console.log(`📦 Version: v${version}`);

    const fullPackageFilename = await getLatestPackage(version);
    const starterKitFilename = `clinic-os-starter-v${version}.zip`;
    const starterKitPath = path.join(DIST_DIR, starterKitFilename);

    try {
        // 1. Upload Full Package to R2 (Optional Backup)
        if (fullPackageFilename) {
            console.log(`   Found Full Package: ${fullPackageFilename}`);
            console.log("☁️  Uploading Full Package to R2 (Backup)...");
            await runCommand(`npx wrangler r2 object put ${PACKAGES_BUCKET}/${fullPackageFilename} --file=dist-packages/${fullPackageFilename} --remote`);
            console.log("   ✅ Upload Complete.");
        } else {
            console.log("⚠️  Full Zip Package not found. Skipping R2 backup upload.");
        }

        // 2. Upload Starter Kit to R2 (Optional Update)
        if (fs.existsSync(starterKitPath)) {
            console.log(`   Found Starter Kit: ${starterKitFilename}`);
            console.log("☁️  Updating Starter Kit (latest)...");
            await runCommand(`npx wrangler r2 object put ${PACKAGES_BUCKET}/starter-kit/latest.zip --file=dist-packages/${starterKitFilename} --remote`);
            console.log("   ✅ Starter Kit Updated.");
        } else {
            console.log("⚠️  Starter Kit Zip not found. Skipping starter kit update.");
        }

        // 3. Update Database Record (Mandatory for Signal)
        console.log("\n🗄️  Updating HQ Database...");
        const releaseNotes = `v${version}: Git-native release (v3.0)`;
        const dbFilename = fullPackageFilename || "git-native";

        const sql = `INSERT OR REPLACE INTO versions (version, type, filename, release_notes, is_public) VALUES ('${version}', 'full', '${dbFilename}', '${releaseNotes}', 1);`;

        await runCommand(`npx wrangler d1 execute ${HQ_DB} --command "${sql}" --remote`);
        console.log("   ✅ Database Updated with new version signal.");

        console.log("\n🎉 RELEASE COMPLETE!");
        console.log(`   v${version} is now active for all clients via Git.`);

    } catch (error) {
        console.error("\n❌ Release Failed:");
        console.error(error);
        process.exit(1);
    }
}

publishRelease();
