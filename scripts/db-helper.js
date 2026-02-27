#!/usr/bin/env node
/**
 * DB Helper - wrangler.toml에서 DB 이름을 읽어 명령 실행
 *
 * Usage:
 *   node scripts/db-helper.js init              # schema_full.sql 실행
 *   node scripts/db-helper.js seed              # seeds/sample_clinic.sql 실행
 *   node scripts/db-helper.js exec <file>       # 지정된 SQL 파일 실행
 *   node scripts/db-helper.js migrate           # 마이그레이션 적용
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * wrangler.toml에서 database_name 읽기
 */
function getDbName() {
    try {
        const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) return match[1];
    } catch (e) {
        console.error('⚠️  wrangler.toml을 읽을 수 없습니다:', e.message);
    }
    return 'my-clinic-db'; // 기본값
}

/**
 * wrangler d1 명령 실행
 */
function runWranglerD1(dbName, args, options = {}) {
    const cmd = `npx wrangler d1 ${args.join(' ')}`.replace('${DB_NAME}', dbName);
    console.log(`\n🔧 DB: ${dbName}`);
    console.log(`> ${cmd}\n`);

    try {
        execSync(cmd, {
            cwd: PROJECT_ROOT,
            stdio: 'inherit',
            ...options
        });
        return true;
    } catch (error) {
        console.error(`\n❌ 명령 실패: ${cmd}`);
        return false;
    }
}

/**
 * SQL 파일 실행
 */
function executeSqlFile(dbName, filePath, isRemote = false) {
    const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(PROJECT_ROOT, filePath);

    if (!fs.existsSync(fullPath)) {
        console.error(`❌ 파일을 찾을 수 없습니다: ${fullPath}`);
        process.exit(1);
    }

    const localFlag = isRemote ? '' : '--local';
    return runWranglerD1(dbName, ['execute', dbName, localFlag, `--file="${fullPath}"`].filter(Boolean));
}

/**
 * 마이그레이션 적용
 */
function applyMigrations(dbName, isRemote = false) {
    const localFlag = isRemote ? '' : '--local';
    return runWranglerD1(dbName, ['migrations', 'apply', dbName, localFlag].filter(Boolean));
}

// Main
const args = process.argv.slice(2);
const command = args[0];
const dbName = getDbName();

switch (command) {
    case 'init':
        console.log('📦 스키마 초기화 중...');
        if (!executeSqlFile(dbName, 'schema_full.sql')) {
            // schema_full.sql이 없으면 migrations 시도
            const schemaPath = path.join(PROJECT_ROOT, 'schema_full.sql');
            if (!fs.existsSync(schemaPath)) {
                console.log('⚠️  schema_full.sql이 없습니다. migrations를 적용합니다.');
                applyMigrations(dbName);
            }
        }
        break;

    case 'seed':
        console.log('🌱 시드 데이터 삽입 중...');
        executeSqlFile(dbName, 'seeds/sample_clinic.sql');
        break;

    case 'exec':
        const sqlFile = args[1];
        if (!sqlFile) {
            console.error('❌ SQL 파일 경로가 필요합니다.');
            console.error('   사용법: node scripts/db-helper.js exec <file.sql>');
            process.exit(1);
        }
        const isRemote = args.includes('--remote');
        executeSqlFile(dbName, sqlFile, isRemote);
        break;

    case 'migrate':
        console.log('🔄 마이그레이션 적용 중...');
        const remote = args.includes('--remote');
        applyMigrations(dbName, remote);
        break;

    case 'name':
        // DB 이름만 출력 (스크립트에서 사용)
        console.log(dbName);
        break;

    default:
        console.log(`
DB Helper - wrangler.toml 기반 데이터베이스 관리

현재 DB: ${dbName}

사용법:
  npm run db:init       스키마 초기화 (schema_full.sql)
  npm run db:seed       시드 데이터 삽입 (seeds/sample_clinic.sql)
  npm run db:migrate    마이그레이션 적용

고급:
  node scripts/db-helper.js exec <file.sql>           로컬 DB에 SQL 실행
  node scripts/db-helper.js exec <file.sql> --remote  원격 DB에 SQL 실행
  node scripts/db-helper.js name                      DB 이름 출력
`);
}
