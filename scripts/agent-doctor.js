#!/usr/bin/env node

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import { runHealthAudit } from './health-audit.js';
import { analyzeLifecycle } from './agent-lifecycle.js';
import { reportErrorStatus } from './lib/error-recovery.mjs';
import { summarizeIssueReporting } from './lib/issue-reporting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '.agent', 'support-status.json');
const HQ_URL = 'https://clinic-os-hq.pages.dev';
const CONTEXT_REFRESH_COMMAND = 'node scripts/generate-agent-context.js --quiet';

function safeReadJson(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return fs.readJsonSync(filePath);
    } catch {
        return fallback;
    }
}

function safeReadText(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch {
        return fallback;
    }
}

function parseSemver(ver) {
    const cleaned = String(ver || '').replace(/^v/, '');
    const [major = 0, minor = 0, patch = 0] = cleaned.split('.').map((part) => Number(part) || 0);
    return { major, minor, patch };
}

function compareSemver(a, b) {
    const av = parseSemver(a);
    const bv = parseSemver(b);
    if (av.major !== bv.major) return av.major - bv.major;
    if (av.minor !== bv.minor) return av.minor - bv.minor;
    return av.patch - bv.patch;
}

function timeoutSignal(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timer)
    };
}

async function fetchChannelVersion(channel) {
    const { signal, clear } = timeoutSignal(10000);
    try {
        const response = await fetch(`${HQ_URL}/api/v1/update/channel-version?channel=${channel}`, { signal });
        if (!response.ok) return null;
        const data = await response.json();
        return data.version ? `v${data.version}` : null;
    } catch {
        return null;
    } finally {
        clear();
    }
}

function detectAppRoot() {
    const starterAppRoot = path.join(PROJECT_ROOT, 'core');
    if (fs.existsSync(path.join(starterAppRoot, 'package.json'))) {
        return starterAppRoot;
    }
    return PROJECT_ROOT;
}

function summarizeSetup(progress) {
    if (!progress?.steps || !Array.isArray(progress.steps)) {
        return { exists: false, done: 0, total: 0, pending: 0 };
    }

    return {
        exists: true,
        done: progress.steps.filter((step) => step.status === 'done').length,
        total: progress.steps.length,
        pending: progress.steps.filter((step) => step.status === 'pending').length,
        in_progress: progress.steps.find((step) => step.status === 'in_progress')?.id || null
    };
}

function getPreferredChannel() {
    const clinicJson = safeReadJson(path.join(PROJECT_ROOT, 'clinic.json'), {});
    if (clinicJson?.channel === 'beta') return 'beta';

    const dockingConfigPath = path.join(PROJECT_ROOT, '.docking', 'config.yaml');
    if (fs.existsSync(dockingConfigPath)) {
        try {
            const config = yaml.load(fs.readFileSync(dockingConfigPath, 'utf8'));
            if (config?.channel === 'beta') return 'beta';
        } catch {
            // ignore
        }
    }

    return 'stable';
}

function getInstallState() {
    const setup = summarizeSetup(safeReadJson(path.join(PROJECT_ROOT, '.agent', 'setup-progress.json')));
    const runtimeContext = safeReadJson(path.join(PROJECT_ROOT, '.agent', 'runtime-context.json'));
    return { setup, runtimeContext };
}

export function getSystemProfile() {
    const totalMemoryGb = os.totalmem() / 1024 / 1024 / 1024;
    const platform = os.platform();
    const installPlatformSupported = platform !== 'win32';

    return {
        platform,
        total_memory_gb: Number(totalMemoryGb.toFixed(1)),
        is_windows: platform === 'win32',
        supports_fast_setup: installPlatformSupported && totalMemoryGb >= 8,
        install_platform_supported: installPlatformSupported,
        install_platform_note: installPlatformSupported
            ? '공식 설치 기준: macOS 또는 WSL Ubuntu'
            : '네이티브 Windows 설치는 지원하지 않습니다. WSL Ubuntu로 이동하세요.'
    };
}

