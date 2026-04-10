#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import { mergeStarterPackageJson, writeStarterPackageJson } from './lib/starter-package-merge.js';
import { buildNpmCommand } from './lib/npm-cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

function parseArgs(argv) {
    const parsed = {
        channel: 'stable',
        auto: true,
        install: true,
        quiet: false,
    };

    for (const arg of argv) {
        if (arg === '--beta') parsed.channel = 'beta';
        if (arg === '--stable') parsed.channel = 'stable';
        if (arg === '--no-install') parsed.install = false;
        if (arg === '--quiet') parsed.quiet = true;
    }

    return parsed;
}

function log(message, quiet = false) {
    if (!quiet) {
        console.log(message);
    }
}

async function runCommand(command, quiet = false, cwd = PROJECT_ROOT) {
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];

    return await new Promise((resolve) => {
        const proc = spawn(shell, args, {
            cwd,
            stdio: quiet ? 'ignore' : 'inherit',
        });

        proc.on('close', (code) => resolve({ success: code === 0, code }));
        proc.on('error', () => resolve({ success: false, code: 1 }));
    });
}

async function getConfig() {
    const configPath = path.join(PROJECT_ROOT, '.docking', 'config.yaml');

    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            return yaml.load(content);
        } catch (_) {
            // ignore
        }
    }

    const clinicJsonPath = path.join(PROJECT_ROOT, 'clinic.json');
    if (fs.existsSync(clinicJsonPath)) {
        try {
            const clinicConfig = fs.readJsonSync(clinicJsonPath);
            return {
                hq_url: clinicConfig.hq_url || DEFAULT_HQ_URL,
                device_token: clinicConfig.license_key || null,
            };
        } catch (_) {
            // ignore
        }
    }

    return { hq_url: DEFAULT_HQ_URL, device_token: null };
}

async function fetchStarterPackageJson(hqUrl, deviceToken) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (deviceToken) {
        headers.Authorization = `Bearer ${deviceToken}`;
    }

    const response = await fetch(`${hqUrl}/api/v1/starter-files/package.json`, { headers });
    if (!response.ok) {
        throw new Error(`starter package.json 다운로드 실패: ${response.status}`);
    }

    return await response.json();
}

async function syncStarterPackageJson(options) {
    const config = await getConfig();
    const hqUrl = config.hq_url || DEFAULT_HQ_URL;
    const deviceToken = config.device_token || null;
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const localPackageJson = fs.existsSync(packageJsonPath) ? fs.readJsonSync(packageJsonPath) : {};
    const upstreamPackageJson = await fetchStarterPackageJson(hqUrl, deviceToken);
    const merged = mergeStarterPackageJson(localPackageJson, upstreamPackageJson);
    const changed = JSON.stringify(localPackageJson) !== JSON.stringify(merged);

    if (changed) {
        writeStarterPackageJson(packageJsonPath, merged);
        log(`   ✅ package.json 동기화: v${localPackageJson.version || '(없음)'} → v${merged.version || '(없음)'}`, options.quiet);
    } else {
        log('   ✅ package.json 이미 최신 상태', options.quiet);
    }

    return { changed, merged };
}

export function getDependencyInstallTargets(projectRoot = PROJECT_ROOT) {
    const targets = [projectRoot];
    const corePath = path.join(projectRoot, 'core');

    if (fs.existsSync(path.join(corePath, 'package.json'))) {
        targets.push(corePath);
    }

    return targets;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const corePullArgs = [`node .docking/engine/fetch.js --${options.channel}`];
    if (options.auto) {
        corePullArgs[0] += ' --auto';
    }

    log('🔄 Starter + Core 묶음 업데이트\n', options.quiet);

    log('1) starter 파일 동기화', options.quiet);
    const starterResult = await runCommand('node scripts/update-starter.js', options.quiet);
    if (!starterResult.success) {
        throw new Error('starter 파일 동기화 실패');
    }

    log('\n2) starter package.json 동기화', options.quiet);
    await syncStarterPackageJson(options);

    log(`\n3) core ${options.channel} 채널 동기화`, options.quiet);
    const coreResult = await runCommand(corePullArgs[0], options.quiet);
    if (!coreResult.success) {
        throw new Error(`core ${options.channel} 동기화 실패`);
    }

    if (options.install) {
        log('\n4) 의존성 동기화 (npm install)', options.quiet);
        for (const installPath of getDependencyInstallTargets(PROJECT_ROOT)) {
            const label = installPath === PROJECT_ROOT ? 'root' : path.relative(PROJECT_ROOT, installPath);
            log(`   ↳ ${label} 의존성 설치`, options.quiet);
            const installResult = await runCommand(buildNpmCommand('install'), options.quiet, installPath);
            if (!installResult.success) {
                throw new Error(`${label} npm install 실패`);
            }
        }
    }

    const contextScriptPath = path.join(PROJECT_ROOT, 'scripts', 'generate-agent-context.js');
    if (fs.existsSync(contextScriptPath)) {
        await runCommand('node scripts/generate-agent-context.js --quiet', true);
    }

    log('\n✅ Starter + Core 업데이트 완료', options.quiet);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch((error) => {
        console.error(`\n❌ update-starter-core 실패: ${error.message}`);
        process.exit(1);
    });
}
