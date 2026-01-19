#!/usr/bin/env node
/**
 * Feature Migration Helper
 *
 * 기능의 데이터베이스 마이그레이션을 관리합니다.
 *
 * Usage:
 *   npm run feature:migrate -- --name vip-management           # 로컬 DB에 적용
 *   npm run feature:migrate -- --name vip-management --remote  # 프로덕션 DB에 적용
 *   npm run feature:migrate -- --all                           # 모든 기능 마이그레이션
 *   npm run feature:migrate -- --status                        # 마이그레이션 상태 확인
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const featuresDir = path.join(projectRoot, 'src', 'features');

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  return options;
}

// Get all features
function getAllFeatures() {
  if (!fs.existsSync(featuresDir)) return [];

  return fs.readdirSync(featuresDir)
    .filter(f => {
      const featurePath = path.join(featuresDir, f);
      return fs.statSync(featurePath).isDirectory() &&
             fs.existsSync(path.join(featurePath, 'manifest.json'));
    });
}

// Check if migration file exists
function getMigrationFile(featureName) {
  const migrationPath = path.join(featuresDir, featureName, 'migration.sql');
  return fs.existsSync(migrationPath) ? migrationPath : null;
}

// Read migration file and extract table names
function extractTables(migrationPath) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const tableMatches = content.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/gi);
  return [...tableMatches].map(m => m[1]);
}

// Run migration
function runMigration(featureName, remote = false) {
  const migrationPath = getMigrationFile(featureName);

  if (!migrationPath) {
    console.error(`❌ Migration file not found for feature: ${featureName}`);
    return false;
  }

  const tables = extractTables(migrationPath);
  const nonCustomTables = tables.filter(t => !t.startsWith('custom_'));

  if (nonCustomTables.length > 0) {
    console.error(`\n⚠️  경고: custom_ 접두사가 없는 테이블이 있습니다:`);
    nonCustomTables.forEach(t => console.error(`   - ${t}`));
    console.error(`\n   코어 테이블과 충돌을 방지하려면 custom_ 접두사를 사용하세요.`);

    const readline = require('readline');
    // For simplicity, just warn but proceed
    console.error(`   계속 진행합니다...\n`);
  }

  console.log(`\n📦 Feature: ${featureName}`);
  console.log(`📄 Migration: ${migrationPath}`);
  console.log(`📊 Tables: ${tables.join(', ') || 'none'}`);
  console.log(`🎯 Target: ${remote ? 'REMOTE (Production)' : 'LOCAL'}\n`);

  const dbName = 'clinic-os-dev';
  const localFlag = remote ? '' : '--local';

  try {
    const cmd = `npx wrangler d1 execute ${dbName} ${localFlag} --file="${migrationPath}"`;
    console.log(`> ${cmd}\n`);

    execSync(cmd, {
      cwd: projectRoot,
      stdio: 'inherit'
    });

    console.log(`\n✅ Migration completed for ${featureName}`);
    return true;
  } catch (err) {
    console.error(`\n❌ Migration failed for ${featureName}`);
    return false;
  }
}

// Show migration status
function showStatus() {
  const features = getAllFeatures();

  if (features.length === 0) {
    console.log('\n📦 No features found.');
    console.log('   Create a feature: npm run create:feature -- --name my-feature\n');
    return;
  }

  console.log('\n📦 Feature Migration Status\n');
  console.log('─'.repeat(70));
  console.log(`${'Feature'.padEnd(25)} ${'Migration'.padEnd(15)} ${'Tables'.padEnd(30)}`);
  console.log('─'.repeat(70));

  for (const feature of features) {
    const migrationPath = getMigrationFile(feature);
    let status = '❌ No file';
    let tables = '-';

    if (migrationPath) {
      const tableList = extractTables(migrationPath);
      status = '✅ Ready';
      tables = tableList.length > 0 ? tableList.slice(0, 3).join(', ') : 'none';
      if (tableList.length > 3) tables += ` (+${tableList.length - 3})`;
    }

    console.log(`${feature.padEnd(25)} ${status.padEnd(15)} ${tables.padEnd(30)}`);
  }

  console.log('─'.repeat(70));
  console.log('\nCommands:');
  console.log('  npm run feature:migrate -- --name <feature>          Apply to local');
  console.log('  npm run feature:migrate -- --name <feature> --remote Apply to production');
  console.log('  npm run feature:migrate -- --all                     Apply all to local\n');
}

// Main
const options = parseArgs();

if (options.status) {
  showStatus();
} else if (options.all) {
  const features = getAllFeatures();
  const remote = options.remote || false;

  console.log(`\n🚀 Running all migrations (${remote ? 'REMOTE' : 'LOCAL'})...\n`);

  let success = 0;
  let failed = 0;

  for (const feature of features) {
    if (getMigrationFile(feature)) {
      if (runMigration(feature, remote)) {
        success++;
      } else {
        failed++;
      }
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`✅ Success: ${success}, ❌ Failed: ${failed}`);
} else if (options.name) {
  const remote = options.remote || false;
  runMigration(options.name, remote);
} else {
  console.log(`
Feature Migration Helper

Usage:
  npm run feature:migrate -- --status                    Show migration status
  npm run feature:migrate -- --name <feature>            Apply to local DB
  npm run feature:migrate -- --name <feature> --remote   Apply to production DB
  npm run feature:migrate -- --all                       Apply all to local DB
  npm run feature:migrate -- --all --remote              Apply all to production DB

Database Schema Rules:
  1. Use 'custom_' prefix for all tables
  2. Never modify core tables directly
  3. Reference core tables with foreign keys

Example:
  npm run feature:migrate -- --name vip-management
`);
}
