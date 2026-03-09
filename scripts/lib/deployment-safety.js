import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export async function loadOptionalDbBackup(importer = (specifier) => import(specifier)) {
    try {
        const mod = await importer('../db-backup.js');
        return typeof mod.backup === 'function' ? mod.backup : null;
    } catch {
        return null;
    }
}

const backupLocalDb = await loadOptionalDbBackup();

const SNAPSHOT_DIR_NAME = 'protection-snapshots';
const RESTORE_STATUS_PATH = '.agent/restore-status.json';
const RESTORABLE_DIRECT_PATHS = [
    'wrangler.toml',
    'clinic.json',
    '.docking/config.yaml',
    '.agent/onboarding-state.json',
    '.agent/clinic-profile.json',
    '.agent/softgate-state.json',
    '.agent/plugin-state.json',
    'src/pages/_local',
    'src/lib/local',
    'src/plugins/local',
    'src/survey-tools/local',
    'public/local',
    'docs/internal',
    'data',
    '.wrangler/state/v3/r2'
];
const LEGACY_SCAN_ROOTS = ['src/pages', 'src/lib', 'src/components', 'src/layouts'];
const CLINIC_PACKAGE_NAMES = new Set(['clinic-os', 'clinic-os-client']);

function safeReadJson(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return fs.readJsonSync(filePath);
    } catch {
        return fallback;
    }
}

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function listFilesRecursive(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const results = [];
    const walk = (current, prefix = '') => {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full, rel);
            } else {
                results.push(rel);
            }
        }
    };
    walk(dirPath);
    return results;
}

export function parseWranglerDeploymentTarget(projectRoot) {
    const wranglerPath = path.join(projectRoot, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        return {
            exists: false,
            path: 'wrangler.toml',
            project_name: null,
            database_id: null,
            bucket_name: null,
            cloudflare_url: null
        };
    }

    const content = fs.readFileSync(wranglerPath, 'utf8');
    const match = (pattern) => content.match(pattern)?.[1] || null;

        return {
            exists: true,
            path: 'wrangler.toml',
            project_name: match(/name\s*=\s*"([^"]+)"/),
            database_name: match(/database_name\s*=\s*"([^"]+)"/),
            database_id: match(/database_id\s*=\s*"([^"]+)"/),
            bucket_name: match(/bucket_name\s*=\s*"([^"]+)"/),
            cloudflare_url: match(/CLOUDFLARE_URL\s*=\s*"([^"]+)"/)
        };
}

export function loadRecordedDeploymentTarget(projectRoot) {
    return safeReadJson(path.join(projectRoot, '.agent', 'deployment-target.json'));
}

function getPathMtime(filePath) {
    try {
        return fs.statSync(filePath).mtime.toISOString();
    } catch {
        return null;
    }
}

function normalizeRelativePath(filePath) {
    return filePath.split(path.sep).join('/');
}

function getRestorableDirectPaths(sourceRoot) {
    return RESTORABLE_DIRECT_PATHS.filter((relativePath) => fs.existsSync(path.join(sourceRoot, relativePath)));
}

function listFilesRelative(rootDir, limit = 500) {
    if (!fs.existsSync(rootDir)) return [];
    const results = [];
    const walk = (current, prefix = '') => {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= limit) return;
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, relativePath);
            } else {
                results.push(relativePath);
            }
        }
    };
    walk(rootDir);
    return results;
}

export function suggestLocalMigrationPath(filePath) {
    const normalized = normalizeRelativePath(filePath);

    if (normalized.startsWith('src/pages/admin/')) {
        return null;
    }
    if (normalized === 'src/config.ts' || normalized === 'src/styles/global.css') {
        return null;
    }
    if (normalized.startsWith('src/pages/')) {
        return normalized.replace('src/pages/', 'src/pages/_local/');
    }
    if (normalized.startsWith('src/components/')) {
        return normalized.replace('src/components/', 'src/plugins/local/components/');
    }
    if (normalized.startsWith('src/lib/')) {
        return normalized.replace('src/lib/', 'src/lib/local/');
    }
    if (normalized.startsWith('src/layouts/')) {
        return normalized.replace('src/layouts/', 'src/plugins/local/layouts/');
    }
    return null;
}

