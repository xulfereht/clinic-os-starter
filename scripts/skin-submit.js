#!/usr/bin/env node

import fs from 'node:fs';

import {
  buildSkinSubmissionPlan,
  createSkinSubmissionPayload,
  findProjectRoot,
  getSkinSubmissionHqUrl,
  getSkinSubmissionLicenseKey,
  submitSkinPayload,
} from './lib/skin-submission.js';

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
Clinic-OS Skin Submit

Usage:
  npm run skin:submit -- --id my-skin --source local

Options:
  --id SKIN_ID          제출할 스킨 ID
  --source SOURCE       local | store | core
  --license KEY         clinic.json 대신 사용할 라이선스 키
  --hq-url URL          기본 HQ URL 대신 사용할 주소
  --dry-run             번들/제출 계획만 출력
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
  console.log(`version: ${result.version}`);
  console.log(`manifest: ${result.manifest.name}`);
  console.log(`bundle: ${result.bundlePath}`);

  if (result.mode === 'submit') {
    console.log(`submission: ${result.submissionId}`);
    console.log(`status: ${result.status}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.id) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot();
  const licenseKey = getSkinSubmissionLicenseKey(projectRoot, options.license);
  const hqUrl = getSkinSubmissionHqUrl(options['hq-url']);
  const plan = buildSkinSubmissionPlan(projectRoot, {
    id: String(options.id),
    source: options.source ? String(options.source) : undefined,
  });

  try {
    const payload = createSkinSubmissionPayload(plan);

    const resultBase = {
      skinId: plan.skinId,
      source: plan.source,
      version: plan.version,
      manifest: {
        id: plan.manifest.id,
        name: plan.manifest.name,
        description: plan.manifest.description || '',
      },
      bundlePath: payload.bundleResult.bundlePath,
      packageHash: payload.packageHash,
      packageBytes: payload.archiveBuffer.byteLength,
    };

    if (options['dry-run']) {
      printResult({
        ...resultBase,
        mode: 'dry-run',
        hqUrl,
        hasLicenseKey: Boolean(licenseKey),
      }, options);
      return;
    }

    if (!licenseKey) {
      throw new Error('clinic.json 또는 .cos-license 에서 라이선스 키를 찾지 못했습니다.');
    }

    const submission = await submitSkinPayload({
      hqUrl,
      licenseKey,
      manifest: plan.manifest,
      packageData: payload.packageData,
      packageHash: payload.packageHash,
    });

    printResult({
      ...resultBase,
      mode: 'submit',
      submissionId: submission.submissionId,
      versionId: submission.versionId,
      status: submission.status,
      validation: submission.validation || null,
    }, options);
  } finally {
    if (plan.tempOutDir && fs.existsSync(plan.tempOutDir)) {
      fs.rmSync(plan.tempOutDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
