#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HQ_URL = 'https://clinic-os-hq.pages.dev';
const TEST_LICENSE = 'clinic-os-production-test-client';
const TEST_SKIN_PREFIX = 'e2e-community-skin-prod';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    options[key] = value;
    if (value !== true) i += 1;
  }
  return options;
}

function printHelp() {
  console.log(`
Clinic-OS Remote HQ Skin Marketplace Smoke Test

Usage:
  npm run skin:test:hq-remote

Options:
  --keep-store-install  테스트 후 local store 설치본을 유지
  --keep-remote-skin    원격 HQ에서 테스트 스킨을 비노출 처리하지 않음
  --help                도움말
`);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ...(options.env || {}) },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${cmd} ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRemoteTestSkin(skinId) {
  const skinDir = path.join(ROOT, 'src', 'skins', 'local', skinId);
  fs.mkdirSync(path.join(skinDir, 'sections'), { recursive: true });
  fs.writeFileSync(path.join(skinDir, 'skin.css'), `:root[data-skin="${skinId}"] {\n  --accent: #0284c7;\n}\n`);
  fs.writeFileSync(path.join(skinDir, 'sections', 'Hero.astro'), '---\nconst { data = {} } = Astro.props;\n---\n<section class="hero-remote-e2e">{data?.title || "Remote E2E Hero"}</section>\n');
  fs.writeFileSync(path.join(skinDir, 'manifest.json'), `${JSON.stringify({
    id: skinId,
    name: 'Remote E2E Community Skin',
    description: 'Production HQ smoke test skin created by master repo',
    version: '1.0.0',
    source: 'local',
    extends: 'clinicLight',
    stylesheet: 'skin.css',
    defaults: { mode: 'light', brandHue: 'sky', density: 'cozy' },
    preview: {
      badge: 'REMOTE-E2E',
      heroMode: 'editorial',
      surfaces: ['hero', 'detail', 'cards'],
    },
    documentation: {
      summary: 'Production HQ remote smoke test artifact',
    },
    overrides: {
      sections: [{ type: 'Hero', file: 'sections/Hero.astro' }],
    },
  }, null, 2)}\n`);
  return skinDir;
}

function cleanupLocalSkinArtifacts(skinId) {
  fs.rmSync(path.join(ROOT, 'src', 'skins', 'local', skinId), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'src', 'skins', 'store', skinId), { recursive: true, force: true });
}

async function waitForRemoteCatalog(skinId, expectedVisible, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${HQ_URL}/api/skins?search=${encodeURIComponent(skinId)}`);
    if (response.ok) {
      const data = await response.json();
      const found = (data.skins || []).some((skin) => skin.id === skinId);
      if (found === expectedVisible) {
        return data;
      }
    }
    await sleep(1500);
  }
  throw new Error(`Remote HQ catalog did not reach expected state for ${skinId}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const skinId = `${TEST_SKIN_PREFIX}-${suffix}`;
  let localSkinCreated = false;
  let submitted = false;
  let installed = false;

  try {
    run('node', ['hq/scripts/seed-test-license.js', '--remote', '--license', TEST_LICENSE, '--email', 'production-skin-test@clinic-os.local', '--name', 'Production Skin Test', '--org', 'Clinic-OS Production Smoke']);
    createRemoteTestSkin(skinId);
    localSkinCreated = true;

    run('node', ['scripts/skin-submit.js', '--id', skinId, '--source', 'local', '--hq-url', HQ_URL, '--license', TEST_LICENSE]);
    submitted = true;

    run('node', ['hq/scripts/review-skin-submission.js', '--remote', '--skin-id', skinId, '--action', 'approve', '--notes', 'Production remote smoke approval']);
    await waitForRemoteCatalog(skinId, true);

    fs.rmSync(path.join(ROOT, 'src', 'skins', 'local', skinId), { recursive: true, force: true });
    localSkinCreated = false;

    run('node', ['scripts/skin-install.js', '--id', skinId, '--hq-url', HQ_URL, '--license', TEST_LICENSE, '--force']);
    installed = true;

    const installedManifestPath = path.join(ROOT, 'src', 'skins', 'store', skinId, 'manifest.json');
    if (!fs.existsSync(installedManifestPath)) {
      throw new Error('Installed store skin manifest not found');
    }
    const installedManifest = JSON.parse(fs.readFileSync(installedManifestPath, 'utf8'));

    if (!options['keep-remote-skin']) {
      run('node', ['hq/scripts/review-skin-submission.js', '--remote', '--skin-id', skinId, '--action', 'reject', '--notes', 'Cleanup after production remote smoke test']);
      await waitForRemoteCatalog(skinId, false);
    }

    if (!options['keep-store-install']) {
      run('node', ['scripts/skin-remove.js', '--id', skinId, '--hq-url', HQ_URL, '--license', TEST_LICENSE]);
      installed = false;
    }

    console.log(JSON.stringify({
      success: true,
      hqUrl: HQ_URL,
      license: TEST_LICENSE,
      skinId,
      submitted,
      installedManifest,
      remoteHiddenAfterTest: !options['keep-remote-skin'],
      localStoreRemovedAfterTest: !options['keep-store-install'],
    }, null, 2));
  } finally {
    if (localSkinCreated) {
      fs.rmSync(path.join(ROOT, 'src', 'skins', 'local', skinId), { recursive: true, force: true });
    }
    if (!options['keep-store-install'] || !installed) {
      fs.rmSync(path.join(ROOT, 'src', 'skins', 'store', skinId), { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