function scanLegacyMigrationCandidates(sourceRoot) {
    const mapped = [];
    const manualReview = [];

    for (const scanRoot of LEGACY_SCAN_ROOTS) {
        const absoluteRoot = path.join(sourceRoot, scanRoot);
        if (!fs.existsSync(absoluteRoot)) continue;

        const files = listFilesRelative(absoluteRoot, 1000);
        for (const relativeFile of files) {
            const sourcePath = normalizeRelativePath(path.join(scanRoot, relativeFile));
            const targetPath = suggestLocalMigrationPath(sourcePath);

            if (targetPath) {
                mapped.push({
                    source_path: sourcePath,
                    target_path: targetPath,
                    strategy: 'legacy-core-to-local',
                    confidence: sourcePath.startsWith('src/pages/') || sourcePath.startsWith('src/lib/')
                        ? 'medium'
                        : 'low'
                });
                continue;
            }

            manualReview.push({
                source_path: sourcePath,
                reason: sourcePath.startsWith('src/pages/admin/')
                    ? 'admin 페이지는 core 버전을 사용하므로 자동 이전하지 않습니다.'
                    : '안전한 local 대상 경로를 자동 추정할 수 없습니다.'
            });
        }
    }

    return {
        mapped_core_candidates: mapped,
        manual_review: manualReview
    };
}

function getLatestDbBackups(projectRoot) {
    const backupRoot = path.join(os.homedir(), '.clinic-os-backups', path.basename(projectRoot));
    if (!fs.existsSync(backupRoot)) return [];
    return fs.readdirSync(backupRoot)
        .filter((entry) => entry.startsWith('backup_'))
        .sort()
        .reverse()
        .slice(0, 3)
        .map((entry) => ({
            name: entry,
            path: path.join(backupRoot, entry),
            updated_at: getPathMtime(path.join(backupRoot, entry))
        }));
}

function summarizeSourceRoot(sourceRoot) {
    const directPaths = getRestorableDirectPaths(sourceRoot);
    const legacy = scanLegacyMigrationCandidates(sourceRoot);
    return {
        direct_paths: directPaths,
        mapped_core_candidates: legacy.mapped_core_candidates,
        manual_review: legacy.manual_review
    };
}

function calculateWorkspaceSourceScore(sourceRoot, summary) {
    let score = 35;
    score += summary.direct_paths.length * 8;
    score += Math.min(summary.mapped_core_candidates.length, 20);

    if (fs.existsSync(path.join(sourceRoot, 'wrangler.toml'))) score += 12;
    if (fs.existsSync(path.join(sourceRoot, 'clinic.json'))) score += 10;
    if (fs.existsSync(path.join(sourceRoot, '.docking'))) score += 10;
    if (fs.existsSync(path.join(sourceRoot, '.agent'))) score += 6;

    return score;
}

function readPackageMeta(sourceRoot) {
    const packageJson = safeReadJson(path.join(sourceRoot, 'package.json'), {});
    return {
        name: packageJson.name || null,
        version: packageJson.version ? `v${packageJson.version}` : null
    };
}

function isClinicWorkspace(sourceRoot) {
    if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) return false;

    const packageMeta = readPackageMeta(sourceRoot);
    const clinicMarkers = [
        fs.existsSync(path.join(sourceRoot, '.docking')),
        fs.existsSync(path.join(sourceRoot, 'clinic.json')),
        fs.existsSync(path.join(sourceRoot, '.core')),
        CLINIC_PACKAGE_NAMES.has(packageMeta.name)
    ].filter(Boolean).length;
    const structuralSignals = [
        fs.existsSync(path.join(sourceRoot, '.agent')),
        fs.existsSync(path.join(sourceRoot, 'wrangler.toml')),
        fs.existsSync(path.join(sourceRoot, 'src', 'pages')),
        fs.existsSync(path.join(sourceRoot, 'core', 'package.json'))
    ].filter(Boolean).length;

    return clinicMarkers > 0 && structuralSignals > 0;
}

