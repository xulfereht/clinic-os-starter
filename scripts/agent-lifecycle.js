#!/usr/bin/env node

import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    collectLocalCustomizationSummary,
    discoverRestoreSources,
    detectTargetDrift,
    loadRecordedDeploymentTarget,
    parseWranglerDeploymentTarget
} from './lib/deployment-safety.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, '.agent', 'lifecycle-status.json');

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

function getVersionLag(currentVersion, targetVersion) {
    const current = parseSemver(currentVersion);
    const target = parseSemver(targetVersion);
    return {
        major: Math.max(0, target.major - current.major),
        minor: target.major > current.major ? target.minor : Math.max(0, target.minor - current.minor),
        patch: target.major > current.major || target.minor > current.minor
            ? target.patch
            : Math.max(0, target.patch - current.patch)
    };
}

function summarizeSetup(progress) {
    if (!progress?.steps || !Array.isArray(progress.steps)) {
        return { exists: false, done: 0, total: 0, pending: 0 };
    }

    return {
        exists: true,
        done: progress.steps.filter((step) => step.status === 'done').length,
        total: progress.steps.length,
        pending: progress.steps.filter((step) => step.status === 'pending').length
    };
}

function detectAppRoot(projectRoot) {
    const starterAppRoot = path.join(projectRoot, 'core');
    if (fs.existsSync(path.join(starterAppRoot, 'package.json'))) {
        return 'core';
    }
    return '.';
}

