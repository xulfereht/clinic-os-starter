import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_ROOT = path.join(__dirname, '..');

// 스타터킷 구조 감지: core/scripts/doctor.js → PROJECT_ROOT should be project root, not core/
const IS_STARTER_KIT = fs.existsSync(path.join(SCRIPT_ROOT, 'core', 'package.json'))
    || fs.existsSync(path.join(SCRIPT_ROOT, '..', 'core', 'package.json'));
const PROJECT_ROOT = (IS_STARTER_KIT && fs.existsSync(path.join(SCRIPT_ROOT, '..', 'core', 'package.json')))
    ? path.join(SCRIPT_ROOT, '..')
    : SCRIPT_ROOT;
const MIGRATIONS_DIR = IS_STARTER_KIT
    ? path.join(PROJECT_ROOT, 'core', 'migrations')
    : path.join(PROJECT_ROOT, 'migrations');

// CLI 모드 체크 (--db-only, --fix, --quiet, --schema)
const args = process.argv.slice(2);
const DB_ONLY = args.includes('--db-only');
const AUTO_FIX = args.includes('--fix');
const QUIET = args.includes('--quiet');
const SCHEMA_CHECK = args.includes('--schema');

async function checkCommand(command, versionArg = '--version') {
    try {
        const { stdout } = await execAsync(`${command} ${versionArg}`);
        return { installed: true, version: stdout.trim() };
    } catch (error) {
        return { installed: false };
    }
}

async function checkNetwork() {
    try {
        const { stdout } = await execAsync('node -e "fetch(\'https://registry.npmjs.org\').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"');
        return true;
    } catch (error) {
        return false;
    }
}

// ─────────────────────────────────────────────────────────
// Schema Parser Functions
// ─────────────────────────────────────────────────────────

/**
 * SQL 파일에서 CREATE TABLE 추출
 * @returns {Map<string, Set<string>>} tableName -> Set of columnNames
 */
function parseCreateTables(sql) {
    const tables = new Map();
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi;

    let match;
    while ((match = createTableRegex.exec(sql)) !== null) {
        const tableName = match[1].toLowerCase();
        // Strip SQL line comments to prevent comma-in-comment false positives
        const columnsDef = match[2].replace(/--[^\n]*/g, '');
        const columns = new Set();

        for (const line of splitTopLevelCommas(columnsDef)) {
            const trimmed = line.trim();
            if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s|UNIQUE\(|CHECK\s*\(|CONSTRAINT\s)/i.test(trimmed)) {
                continue;
            }
            if (trimmed.startsWith("'") || trimmed.startsWith("(")) continue;
            const colMatch = trimmed.match(/^["']?(\w+)["']?\s+\w/);
            if (colMatch) {
                columns.add(colMatch[1].toLowerCase());
            }
        }
        tables.set(tableName, columns);
    }
    return tables;
}

/**
 * SQL 파일에서 ALTER TABLE ADD COLUMN 추출
 */
function parseAlterTables(sql) {
    const alterations = [];
    const alterRegex = /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?\s+([^;]+);/gi;

    let match;
    while ((match = alterRegex.exec(sql)) !== null) {
        alterations.push({
            table: match[1].toLowerCase(),
            column: match[2].toLowerCase(),
            definition: match[3].trim()
        });
    }
    return alterations;
}

/**
 * migrations 폴더의 모든 SQL 파일을 분석하여 필요 스키마 구축
 */
function buildRequiredSchema() {
    const requiredTables = new Map();

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return { tables: requiredTables };
    }

    const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of sqlFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        const tables = parseCreateTables(sql);
        for (const [tableName, columns] of tables) {
            if (!requiredTables.has(tableName)) {
                requiredTables.set(tableName, new Set());
            }
            for (const col of columns) {
                requiredTables.get(tableName).add(col);
            }
        }

        const alterations = parseAlterTables(sql);
        for (const { table, column } of alterations) {
            if (!requiredTables.has(table)) {
                requiredTables.set(table, new Set());
            }
            requiredTables.get(table).add(column);
        }
    }

    return { tables: requiredTables };
}

