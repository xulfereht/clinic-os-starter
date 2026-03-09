#!/usr/bin/env node

import {
  findProjectRoot,
  reportIssueToSupport,
} from './lib/issue-reporting.js';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const inlineIndex = arg.indexOf('=');
    if (inlineIndex !== -1) {
      options[arg.slice(2, inlineIndex)] = arg.slice(inlineIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    const value = next && !next.startsWith('--') ? next : true;
    options[key] = value;
    if (value !== true) index += 1;
  }

  return options;
}

function printHelp() {
  console.log(`
Clinic-OS Agent Issue Reporter

Usage:
  npm run agent:report-issue -- --auto
  npm run agent:report-issue -- --dry-run --json

Options:
  --auto                 반복/고위험 이슈일 때만 실제 제출
  --dry-run              로컬 payload와 recurrence 판단만 출력
  --json                 JSON 형태로 출력
  --force                duplicate/appended 이슈 대신 새 bug report 생성
  --no-append            유사 이슈가 있어도 append 하지 않고 duplicate 정보만 반환
  --license KEY          clinic.json 대신 사용할 라이선스 키
  --support-url URL      support agent 기본 URL 대신 사용할 주소
  --title TEXT           수동 제목
  --description TEXT     수동 설명
  --severity LEVEL       low|medium|high|critical
  --command TEXT         재현 시 실행한 명령
  --help                 도움말
`);
}

function printResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`mode: ${result.mode}`);
  console.log(`title: ${result.title || '-'}`);
  console.log(`phase: ${result.phase || '-'}`);
  console.log(`severity: ${result.severity || '-'}`);
  console.log(`fingerprint: ${result.fingerprint || '-'}`);
  console.log(`occurrence_count: ${result.occurrence_count ?? 0}`);

  if (result.reason) {
    console.log(`reason: ${result.reason}`);
  }

  if (result.mode === 'created') {
    console.log(`bug: ${result.internal_id}`);
    if (result.github_issue_url) {
      console.log(`github: ${result.github_issue_url}`);
    }
    return;
  }

  if (result.mode === 'append-duplicate') {
    console.log(`duplicate_bug: ${result.bugId}`);
    console.log(`message: ${result.message}`);
    return;
  }

  if (result.mode === 'duplicate-detected') {
    console.log(`duplicate_count: ${result.potential_duplicates?.length || 0}`);
    return;
  }

  if (result.mode === 'preview') {
    console.log(`support_url: ${result.support_url}`);
    console.log(`has_license_key: ${result.has_license_key ? 'yes' : 'no'}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const projectRoot = findProjectRoot();
  const result = await reportIssueToSupport(projectRoot, {
    auto: Boolean(options.auto),
    dryRun: Boolean(options['dry-run']),
    force: Boolean(options.force),
    appendDuplicate: !options['no-append'],
    license: options.license ? String(options.license) : undefined,
    supportUrl: options['support-url'] ? String(options['support-url']) : undefined,
    title: options.title ? String(options.title) : undefined,
    description: options.description ? String(options.description) : undefined,
    severity: options.severity ? String(options.severity) : undefined,
    command: options.command ? String(options.command) : undefined,
  });

  printResult(result, options);

  if (!result.success && result.mode !== 'preview' && result.mode !== 'skipped' && result.mode !== 'noop') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
