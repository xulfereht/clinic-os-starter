#!/usr/bin/env node

import {
  findProjectRoot,
  getSkinInstallerHqUrl,
  getSkinStoreLicenseKey,
  planSkinRemoval,
  removeInstalledSkin,
  reportSkinUninstall,
} from './lib/skin-store-installer.js';

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
Clinic-OS Skin Remove

Usage:
  npm run skin:remove -- --id linenBreeze

Options:
  --id SKIN_ID          제거할 store 스킨 ID
  --license KEY         clinic.json 대신 사용할 라이선스 키
  --hq-url URL          기본 HQ URL 대신 사용할 주소
  --dry-run             제거 계획만 출력
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
  console.log(`target: ${result.targetDir}`);
  if (result.manifest?.version) {
    console.log(`version: ${result.manifest.version}`);
  }

  if (result.mode === 'dry-run') {
    if (result.blockingReason) {
      console.log(`차단 사유: ${result.blockingReason}`);
    }
    return;
  }

  console.log('스토어 스킨이 제거되었습니다.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.id) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot();

  if (options['dry-run']) {
    const plan = planSkinRemoval(projectRoot, String(options.id));
    printResult({
      ...plan,
      mode: 'dry-run',
    }, options);
    return;
  }

  const result = removeInstalledSkin(projectRoot, String(options.id));
  const licenseKey = getSkinStoreLicenseKey(projectRoot, options.license);
  await reportSkinUninstall({
    skinId: result.skinId,
    licenseKey,
    hqUrl: getSkinInstallerHqUrl(options['hq-url']),
  });

  printResult({
    ...result,
    mode: 'remove',
  }, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
