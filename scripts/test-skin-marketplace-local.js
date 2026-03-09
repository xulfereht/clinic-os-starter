#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const TEST_LICENSE = 'clinic-os-master-test-license';
const TEST_SKIN_ID = 'e2e-community-skin';
const TEST_SKIN_DIR = path.join(ROOT, 'src', 'skins', 'local', TEST_SKIN_ID);
const TEST_STORE_DIR = path.join(ROOT, 'src', 'skins', 'store', TEST_SKIN_ID);
const HQ_LOCAL_STATE_DIR = path.join(ROOT, 'hq', '.wrangler', 'state', 'v3');

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
Clinic-OS Local HQ Skin Marketplace Smoke Test

Usage:
  npm run skin:test:hq-local

Options:
  --keep-artifacts      테스트 후 생성한 local/store 스킨을 유지
  --help                도움말
`);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error('Failed to allocate free port'));
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/skins`);
      if (response.ok) {
        return;
      }
    } catch (_) {}
    await sleep(750);
  }
  throw new Error(`HQ dev server did not start within ${timeoutMs}ms`);
}

function ensureTestSkin() {
  fs.mkdirSync(path.join(TEST_SKIN_DIR, 'sections'), { recursive: true });
  fs.writeFileSync(path.join(TEST_SKIN_DIR, 'skin.css'), `:root[data-skin="${TEST_SKIN_ID}"] {\n  --accent: #0f766e;\n}\n`);
  fs.writeFileSync(path.join(TEST_SKIN_DIR, 'sections', 'Hero.astro'), '---\nconst { data = {} } = Astro.props;\n---\n<section class="hero-e2e">{data?.title || "E2E Hero"}</section>\n');
  fs.writeFileSync(path.join(TEST_SKIN_DIR, 'manifest.json'), `${JSON.stringify({
    id: TEST_SKIN_ID,
    name: 'E2E Community Skin',
    description: 'Master repo local HQ marketplace smoke test',
    version: '1.0.0',
    source: 'local',
    extends: 'clinicLight',
    stylesheet: 'skin.css',
    defaults: { mode: 'light', brandHue: 'teal', density: 'cozy' },
    preview: {
      badge: 'E2E',
      heroMode: 'calm',
      surfaces: ['hero', 'detail', 'cards'],
    },
    documentation: {
      summary: 'Local test skin for HQ marketplace validation',
    },
    overrides: {
      sections: [
        { type: 'Hero', file: 'sections/Hero.astro' },
      ],
    },
  }, null, 2)}\n`);
}

function cleanupTestArtifacts() {
  fs.rmSync(TEST_SKIN_DIR, { recursive: true, force: true });
  fs.rmSync(TEST_STORE_DIR, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const port = await findFreePort();
  const hqUrl = `http://127.0.0.1:${port}`;
  const hqProcess = spawn(NPM_CMD, ['run', 'dev', '--prefix', 'hq', '--', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: 'pipe',
    detached: process.platform !== 'win32',
  });

  let stdout = '';
  let stderr = '';
  hqProcess.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  hqProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    cleanupTestArtifacts();
    fs.rmSync(HQ_LOCAL_STATE_DIR, { recursive: true, force: true });
    run(NPM_CMD, ['run', 'db:init', '--prefix', 'hq']);
    run('node', ['hq/scripts/seed-test-license.js', '--license', TEST_LICENSE]);
    ensureTestSkin();

    await waitForServer(hqUrl);

    run('node', ['scripts/skin-submit.js', '--id', TEST_SKIN_ID, '--source', 'local', '--hq-url', hqUrl, '--license', TEST_LICENSE]);
    run('node', ['hq/scripts/review-skin-submission.js', '--skin-id', TEST_SKIN_ID, '--action', 'approve']);

    const catalogResponse = await fetch(`${hqUrl}/api/skins`);
    if (!catalogResponse.ok) {
      throw new Error('Failed to fetch local HQ skin catalog');
    }
    const catalogJson = await catalogResponse.json();
    const communitySkin = (catalogJson.skins || []).find((skin) => skin.id === TEST_SKIN_ID);
    if (!communitySkin || communitySkin.distribution !== 'community') {
      throw new Error('Approved community skin not found in HQ catalog');
    }

    fs.rmSync(TEST_SKIN_DIR, { recursive: true, force: true });
    run('node', ['scripts/skin-install.js', '--id', TEST_SKIN_ID, '--hq-url', hqUrl, '--license', TEST_LICENSE, '--force']);

    const installedManifestPath = path.join(TEST_STORE_DIR, 'manifest.json');
    if (!fs.existsSync(installedManifestPath)) {
      throw new Error('Installed store skin manifest not found');
    }

    const installedManifest = JSON.parse(fs.readFileSync(installedManifestPath, 'utf8'));
    if (installedManifest.id !== TEST_SKIN_ID || installedManifest.source !== 'store') {
      throw new Error('Installed store skin manifest is invalid');
    }

    console.log(JSON.stringify({
      success: true,
      hqUrl,
      license: TEST_LICENSE,
      skinId: TEST_SKIN_ID,
      installedManifest,
    }, null, 2));
  } finally {
    if (!options['keep-artifacts']) {
      cleanupTestArtifacts();
    }
    if (process.platform !== 'win32') {
      try {
        process.kill(-hqProcess.pid, 'SIGTERM');
      } catch (_) {}
    } else {
      hqProcess.kill('SIGTERM');
    }
    await sleep(1000);
    if (!hqProcess.killed) {
      if (process.platform !== 'win32') {
        try {
          process.kill(-hqProcess.pid, 'SIGKILL');
        } catch (_) {}
      } else {
        hqProcess.kill('SIGKILL');
      }
    }
    if (stdout.trim()) {
      process.stdout.write(stdout);
    }
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