function makeCandidate({
    type,
    sourceRoot,
    label,
    summary,
    score,
    metadata = {}
}) {
    return {
        id: `${type}:${normalizeRelativePath(sourceRoot)}`,
        type,
        label,
        path: sourceRoot,
        score,
        detected_at: getPathMtime(sourceRoot),
        package: readPackageMeta(sourceRoot),
        direct_paths: summary.direct_paths,
        mapped_core_candidates: summary.mapped_core_candidates,
        manual_review: summary.manual_review,
        metadata
    };
}

function discoverSiblingWorkspaceCandidates(projectRoot) {
    const parentDir = path.dirname(projectRoot);
    const projectRealPath = fs.realpathSync(projectRoot);
    if (!fs.existsSync(parentDir)) return [];

    const candidates = [];
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });

    const considerPath = (candidateRoot, relation) => {
        let realCandidatePath;
        try {
            realCandidatePath = fs.realpathSync(candidateRoot);
        } catch {
            return;
        }

        if (realCandidatePath === projectRealPath) return;
        if (!isClinicWorkspace(candidateRoot)) return;

        const summary = summarizeSourceRoot(candidateRoot);
        const score = calculateWorkspaceSourceScore(candidateRoot, summary) + (relation === 'nested-backup' ? 8 : 4);
        candidates.push(makeCandidate({
            type: 'workspace-folder',
            sourceRoot: candidateRoot,
            label: relation === 'sibling'
                ? `형제 폴더 백업 (${path.basename(candidateRoot)})`
                : `백업 폴더 내부 설치본 (${path.basename(candidateRoot)})`,
            summary,
            score,
            metadata: {
                relation,
                parent_dir: parentDir
            }
        }));
    };

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidateRoot = path.join(parentDir, entry.name);
        if (entry.name.toLowerCase().includes('backup')) {
            const nestedEntries = fs.readdirSync(candidateRoot, { withFileTypes: true });
            for (const nestedEntry of nestedEntries) {
                if (!nestedEntry.isDirectory()) continue;
                considerPath(path.join(candidateRoot, nestedEntry.name), 'nested-backup');
            }
        }

        considerPath(candidateRoot, 'sibling');
    }

    return candidates;
}

function discoverProtectionSnapshotCandidates(projectRoot) {
    const snapshotRoot = getSnapshotRoot(projectRoot);
    if (!fs.existsSync(snapshotRoot)) return [];

    return fs.readdirSync(snapshotRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(snapshotRoot, entry.name))
        .map((snapshotDir) => {
            const manifest = safeReadJson(path.join(snapshotDir, 'manifest.json'), null);
            if (!manifest) return null;

            const directPaths = (manifest.copied_paths || []).filter((relativePath) => RESTORABLE_DIRECT_PATHS.includes(relativePath));
            return {
                id: `protection-snapshot:${normalizeRelativePath(snapshotDir)}`,
                type: 'protection-snapshot',
                label: `보호 스냅샷 (${path.basename(snapshotDir)})`,
                path: snapshotDir,
                score: 110 + directPaths.length * 8,
                detected_at: manifest.created_at || getPathMtime(snapshotDir),
                package: null,
                direct_paths: directPaths,
                mapped_core_candidates: [],
                manual_review: [],
                metadata: {
                    reason: manifest.reason || null,
                    manifest
                }
            };
        })
        .filter(Boolean);
}

function discoverCoreBackupCandidates(projectRoot) {
    const backupRoot = path.join(projectRoot, '.core-backup');
    if (!fs.existsSync(backupRoot)) return [];

    return fs.readdirSync(backupRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(backupRoot, entry.name))
        .map((backupDir) => {
            const manifest = safeReadJson(path.join(backupDir, 'manifest.json'), null);
            if (!manifest) return null;

            const mapped = (manifest.files || [])
                .filter((entry) => entry.suggestedLocalPath)
                .map((entry) => ({
                    source_path: entry.path,
                    target_path: entry.suggestedLocalPath,
                    strategy: 'core-backup-manifest',
                    confidence: 'high'
                }));
            const manualReview = (manifest.files || [])
                .filter((entry) => !entry.suggestedLocalPath)
                .map((entry) => ({
                    source_path: entry.path,
                    reason: 'manifest에 suggestedLocalPath가 없어 수동 검토가 필요합니다.'
                }));

            return {
                id: `core-backup:${normalizeRelativePath(backupDir)}`,
                type: 'core-backup',
                label: `core 충돌 백업 (${path.basename(backupDir)})`,
                path: backupDir,
                score: 95 + mapped.length * 6,
                detected_at: manifest.date || getPathMtime(backupDir),
                package: null,
                direct_paths: [],
                mapped_core_candidates: mapped,
                manual_review: manualReview,
                metadata: {
                    manifest
                }
            };
        })
        .filter(Boolean);
}