function getPreferredChannel(projectRoot) {
    const clinicJson = safeReadJson(path.join(projectRoot, 'clinic.json'), {});
    if (clinicJson?.channel === 'beta') return 'beta';

    const dockingConfigPath = path.join(projectRoot, '.docking', 'config.yaml');
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

export async function analyzeLifecycle(options = {}) {
    const projectRoot = options.projectRoot || PROJECT_ROOT;
    const rootPkg = safeReadJson(path.join(projectRoot, 'package.json'), {});
    const runtimeContext = options.runtimeContext || safeReadJson(path.join(projectRoot, '.agent', 'runtime-context.json'));
    const onboardingState = safeReadJson(path.join(projectRoot, '.agent', 'onboarding-state.json'), {});
    const clinicProfile = safeReadJson(path.join(projectRoot, '.agent', 'clinic-profile.json'), {});
    const setup = summarizeSetup(safeReadJson(path.join(projectRoot, '.agent', 'setup-progress.json')));
    const localSummary = collectLocalCustomizationSummary(projectRoot);
    const restoreSources = discoverRestoreSources(projectRoot);
    const currentTarget = parseWranglerDeploymentTarget(projectRoot);
    const recordedTarget = loadRecordedDeploymentTarget(projectRoot);
    const targetDrift = detectTargetDrift(currentTarget, recordedTarget);

    const versions = options.versions || {
        root_package_version: rootPkg.version ? `v${rootPkg.version}` : null,
        core_version: safeReadText(path.join(projectRoot, '.core', 'version')),
        starter_version: safeReadText(path.join(projectRoot, '.core', 'starter-version')),
        hq_stable: null
    };
    const preferredChannel = versions.preferred_channel || getPreferredChannel(projectRoot);
    const starterCoreSyncCommand = fs.existsSync(path.join(projectRoot, 'scripts', 'update-starter-core.js'))
        ? `node scripts/update-starter-core.js --${preferredChannel}`
        : `npm run update:starter && npm run core:pull -- --auto --${preferredChannel}`;

    const versionTarget = versions.hq_stable || versions.root_package_version;
    const versionLag = getVersionLag(versions.core_version || versions.root_package_version, versionTarget);

    const deploymentCount = Number(onboardingState?.deployment_count || 0);
    const hasExistingSite = !!clinicProfile?.migration?.has_existing_site;
    const hasAgentEraFiles = [
        '.agent/manifests/change-strategy.json',
        '.agent/manifests/admin-public-bindings.json',
        '.agent/manifests/command-safety.json'
    ].every((relativePath) => fs.existsSync(path.join(projectRoot, relativePath)));

    const hasLegacySignals = [
        !versions.starter_version,
        !runtimeContext,
        !hasAgentEraFiles,
        versionLag.major > 0 || versionLag.minor >= 3
    ];

    const activeClinic = deploymentCount > 0 || localSummary.has_local_work || localSummary.has_wrangler_state || hasExistingSite;

    let scenario = 'operational_guarded';
    let strategy = 'continue_onboarding';
    const reasons = [];

    if (!setup.exists && !currentTarget.exists && !activeClinic) {
        scenario = 'fresh_install';
        strategy = 'new_install';
        reasons.push('설치 상태 파일, wrangler 설정, 기존 운영 신호가 없습니다.');
    } else if (setup.exists && setup.pending > 0) {
        scenario = 'resume_setup';
        strategy = 'resume_setup';
        reasons.push(`setup이 ${setup.done}/${setup.total} 단계에서 멈춰 있습니다.`);
    } else if (targetDrift.risky_fields.length > 0 && (deploymentCount > 0 || !!recordedTarget)) {
        scenario = 'production_binding_drift';
        strategy = 'block_and_review';
        reasons.push(`기존 배포 대상과 핵심 연결이 달라졌습니다: ${targetDrift.risky_fields.join(', ')}`);
    } else if (activeClinic && hasLegacySignals.some(Boolean)) {
        scenario = 'legacy_reinstall_migration';
        strategy = 'fresh_reinstall_migrate';
        if (!versions.starter_version) reasons.push('starter-version이 없어 구형 스타터일 가능성이 높습니다.');
        if (!runtimeContext) reasons.push('runtime-context가 없어 에이전트 지원 레이어가 비어 있습니다.');
        if (!hasAgentEraFiles) reasons.push('최신 agent manifests가 없는 구버전 설치본입니다.');
        if (versionLag.major > 0 || versionLag.minor >= 3) {
            reasons.push(`현재 코어가 최신 기준으로 ${versionLag.major} major / ${versionLag.minor} minor 이상 뒤처져 있습니다.`);
        }
        if (restoreSources.total > 0 && restoreSources.primary) {
            reasons.push(`복원 소스 ${restoreSources.total}개를 감지했습니다. 최상위 후보: ${restoreSources.primary.label}`);
        }
    } else if ((versionLag.major > 0 || versionLag.minor > 0 || versionLag.patch > 0) && activeClinic) {
        scenario = 'safe_update_in_place';
        strategy = 'update_in_place_with_snapshot';
        reasons.push('현행 설치본이 최신 코어보다 뒤처져 있지만 인플레이스 업데이트가 가능한 범위입니다.');
    } else if (deploymentCount > 0) {
        scenario = 'operational_guarded';
        strategy = 'protect_before_deploy';
        reasons.push('이미 배포 경험이 있는 운영 설치본입니다. 배포 전 보호 스냅샷이 우선입니다.');
    } else {
        scenario = 'onboarding_ready';
        strategy = 'continue_onboarding';
        reasons.push('설치는 가능 상태이며 본격 온보딩을 진행할 수 있습니다.');
    }

    const recommendedCommands = [];
    if (scenario === 'legacy_reinstall_migration') {
        recommendedCommands.push('npm run agent:snapshot -- --reason=legacy-migration');
        if (restoreSources.total > 0) {
            recommendedCommands.push('npm run agent:restore -- --dry-run');
        }
        recommendedCommands.push('새 스타터킷에 최신 버전을 설치한 뒤 추출된 복원 계획 기준으로 local/custom config를 이관');
    } else if (scenario === 'safe_update_in_place') {
        recommendedCommands.push('npm run agent:snapshot -- --reason=pre-update');
        recommendedCommands.push(starterCoreSyncCommand);
    } else if (scenario === 'production_binding_drift') {
        recommendedCommands.push('npm run agent:snapshot -- --reason=target-drift');
        recommendedCommands.push('wrangler.toml의 project/database/bucket 변경 의도를 먼저 검토');
    } else if (scenario === 'resume_setup') {
        recommendedCommands.push('npm run setup:step -- --next');
    } else if (scenario === 'fresh_install') {
        recommendedCommands.push('npm run setup:agent');
    } else {
        recommendedCommands.push('npm run agent:doctor -- --json');
    }

    const lifecycle = {
        version: 1,
        generated_at: new Date().toISOString(),
        app_root: detectAppRoot(projectRoot),
        scenario,
        strategy,
        reasons,
        versions,
        version_lag: versionLag,
        active_clinic: activeClinic,
        deployment_count: deploymentCount,
        local_summary: localSummary,
        restore_sources: {
            total: restoreSources.total,
            primary: restoreSources.primary
                ? {
                    id: restoreSources.primary.id,
                    type: restoreSources.primary.type,
                    label: restoreSources.primary.label,
                    path: restoreSources.primary.path
                }
                : null
        },
        target: {
            current: currentTarget,
            recorded: recordedTarget,
            drift: targetDrift
        },
        recommended_commands: recommendedCommands
    };

    fs.ensureDirSync(path.dirname(OUTPUT_PATH));
    fs.writeJsonSync(OUTPUT_PATH, lifecycle, { spaces: 2 });
    return lifecycle;
}

function printHuman(lifecycle) {
    console.log('\n🧭 Clinic-OS Lifecycle\n');
    console.log(`- scenario: ${lifecycle.scenario}`);
    console.log(`- strategy: ${lifecycle.strategy}`);
    console.log(`- active clinic: ${lifecycle.active_clinic ? 'yes' : 'no'}`);
    console.log(`- deployment count: ${lifecycle.deployment_count}`);
    if (lifecycle.restore_sources?.primary) {
        console.log(`- restore source: ${lifecycle.restore_sources.primary.label}`);
    }

    if (lifecycle.reasons.length > 0) {
        console.log('\n판단 근거');
        for (const reason of lifecycle.reasons) {
            console.log(`- ${reason}`);
        }
    }

    console.log('\n권장 명령');
    for (const command of lifecycle.recommended_commands) {
        console.log(`- ${command}`);
    }
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const json = args.has('--json');
    const lifecycle = await analyzeLifecycle({ projectRoot: PROJECT_ROOT });

    if (json) {
        console.log(JSON.stringify(lifecycle, null, 2));
        return;
    }

    printHuman(lifecycle);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
    main().catch((error) => {
        console.error('Agent lifecycle failed:', error);
        process.exit(1);
    });
}