/**
 * D1 명령어 실행
 */
async function runD1Query(dbName, command) {
    try {
        const { stdout } = await execAsync(
            `npx wrangler d1 execute ${dbName} --local --command "${command}" --json`,
            { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024 }
        );
        const data = JSON.parse(stdout);
        if (data && data[0] && data[0].results) {
            return data[0].results;
        }
        return [];
    } catch (e) {
        return [];
    }
}

/**
 * 괄호 깊이를 고려한 최상위 쉼표 분리 (CHECK 내부 enum 값 무시)
 */
function splitTopLevelCommas(str) {
    const parts = [];
    let depth = 0, current = '';
    for (const ch of str) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
        else current += ch;
    }
    if (current) parts.push(current);
    return parts;
}

/**
 * CREATE TABLE SQL에서 컬럼명 파싱
 */
function parseColumnsFromSQL(sql) {
    const cols = new Set();
    if (!sql) return cols;
    const match = sql.match(/\(([^]*)\)/);
    if (!match) return cols;
    for (const line of splitTopLevelCommas(match[1])) {
        const trimmed = line.trim();
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s|UNIQUE\(|CHECK\s*\(|CONSTRAINT\s)/i.test(trimmed)) continue;
        if (trimmed.startsWith("'") || trimmed.startsWith("(")) continue;
        const colMatch = trimmed.match(/^"?(\w+)"?\s+\w/);
        if (colMatch) cols.add(colMatch[1].toLowerCase());
    }
    return cols;
}

/**
 * 전체 테이블/컬럼 정보를 단일 쿼리로 조회 (wrangler 1회 호출)
 * pragma_table_info 사용 - ALTER TABLE ADD COLUMN으로 추가된 컬럼도 정확히 감지
 * (sqlite_master.sql은 ALTER TABLE 변경을 반영하지 않아 false positive 발생)
 */
async function getAllTableColumns(dbName) {
    const results = await runD1Query(dbName,
        "SELECT m.name as table_name, p.name as column_name FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'"
    );
    const tableColumns = new Map();
    for (const r of results) {
        const tbl = r.table_name.toLowerCase();
        if (!tableColumns.has(tbl)) {
            tableColumns.set(tbl, new Set());
        }
        tableColumns.get(tbl).add(r.column_name.toLowerCase());
    }
    return tableColumns;
}

/**
 * 스키마 비교 - 누락된 테이블/컬럼 찾기
 */
async function compareSchemas(dbName, required) {
    const missing = { tables: [], columns: [] };
    const allTableColumns = await getAllTableColumns(dbName);

    for (const [tableName, requiredColumns] of required.tables) {
        if (!allTableColumns.has(tableName)) {
            missing.tables.push(tableName);
            continue;
        }

        const currentColumns = allTableColumns.get(tableName);
        for (const col of requiredColumns) {
            if (!currentColumns.has(col)) {
                missing.columns.push({ table: tableName, column: col });
            }
        }
    }

    return missing;
}

/**
 * 누락된 스키마에 대한 복구 SQL 생성
 */