function discoverWholeFolderBackupCandidates(projectRoot, backupRoot, type, labelPrefix, scoreOffset = 0) {
    if (!fs.existsSync(backupRoot)) return [];

    return fs.readdirSync(backupRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(backupRoot, entry.name))
        .map((sourceRoot) => {
            const summary = summarizeSourceRoot(sourceRoot);
            if (summary.direct_paths.length === 0 && summary.mapped_core_candidates.length === 0 && summary.manual_review.length === 0) {
                return null;
            }

            return makeCandidate({
                type,
                sourceRoot,
                label: `${labelPrefix} (${path.basename(sourceRoot)})`,
                summary,
                score: calculateWorkspaceSourceScore(sourceRoot, summary) + scoreOffset,
                metadata: {
                    source_root: backupRoot
                }
            });
        })
        .filter(Boolean);
}

function compareCandidateOrder(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.detected_at || '').localeCompare(String(a.detected_at || ''));
}

export function discoverRestoreSources(projectRoot) {
    const candidates = [
        ...discoverProtectionSnapshotCandidates(projectRoot),
        ...discoverCoreBackupCandidates(projectRoot),
        ...discoverWholeFolderBackupCandidates(
            projectRoot,
            path.join(projectRoot, 'archive', 'backups'),
            'whole-folder-backup',
            '도킹 전체 폴더 백업',
            20
        ),
        ...discoverWholeFolderBackupCandidates(
            projectRoot,
            path.join(projectRoot, '.core', 'atomic-update', 'backup'),
            'atomic-backup',
            '원자 업데이트 백업',
            18
        ),
        ...discoverSiblingWorkspaceCandidates(projectRoot)
    ].sort(compareCandidateOrder);

    return {
        generated_at: new Date().toISOString(),
        total: candidates.length,
        primary: candidates[0] || null,
        candidates,
        db_backups: getLatestDbBackups(projectRoot)
    };
}

function getDefaultDbBackupCandidate(projectRoot) {
    return getLatestDbBackups(projectRoot)[0] || null;
}

