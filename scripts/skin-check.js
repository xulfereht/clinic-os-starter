#!/usr/bin/env node

import { findProjectRoot } from './lib/survey-tool-installer.js';
import { formatSkinCheckResult, runSkinCheck } from './lib/skin-check.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;

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
Clinic-OS Skin Check

Usage:
  npm run skin:check -- [--id SKIN_ID] [--source core|store|local] [--json] [--strict]

Options:
  --id SKIN_ID      특정 스킨만 검사
  --source SOURCE   core | store | local 중 하나만 검사
  --json            JSON 출력
  --strict          warning 도 실패로 간주
  --help            도움말
`);
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    return;
  }

  const projectRoot = findProjectRoot();
  const result = runSkinCheck(projectRoot, {
    id: typeof options.id === 'string' ? options.id : null,
    source: typeof options.source === 'string' ? options.source : null,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatSkinCheckResult(result));
  }

  const shouldFailOnWarnings = options.strict === true;
  if (result.summary.errors > 0 || (shouldFailOnWarnings && result.summary.warnings > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
