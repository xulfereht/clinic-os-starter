#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot } from './lib/survey-tool-installer.js';
import { validateSurveyToolManifest } from '../src/lib/survey-tool-runtime.ts';

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
Clinic-OS Survey Tool Check

Usage:
  npm run survey-tool:check -- [--id TOOL_ID] [--json]

Options:
  --id TOOL_ID    특정 local 검사도구만 검사
  --json          JSON 출력
  --help          도움말
`);
}

function findToolDirs(projectRoot, onlyId) {
  const localRoot = path.join(projectRoot, 'src', 'survey-tools', 'local');
  if (!fs.existsSync(localRoot)) {
    return [];
  }

  return fs.readdirSync(localRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !onlyId || entry.name === onlyId)
    .map((entry) => path.join(localRoot, entry.name));
}

function readManifest(toolDir) {
  const manifestPath = path.join(toolDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json 이 없습니다.');
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function checkCustomFile(toolDir, fileName, expected) {
  const exists = fs.existsSync(path.join(toolDir, fileName));
  if (expected && !exists) {
    return [{ level: 'error', message: `${fileName} 이 필요하지만 파일이 없습니다.` }];
  }
  return [];
}

function validateTool(toolDir) {
  const manifest = readManifest(toolDir);
  const issues = validateSurveyToolManifest(manifest);

  issues.push(...checkCustomFile(toolDir, 'survey.astro', manifest.useCustomSurvey === true || manifest.useCustomRenderer === true));
  issues.push(...checkCustomFile(toolDir, 'result.astro', manifest.useCustomResult === true || manifest.useCustomRenderer === true));
  issues.push(...checkCustomFile(toolDir, 'report.astro', manifest.useCustomReport === true));

  return {
    toolId: manifest.id || path.basename(toolDir),
    toolDir,
    issues,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }
  const projectRoot = findProjectRoot();
  const toolDirs = findToolDirs(projectRoot, typeof options.id === 'string' ? options.id : null);

  if (toolDirs.length === 0) {
    console.error('검사할 local survey tool 이 없습니다.');
    process.exit(1);
  }

  const results = toolDirs.map((toolDir) => validateTool(toolDir));
  const errorCount = results.reduce((sum, result) => sum + result.issues.filter((issue) => issue.level === 'error').length, 0);
  const warningCount = results.reduce((sum, result) => sum + result.issues.filter((issue) => issue.level === 'warning').length, 0);

  if (options.json) {
    console.log(JSON.stringify({
      tools: results,
      summary: {
        tools: results.length,
        errors: errorCount,
        warnings: warningCount,
      },
    }, null, 2));
  } else {
    for (const result of results) {
      console.log(`${result.toolId}  (${path.relative(projectRoot, result.toolDir)})`);
      if (result.issues.length === 0) {
        console.log('  - 문제 없음');
      } else {
        for (const issue of result.issues) {
          console.log(`  - [${issue.level}] ${issue.message}`);
        }
      }
    }
    console.log(`요약: errors=${errorCount}, warnings=${warningCount}`);
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
