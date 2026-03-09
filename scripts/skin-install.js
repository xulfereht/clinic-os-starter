#!/usr/bin/env node

import { installSkinBundle, planSkinInstall } from './lib/skin-package.js';
import {
  downloadSkinPackage,
  findProjectRoot,
  getSkinInstallerHqUrl,
  getSkinStoreLicenseKey,
  installSkinFromDownloadedPayload,
  planSkinStoreInstall,
  reportSkinInstall,
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
Clinic-OS Skin Install

Usage:
  npm run skin:install -- --file dist-skins/my-skin-v1.0.0.zip
  npm run skin:install -- --id linenBreeze

Options:
  --file PATH           설치할 skin bundle zip 경로
  --id SKIN_ID          HQ curated 스킨 ID로 직접 설치
  --version VERSION     특정 HQ 스킨 버전 설치
  --license KEY         clinic.json 대신 사용할 라이선스 키
  --hq-url URL          기본 HQ URL 대신 사용할 주소
  --force               기존 store 설치본이 있으면 백업 후 재설치
  --dry-run             설치 계획만 출력
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
  console.log(`version: ${result.version}`);
  console.log(`target: ${result.targetDir}`);
  console.log(`files: ${result.files.join(', ')}`);

  if (result.mode === 'dry-run') {
    if (result.blockingConflict) {
      console.log(`차단 사유: ${result.blockingConflict.reason}`);
    }
    if (result.existingStoreInstall) {
      console.log(`기존 store 설치본: ${result.existingStoreInstall.path}`);
    }
    return;
  }

  if (result.backupDir) {
    console.log(`backup: ${result.backupDir}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.file && !options.id)) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot();
  const hqUrl = getSkinInstallerHqUrl(options['hq-url']);

  if (options.id) {
    const licenseKey = getSkinStoreLicenseKey(projectRoot, options.license);
    if (!licenseKey) {
      console.error('Error: clinic.json 또는 .cos-license 에서 라이선스 키를 찾지 못했습니다.');
      process.exit(1);
    }

    const payload = await downloadSkinPackage({
      skinId: String(options.id),
      version: options.version ? String(options.version) : null,
      licenseKey,
      hqUrl,
    });

    if (options['dry-run']) {
      const plan = planSkinStoreInstall(projectRoot, payload, {
        force: options.force === true,
      });
      printResult({
        ...plan,
        mode: 'dry-run',
      }, options);
      return;
    }

    const result = installSkinFromDownloadedPayload(projectRoot, payload, {
      force: options.force === true,
    });

    await reportSkinInstall({
      skinId: result.skinId,
      version: result.manifest.version || payload.download?.version || '1.0.0',
      licenseKey,
      hqUrl,
    });

    printResult({
      ...result,
      mode: 'install',
    }, options);
    return;
  }

  if (options['dry-run']) {
    const plan = planSkinInstall(projectRoot, String(options.file), {
      force: options.force === true,
    });
    printResult({
      ...plan,
      mode: 'dry-run',
    }, options);
    return;
  }

  const result = installSkinBundle(projectRoot, String(options.file), {
    force: options.force === true,
  });

  printResult({
    ...result,
    mode: 'install',
  }, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