function analyzeFastSetupCandidate({ projectRoot, installState, rootPkg }) {
    const clinicJson = safeReadJson(path.join(projectRoot, 'clinic.json'), {});
    const systemProfile = getSystemProfile();
    const hasDockingConfig = fs.existsSync(path.join(projectRoot, '.docking', 'config.yaml'));
    const hasWranglerState = fs.existsSync(path.join(projectRoot, '.wrangler', 'state'));
    const hasSignedLicense = Boolean(clinicJson?.license_key);
    const isStarterClient = rootPkg?.name === 'clinic-os-client'
        || installState.runtimeContext?.repo?.is_starter_kit === true;
    const hasSetupProgress = installState.setup.exists;

    const eligible = systemProfile.supports_fast_setup
        && isStarterClient
        && hasSignedLicense
        && !hasDockingConfig
        && !hasWranglerState
        && !hasSetupProgress;

    let reason = '기본은 단계별 setup이 권장됩니다.';
    if (eligible) {
        reason = '고성능 신규 스타터 설치본으로 판단되어 fast setup 후보입니다.';
    } else if (!systemProfile.install_platform_supported) {
        reason = '네이티브 Windows 설치는 지원하지 않습니다. WSL Ubuntu에서 다시 진행해야 합니다.';
    } else if (!systemProfile.supports_fast_setup) {
        reason = '고성능 macOS/WSL Ubuntu 환경이 아니거나 메모리가 부족해 fast setup을 권장하지 않습니다.';
    } else if (!isStarterClient) {
        reason = '스타터킷 클라이언트 설치본이 아니라서 fast setup 대상이 아닙니다.';
    } else if (!hasSignedLicense) {
        reason = 'signed clinic.json의 license_key가 없어 fast setup 자동 조건을 충족하지 않습니다.';
    } else if (hasDockingConfig || hasWranglerState || hasSetupProgress) {
        reason = '기존 로컬 상태가 감지되어 fast setup보다 단계별 setup이 안전합니다.';
    }

    return {
        recommended: systemProfile.supports_fast_setup,
        eligible,
        reason,
        command: 'npm run setup:agent -- --prefer-fast',
        direct_command: 'npm run setup:fast',
        system_profile: systemProfile,
        signals: {
            is_starter_client: isStarterClient,
            has_signed_license: hasSignedLicense,
            has_docking_config: hasDockingConfig,
            has_wrangler_state: hasWranglerState,
            has_setup_progress: hasSetupProgress
        }
    };
}

function getCheck(health, name) {
    return health?.checks?.[name] || { ok: true, issues: [] };
}

function getStarterUpdateCommands(projectRoot, preferredChannel) {
    const rootPkg = safeReadJson(path.join(projectRoot, 'package.json'), {});
    const updateStarterScript = rootPkg?.scripts?.['update:starter'] || '';
    const starterUpdateCommand = updateStarterScript.includes('node scripts/update-starter.js')
        ? 'npm run update:starter'
        : 'node scripts/update-starter.js';
    const starterCoreSyncCommand = fs.existsSync(path.join(projectRoot, 'scripts', 'update-starter-core.js'))
        ? `node scripts/update-starter-core.js --${preferredChannel}`
        : `${starterUpdateCommand} && node .docking/engine/fetch.js --${preferredChannel} --auto`;

    return { starterUpdateCommand, starterCoreSyncCommand };
}