export function restoreLocalDbFromBackup(projectRoot, backupDir) {
    if (!backupDir || !fs.existsSync(backupDir)) {
        throw new Error('DB 백업 경로를 찾지 못했습니다.');
    }

    const targetDir = path.join(projectRoot, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
    fs.ensureDirSync(targetDir);

    const files = fs.readdirSync(backupDir);
    for (const file of files) {
        fs.copySync(path.join(backupDir, file), path.join(targetDir, file), { overwrite: true });
    }

    return {
        backup_dir: backupDir,
        target_dir: targetDir,
        file_count: files.length
    };
}

function resolveSourceFilePath(source, relativePath) {
    if (source.type === 'protection-snapshot') {
        return path.join(source.path, relativePath);
    }
    return path.join(source.path, relativePath);
}

function shouldApplyMappedCore(source, includeMappedCore) {
    if (source.type === 'core-backup') return true;
    return includeMappedCore;
}

export function buildRestorePlan({ projectRoot, source, includeMappedCore = false } = {}) {
    if (!source) {
        throw new Error('복원 소스를 찾지 못했습니다.');
    }

    const directCopies = source.direct_paths.map((relativePath) => ({
        kind: 'direct-copy',
        source_path: resolveSourceFilePath(source, relativePath),
        target_path: path.join(projectRoot, relativePath),
        relative_target_path: relativePath
    }));

    const mappedCopies = shouldApplyMappedCore(source, includeMappedCore)
        ? source.mapped_core_candidates.map((entry) => ({
            kind: 'mapped-core',
            source_path: resolveSourceFilePath(source, entry.source_path),
            target_path: path.join(projectRoot, entry.target_path),
            relative_target_path: entry.target_path,
            original_source_path: entry.source_path,
            confidence: entry.confidence || 'medium'
        }))
        : [];

    const warnings = [];
    if (!shouldApplyMappedCore(source, includeMappedCore) && source.mapped_core_candidates.length > 0) {
        warnings.push('legacy core 수정 후보는 기본으로 적용하지 않습니다. 필요하면 --include-mapped-core를 사용하세요.');
    }
    if (source.type === 'workspace-folder' || source.type === 'whole-folder-backup' || source.type === 'atomic-backup') {
        warnings.push('전체 폴더 백업에서는 local/custom/config 경로만 직접 복원하고, 나머지 코어 수정은 추출 후보로만 다룹니다.');
    }

    const dbBackup = getDefaultDbBackupCandidate(projectRoot);
    if (dbBackup) {
        warnings.push('DB 데이터는 자동으로 덮어쓰지 않습니다. 필요하면 --restore-db-latest로 최신 로컬 백업을 복원하세요.');
    }

    return {
        version: 1,
        created_at: new Date().toISOString(),
        project_root: projectRoot,
        source: {
            id: source.id,
            type: source.type,
            label: source.label,
            path: source.path,
            detected_at: source.detected_at,
            package: source.package
        },
        operations: {
            direct_copy: directCopies,
            mapped_core: mappedCopies
        },
        manual_review: source.manual_review,
        warnings,
        database: {
            latest_backup: dbBackup,
            restore_supported: !!dbBackup
        },
        verification_commands: [
            'npm run agent:context',
            'npm run health',
            'npm run db:migrate',
            'npm run build'
        ]
    };
}

function copyFileOrDir(src, dest) {
    fs.ensureDirSync(path.dirname(dest));
    fs.copySync(src, dest, { overwrite: true });
}

export async function applyRestorePlan(plan, { createPreRestoreSnapshot = true, restoreDbLatest = false } = {}) {
    const projectRoot = plan.project_root;
    const status = {
        version: 1,
        applied_at: new Date().toISOString(),
        project_root: projectRoot,
        source: plan.source,
        pre_restore_snapshot: null,
        copied: [],
        database_restore: null,
        manual_review: plan.manual_review,
        warnings: plan.warnings,
        verification_commands: plan.verification_commands
    };

    if (createPreRestoreSnapshot) {
        status.pre_restore_snapshot = await createProtectionSnapshot({
            projectRoot,
            reason: 'pre-restore',
            includeDbBackup: true
        });
    }

    const operations = [...plan.operations.direct_copy, ...plan.operations.mapped_core];
    for (const operation of operations) {
        if (!fs.existsSync(operation.source_path)) continue;
        copyFileOrDir(operation.source_path, operation.target_path);
        status.copied.push({
            kind: operation.kind,
            from: operation.source_path,
            to: operation.target_path
        });
    }

    if (restoreDbLatest && plan.database?.latest_backup?.path) {
        status.database_restore = restoreLocalDbFromBackup(projectRoot, plan.database.latest_backup.path);
    }

    const outputPath = path.join(projectRoot, RESTORE_STATUS_PATH);
    fs.ensureDirSync(path.dirname(outputPath));
    fs.writeJsonSync(outputPath, status, { spaces: 2 });
    return status;
}

export function loadRestoreStatus(projectRoot) {
    return safeReadJson(path.join(projectRoot, RESTORE_STATUS_PATH));
}

export function detectTargetDrift(currentTarget, recordedTarget) {
    if (!currentTarget?.exists || !recordedTarget?.target) {
        return { has_drift: false, changed_fields: [], risky_fields: [] };
    }

    const fields = ['project_name', 'database_id', 'bucket_name', 'cloudflare_url'];
    const riskyFields = ['project_name', 'database_id', 'bucket_name'];
    const changedFields = fields.filter((field) => {
        const currentValue = currentTarget[field] || null;
        const recordedValue = recordedTarget.target[field] || null;
        return currentValue !== recordedValue;
    });

    return {
        has_drift: changedFields.length > 0,
        changed_fields: changedFields,
        risky_fields: changedFields.filter((field) => riskyFields.includes(field))
    };
}

export function collectLocalCustomizationSummary(projectRoot) {
    const trackedPaths = [
        'src/pages/_local',
        'src/lib/local',
        'src/plugins/local',
        'src/survey-tools/local',
        'public/local',
        'docs/internal'
    ];

    const paths = trackedPaths.map((relativePath) => {
        const absolutePath = path.join(projectRoot, relativePath);
        const files = listFilesRecursive(absolutePath);
        return {
            path: relativePath,
            exists: fs.existsSync(absolutePath),
            file_count: files.length,
            files: files.slice(0, 50)
        };
    });

    const totalFiles = paths.reduce((sum, entry) => sum + entry.file_count, 0);
    const operationalFiles = paths
        .filter((entry) => entry.path !== 'docs/internal')
        .reduce((sum, entry) => sum + entry.file_count, 0);
    const hasWranglerState = fs.existsSync(path.join(projectRoot, '.wrangler', 'state'));

    return {
        total_files: totalFiles,
        operational_files: operationalFiles,
        has_local_work: operationalFiles > 0,
        has_wrangler_state: hasWranglerState,
        paths
    };
}

function copyIntoSnapshot(projectRoot, snapshotDir, relativePath, manifest) {
    const src = path.join(projectRoot, relativePath);
    const dest = path.join(snapshotDir, relativePath);
    if (!fs.existsSync(src)) {
        manifest.missing_paths.push(relativePath);
        return;
    }

    fs.ensureDirSync(path.dirname(dest));
    fs.copySync(src, dest);
    manifest.copied_paths.push(relativePath);
}

export async function createProtectionSnapshot({ projectRoot, reason = 'manual', includeDbBackup = true } = {}) {
    const timestamp = formatTimestamp();
    const snapshotRoot = path.join(projectRoot, '.agent', SNAPSHOT_DIR_NAME);
    const snapshotDir = path.join(snapshotRoot, `${reason}-${timestamp}`);

    fs.ensureDirSync(snapshotDir);

    const manifest = {
        version: 1,
        reason,
        created_at: new Date().toISOString(),
        snapshot_dir: snapshotDir,
        copied_paths: [],
        missing_paths: [],
        deployment_target: parseWranglerDeploymentTarget(projectRoot),
        local_summary: collectLocalCustomizationSummary(projectRoot),
        db_backup_created: false
    };

    const snapshotPaths = [
        'wrangler.toml',
        'clinic.json',
        '.docking/config.yaml',
        '.agent/onboarding-state.json',
        '.agent/clinic-profile.json',
        '.agent/softgate-state.json',
        '.agent/plugin-state.json',
        '.agent/runtime-context.json',
        '.agent/support-status.json',
        '.agent/lifecycle-status.json',
        'src/pages/_local',
        'src/lib/local',
        'src/plugins/local',
        'src/survey-tools/local',
        'public/local',
        'docs/internal',
        'data',
        '.wrangler/state/v3/r2'
    ];

    for (const relativePath of snapshotPaths) {
        copyIntoSnapshot(projectRoot, snapshotDir, relativePath, manifest);
    }

    if (includeDbBackup) {
        try {
            manifest.db_backup_created = !!backupLocalDb({ force: true, silent: true });
        } catch (error) {
            manifest.db_backup_error = error.message;
        }
    }

    fs.writeJsonSync(path.join(snapshotDir, 'manifest.json'), manifest, { spaces: 2 });
    return manifest;
}

export function recordDeploymentTarget(projectRoot, target, metadata = {}) {
    const outputPath = path.join(projectRoot, '.agent', 'deployment-target.json');
    fs.ensureDirSync(path.dirname(outputPath));
    const payload = {
        version: 1,
        recorded_at: new Date().toISOString(),
        target,
        metadata
    };
    fs.writeJsonSync(outputPath, payload, { spaces: 2 });
    return payload;
}

export function getSnapshotRoot(projectRoot) {
    return path.join(projectRoot, '.agent', SNAPSHOT_DIR_NAME);
}
