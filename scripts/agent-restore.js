#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import {
    applyRestorePlan,
    buildRestorePlan,
    discoverRestoreSources
} from './lib/deployment-safety.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

function getArgValue(args, prefix, fallback = null) {
    const match = args.find((arg) => arg.startsWith(`${prefix}=`));
    if (!match) return fallback;
    return match.slice(prefix.length + 1);
}

function pickSource(discovery, selector) {
    if (!selector || selector === 'auto') return discovery.primary;

    const normalizedSelector = path.resolve(PROJECT_ROOT, selector);
    return discovery.candidates.find((candidate) =>
        candidate.id === selector ||
        candidate.path === selector ||
        path.resolve(candidate.path) === normalizedSelector ||
        path.basename(candidate.path) === selector
    ) || null;
}

export function planRestore(options = {}) {
    const projectRoot = options.projectRoot || PROJECT_ROOT;
    const discovery = discoverRestoreSources(projectRoot);
    const source = pickSource(discovery, options.source || 'auto');

    if (!source) {
        throw new Error('사용 가능한 복원 소스를 찾지 못했습니다.');
    }

    const plan = buildRestorePlan({
        projectRoot,
        source,
        includeMappedCore: !!options.includeMappedCore
    });

    return {
        discovery: {
            generated_at: discovery.generated_at,
            total: discovery.total,
            primary: discovery.primary
                ? {
                    id: discovery.primary.id,
                    type: discovery.primary.type,
                    label: discovery.primary.label,
                    path: discovery.primary.path
                }
                : null
        },
        available_sources: discovery.candidates.map((candidate) => ({
            id: candidate.id,
            type: candidate.type,
            label: candidate.label,
            path: candidate.path,
            score: candidate.score,
            detected_at: candidate.detected_at,
            direct_path_count: candidate.direct_paths.length,
            mapped_core_count: candidate.mapped_core_candidates.length,
            manual_review_count: candidate.manual_review.length
        })),
        plan
    };
}

function printSources(payload) {
    console.log('\n📦 Clinic-OS Restore Sources\n');
    if (payload.available_sources.length === 0) {
        console.log('- 사용 가능한 복원 소스가 없습니다.');
        return;
    }

    for (const source of payload.available_sources) {
        console.log(`- ${source.label}`);
        console.log(`  id: ${source.id}`);
        console.log(`  path: ${source.path}`);
        console.log(`  score: ${source.score}`);
        console.log(`  direct paths: ${source.direct_path_count}`);
        console.log(`  mapped core: ${source.mapped_core_count}`);
        console.log(`  manual review: ${source.manual_review_count}`);
    }
}

function printPlan(payload, result = null) {
    const { plan } = payload;
    console.log('\n🧩 Clinic-OS Restore Plan\n');
    console.log(`- source: ${plan.source.label}`);
    console.log(`- type: ${plan.source.type}`);
    console.log(`- path: ${plan.source.path}`);
    console.log(`- direct copy: ${plan.operations.direct_copy.length}`);
    console.log(`- mapped core: ${plan.operations.mapped_core.length}`);
    console.log(`- manual review: ${plan.manual_review.length}`);
    if (plan.database?.latest_backup) {
        console.log(`- db backup: ${plan.database.latest_backup.name}`);
    }

    if (plan.warnings.length > 0) {
        console.log('\n주의');
        for (const warning of plan.warnings) {
            console.log(`- ${warning}`);
        }
    }

    if (plan.operations.direct_copy.length > 0) {
        console.log('\n직접 복원');
        for (const operation of plan.operations.direct_copy.slice(0, 20)) {
            console.log(`- ${operation.relative_target_path}`);
        }
    }

    if (plan.operations.mapped_core.length > 0) {
        console.log('\n추출된 legacy core 후보');
        for (const operation of plan.operations.mapped_core.slice(0, 20)) {
            console.log(`- ${operation.original_source_path} -> ${operation.relative_target_path}`);
        }
    }

    if (plan.manual_review.length > 0) {
        console.log('\n수동 검토');
        for (const item of plan.manual_review.slice(0, 20)) {
            console.log(`- ${item.source_path}: ${item.reason}`);
        }
    }

    if (result) {
        console.log('\n적용 결과');
        console.log(`- copied: ${result.copied.length}`);
        console.log(`- pre-restore snapshot: ${result.pre_restore_snapshot?.snapshot_dir || '(없음)'}`);
        console.log(`- db restore: ${result.database_restore ? result.database_restore.backup_dir : '(건너뜀)'}`);
        console.log(`- status: .agent/restore-status.json`);
    } else {
        console.log('\n다음 검증');
        for (const command of plan.verification_commands) {
            console.log(`- ${command}`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const dryRun = args.includes('--dry-run');
    const listSources = args.includes('--list-sources');
    const includeMappedCore = args.includes('--include-mapped-core');
    const restoreDbLatest = args.includes('--restore-db-latest');
    const noSnapshot = args.includes('--no-snapshot');
    const source = getArgValue(args, '--source', 'auto');

    const payload = planRestore({
        projectRoot: PROJECT_ROOT,
        source,
        includeMappedCore
    });

    if (listSources) {
        if (json) {
            console.log(JSON.stringify(payload.available_sources, null, 2));
            return;
        }
        printSources(payload);
        return;
    }

    if (dryRun) {
        if (json) {
            console.log(JSON.stringify(payload, null, 2));
            return;
        }
        printPlan(payload);
        return;
    }

    const result = await applyRestorePlan(payload.plan, {
        createPreRestoreSnapshot: !noSnapshot,
        restoreDbLatest
    });

    if (json) {
        console.log(JSON.stringify({ ...payload, result }, null, 2));
        return;
    }

    printPlan(payload, result);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
    main().catch((error) => {
        console.error('Agent restore failed:', error);
        process.exit(1);
    });
}
