#!/usr/bin/env node

import path from 'node:path';
import { findProjectRoot } from './lib/survey-tool-installer.js';
import { getSkinScaffoldPlan, writeSkinScaffold } from './lib/skin-scaffold.js';

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
Clinic-OS Skin Pack Scaffold

Usage:
  npm run skin:create -- --id SKIN_ID [--extends clinicLight]

Options:
  --id SKIN_ID            생성할 스킨 팩 ID
  --title TITLE           표시 이름
  --extends SKIN_ID       기반이 될 코어/기존 스킨 ID (기본값: clinicLight)
  --without-hero          Hero override 템플릿 생략
  --without-main-hero     MainHero override 템플릿 생략
  --dry-run               파일 생성 없이 계획만 출력
  --json                  JSON 출력
  --help                  도움말
`);
}

function formatPlan(plan, options) {
  if (options.json) {
    console.log(JSON.stringify({
      skinId: plan.skinId,
      title: plan.title,
      extendsSkin: plan.extendsSkin,
      targetDir: plan.targetDir,
      files: plan.files.map((file) => path.relative(process.cwd(), file.path)),
    }, null, 2));
    return;
  }

  console.log(`스킨 ID: ${plan.skinId}`);
  console.log(`제목: ${plan.title}`);
  console.log(`기반 스킨: ${plan.extendsSkin}`);
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

  const plan = getSkinScaffoldPlan({
    projectRoot: findProjectRoot(),
    skinId: String(options.id),
    title: typeof options.title === 'string' ? options.title : undefined,
    extendsSkin: typeof options.extends === 'string' ? options.extends : 'clinicLight',
    withHero: !options['without-hero'],
    withMainHero: !options['without-main-hero'],
  });

  if (options['dry-run']) {
    formatPlan(plan, options);
    return;
  }

  writeSkinScaffold(plan);
  formatPlan(plan, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
