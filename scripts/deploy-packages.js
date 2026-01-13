import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// --- Configuration ---
const HQ_URL = 'https://clinic-os-hq.pages.dev';
const ADMIN_ID = 'admin-001'; // From HQ Database
const DIST_DIR = path.join(PROJECT_ROOT, 'dist-packages');

async function deploy() {
    console.log('🚀 Starting Deployment of packages to HQ...\n');

    // 1. Create Starter Kit
    console.log('📦 Step 1: Creating Starter Kit...');
    execSync('node scripts/create-starter-kit.js', { stdio: 'inherit' });

    // 2. Create Full Update Package
    console.log('\n📦 Step 2: Creating Full Update Package...');
    execSync('node scripts/pack-docking.js --type=full', { stdio: 'inherit' });

    // 3. Find files
    const pkgJson = fs.readJsonSync(path.join(PROJECT_ROOT, 'package.json'));
    const version = pkgJson.version;

    const files = fs.readdirSync(DIST_DIR).sort();
    const starterFile = files.filter(f => f.startsWith(`clinic-os-starter-v${version}`) && f.endsWith('.zip')).pop();
    const fullPackageFile = files.filter(f => f.startsWith(`clinic-os-v${version}`) && f.includes('-full-') && f.endsWith('.zip')).pop();

    if (!starterFile || !fullPackageFile) {
        console.error('❌ Failed to find generated packages in dist-packages/');
        process.exit(1);
    }

    console.log(`\n☁️ Step 3: Uploading to HQ (${HQ_URL})...`);

    // Upload Starter Kit
    console.log(`   Uploading Starter Kit: ${starterFile}...`);
    const starterBlob = fs.readFileSync(path.join(DIST_DIR, starterFile));
    const starterFormData = new FormData();
    starterFormData.append('file', new Blob([starterBlob], { type: 'application/zip' }), 'latest.zip');

    const starterRes = await fetch(`${HQ_URL}/api/admin/upload-starter`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${ADMIN_ID}`
        },
        body: starterFormData
    });

    if (starterRes.ok) {
        console.log('✅ Starter Kit uploaded successfully.');
    } else {
        const err = await starterRes.text();
        console.error('❌ Starter Kit upload failed:', err);
    }

    // Upload Full Package
    console.log(`\n   Uploading Full Package: ${fullPackageFile}...`);
    const fullBlob = fs.readFileSync(path.join(DIST_DIR, fullPackageFile));

    // handleUpload expects raw body and query params
    const uploadUrl = new URL(`${HQ_URL}/api/admin/upload`);
    uploadUrl.searchParams.set('filename', `packages/full/v${version}.zip`);
    uploadUrl.searchParams.set('version', version);
    uploadUrl.searchParams.set('type', 'full');
    uploadUrl.searchParams.set('notes', `Initial full release v${version}`);

    const fullRes = await fetch(uploadUrl.toString(), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${ADMIN_ID}`,
            'Content-Type': 'application/zip'
        },
        body: fullBlob
    });

    if (fullRes.ok) {
        console.log('✅ Full Package uploaded successfully.');
    } else {
        const err = await fullRes.text();
        console.error('❌ Full Package upload failed:', err);
    }

    console.log('\n🏁 Deployment Finished!');
}

deploy().catch(console.error);
