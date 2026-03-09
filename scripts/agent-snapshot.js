#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { createProtectionSnapshot } from './lib/deployment-safety.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

function getArgValue(args, prefix, fallback) {
    const hit = args.find((arg) => arg.startsWith(`${prefix}=`));
    if (!hit) return fallback;
    return hit.slice(prefix.length + 1);
}

async function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const noDb = args.includes('--no-db');
    const reason = getArgValue(args, '--reason', 'manual');

    const manifest = await createProtectionSnapshot({
        projectRoot: PROJECT_ROOT,
        reason,
        includeDbBackup: !noDb
    });

    if (json) {
        console.log(JSON.stringify(manifest, null, 2));
        return;
    }

    console.log('\n🧳 Clinic-OS Protection Snapshot\n');
    console.log(`- reason: ${manifest.reason}`);
    console.log(`- snapshot: ${manifest.snapshot_dir}`);
    console.log(`- copied paths: ${manifest.copied_paths.length}`);
    console.log(`- db backup: ${manifest.db_backup_created ? 'created/refreshed' : 'skipped or unchanged'}`);

    if (manifest.missing_paths.length > 0) {
        console.log(`- missing paths: ${manifest.missing_paths.join(', ')}`);
    }
}

main().catch((error) => {
    console.error('Agent snapshot failed:', error);
    process.exit(1);
});
