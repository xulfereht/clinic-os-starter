/**
 * Version resolution for core:pull operations
 *
 * Handles: HQ API version lookup, git tag fallback, local version read/write,
 * semver comparison, config loading (clinic.json, config.yaml)
 *
 * Extracted from fetch.js.
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fetchWithTimeout, runCommand } from './git-utils.js';

/**
 * Load HQ URL, device_token, license_key, channel from config files
 */
export function getConfig(projectRoot) {
    const clinicJsonPath = path.join(projectRoot, 'clinic.json');
    const configYamlPath = path.join(projectRoot, '.docking/config.yaml');

    let hqUrl = 'https://clinic-os-hq.pages.dev';
    let licenseKey = null;
    let deviceToken = null;
    let channel = 'stable';

    if (fs.existsSync(clinicJsonPath)) {
        try {
            const clinicConfig = fs.readJsonSync(clinicJsonPath);
            hqUrl = clinicConfig.hq_url || hqUrl;
            licenseKey = clinicConfig.license_key || null;
            channel = clinicConfig.channel || channel;
        } catch (e) { /* ignore */ }
    }

    if (fs.existsSync(configYamlPath)) {
        try {
            const config = yaml.load(fs.readFileSync(configYamlPath, 'utf8'));
            hqUrl = config.hq_url || hqUrl;
            deviceToken = config.device_token || null;
        } catch (e) { /* ignore */ }
    }

    return { hqUrl, deviceToken, licenseKey, channel };
}

/**
 * Get authenticated git URL from HQ API
 */
