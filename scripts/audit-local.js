#!/usr/bin/env node
/**
 * audit-local.js — _local override audit after core:pull
 *
 * Compares _local page overrides against core versions to detect:
 * - STALE: _local exists but is identical or inferior to core (should delete)
 * - DRIFT: _local diverged from core (needs merge or manual review)
 * - ORPHAN: _local exists but core page was removed
 * - OK: _local has genuine customization that should be kept
 *
 * Usage:
 *   node scripts/audit-local.js              # Show report
 *   node scripts/audit-local.js --json       # JSON output
 *   node scripts/audit-local.js --auto-clean # Delete STALE+ORPHAN files
 *   node scripts/audit-local.js --help       # Show help
 *
 * Designed to run after core:pull in client repos.
 * The local agent can use this to decide whether to keep or remove _local overrides.
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const IS_STARTER = fs.existsSync('core/src');
const SRC_BASE = IS_STARTER ? 'core/src' : 'src';
const LOCAL_DIR = path.join(SRC_BASE, 'pages/_local');

const args = new Set(process.argv.slice(2));
const JSON_MODE = args.has('--json');
const AUTO_CLEAN = args.has('--auto-clean');

if (args.has('--help') || args.has('-h')) {
    console.log(`audit-local.js — _local override audit

Usage:
  node scripts/audit-local.js              # Show report
  node scripts/audit-local.js --json       # JSON output
  node scripts/audit-local.js --auto-clean # Delete STALE+ORPHAN files automatically

Categories:
  STALE   — _local identical to core or older. Safe to delete.
  DRIFT   — _local differs from core. Needs review.
  ORPHAN  — _local exists but no matching core page. Safe to delete.
  OK      — _local has genuine customization.
  ADMIN   — admin page override (ignored at build time).`);
    process.exit(0);
}

function findLocalFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findLocalFiles(fullPath));
        } else if (entry.name.endsWith('.astro') || entry.name.endsWith('.ts')) {
            results.push(fullPath);
        }
    }
    return results;
}

function getCorePath(localPath) {
    return localPath.replace(`${path.sep}_local${path.sep}`, path.sep).replace(`/_local/`, '/');
}

function getRelativePath(filePath) {
    return path.relative(SRC_BASE, filePath);
}

function computeSimilarity(localPath, corePath) {
    try {
        const localContent = fs.readFileSync(localPath, 'utf-8');
        const coreContent = fs.readFileSync(corePath, 'utf-8');

        const normalize = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
        if (normalize(localContent) === normalize(coreContent)) return 1.0;

        const localLines = new Set(localContent.split('\n').map(l => l.trim()).filter(Boolean));
        const coreLines = new Set(coreContent.split('\n').map(l => l.trim()).filter(Boolean));
        const intersection = [...localLines].filter(l => coreLines.has(l)).length;
        const union = new Set([...localLines, ...coreLines]).size;
        return union > 0 ? intersection / union : 0;
    } catch {
        return 0;
    }
}

function checkImports(localPath) {
    try {
        const content = fs.readFileSync(localPath, 'utf-8');
        const localImports = [];
        const importRegex = /from\s+['"]([^'"]*local[^'"]*)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            localImports.push(match[1]);
        }
        return localImports;
    } catch {
        return [];
    }
}

// --- Main ---

const localFiles = findLocalFiles(LOCAL_DIR);

if (localFiles.length === 0) {
    if (JSON_MODE) {
        console.log(JSON.stringify({ files: [], summary: { total: 0 } }));
    } else {
        console.log('✅ No _local overrides found. All pages use core versions.');
    }
    process.exit(0);
}

const results = [];

for (const localPath of localFiles) {
    const corePath = getCorePath(localPath);
    const relativePath = getRelativePath(localPath);
    const isAdmin = relativePath.includes('admin/');
    const localImports = checkImports(localPath);
    const hasLocalDeps = localImports.length > 0;

    let category, reason;
    let similarity = 0;

    if (isAdmin) {
        category = 'ADMIN';
        reason = 'admin override — ignored at build time';
    } else if (!fs.existsSync(corePath)) {
        category = 'ORPHAN';
        reason = 'no matching core page';
    } else {
        similarity = computeSimilarity(localPath, corePath);

        if (similarity >= 0.95) {
            category = 'STALE';
            reason = `${Math.round(similarity * 100)}% identical to core`;
        } else if (hasLocalDeps) {
            category = similarity < 0.5 ? 'OK' : 'DRIFT';
            reason = `imports local deps: ${localImports.join(', ')}`;
        } else if (similarity >= 0.7) {
            category = 'DRIFT';
            reason = `${Math.round(similarity * 100)}% similar — minor diff, review needed`;
        } else {
            category = 'OK';
            reason = `${Math.round(similarity * 100)}% similar — significant customization`;
        }
    }

    results.push({
        path: relativePath,
        category,
        reason,
        similarity: Math.round(similarity * 100),
        localDeps: localImports,
        coreExists: fs.existsSync(corePath),
    });
}

const order = { STALE: 0, ORPHAN: 1, DRIFT: 2, ADMIN: 3, OK: 4 };
results.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9));

const summary = {
    total: results.length,
    stale: results.filter(r => r.category === 'STALE').length,
    orphan: results.filter(r => r.category === 'ORPHAN').length,
    drift: results.filter(r => r.category === 'DRIFT').length,
    admin: results.filter(r => r.category === 'ADMIN').length,
    ok: results.filter(r => r.category === 'OK').length,
};

if (JSON_MODE) {
    console.log(JSON.stringify({ files: results, summary }, null, 2));
} else {
    const icons = { STALE: '🗑️', ORPHAN: '👻', DRIFT: '⚠️', ADMIN: '🔒', OK: '✅' };

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`🔍 _local Override Audit`);
    console.log(`═══════════════════════════════════════════════════\n`);
    console.log(`  Total: ${summary.total} overrides\n`);

    for (const r of results) {
        console.log(`  ${icons[r.category] || '?'} [${r.category}] ${r.path}`);
        console.log(`     → ${r.reason}`);
        if (r.localDeps.length > 0) {
            console.log(`     📦 deps: ${r.localDeps.join(', ')}`);
        }
    }

    console.log(`\n─────────────────────────────────────────────────`);
    console.log(`  🗑️  STALE: ${summary.stale} (safe to delete)`);
    console.log(`  👻 ORPHAN: ${summary.orphan} (safe to delete)`);
    console.log(`  ⚠️  DRIFT: ${summary.drift} (needs review)`);
    console.log(`  🔒 ADMIN: ${summary.admin} (ignored at build)`);
    console.log(`  ✅ OK: ${summary.ok} (keep)`);

    if (summary.stale + summary.orphan > 0) {
        console.log(`\n  💡 Run with --auto-clean to delete STALE + ORPHAN files.`);
    }
    console.log('');
}

// Auto-clean
if (AUTO_CLEAN) {
    const toDelete = results.filter(r => r.category === 'STALE' || r.category === 'ORPHAN');
    if (toDelete.length === 0) {
        console.log('  Nothing to clean.');
    } else {
        for (const r of toDelete) {
            const fullPath = path.join(SRC_BASE, r.path);
            try {
                fs.unlinkSync(fullPath);
                console.log(`  🗑️  Deleted: ${r.path}`);
            } catch (e) {
                console.error(`  ❌ Failed to delete ${r.path}: ${e.message}`);
            }
        }
        console.log(`\n  Deleted ${toDelete.length} files.`);
    }
}

process.exit(summary.stale + summary.orphan + summary.drift > 0 ? 1 : 0);