export function buildActions({ installState, health, errorStatus, versions, lifecycle, issueReporting, fastSetup }) {
    const actions = [];
    const setupPending = installState.setup.exists && installState.setup.pending > 0;
    const preferredChannel = versions.preferred_channel;
    const targetVersion = versions[`hq_${preferredChannel}`];
    const systemProfile = fastSetup?.system_profile || getSystemProfile();
    const starterCompatibility = getCheck(health, 'starter_compatibility');
    const nodeModules = getCheck(health, 'node_modules');
    const versionConsistency = getCheck(health, 'version_consistency');
    const schemaHealth = getCheck(health, 'schema_health');
    const migrationState = getCheck(health, 'migration_state');
    const { starterUpdateCommand, starterCoreSyncCommand } = getStarterUpdateCommands(PROJECT_ROOT, preferredChannel);

    if (!systemProfile.install_platform_supported) {
        actions.push({
            id: 'move_to_supported_platform',
            priority: 120,
            severity: 'high',
            title: '지원되는 설치 환경으로 이동',
            reason: '네이티브 Windows 설치는 지원하지 않습니다. macOS 또는 WSL Ubuntu에서 다시 진행해야 합니다.',
            command: null,
            autoRunnable: false
        });
    }

    if (lifecycle?.scenario === 'legacy_reinstall_migration') {
        actions.push({
            id: 'prepare_legacy_migration',
            priority: 110,
            severity: 'high',
            title: '구형 설치본 신규 설치 + 마이그레이션 권장',
            reason: lifecycle.reasons.join(' / ') || '구형 설치본은 인플레이스 업데이트보다 신규 설치 후 이관이 안전합니다.',
            command: 'npm run agent:snapshot -- --reason=legacy-migration',
            autoRunnable: false
        });

        if (lifecycle?.restore_sources?.total > 0) {
            actions.push({
                id: 'preview_restore_plan',
                priority: 108,
                severity: 'high',
                title: '자동 백업 기반 복원 계획 미리보기',
                reason: `복원 소스 ${lifecycle.restore_sources.total}개를 감지했습니다.${lifecycle.restore_sources.primary ? ` 최상위 후보: ${lifecycle.restore_sources.primary.label}` : ''}`,
                command: 'npm run agent:restore -- --dry-run --json',
                autoRunnable: false
            });
        }
    }

    if (lifecycle?.scenario === 'production_binding_drift') {
        actions.push({
            id: 'review_target_drift',
            priority: 105,
            severity: 'high',
            title: '배포 대상 연결 변경 감지',
            reason: lifecycle.reasons.join(' / '),
            command: 'npm run agent:lifecycle -- --json',
            autoRunnable: false
        });
    }

    if (!installState.runtimeContext) {
        actions.push({
            id: 'refresh_context',
            priority: 100,
            severity: 'high',
            title: '에이전트 runtime context 생성',
            reason: '로컬 설치본의 app root, local override, 보호 경로를 먼저 파악해야 합니다.',
            command: 'npm run agent:context',
            autoRunnable: true
        });
    }

    if (errorStatus?.hasError) {
        actions.push({
            id: 'recover_last_error',
            priority: 95,
            severity: errorStatus.autoRecoverable ? 'high' : 'medium',
            title: '최근 에러 복구',
            reason: `${errorStatus.phase} 단계 에러가 남아 있습니다.`,
            command: 'npm run error:recover',
            autoRunnable: !!errorStatus.autoRecoverable
        });
    }

    if (
        issueReporting?.available
        && issueReporting.eligible
        && issueReporting.license_present
        && !issueReporting.already_reported_same_event
    ) {
        actions.push({
            id: 'report_recurring_issue',
            priority: errorStatus?.hasError ? 82 : 68,
            severity: issueReporting.severity === 'critical' ? 'high' : 'medium',
            title: '반복 오류를 HQ 지원 채널에 보고',
            reason: issueReporting.reason,
            command: 'npm run agent:report-issue -- --auto --json',
            autoRunnable: false
        });
    }

    if (setupPending) {
        actions.push({
            id: 'continue_setup',
            priority: 90,
            severity: 'high',
            title: '설치 단계 계속 진행',
            reason: `설치가 ${installState.setup.done}/${installState.setup.total} 단계에서 멈춰 있습니다.`,
            command: 'npm run setup:step -- --next',
            autoRunnable: false
        });
    }

    if (fastSetup?.eligible) {
        actions.push({
            id: 'prefer_fast_setup',
            priority: 88,
            severity: 'medium',
            title: '고성능 빠른 설치 후보',
            reason: fastSetup.reason,
            command: fastSetup.command,
            autoRunnable: false
        });
    }

    if (!starterCompatibility.ok) {
        actions.push({
            id: 'update_starter',
            priority: 85,
            severity: 'high',
            title: '스타터 인프라 업데이트',
            reason: starterCompatibility.issues.join(' / ') || '스타터 버전이 요구사항보다 낮습니다.',
            command: starterUpdateCommand,
            autoRunnable: true
        });
    }

    if (!nodeModules.ok) {
        actions.push({
            id: 'install_dependencies',
            priority: 75,
            severity: 'medium',
            title: '의존성 재설치/동기화',
            reason: nodeModules.issues.join(' / ') || 'node_modules 상태가 오래되었습니다.',
            command: 'npm install',
            autoRunnable: true
        });
    }

    if (!schemaHealth.ok || !migrationState.ok) {
        const healthReasons = [
            ...(schemaHealth.issues || []),
            ...(migrationState.issues || []),
        ].filter(Boolean);

        actions.push({
            id: 'repair_local_database',
            priority: setupPending ? 35 : 78,
            severity: health.score < 50 ? 'high' : 'medium',
            title: '로컬 DB 스키마/마이그레이션 복구',
            reason: healthReasons.join(' / ') || '로컬 DB 상태가 설치 기준을 만족하지 않습니다.',
            command: 'npm run health:fix',
            autoRunnable: true
        });
    }

    if (
        lifecycle?.scenario !== 'legacy_reinstall_migration' &&
        targetVersion &&
        (!versions.core_version || compareSemver(versions.core_version, targetVersion) < 0)
    ) {
        actions.push({
            id: 'update_core',
            priority: setupPending ? 40 : 80,
            severity: setupPending ? 'low' : 'high',
            title: starterCompatibility.ok ? '코어 업데이트' : '스타터 + 코어 동기화',
            reason: versions.core_version
                ? `설치된 코어 ${versions.core_version}가 ${preferredChannel} 채널 ${targetVersion}보다 낮습니다.`
                : '설치된 코어 버전을 찾지 못했습니다.',
            command: starterCompatibility.ok
                ? `npm run core:pull -- --auto --${preferredChannel}`
                : starterCoreSyncCommand,
            autoRunnable: !setupPending
        });
    }

    if (!versionConsistency.ok && !actions.some((action) => action.id === 'update_core')) {
        actions.push({
            id: 'reconcile_versions',
            priority: 70,
            severity: 'medium',
            title: '버전 불일치 점검',
            reason: versionConsistency.issues.join(' / '),
            command: 'npm run health:fix',
            autoRunnable: true
        });
    }

    if (actions.length === 0) {
        actions.push({
            id: 'healthy',
            priority: 0,
            severity: 'info',
            title: '즉시 조치 불필요',
            reason: '현재 감지된 블로커가 없습니다.',
            command: null,
            autoRunnable: false
        });
    }

    return actions
        .sort((a, b) => b.priority - a.priority)
        .map((action) => ({
            ...action,
            agent_mode: action.autoRunnable ? 'run' : 'propose'
        }));
}