function generateRecoverySQL(missing) {
    const recoveryStatements = [];

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return recoveryStatements;
    }

    const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let allSql = '';
    for (const file of sqlFiles) {
        allSql += fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8') + '\n';
    }

    // 누락된 테이블 복구
    for (const tableName of missing.tables) {
        const regex = new RegExp(
            `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?${tableName}["']?\\s*\\([\\s\\S]*?\\);`,
            'gi'
        );
        const match = allSql.match(regex);
        if (match) {
            let stmt = match[0];
            if (!/IF\s+NOT\s+EXISTS/i.test(stmt)) {
                stmt = stmt.replace(/CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
            }
            recoveryStatements.push({ type: 'table', name: tableName, sql: stmt });
        }
    }

    // 누락된 컬럼 복구
    for (const { table, column } of missing.columns) {
        const alterRegex = new RegExp(
            `ALTER\\s+TABLE\\s+["']?${table}["']?\\s+ADD\\s+(?:COLUMN\\s+)?["']?${column}["']?\\s+([^;]+);`,
            'i'
        );
        const alterMatch = alterRegex.exec(allSql);

        if (alterMatch) {
            const typeDef = alterMatch[1].trim();
            recoveryStatements.push({
                type: 'column', table, column,
                sql: `ALTER TABLE "${table}" ADD COLUMN "${column}" ${typeDef};`
            });
        } else {
            const createRegex = new RegExp(
                `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?${table}["']?\\s*\\(([\\s\\S]*?)\\);`,
                'gi'
            );
            const createMatch = createRegex.exec(allSql);
            if (createMatch) {
                const columnsDef = createMatch[1];
                const colRegex = new RegExp(`["']?${column}["']?\\s+([^,]+)`, 'gi');
                const colMatch = colRegex.exec(columnsDef);
                if (colMatch) {
                    const typeDef = colMatch[1].trim();
                    recoveryStatements.push({
                        type: 'column',
                        table,
                        column,
                        sql: `ALTER TABLE "${table}" ADD COLUMN "${column}" ${typeDef};`
                    });
                }
            }
        }
    }

    return recoveryStatements;
}

/**
 * 복구 SQL 실행
 */
async function executeRecoverySQL(dbName, statements, verbose = true) {
    let successCount = 0;
    let failCount = 0;

    for (const stmt of statements) {
        if (verbose) {
            process.stdout.write(`   🔧 ${stmt.type}: ${stmt.name || stmt.column}... `);
        }

        try {
            const escapedSql = stmt.sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
            await execAsync(
                `npx wrangler d1 execute ${dbName} --local --command "${escapedSql}" --yes`,
                { cwd: PROJECT_ROOT }
            );
            successCount++;
            if (verbose) console.log('✅');
        } catch (e) {
            if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                successCount++;
                if (verbose) console.log('⏭️ (이미 존재)');
            } else {
                failCount++;
                if (verbose) console.log(`❌`);
            }
        }
    }

    return { success: failCount === 0, successCount, failCount };
}

/**
 * 스키마 Doctor - 누락된 스키마 검증 및 복구
 */
async function runSchemaDoctor(dbName, options = {}) {
    const { fix = false, verbose = true } = options;

    if (verbose) {
        console.log('\n🩺 Schema Doctor - 스키마 검증\n');
    }

    // 1. 필요 스키마 구축
    if (verbose) console.log('   📋 필요 스키마 분석 중...');
    const required = buildRequiredSchema();

    if (verbose) {
        console.log(`      → 테이블: ${required.tables.size}개`);
    }

    // 2. 현재 스키마와 비교
    if (verbose) console.log('   🔍 현재 DB 스키마와 비교 중...');
    const missing = await compareSchemas(dbName, required);

    const totalMissing = missing.tables.length + missing.columns.length;

    if (totalMissing === 0) {
        if (verbose) {
            console.log('\n   ✅ 모든 스키마가 정상입니다!\n');
        }
        return { ok: true, missing: null };
    }

    // 3. 누락 항목 리포트
    if (verbose) {
        console.log(`\n   ⚠️  누락된 스키마 발견: ${totalMissing}개\n`);

        if (missing.tables.length > 0) {
            console.log('      📦 누락된 테이블:');
            for (const t of missing.tables) {
                console.log(`         - ${t}`);
            }
        }

        if (missing.columns.length > 0) {
            console.log('      📝 누락된 컬럼:');
            for (const { table, column } of missing.columns) {
                console.log(`         - ${table}.${column}`);
            }
        }
    }

    // 4. 복구 SQL 생성
    const recoverySQL = generateRecoverySQL(missing);

    if (!fix) {
        if (verbose) {
            console.log('\n   💡 복구하려면: npm run doctor -- --fix\n');
        }
        return { ok: false, missing, recoverySQL };
    }

    // 5. 복구 실행
    if (verbose) {
        console.log('\n   🔧 스키마 복구 중...\n');
    }

    const result = await executeRecoverySQL(dbName, recoverySQL, verbose);

    if (verbose) {
        console.log(`\n      → 성공: ${result.successCount}, 실패: ${result.failCount}\n`);

        if (result.success) {
            console.log('   ✅ 스키마 복구 완료!\n');
        } else {
            console.log('   ⚠️  일부 복구 실패. 로그를 확인하세요.\n');
        }
    }

    return { ok: result.success, missing, recoverySQL, result };
}

