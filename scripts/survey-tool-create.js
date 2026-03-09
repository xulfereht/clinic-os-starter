#!/usr/bin/env node

import path from 'node:path';
import { findProjectRoot } from './lib/survey-tool-installer.js';
import { getSurveyToolScaffoldPlan, writeSurveyToolScaffold } from './lib/survey-tool-scaffold.js';

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
Clinic-OS Survey Tool Scaffold

Usage:
  npm run survey-tool:create -- --id TOOL_ID [--mode manifest|hybrid|custom]

Options:
  --id TOOL_ID           생성할 검사도구 ID
  --title TITLE          표시 이름
  --mode MODE            manifest | hybrid | custom (기본값: manifest)
  --with-report          report.astro 템플릿도 같이 생성
  --dry-run              파일 생성 없이 계획만 출력
  --json                 JSON 출력
  --help                 도움말
`);
}

function formatPlan(plan, options) {
  if (options.json) {
    console.log(JSON.stringify({
      toolId: plan.toolId,
      title: plan.title,
      mode: plan.mode,
      withReport: plan.withReport,
      targetDir: plan.targetDir,
      files: plan.files.map((file) => path.relative(process.cwd(), file.path)),
    }, null, 2));
    return;
  }

  console.log(`검사도구 ID: ${plan.toolId}`);
  console.log(`제목: ${plan.title}`);
  console.log(`모드: ${plan.mode}`);
  console.log(`대상: ${plan.targetDir}`);
  console.log('생성 파일:');
  for (const file of plan.files) {
    console.log(`- ${path.relative(process.cwd(), file.path)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help || !options.id) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const mode = typeof options.mode === 'string' ? options.mode : 'manifest';
  if (!['manifest', 'hybrid', 'custom'].includes(mode)) {
    console.error('Error: mode는 manifest, hybrid, custom 중 하나여야 합니다.');
    process.exit(1);
  }

  const plan = getSurveyToolScaffoldPlan({
    projectRoot: findProjectRoot(),
    toolId: String(options.id),
    title: typeof options.title === 'string' ? options.title : undefined,
    mode,
    withReport: Boolean(options['with-report']),
  });

  if (options['dry-run']) {
    formatPlan(plan, options);
    return;
  }

  writeSurveyToolScaffold(plan);
  formatPlan(plan, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
