#!/usr/bin/env node
/**
 * cleanup.js — Client repo disk cleanup
 *
 * Removes old backups, snapshots, and build caches to keep repo size manageable.
 *
 * Usage:
 *   node scripts/cleanup.js              # Standard cleanup (backups + snapshots)
 *   node scripts/cleanup.js --all        # Standard + build cache
 *   node scripts/cleanup.js --dry-run    # Show what would be deleted
 *   node scripts/cleanup.js --help       # Show help
 *
 * Retention policy:
 *   .core-backup/          — keep latest 5
 *   .agent/protection-snapshots/ — keep latest 5
 *   core/.astro/           — deleted on --all (build cache)
 *   core/dist/             — deleted on --all (build output)
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const IS_STARTER = fs.existsSync(path.join(PROJECT_ROOT, 'core/src'));

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const ALL = args.has('--all');

if (args.has('--help') || args.has('-h')) {
    console.log(`cleanup.js — Client repo disk cleanup

Usage:
  node scripts/cleanup.js              # Backups + snapshots (keep 5)
  node scripts/cleanup.js --all        # + build cache (dist, .astro)
  node scripts/cleanup.js --dry-run    # Preview only

Retention: keep latest 5 backups/snapshots. Build cache fully removed on --all.`);
    process.exit(0);
}

function getSubdirs(dir) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) return [];
    return fs.readdirSync(fullDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
}

function removeDir(dir) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) return 0;
    const size = getDirSize(fullDir);
    if (DRY_RUN) {
        console.log(`  [dry-run] would delete: ${dir} (${formatSize(size)})`);
    } else {
        fs.rmSync(fullDir, { recursive: true, force: true });
        console.log(`  🗑️  ${dir} (${formatSize(size)})`);
    }
    return size;
}

function getDirSize(dir) {
    let size = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                size += getDirSize(full);
            } else {
                size += fs.statSync(full).size;
            }
        }
    } catch { /* skip */ }
    return size;
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function pruneDir(dir, keep) {
    const subdirs = getSubdirs(dir);
    if (subdirs.length <= keep) {
        console.log(`  ✅ ${dir}: ${subdirs.length}개 (보존 한도 ${keep} 이내)`);
        return 0;
    }
    const toDelete = subdirs.slice(0, subdirs.length - keep);
    let freed = 0;
    console.log(`  📦 ${dir}: ${subdirs.length}개 → ${keep}개 (${toDelete.length}개 삭제)`);
    for (const d of toDelete) {
        freed += removeDir(path.join(dir, d));
    }
    return freed;
}

// --- Main ---
console.log(`\n═══════════════════════════════════════════════════`);
console.log(`🧹 Clinic-OS Repo Cleanup${DRY_RUN ? ' (dry-run)' : ''}`);
console.log(`═══════════════════════════════════════════════════\n`);

let totalFreed = 0;

// 1. Core backups
totalFreed += pruneDir('.core-backup', 5);

// 2. Protection snapshots
totalFreed += pruneDir('.agent/protection-snapshots', 5);

// 3. Build cache (--all only)
if (ALL) {
    const corePrefix = IS_STARTER ? 'core/' : '';
    const astroDir = `${corePrefix}.astro`;
    const distDir = `${corePrefix}dist`;

    console.log(`\n  🔨 Build cache cleanup:`);
    if (fs.existsSync(path.join(PROJECT_ROOT, astroDir))) {
        totalFreed += removeDir(astroDir);
    }
    if (fs.existsSync(path.join(PROJECT_ROOT, distDir))) {
        totalFreed += removeDir(distDir);
    }
}

console.log(`\n─────────────────────────────────────────────────`);
console.log(`  ${DRY_RUN ? 'Would free' : 'Freed'}: ${formatSize(totalFreed)}`);
console.log('');