export async function getAuthenticatedGitUrl(projectRoot) {
    const { hqUrl, deviceToken, licenseKey, channel } = getConfig(projectRoot);

    if (!deviceToken && !licenseKey) {
        console.log('   ⚠️  인증 정보가 없습니다. npm run setup을 먼저 실행하세요.');
        return null;
    }

    try {
        const response = await fetchWithTimeout(`${hqUrl}/api/v1/update/git-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_token: deviceToken, license_key: licenseKey, channel })
        }, 15000);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.log(`   ⚠️  HQ 인증 실패: ${err.error || response.status}`);
            return null;
        }

        const data = await response.json();
        return data.git_url || null;
    } catch (e) {
        console.log(`   ⚠️  HQ 연결 실패: ${e.message}`);
        return null;
    }
}

/**
 * Get version from HQ API for a channel
 */
export async function getVersionFromHQ(projectRoot, channel = 'stable') {
    const { hqUrl } = getConfig(projectRoot);
    try {
        const response = await fetchWithTimeout(
            `${hqUrl}/api/v1/update/channel-version?channel=${channel}`, {}, 10000
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.version ? `v${data.version}` : null;
    } catch (e) {
        return null;
    }
}

/**
 * Read current core version from .core/version
 * Auto-creates from package.json if missing
 */
export function readCoreVersion(projectRoot, isStarterKit) {
    const versionFile = path.join(projectRoot, '.core', 'version');
    if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf8').trim();
    }

    // Auto-create from package.json
    console.log('   ⚠️  .core/version 파일이 없습니다. 자동 생성 중...');
    const pkgPath = isStarterKit
        ? path.join(projectRoot, 'core', 'package.json')
        : path.join(projectRoot, 'package.json');

    let version = 'v0.0.0';
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = fs.readJsonSync(pkgPath);
            version = pkg.version?.startsWith('v') ? pkg.version : `v${pkg.version}`;
        } catch (e) { /* ignore */ }
    }

    const coreDir = path.join(projectRoot, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeFileSync(versionFile, version);
    console.log(`   ℹ️  .core/version 자동 생성: ${version}`);
    return version;
}

/**
 * Write core version to .core/version
 */
export function writeCoreVersion(projectRoot, version) {
    const coreDir = path.join(projectRoot, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeFileSync(path.join(coreDir, 'version'), version);
}

/**
 * Read .core/starter-version (auto-create from package.json if missing)
 */
export function readStarterVersion(projectRoot, isStarterKit) {
    const starterVersionPath = path.join(projectRoot, '.core', 'starter-version');
    if (fs.existsSync(starterVersionPath)) {
        return fs.readFileSync(starterVersionPath, 'utf8').trim();
    }

    const pkgPath = isStarterKit
        ? path.join(projectRoot, 'core', 'package.json')
        : path.join(projectRoot, 'package.json');

    let version = 'v0.0.0';
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = fs.readJsonSync(pkgPath);
            if (pkg.version) {
                version = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
            }
        } catch (e) { /* ignore */ }
    }

    const coreDir = path.join(projectRoot, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeFileSync(starterVersionPath, version);
    console.log(`   ℹ️  .core/starter-version 자동 생성: ${version}`);
    return version;
}

/**
 * Semver comparison: a < b?
 */
export function semverLt(a, b) {
    const parse = (v) => (v || '').replace(/^v/, '').split('.').map(Number);
    const av = parse(a), bv = parse(b);
    for (let i = 0; i < 3; i++) {
        if ((av[i] || 0) !== (bv[i] || 0)) return (av[i] || 0) < (bv[i] || 0);
    }
    return false;
}

/**
 * 채널별 최신 버전 조회
 * Primary: HQ API (release_channels 테이블)
 * Fallback: Git 태그 (latest-stable, latest-beta)
 */
export async function getChannelVersion(projectRoot, channel = 'stable') {
    const channelTag = channel === 'beta' ? 'latest-beta' : 'latest-stable';

    console.log(`   🔍 HQ API에서 ${channel} 버전 조회 중...`);
    const hqVersion = await getVersionFromHQ(projectRoot, channel);
    if (hqVersion) {
        console.log(`   ✅ HQ ${channel} 버전: ${hqVersion}`);
        return hqVersion;
    }

    console.log(`   ⚠️  HQ API 조회 실패. Git 태그(${channelTag})로 fallback...`);

    const tagCheck = await runCommand(`git rev-parse --verify refs/tags/${channelTag}`, projectRoot, true);
    if (!tagCheck.success) {
        throw new Error(`HQ API 조회 실패, ${channelTag} 태그도 없습니다.`);
    }

    const commitResult = await runCommand(`git rev-list -n 1 ${channelTag}`, projectRoot, true);
    if (!commitResult.success) {
        throw new Error(`${channelTag} 커밋을 읽을 수 없습니다.`);
    }
    const commitSha = commitResult.stdout.trim();

    const tagsResult = await runCommand(`git tag --points-at ${commitSha}`, projectRoot, true);
    const tags = tagsResult.stdout.split('\n').filter(t => t && t.startsWith('v') && !t.startsWith('latest'));

    if (tags.length === 0) {
        const describeResult = await runCommand(`git describe --tags --match "v*" ${channelTag}`, projectRoot, true);
        if (describeResult.success) {
            const described = describeResult.stdout.trim();
            const vTag = described.split('-')[0];
            if (vTag.startsWith('v')) {
                return vTag;
            }
        }
        throw new Error(`${channelTag}에서 v-tag를 찾을 수 없습니다.`);
    }

    const sortedTags = tags.sort((a, b) => {
        const aParts = a.replace('v', '').split('.').map(Number);
        const bParts = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
                return (bParts[i] || 0) - (aParts[i] || 0);
            }
        }
        return 0;
    });

    return sortedTags[0];
}

/**
 * Fallback: semver 정렬 기반 최신 stable 태그
 */
export async function getLatestStableTagFallback(projectRoot) {
    const result = await runCommand('git tag --list "v*" --sort=-v:refname', projectRoot, true);
    const tags = result.stdout.split('\n').filter(Boolean);

    const stable = tags.find(t => !/-/.test(t));
    if (!stable) {
        throw new Error('사용 가능한 안정 태그(v*)를 찾지 못했습니다.');
    }
    return stable;
}