async function runCommand(command, quiet = false) {
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];

    return await new Promise((resolve) => {
        const proc = spawn(shell, args, {
            cwd: PROJECT_ROOT,
            stdio: quiet ? 'ignore' : 'inherit'
        });

        proc.on('close', (code) => resolve({ success: code === 0, code }));
        proc.on('error', () => resolve({ success: false, code: 1 }));
    });
}

async function refreshRuntimeContext() {
    await runCommand(CONTEXT_REFRESH_COMMAND, true);
}

function persistStatus(status) {
    fs.ensureDirSync(path.dirname(OUTPUT_PATH));
    fs.writeJsonSync(OUTPUT_PATH, status, { spaces: 2 });
}

async function gatherStatus() {
    await refreshRuntimeContext();

    const appRoot = detectAppRoot();
    const rootPkg = safeReadJson(path.join(PROJECT_ROOT, 'package.json'), {});
    const appPkg = safeReadJson(path.join(appRoot, 'package.json'), {});
    const health = await runHealthAudit({ quiet: true, fix: false });
    const errorStatus = await reportErrorStatus();
    const installState = getInstallState();
    const preferredChannel = getPreferredChannel();
    const { starterUpdateCommand, starterCoreSyncCommand } = getStarterUpdateCommands(PROJECT_ROOT, preferredChannel);
    const fastSetup = analyzeFastSetupCandidate({ projectRoot: PROJECT_ROOT, installState, rootPkg });

    const [hqStable, hqBeta] = await Promise.all([
        fetchChannelVersion('stable'),
        fetchChannelVersion('beta')
    ]);

    const versions = {
        preferred_channel: preferredChannel,
        root_package_version: rootPkg.version ? `v${rootPkg.version}` : null,
        app_package_version: appPkg.version ? `v${appPkg.version}` : null,
        core_version: safeReadText(path.join(PROJECT_ROOT, '.core', 'version')),
        starter_version: safeReadText(path.join(PROJECT_ROOT, '.core', 'starter-version')),
        hq_stable: hqStable,
        hq_beta: hqBeta
    };

    const lifecycle = await analyzeLifecycle({
        projectRoot: PROJECT_ROOT,
        versions,
        runtimeContext: installState.runtimeContext
    });
    const issueReporting = summarizeIssueReporting(PROJECT_ROOT, {
        supportStatus: {
            versions,
            health: {
                score: health.score,
                issues: health.issues,
                checks: health.checks
            },
            lifecycle,
            error: errorStatus,
            install: installState.setup,
        },
        runtimeContext: installState.runtimeContext,
    });
    const actions = buildActions({ installState, health, errorStatus, versions, lifecycle, issueReporting, fastSetup });

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        project_root: PROJECT_ROOT,
        app_root: appRoot,
        versions,
        health: {
            score: health.score,
            issues: health.issues,
            checks: health.checks
        },
        lifecycle,
        setup_recommendation: {
            fast_setup: fastSetup
        },
        error: errorStatus,
        issue_reporting: issueReporting,
        install: installState.setup,
        actions,
        safe_commands: {
            setup_fast: 'npm run setup:fast',
            setup_agent_prefer_fast: 'npm run setup:agent -- --prefer-fast',
            setup_step_status: 'npm run setup:step -- --status',
            setup_step_next: 'npm run setup:step -- --next',
            refresh_context: 'npm run agent:context',
            lifecycle: 'npm run agent:lifecycle -- --json',
            snapshot: 'npm run agent:snapshot -- --reason=manual',
            restore_preview: 'npm run agent:restore -- --dry-run --json',
            report_issue_preview: 'npm run agent:report-issue -- --dry-run --json',
            report_issue: 'npm run agent:report-issue -- --auto --json',
            status: 'npm run status',
            health: 'npm run health',
            recover_error: 'npm run error:recover',
            update_starter: starterUpdateCommand,
            update_starter_core_stable: starterCoreSyncCommand.replace(`--${preferredChannel}`, '--stable'),
            update_starter_core_beta: starterCoreSyncCommand.replace(`--${preferredChannel}`, '--beta'),
            update_core_stable: 'npm run core:pull -- --auto --stable',
            update_core_beta: 'npm run core:pull -- --auto --beta'
        }
    };
}

