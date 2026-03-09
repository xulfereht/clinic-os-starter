#!/usr/bin/env node

import { findProjectRoot } from './lib/survey-tool-installer.js';
import { buildSkinBundlePlan, writeSkinBundle } from './lib/skin-package.js';

function parseArgs(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const inlineIndex = arg.indexOf('=');
    if (inlineIndex !== -1) {
      options[arg.slice(2, inlineIndex)] = arg.slice(inlineIndex + 1);
      continue;
    }

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
Clinic-OS Skin Bundle

Usage:
  npm run skin:bundle -- --id SKIN_ID

Options:
  --id SKIN_ID          패키징할 skin pack ID
  --source SOURCE       local | core | store
  --out-dir DIR         번들 출력 디렉토리 (기본값: dist-skins)
  --dry-run             계획만 출력
  --json                JSON 출력
  --help                도움말
`);
}

function printResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`skin: ${result.skinId}`);
  console.log(`source: ${result.source}`);
  console.log(`bundle: ${result.bundlePath}`);
  console.log(`files: ${result.files.join(', ')}`);
  if (result.mode !== 'dry-run') {
    console.log(`archive hash: ${result.archiveHash}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.id) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot();
  const plan = buildSkinBundlePlan(projectRoot, {
    id: options.id,
    source: options.source,
    outDir: options['out-dir'],
  });

  if (options['dry-run']) {
    printResult({
      mode: 'dry-run',
      skinId: plan.skinId,
      source: plan.source,
      bundlePath: plan.bundlePath,
      files: plan.files.map((file) => file.relativePath),
      packageMeta: plan.packageMeta,
    }, options);
    return;
  }

  const result = writeSkinBundle(plan);
  printResult({
    mode: 'bundle',
    skinId: result.skinId,
    source: result.source,
    bundlePath: result.bundlePath,
    files: result.files.map((file) => file.relativePath),
    packageMeta: result.packageMeta,
    archiveHash: result.archiveHash,
    bytes: result.bytes,
  }, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