// ─────────────────────────────────────────────────────────
// DB Doctor Functions
// ─────────────────────────────────────────────────────────

function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * wrangler.toml에서 database_name 읽기
 */
function getDbNameFromWrangler() {
    try {
        const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
        if (!fs.existsSync(wranglerPath)) return null;

        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/**
 * 로컬 D1 DB가 존재하는지 확인
 */
function checkLocalDbExists() {
    const d1Path = path.join(PROJECT_ROOT, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    if (!fs.existsSync(d1Path)) return { exists: false, path: null };

    try {
        const files = fs.readdirSync(d1Path);
        const sqliteFile = files.find(f => f.endsWith('.sqlite'));
        if (sqliteFile) {
            return { exists: true, path: path.join(d1Path, sqliteFile) };
        }
    } catch (e) {}

    return { exists: false, path: null };
}

/**
 * DB에 super_admins 테이블과 데이터가 있는지 확인
 */
async function checkDbHasData(dbName) {
    try {
        const { stdout } = await execAsync(
            `npx wrangler d1 execute ${dbName} --local --command "SELECT COUNT(*) as cnt FROM super_admins" --json`,
            { cwd: PROJECT_ROOT }
        );
        const result = JSON.parse(stdout);
        const count = result[0]?.results?.[0]?.cnt || 0;
        return { hasData: count > 0, adminCount: count };
    } catch (e) {
        return { hasData: false, adminCount: 0, error: e.message };
    }
}

/**
 * DB 상태 체크 및 리포트
 */
async function runDbDoctor() {
    if (!QUIET) {
        console.log('\n🗃️  Database Doctor\n');
        console.log('──────────────────────────────────────────────────────────');
    }

    const issues = [];
    const fixes = [];

    // 1. wrangler.toml 체크
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        issues.push({
            type: 'critical',
            message: 'wrangler.toml 파일이 없습니다',
            fix: 'npm run setup을 실행하세요'
        });
        if (!QUIET) console.log('❌ wrangler.toml: 파일 없음');
        return { ok: false, issues, fixes };
    }

    const dbName = getDbNameFromWrangler();
    if (!dbName) {
        issues.push({
            type: 'critical',
            message: 'wrangler.toml에 database_name이 없습니다',
            fix: 'wrangler.toml에 [[d1_databases]] 섹션 추가 필요'
        });
        if (!QUIET) console.log('❌ database_name: 설정 없음');
        return { ok: false, issues, fixes };
    }

    if (!QUIET) console.log(`✅ database_name: ${dbName}`);

    // 2. 플레이스홀더 체크
    const placeholders = ['my-clinic-db', 'local-clinic-db', 'your-database-id-here'];
    if (placeholders.includes(dbName)) {
        issues.push({
            type: 'warning',
            message: `DB 이름이 기본값입니다 (${dbName})`,
            fix: '고유한 DB 이름으로 변경 권장'
        });
        if (!QUIET) console.log(`⚠️  DB 이름: 기본값 사용 중 (${dbName})`);
    }

    // 3. 로컬 DB 파일 체크
    const localDb = checkLocalDbExists();
    if (!localDb.exists) {
        issues.push({
            type: 'warning',
            message: '로컬 DB 파일이 없습니다',
            fix: 'npm run db:init && npm run db:seed'
        });
        if (!QUIET) console.log('⚠️  로컬 DB: 파일 없음 (초기화 필요)');
    } else {
        if (!QUIET) console.log('✅ 로컬 DB: 파일 존재');

        // 4. DB 데이터 체크
        const dbData = await checkDbHasData(dbName);
        if (dbData.error) {
            issues.push({
                type: 'error',
                message: `DB 조회 실패: ${dbData.error}`,
                fix: 'DB 이름과 wrangler.toml 설정 확인'
            });
            if (!QUIET) console.log(`❌ DB 연결: 실패 - ${dbData.error}`);
        } else if (!dbData.hasData) {
            issues.push({
                type: 'warning',
                message: '관리자 계정이 없습니다',
                fix: 'npm run db:seed로 시드 데이터 추가'
            });
            if (!QUIET) console.log('⚠️  관리자 계정: 없음 (시드 필요)');
        } else {
            if (!QUIET) console.log(`✅ 관리자 계정: ${dbData.adminCount}개`);
        }
    }

    // 5. database_id 체크
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const idMatch = content.match(/database_id\s*=\s*"([^"]+)"/);
    const dbId = idMatch ? idMatch[1] : null;

    if (!dbId || dbId.includes('placeholder') || dbId === 'your-database-id-here') {
        if (!QUIET) console.log('ℹ️  database_id: 로컬 전용 (프로덕션 배포 시 설정 필요)');
    } else {
        if (!QUIET) console.log(`✅ database_id: ${dbId.substring(0, 8)}...`);
    }

    if (!QUIET) console.log('──────────────────────────────────────────────────────────');

    // 이슈 요약
    if (issues.length > 0) {
        if (!QUIET) {
            console.log('\n📋 발견된 이슈:');
            issues.forEach((issue) => {
                const icon = issue.type === 'critical' ? '🔴' : issue.type === 'error' ? '🟠' : '🟡';
                console.log(`   ${icon} ${issue.message}`);
                console.log(`      → ${issue.fix}`);
            });
        }

        // 자동 수정 제안
        if (AUTO_FIX && issues.some(i => i.type !== 'critical')) {
            if (!QUIET) console.log('\n🔧 자동 수정 시도 중...');
            // 간단한 수정만 자동화 (시드 데이터 등)
            const needsSeed = issues.some(i => i.message.includes('관리자 계정이 없습니다'));
            if (needsSeed && localDb.exists) {
                try {
                    await execAsync(`node scripts/db-helper.js seed`, { cwd: PROJECT_ROOT });
                    fixes.push('시드 데이터 추가됨');
                    if (!QUIET) console.log('   ✅ 시드 데이터 추가 완료');
                } catch (e) {
                    if (!QUIET) console.log('   ❌ 시드 추가 실패:', e.message);
                }
            }
        }
    } else {
        if (!QUIET) console.log('\n🎉 데이터베이스 상태 양호!');
    }

    // 6. 스키마 검증 (로컬 DB가 있을 때만)
    let schemaResult = { ok: true };
    if (localDb.exists && dbName) {
        schemaResult = await runSchemaDoctor(dbName, { fix: AUTO_FIX, verbose: !QUIET });

        if (!schemaResult.ok && schemaResult.missing) {
            issues.push({
                type: 'error',
                message: `스키마 누락: 테이블 ${schemaResult.missing.tables.length}개, 컬럼 ${schemaResult.missing.columns.length}개`,
                fix: 'npm run doctor -- --fix'
            });
        }
    }

    return {
        ok: issues.filter(i => i.type === 'critical' || i.type === 'error').length === 0 && schemaResult.ok,
        dbName,
        issues,
        fixes,
        schema: schemaResult
    };
}

// Export for use in other scripts
export { runDbDoctor, runSchemaDoctor, getDbNameFromWrangler, checkLocalDbExists };

async function runDoctor() {
    // DB-only 모드
    if (DB_ONLY) {
        const result = await runDbDoctor();
        process.exit(result.ok ? 0 : 1);
    }

    console.log('\n🏥 Clinic-OS Environment Doctor\n');
    console.log('──────────────────────────────────────────────────────────');

    const platform = os.platform();
    const arch = os.arch();
    console.log(`💻 OS: ${platform} (${arch})`);

    let hasError = false;

    // 1. Node.js Check
    const nodeCheck = await checkCommand('node');
    if (nodeCheck.installed) {
        const versionMatch = nodeCheck.version.match(/v(\d+)/);
        const versionMajor = versionMatch ? parseInt(versionMatch[1]) : 0;
        if (versionMajor < 18) {
            console.log('❌ Node.js: ' + nodeCheck.version + ' (v18+ Required)');
            hasError = true;
        } else {
            console.log('✅ Node.js: ' + nodeCheck.version);
        }
    } else {
        console.log('❌ Node.js: Not installed');
        hasError = true;
    }

    // 2. Git Check
    const gitCheck = await checkCommand('git');
    if (gitCheck.installed) {
        console.log('✅ Git: ' + gitCheck.version);
    } else {
        console.log('❌ Git: Not installed');
        hasError = true;
    }

    // 3. NPM/PNPM/Bun Check
    const npmCheck = await checkCommand('npm');
    console.log(npmCheck.installed ? `✅ NPM: ${npmCheck.version}` : '❌ NPM: Not installed');

    // 4. Wrangler Check
    const wranglerCheck = await checkCommand('npx wrangler', '--version');
    if (wranglerCheck.installed) {
        console.log('✅ Wrangler: ' + wranglerCheck.version);
    } else {
        console.log('⚠️  Wrangler: Not installed (will be used via npx)');
    }

    // 5. Network Check
    process.stdout.write('🌐 Network (Registry): Checking...');
    const isOnline = await checkNetwork();
    // When running non-interactively (e.g., via SSH), stdout may not be a TTY and
    // clearLine/cursorTo can be undefined. Guard for Windows + non-TTY.
    if (typeof process.stdout.clearLine === 'function') process.stdout.clearLine(0);
    if (typeof process.stdout.cursorTo === 'function') process.stdout.cursorTo(0);
    if (isOnline) {
        console.log('✅ Network: Connected to npm registry');
    } else {
        console.log('❌ Network: Connection failed');
        hasError = true;
    }

    console.log('──────────────────────────────────────────────────────────');

    // DB 상태 체크 추가
    const dbResult = await runDbDoctor();
    if (!dbResult.ok) {
        hasError = true;
    }

    if (hasError) {
        console.log('\n❗ Some issues were found. Please fix them to ensure stability:');

        if (!nodeCheck.installed || (nodeCheck.version && parseInt(nodeCheck.version.match(/v(\d+)/)[1]) < 18)) {
            if (platform === 'win32') {
                console.log('\n🔹 지원 플랫폼 안내:');
                console.log('   네이티브 Windows 설치는 지원하지 않습니다. WSL Ubuntu에서 Node.js를 설치하세요.');
            } else if (platform === 'darwin') {
                console.log('\n🔹 Node.js 설치 (macOS):');
                console.log('   명령어: brew install node@20');
            }
        }

        if (!gitCheck.installed) {
            if (platform === 'win32') {
                console.log('\n🔹 지원 플랫폼 안내:');
                console.log('   네이티브 Windows 설치는 지원하지 않습니다. WSL Ubuntu에서 Git을 설치하세요.');
            } else if (platform === 'darwin') {
                console.log('\n🔹 Git 설치 (macOS):');
                console.log('   명령어: brew install git');
            }
        }

        console.log('\n💡 모든 도구를 설치한 후 다시 `npm run doctor`를 실행하세요.\n');
        process.exit(1);
    } else {
        console.log('\n🎉 Your environment is ready for Clinic-OS development!');
        console.log('💡 Try `npm run dev` to start the local server.\n');
        process.exit(0);
    }
}

// Only run when executed directly (not when imported by fetch.js)
const isDirectRun = process.argv[1] && (
    process.argv[1].endsWith('/doctor.js') ||
    process.argv[1].endsWith('\\doctor.js')
);
if (isDirectRun) {
    runDoctor().catch(err => {
        console.error('Fatal error in doctor:', err);
        process.exit(1);
    });
}