async function runSync(status, dryRun = false) {
    const results = [];
    const runnable = status.actions.filter((action) => action.autoRunnable && action.command);

    for (const action of runnable) {
        if (dryRun) {
            results.push({ id: action.id, command: action.command, success: true, dryRun: true });
            continue;
        }

        console.log(`\n▶ ${action.title}`);
        console.log(`   이유: ${action.reason}`);
        console.log(`   실행: ${action.command}`);

        const result = await runCommand(action.command, false);
        results.push({ id: action.id, command: action.command, success: result.success, code: result.code });

        if (!result.success) {
            console.log(`   ⚠️  ${action.id} 실패 — 후속 자동 실행을 중단합니다.`);
            break;
        }
    }

    await refreshRuntimeContext();
    return results;
}

function printHuman(status, syncResults = null) {
    console.log('\n🩺 Clinic-OS Agent Doctor\n');
    console.log(`- preferred channel: ${status.versions.preferred_channel}`);
    console.log(`- starter: ${status.versions.starter_version || '(없음)'}`);
    console.log(`- core: ${status.versions.core_version || '(없음)'}`);
    console.log(`- HQ stable: ${status.versions.hq_stable || '(조회 실패)'}`);
    console.log(`- HQ beta: ${status.versions.hq_beta || '(조회 실패)'}`);
    console.log(`- health: ${status.health.score}/100`);
    if (status.lifecycle?.scenario) {
        console.log(`- lifecycle: ${status.lifecycle.scenario} (${status.lifecycle.strategy})`);
    }
    if (status.setup_recommendation?.fast_setup) {
        const fast = status.setup_recommendation.fast_setup;
        const badge = fast.eligible ? '추천' : (fast.recommended ? '가능' : '비권장');
        console.log(`- fast setup: ${badge} (${fast.system_profile.platform}, ${fast.system_profile.total_memory_gb}GB)`);
    }

    if (status.error?.hasError) {
        console.log(`- last error: ${status.error.phase} (${status.error.error})`);
    }

    if (status.issue_reporting?.available) {
        const endpointBadge = status.issue_reporting.support_url_meta?.official ? ', official endpoint' : '';
        console.log(`- issue reporting: ${status.issue_reporting.occurrence_count}회 (${status.issue_reporting.severity}${endpointBadge})`);
    } else if (status.issue_reporting?.support_url_meta?.official) {
        console.log(`- support endpoint: official (${status.issue_reporting.support_url_meta.host})`);
    }

    if (status.install.exists) {
        console.log(`- setup: ${status.install.done}/${status.install.total} 완료`);
    }

    if (status.setup_recommendation?.fast_setup?.reason) {
        console.log(`- setup hint: ${status.setup_recommendation.fast_setup.reason}`);
    }

    console.log('\n권장 조치');
    for (const action of status.actions) {
        console.log(`- [${action.severity}/${action.agent_mode}] ${action.title}`);
        console.log(`  이유: ${action.reason}`);
        if (action.command) {
            console.log(`  명령: ${action.command}`);
        }
    }

    if (syncResults) {
        console.log('\n실행 결과');
        for (const result of syncResults) {
            const label = result.success ? '✅' : '❌';
            const suffix = result.dryRun ? ' (dry-run)' : '';
            console.log(`- ${label} ${result.id}: ${result.command}${suffix}`);
        }
    }
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const json = args.has('--json');
    const sync = args.has('--sync');
    const dryRun = args.has('--dry-run');

    let status = await gatherStatus();

    let syncResults = null;
    if (sync) {
        syncResults = await runSync(status, dryRun);
        status = {
            ...(await gatherStatus()),
            sync_results: syncResults
        };
    }

    persistStatus(status);

    if (json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }

    printHuman(status, syncResults);
}

main().catch((error) => {
    console.error('Agent doctor failed:', error);
    process.exit(1);
});
