#!/usr/bin/env node

import {
  applySurveyToolSchema,
  findProjectRoot,
  getSurveyToolLicenseKey,
  installSurveyToolFiles,
  planSurveyToolInstall,
} from './lib/survey-tool-installer.js';

const HQ_URL = process.env.COS_HQ_URL || process.env.PUBLIC_HQ_URL || 'https://clinic-os-hq.pages.dev';

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[i + 1];
    const value = next && !next.startsWith('--') ? next : true;
    options[key] = value;
    if (value !== true) {
      i += 1;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Clinic-OS Survey Tool Installer

Usage:
  npm run survey-tool:install -- --id TOOL_ID

Options:
  --id TOOL_ID          설치할 검사도구 ID
  --version VERSION     특정 버전 설치
  --license KEY         clinic.json 대신 사용할 라이선스 키
  --force               기존 store 설치본을 백업 후 재설치
  --dry-run             다운로드/설치 계획만 출력
  --json                JSON 형태로 출력
  --skip-migration      migration.sql 자동 실행 생략
  --skip-seed           seed.sql 자동 실행 생략
  --help                도움말 출력
`);
}

function printResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`검사도구: ${result.toolId}`);
  console.log(`버전: ${result.version}`);
  console.log(`대상: ${result.targetDir}`);

  if (result.mode === 'dry-run') {
    console.log('모드: dry-run');
    if (result.blockingConflict) {
      console.log(`차단 사유: ${result.blockingConflict.reason}`);
    }
    if (result.existingStoreInstall) {
      console.log(`기존 store 설치본: ${result.existingStoreInstall.path}`);
    }
    console.log(`패키지 유형: ${result.package.manifestOnly ? 'manifest-only' : 'bundle'}`);
    if (result.package.files.length > 0) {
      console.log(`패키지 파일: ${result.package.files.join(', ')}`);
    }
    return;
  }

  if (result.backupDir) {
    console.log(`백업: ${result.backupDir}`);
  }

  console.log(result.filesExtracted ? '패키지 파일이 추출되었습니다.' : 'manifest-only 검사도구가 저장되었습니다.');

  if (result.schema.actions.length > 0) {
    console.log('적용한 DB 작업:');
    for (const action of result.schema.actions) {
      console.log(`- ${action.type}: ${action.file}`);
    }
  }

  if (result.schema.warnings.length > 0) {
    console.log('주의:');
    for (const warning of result.schema.warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log('다음 단계: dev 서버를 재시작하거나 build/deploy 전에 변경사항을 검증하세요.');
}

async function downloadSurveyTool({ toolId, version, licenseKey }) {
  const response = await fetch(`${HQ_URL}/api/survey-tools/${toolId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      version: version || null,
      includePackage: true,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || '검사도구 다운로드에 실패했습니다.');
  }

  return payload;
}

async function reportInstall({ toolId, version, licenseKey }) {
  try {
    await fetch(`${HQ_URL}/api/survey-tools/${toolId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, version }),
    });
  } catch (error) {
    console.error(`Warning: HQ 설치 보고 실패: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help || !options.id) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot();
  const licenseKey = getSurveyToolLicenseKey(projectRoot, options.license);

  if (!licenseKey) {
    console.error('Error: clinic.json 또는 .cos-license 에서 라이선스 키를 찾지 못했습니다.');
    process.exit(1);
  }

  const payload = await downloadSurveyTool({
    toolId: options.id,
    version: options.version,
    licenseKey,
  });

  const plan = planSurveyToolInstall(projectRoot, options.id, payload, {
    force: Boolean(options.force),
  });

  if (options['dry-run']) {
    printResult({
      ...plan,
      mode: 'dry-run',
      toolId: options.id,
    }, options);
    return;
  }

  const installResult = installSurveyToolFiles(projectRoot, options.id, payload, {
    force: Boolean(options.force),
  });

  const schema = applySurveyToolSchema(projectRoot, options.id, {
    skipMigration: Boolean(options['skip-migration']),
    skipSeed: Boolean(options['skip-seed']),
    stdio: 'inherit',
  });

  await reportInstall({
    toolId: options.id,
    version: installResult.version,
    licenseKey,
  });

  printResult({
    ...installResult,
    schema,
  }, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
