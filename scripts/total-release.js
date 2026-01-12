import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function runCommand(cmd, cwd = PROJECT_ROOT) {
    console.log(`\n🚀 Running: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, { cwd });
    if (stdout) console.log(stdout.trim());
    if (stderr && !stderr.includes('Uploading') && !stderr.includes('complete')) {
        console.warn(stderr.trim());
    }
}

async function totalRelease() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("   🏥 Clinic-OS One-Click Total Release Coordinator 🏥");
    console.log("═══════════════════════════════════════════════════════════\n");

    try {
        // 1. Get Version
        const pkg = await fs.readJson(path.join(PROJECT_ROOT, 'package.json'));
        const version = pkg.version;
        const tagName = `v${version}`;
        console.log(`📦 Targeted Version: ${tagName}`);

        // 2. Main Repository Sync
        console.log("\n📡 [1/5] Syncing Main Repository (Clinic-OS)...");
        try {
            await runCommand(`git add .`);
            await runCommand(`git commit -m "release: ${tagName}"`);
            await runCommand(`git push origin main`);
            console.log("   ✅ Main repository synced.");
        } catch (e) {
            console.log("   ℹ️  No changes to commit or sync already up to date.");
        }

        // 3. Starter Kit Generation
        console.log("\n📦 [2/6] Generating Starter Kit...");
        await runCommand(`npm run create-starter-kit`);
        console.log("   ✅ Starter Kit prepared.");

        // 4. Starter Kit Mirroring
        console.log("\n🔄 [3/6] Mirroring Starter Kit (Public Git)...");
        await runCommand(`npm run starter:push`);
        console.log("   ✅ Starter Kit mirror repository synced.");

        // 5. Core Mirroring
        console.log("\n🔄 [4/6] Mirroring Core for Distribution...");
        await runCommand(`npm run core:push`);
        console.log("   ✅ Core mirror repository synced.");

        // 6. HQ Distribution & D1 Update
        console.log("\n☁️  [5/6] Distributing to HQ (R2 & D1)...");
        await runCommand(`npm run release`);
        console.log("   ✅ HQ distribution complete.");

        // 6. HQ Server Deployment
        console.log("\n🌎 [5/5] Deploying HQ Server (Cloudflare Pages)...");
        await runCommand(`npm run hq:deploy`);
        console.log("   ✅ HQ server deployed.");

        console.log("\n═══════════════════════════════════════════════════════════");
        console.log(`🎉 TOTAL RELEASE SUCCESSFUL: ${tagName} is live!`);
        console.log("═══════════════════════════════════════════════════════════\n");

    } catch (error) {
        console.error("\n❌ Total Release Failed:");
        console.error(error.message);
        process.exit(1);
    }
}

totalRelease();
