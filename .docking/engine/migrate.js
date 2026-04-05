/**
 * Migration Runner Utility
 *
 * Core 업데이트 및 플러그인 설치 시 마이그레이션을 자동으로 실행합니다.
 *
 * 사용법:
 *   import { runMigrations, runPluginMigration } from './migrate.js';
 *
 *   // 코어 마이그레이션 실행
 *   await runMigrations({ local: true });
 *
 *   // 플러그인 마이그레이션 실행
 *   await runPluginMigration('plugin-id', '/path/to/migration.sql', { local: true });
 *
 * @see ARCHITECTURE.md#4-데이터베이스
 * @see migrations/ - 마이그레이션 SQL 파일
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find actual project root by looking for wrangler.toml first (has DB config)
 * Then falls back to other markers if wrangler.toml not found.
 * Traverses up from script location to handle both:
 * - Direct run from root (/.docking/engine/migrate.js)
 * - Run from core (/core/.docking/engine/migrate.js)
 */
function findProjectRoot(startDir) {
    let current = startDir;

    // 1차: wrangler.toml 또는 core/package.json 탐색 (스타터킷 구조 포함)
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'wrangler.toml'))) {
            return current;
        }
        if (fs.existsSync(path.join(current, 'core', 'package.json'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // 2차: 다른 마커로 fallback
    current = startDir;
    const fallbackMarkers = ['.docking/config.yaml', 'clinic.json'];
    for (let i = 0; i < 5; i++) {
        for (const marker of fallbackMarkers) {
            if (fs.existsSync(path.join(current, marker))) {
                return current;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // Fallback to original behavior (2 levels up from .docking/engine/)
    return path.join(startDir, '../..');
}

const PROJECT_ROOT = findProjectRoot(__dirname);
let errorRecoveryModulePromise = null;

// 기본 설정 (wrangler.toml에서 읽지 못할 경우의 fallback)
const DEFAULT_DB_NAME = 'clinic-os-db';

async function loadErrorRecoveryModule() {
    if (!errorRecoveryModulePromise) {
        const moduleUrl = pathToFileURL(path.join(PROJECT_ROOT, 'scripts', 'lib', 'error-recovery.mjs')).href;
        errorRecoveryModulePromise = import(moduleUrl).catch(() => null);
    }
    return errorRecoveryModulePromise;
}

async function reportMigrationError({ phase = 'migration', error, command, context = {}, recovery = {} }) {
    try {
        const helpers = await loadErrorRecoveryModule();
        const resolvedCommand = command || 'npm run db:migrate';

        if (helpers?.recordStructuredError) {
            await helpers.recordStructuredError({
                projectRoot: PROJECT_ROOT,
                phase,
                error,
                command: resolvedCommand,
                context: {
                    projectRoot: PROJECT_ROOT,
                    ...context,
                },
                recovery,
                source: 'migration-runner',
            });
            return;
        }

        const errorReport = {
            timestamp: new Date().toISOString(),
            command: resolvedCommand,
            phase,
            error: {
                message: typeof error === 'string' ? error : error?.message || String(error),
                stack: typeof error === 'object' ? error?.stack || null : null,
                code: typeof error === 'object' ? error?.code || 'UNKNOWN' : 'UNKNOWN',
            },
            context: {
                projectRoot: PROJECT_ROOT,
                ...context,
            },
            recovery,
            attempts: [],
        };
        const errorPath = path.join(PROJECT_ROOT, '.agent', 'last-error.json');
        fs.ensureDirSync(path.dirname(errorPath));
        fs.writeJsonSync(errorPath, errorReport, { spaces: 2 });
    } catch (_) {
        // 에러 보고 실패는 무시
    }
}

// ═══════════════════════════════════════════════════════════════
// SQLITE_BUSY Retry Helper
// ═══════════════════════════════════════════════════════════════

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 200, // ms
    retryableErrors: ['SQLITE_BUSY', 'database is locked', 'SQLITE_LOCKED']
};

async function executeWithRetry(fn, config = RETRY_CONFIG) {
    let lastError;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const msg = error.message || error.stderr || String(error);
            const isRetryable = config.retryableErrors.some(p => msg.includes(p));
            if (isRetryable && attempt < config.maxRetries) {
                const delay = config.baseDelay * Math.pow(2, attempt - 1);
                console.log(`   ⏳ SQLITE_BUSY - ${delay}ms 후 재시도 (${attempt}/${config.maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// ═══════════════════════════════════════════════════════════════
// ALTER TABLE Safe Execution (PRAGMA 기반 컬럼 존재 체크)
// ═══════════════════════════════════════════════════════════════

/**
 * SQL 파일에서 모든 ALTER TABLE ADD COLUMN 구문을 파싱
 * 하나의 파일에 여러 ALTER TABLE이 있는 경우 모두 추출
 * @returns {Array<{tableName: string, columnName: string, statement: string}>}
 */
function parseAllAlterTableStatements(sql) {
    const results = [];
    const regex = /ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+(\S+)\s+([^;]*);?/gi;
    let match;
    while ((match = regex.exec(sql)) !== null) {
        results.push({
            tableName: match[1].replace(/"/g, ''),
            columnName: match[2].replace(/"/g, ''),
            statement: match[0].replace(/;$/, '')
        });
    }
    return results;
}

/**
 * 테이블의 컬럼 존재 여부를 PRAGMA table_info()로 확인
 * SQLite에서 컬럼 존재를 안전하게 체크하는 유일한 방법
 */
async function columnExists(dbName, tableName, columnName, localFlag = '--local') {
    try {
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} ${localFlag} --command "PRAGMA table_info(${tableName})" --json 2>&1`,
            PROJECT_ROOT,
            true
        );
        if (result.success && result.stdout) {
            const data = JSON.parse(result.stdout);
            if (data && data[0] && data[0].results) {
                return data[0].results.some(col => col.name === columnName);
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * 단일 SQL 커맨드 실행 (ALTER TABLE 등)
 */
async function executeSqlCommand(dbName, sql, localFlag = '--local') {
    const escaped = sql.replace(/"/g, '\\"');
    return runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --command "${escaped}" --yes`,
        PROJECT_ROOT,
        true
    );
}

// ═══════════════════════════════════════════════════════════════
// Schema State Tracking
// ═══════════════════════════════════════════════════════════════

const SCHEMA_STATE_PATH = path.join(PROJECT_ROOT, '.core', 'schema-state.json');

/**
 * 스키마 상태 파일 경로
 */
function getSchemaStatePath() {
    return SCHEMA_STATE_PATH;
}

/**
 * 스키마 상태 로드
 */
function loadSchemaState() {
    try {
        if (fs.existsSync(SCHEMA_STATE_PATH)) {
            return fs.readJsonSync(SCHEMA_STATE_PATH);
        }
    } catch (e) {
        console.log('   ⚠️  schema-state.json 로드 실패, 새로 생성합니다');
    }
    return null;
}

/**
 * 스키마 상태 저장
 */
function saveSchemaState(state) {
    const coreDir = path.join(PROJECT_ROOT, '.core');
    fs.ensureDirSync(coreDir);
    fs.writeJsonSync(SCHEMA_STATE_PATH, state, { spaces: 2 });
}

/**
 * 스키마 해시 계산 (마이그레이션 파일들의 해시)
 */
function calculateSchemaHash(migrationFiles) {
    const hash = crypto.createHash('sha256');
    for (const file of migrationFiles.sort()) {
        const content = fs.readFileSync(file, 'utf8');
        hash.update(content);
    }
    return hash.digest('hex');
}

/**
 * 초기 스키마 상태 생성 (설치 시 호출)
 */
export async function initializeSchemaState(migrationsDir, dbName) {
    const migrationFiles = getMigrationFiles(migrationsDir);
    const appliedMigrations = await getAppliedMigrations({ local: true, dbName });

    const state = {
        installedAt: new Date().toISOString(),
        initialSchema: migrationFiles[0] || null,
        lastMigration: migrationFiles[migrationFiles.length - 1] || null,
        appliedMigrations: Array.from(appliedMigrations),
        migrationCount: migrationFiles.length,
        schemaHash: calculateSchemaHash(migrationFiles.map(f => path.join(migrationsDir, f))),
        version: '1.0'
    };

    saveSchemaState(state);
    console.log('   ✅ schema-state.json 초기화 완료');
    return state;
}

/**
 * 스키마 상태 업데이트 (마이그레이션 실행 후 호출)
 */
export async function updateSchemaState(migrationsDir, dbName) {
    const migrationFiles = getMigrationFiles(migrationsDir);
    const appliedMigrations = await getAppliedMigrations({ local: true, dbName });
    const currentState = loadSchemaState();

    const state = {
        ...(currentState || {}),
        lastMigration: migrationFiles[migrationFiles.length - 1] || null,
        appliedMigrations: Array.from(appliedMigrations),
        migrationCount: migrationFiles.length,
        schemaHash: calculateSchemaHash(migrationFiles.map(f => path.join(migrationsDir, f))),
        updatedAt: new Date().toISOString(),
        version: '1.0'
    };

    saveSchemaState(state);
    return state;
}

/**
 * 스키마 상태 검증
 * - 파일 시스템의 마이그레이션과 DB 기록 비교
 * - 불일치 시 복구 필요 여부 반환
 */
export async function verifySchemaState(migrationsDir, dbName) {
    const state = loadSchemaState();
    const migrationFiles = getMigrationFiles(migrationsDir);
    const appliedMigrations = await getAppliedMigrations({ local: true, dbName });

    const issues = [];

    // 1. 마이그레이션 파일 수 불일치
    if (state && state.migrationCount !== migrationFiles.length) {
        issues.push({
            type: 'count_mismatch',
            message: `마이그레이션 개수 불일치: state=${state.migrationCount}, actual=${migrationFiles.length}`,
            severity: 'warning'
        });
    }

    // 2. 해시 불일치 (파일 내용 변경됨)
    if (state && state.schemaHash) {
        const currentHash = calculateSchemaHash(migrationFiles.map(f => path.join(migrationsDir, f)));
        if (state.schemaHash !== currentHash) {
            issues.push({
                type: 'hash_mismatch',
                message: '마이그레이션 파일 내용이 변경되었습니다',
                severity: 'error'
            });
        }
    }

    // 3. DB에 없는 마이그레이션 파일
    const pendingFiles = migrationFiles.filter(f => !appliedMigrations.has(f));
    if (pendingFiles.length > 0) {
        issues.push({
            type: 'pending_migrations',
            message: `${pendingFiles.length}개 마이그레이션이 아직 적용되지 않음`,
            severity: 'info',
            files: pendingFiles
        });
    }

    // 4. DB에만 있고 파일이 없는 마이그레이션 (orphaned)
    const orphanedMigrations = Array.from(appliedMigrations).filter(m => !migrationFiles.includes(m));
    if (orphanedMigrations.length > 0) {
        issues.push({
            type: 'orphaned_migrations',
            message: `${orphanedMigrations.length}개 마이그레이션이 파일에서 사라짐`,
            severity: 'warning',
            migrations: orphanedMigrations
        });
    }

    return {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        needsRecovery: issues.some(i => i.severity === 'error'),
        issues,
        state,
        migrationFiles,
        appliedMigrations: Array.from(appliedMigrations)
    };
}

/**
 * 스키마 상태 자동 복구
 */
export async function recoverSchemaState(migrationsDir, dbName) {
    console.log('\n🩺 스키마 상태 자동 복구 중...');

    const verification = await verifySchemaState(migrationsDir, dbName);

    if (verification.valid && !verification.needsRecovery) {
        console.log('   ✅ 스키마 상태 정상');
        return { success: true, actions: [] };
    }

    const actions = [];

    for (const issue of verification.issues) {
        switch (issue.type) {
            case 'pending_migrations':
                console.log(`   🔄 대기 중인 마이그레이션 발견: ${issue.files.length}개`);
                // 마이그레이션 실행은 runMigrations에서 처리
                actions.push({ type: 'run_pending', files: issue.files });
                break;

            case 'orphaned_migrations':
                console.log(`   ⚠️  orphaned 마이그레이션: ${issue.migrations.join(', ')}`);
                actions.push({ type: 'orphaned', migrations: issue.migrations });
                break;

            case 'hash_mismatch':
            case 'count_mismatch':
                console.log(`   🔄 schema-state.json 재생성`);
                await initializeSchemaState(migrationsDir, dbName);
                actions.push({ type: 'rebuild_state' });
                break;
        }
    }

    return { success: true, actions };
}

/**
 * 명령어 실행 헬퍼
 */
function runCommand(cmd, cwd = PROJECT_ROOT, silent = false) {
    return new Promise((resolve) => {
        exec(cmd, { cwd, shell: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                if (!silent) console.error(`   ❌ Error: ${error.message}`);
                resolve({ success: false, stdout: '', stderr: stderr || error.message });
                return;
            }
            resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
        });
    });
}

/**
 * wrangler.toml에서 DB 이름 가져오기
 */
function getDbName() {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        if (match) return match[1];
    }
    return DEFAULT_DB_NAME;
}

/**
 * 적용된 마이그레이션 목록 조회
 */
async function getAppliedMigrations(options = {}) {
    const { local = true, dbName = getDbName() } = options;
    const localFlag = local ? '--local' : '--remote';

    const result = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --command "SELECT name FROM d1_migrations" --json`,
        PROJECT_ROOT,
        true
    );

    if (!result.success) {
        // 테이블이 없을 수 있음 - 빈 Set 반환
        return new Set();
    }

    try {
        const parsed = JSON.parse(result.stdout);
        if (parsed && parsed[0] && parsed[0].results) {
            return new Set(parsed[0].results.map(r => r.name));
        }
    } catch (e) {
        // JSON 파싱 실패
    }

    return new Set();
}

/**
 * 마이그레이션 파일 목록 조회 (정렬됨)
 */
function getMigrationFiles(migrationsDir) {
    if (!fs.existsSync(migrationsDir)) {
        return [];
    }

    return fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
        .sort((a, b) => {
            // 숫자 접두사로 정렬 (0000_, 0001_, 등)
            const numA = parseInt(a.match(/^(\d+)/)?.[1] || '9999');
            const numB = parseInt(b.match(/^(\d+)/)?.[1] || '9999');
            return numA - numB;
        });
}

/**
 * 단일 마이그레이션 파일의 안전한 실행
 *
 * ALTER TABLE ADD COLUMN 구문이 포함된 경우:
 *   1. PRAGMA table_info()로 컬럼 존재 여부 확인
 *   2. 이미 존재하는 컬럼은 스킵
 *   3. 누락된 컬럼만 개별 실행
 *   4. 기존 데이터는 보존됨 (ALTER TABLE ADD COLUMN은 데이터에 영향 없음)
 *
 * ALTER TABLE이 아닌 경우 (CREATE TABLE IF NOT EXISTS, INSERT 등):
 *   - 파일 전체를 그대로 실행
 *   - "already exists" 오류는 성공으로 처리
 */
async function executeMigration(filePath, options = {}) {
    const { local = true, dbName = getDbName(), verbose = false } = options;
    const localFlag = local ? '--local' : '--remote';
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
        return { success: false, error: `파일을 찾을 수 없음: ${filePath}` };
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    const alterStatements = parseAllAlterTableStatements(sql);

    // ── ALTER TABLE ADD COLUMN이 포함된 파일: 컬럼 단위 안전 실행 ──
    if (alterStatements.length > 0) {
        let addedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const { tableName, columnName, statement } of alterStatements) {
            const exists = await columnExists(dbName, tableName, columnName, localFlag);

            if (exists) {
                skippedCount++;
                if (verbose) {
                    console.log(`      ⏭️  ${tableName}.${columnName} 이미 존재 → 스킵`);
                }
                continue;
            }

            // 컬럼이 없으면 해당 ALTER TABLE만 개별 실행
            try {
                const result = await executeWithRetry(async () => {
                    const res = await executeSqlCommand(dbName, statement, localFlag);
                    if (!res.success) {
                        const errMsg = res.stderr || '';
                        if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
                            throw new Error(`SQLITE_BUSY: ${statement}`);
                        }
                        // duplicate column은 성공으로 처리 (race condition 대비)
                        if (errMsg.includes('duplicate column')) {
                            return { success: true, alreadyExists: true };
                        }
                        return res;
                    }
                    return res;
                });

                if (result.success || result.alreadyExists) {
                    addedCount++;
                    if (verbose) {
                        console.log(`      ✅ ${tableName}.${columnName} 추가됨`);
                    }
                } else {
                    errorCount++;
                    if (verbose) {
                        console.log(`      ❌ ${tableName}.${columnName}: ${result.stderr}`);
                    }
                }
            } catch (retryErr) {
                errorCount++;
                if (verbose) {
                    console.log(`      ❌ ${tableName}.${columnName}: ${retryErr.message}`);
                }
            }
        }

        // ALTER TABLE 외에 다른 SQL도 포함된 경우 (예: UPDATE, INSERT 등)
        // ALTER TABLE 구문을 제거하고 나머지만 임시 파일로 실행
        const nonAlterSql = sql.replace(/ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+\S+\s+[^;]*;?/gi, '').trim();
        if (nonAlterSql.length > 10) { // 의미 있는 SQL이 남아있으면
            // 리모트 모드에서 DML이 migrations/에 포함되어 있으면 경고 후 스킵
            if (!local && /\b(INSERT|UPDATE|DELETE)\b/i.test(nonAlterSql)) {
                console.log(`      ⚠️  [${fileName}] 리모트 모드: DML(INSERT/UPDATE/DELETE) 스킵 — migrations/에는 DDL만 허용`);
                return { success: true, skipped: true, reason: 'dml_in_remote' };
            }
            const tmpFile = path.join(PROJECT_ROOT, '.core', `_tmp_migration_${Date.now()}.sql`);
            try {
                fs.ensureDirSync(path.dirname(tmpFile));
                fs.writeFileSync(tmpFile, nonAlterSql, 'utf8');
                await executeWithRetry(async () => {
                    const res = await runCommand(
                        `npx wrangler d1 execute ${dbName} ${localFlag} --file="${tmpFile}" --yes`,
                        PROJECT_ROOT,
                        true
                    );
                    if (!res.success) {
                        const errMsg = (res.stderr || '') + (res.stdout || '');
                        if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
                            throw new Error(`SQLITE_BUSY: ${fileName}`);
                        }
                    }
                    return res;
                });
            } catch (e) {
                if (verbose) console.log(`      ⚠️  비ALTER SQL 실행 경고: ${e.message}`);
            } finally {
                try { fs.removeSync(tmpFile); } catch (_) {}
            }
        }

        // 부분 실패 시 기록하지 않음 — 다음 실행에서 재시도 가능
        if (errorCount === 0) {
            await recordMigration(dbName, fileName, localFlag);
        }
        return {
            success: errorCount === 0,
            added: addedCount,
            skipped: skippedCount,
            errors: errorCount
        };
    }

    // ── ALTER TABLE이 없는 일반 마이그레이션: 파일 전체 실행 ──

    // 리모트 모드에서 순수 DML 파일 스킵 (migrations/에는 DDL만 허용)
    if (!local && !/\b(CREATE|ALTER|DROP)\b/i.test(sql) && /\b(INSERT|UPDATE|DELETE)\b/i.test(sql)) {
        console.log(`      ⚠️  [${fileName}] 리모트 모드: 순수 DML 파일 스킵 — seeds/로 이동 필요`);
        await recordMigration(dbName, fileName, localFlag); // 기록은 하되 실행은 안 함
        return { success: true, skipped: true, reason: 'pure_dml_in_remote' };
    }

    try {
        const result = await executeWithRetry(async () => {
            const res = await runCommand(
                `npx wrangler d1 execute ${dbName} ${localFlag} --file="${filePath}" --yes`,
                PROJECT_ROOT,
                true
            );
            if (!res.success) {
                const errMsg = (res.stderr || '') + (res.stdout || '');
                if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
                    throw new Error(`SQLITE_BUSY: ${fileName}`);
                }
            }
            return res;
        });

        if (!result.success) {
            const errMsg = (result.stderr || '') + (result.stdout || '');
            if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
                await recordMigration(dbName, fileName, localFlag);
                return { success: true, skipped: true };
            }
            return { success: false, error: result.stderr };
        }

        await recordMigration(dbName, fileName, localFlag);
        return { success: true };
    } catch (retryErr) {
        return { success: false, error: retryErr.message };
    }
}

/**
 * d1_migrations 테이블에 마이그레이션 적용 기록
 */
async function recordMigration(dbName, fileName, localFlag = '--local') {
    await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --command "INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${fileName}', datetime('now'))" --yes`,
        PROJECT_ROOT,
        true
    );
}

/**
 * 코어 마이그레이션 실행
 * migrations/ 폴더의 모든 마이그레이션을 순서대로 실행
 *
 * 모든 ALTER TABLE ADD COLUMN은 PRAGMA table_info() 기반 컬럼 존재 체크 후 실행.
 * - 이미 컬럼이 있으면 스킵 + 기록 (신규 설치에서 0000에 이미 포함된 경우)
 * - 컬럼이 없으면 추가 (구버전 설치 후 업데이트 시)
 * - 기존 데이터는 항상 보존됨
 */
export async function runMigrations(options = {}) {
    const { local = true, verbose = true } = options;
    const dbName = getDbName();
    const localFlag = local ? '--local' : '--remote';

    // wrangler.toml 존재 확인 (DB 설정 필수)
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (!fs.existsSync(wranglerPath)) {
        console.log('   ❌ wrangler.toml이 없습니다. npm run setup을 먼저 실행하세요.');
        // 에러 보고서 저장 (에이전트 자동 복구용)
        try {
            await reportMigrationError({
                phase: 'precondition',
                error: 'wrangler.toml이 없습니다. npm run setup을 먼저 실행하세요.',
                command: 'npm run db:migrate',
                context: { wranglerPath },
                recovery: {
                    workflow: '.agent/workflows/troubleshooting.md',
                    section: 'precondition',
                    suggestion: 'npm run setup으로 초기 설정 실행',
                    commands: ['npm run setup:step -- --next']
                },
            });
            console.log('   📋 에러 보고서: .agent/last-error.json');
            console.log('   🤖 에이전트: .agent/workflows/troubleshooting.md를 참조하세요.');
        } catch (e) { /* 보고서 저장 실패 무시 */ }
        return { success: false, applied: 0, failed: 0, error: 'wrangler.toml 누락' };
    }

    if (verbose) {
        console.log(`\n🗃️  마이그레이션 실행 중... (${local ? 'local' : 'remote'})`);
    }

    // 마이그레이션 디렉토리 찾기 (core/ 또는 루트)
    let migrationsDir = path.join(PROJECT_ROOT, 'core/migrations');
    if (!fs.existsSync(migrationsDir)) {
        migrationsDir = path.join(PROJECT_ROOT, 'migrations');
    }

    if (!fs.existsSync(migrationsDir)) {
        if (verbose) console.log('   ⚠️  마이그레이션 폴더를 찾을 수 없습니다.');
        return { success: true, applied: 0, skipped: 0 };
    }

    // d1_migrations 테이블 보장 (최초 실행 시 없을 수 있음)
    try {
        await executeWithRetry(async () => {
            const res = await runCommand(
                `npx wrangler d1 execute ${dbName} ${localFlag} --command "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))" --yes`,
                PROJECT_ROOT,
                true
            );
            if (!res.success) {
                const errMsg = res.stderr || '';
                if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
                    throw new Error('SQLITE_BUSY: d1_migrations table creation');
                }
            }
            return res;
        });
    } catch (e) {
        if (verbose) console.log(`   ⚠️  d1_migrations 테이블 생성 실패: ${e.message}`);
    }

    // 스키마 상태 초기화 (최초 실행 시)
    const state = loadSchemaState();
    if (!state) {
        if (verbose) console.log('   📝 schema-state.json 초기화 중...');
        await initializeSchemaState(migrationsDir, dbName);
    }

    // 스키마 상태 검증 및 복구
    if (options.verify !== false) {
        const verification = await verifySchemaState(migrationsDir, dbName);
        if (!verification.valid || verification.needsRecovery) {
            if (verbose) console.log('   🩺 스키마 상태 불일치 감지, 복구 시도...');
            const recovery = await recoverSchemaState(migrationsDir, dbName);
            if (!recovery.success && verbose) {
                console.log('   ⚠️  일부 복구 작업 필요');
            }
        }
    }

    // 적용된 마이그레이션 조회
    const applied = await getAppliedMigrations({ local, dbName });

    // 마이그레이션 파일 목록
    const files = getMigrationFiles(migrationsDir);

    // 적용할 마이그레이션 필터링
    const toApply = files.filter(f => !applied.has(f));

    if (toApply.length === 0) {
        if (verbose) console.log('   ✅ 적용할 새 마이그레이션이 없습니다.');
        // 모든 마이그레이션이 기록되어 있어도 실제 컬럼이 누락될 수 있음 (구버전 버그)
        // repair 모드로 실제 스키마 정합성 검증
        if (options.repair !== false) {
            const repairResult = await repairMigrations({ local, verbose });
            if (repairResult.repaired > 0) {
                return { success: true, applied: 0, repaired: repairResult.repaired, skipped: files.length };
            }
        }
        return { success: true, applied: 0, skipped: files.length };
    }

    // ETA 추정: ALTER 파일은 ~3초, 일반 파일은 ~1.5초
    const estimatedSecs = toApply.reduce((acc, f) => {
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        return acc + (parseAllAlterTableStatements(sql).length > 0 ? 3 : 1.5);
    }, 0);

    if (verbose) {
        console.log(`   📋 ${toApply.length}개 마이그레이션 적용 예정 (PRAGMA 안전 모드)`);
        console.log(`   ⏱️  예상 소요: ~${Math.ceil(estimatedSecs)}초`);
    }

    let appliedCount = 0;
    let failedCount = 0;
    const errors = [];
    const startTime = Date.now();

    for (let i = 0; i < toApply.length; i++) {
        const file = toApply[i];
        const filePath = path.join(migrationsDir, file);
        const progress = `[${i + 1}/${toApply.length}]`;

        if (verbose) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = i > 0 ? elapsed / i : estimatedSecs / toApply.length;
            const remaining = Math.ceil(rate * (toApply.length - i));
            process.stdout.write(`   🔄 ${progress} ${file} (~${remaining}s 남음)... `);
        }

        const result = await executeMigration(filePath, { local, dbName, verbose });

        if (result.success) {
            appliedCount++;
            if (verbose) {
                if (result.skipped) {
                    console.log('⏭️');
                } else if (result.added !== undefined) {
                    console.log(`✅ (+${result.added}컬럼, ⏭️${result.skipped || 0})`);
                } else {
                    console.log('✅');
                }
            }
        } else {
            failedCount++;
            errors.push({ file, error: result.error });
            if (verbose) {
                console.log(`❌ ${result.error}`);
            }
        }
    }

    if (verbose) {
        if (failedCount > 0) {
            console.log(`   ⚠️  완료: ${appliedCount}개 성공, ${failedCount}개 실패`);
        } else {
            console.log(`   ✅ ${appliedCount}개 마이그레이션 적용 완료`);
        }
    }

    // 마이그레이션 후 repair (부분 실패 복구)
    if (options.repair !== false && failedCount > 0) {
        if (verbose) console.log('\n   🔧 실패한 마이그레이션 복구 시도...');
        await repairMigrations({ local, verbose });
    }

    // 스키마 상태 업데이트
    if (appliedCount > 0) {
        await updateSchemaState(migrationsDir, dbName);
    }

    return {
        success: failedCount === 0,
        applied: appliedCount,
        failed: failedCount,
        errors
    };
}

/**
 * 마이그레이션 복구 (Repair)
 *
 * "적용됨"으로 기록되었지만 실제 컬럼이 누락된 경우를 감지하고 복구합니다.
 * - 구버전 코드에서 errorCount 체크 없이 recordMigration을 호출한 경우
 * - SQLITE_BUSY 등으로 ALTER TABLE이 실패했지만 기록은 된 경우
 * - DB 복원/복제 시 불일치가 생긴 경우
 *
 * 모든 ALTER TABLE ADD COLUMN 구문을 가진 마이그레이션 파일을 스캔하고,
 * 각 컬럼의 실제 존재 여부를 PRAGMA로 확인합니다.
 */
export async function repairMigrations(options = {}) {
    const { local = true, verbose = true } = options;
    const dbName = getDbName();
    const localFlag = local ? '--local' : '--remote';

    if (verbose) {
        console.log(`\n🔧 마이그레이션 복구 모드 (PRAGMA 컬럼 검증)...`);
    }

    // 마이그레이션 디렉토리 찾기
    let migrationsDir = path.join(PROJECT_ROOT, 'core/migrations');
    if (!fs.existsSync(migrationsDir)) {
        migrationsDir = path.join(PROJECT_ROOT, 'migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
        if (verbose) console.log('   ⚠️  마이그레이션 폴더를 찾을 수 없습니다.');
        return { success: true, repaired: 0 };
    }

    const files = getMigrationFiles(migrationsDir);
    let repairedCount = 0;
    let checkedCount = 0;

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        const alterStatements = parseAllAlterTableStatements(sql);

        if (alterStatements.length === 0) continue;

        for (const { tableName, columnName, statement } of alterStatements) {
            checkedCount++;
            const exists = await columnExists(dbName, tableName, columnName, localFlag);

            if (!exists) {
                // 컬럼이 누락됨 — 복구 실행
                if (verbose) {
                    console.log(`   🔧 ${tableName}.${columnName} 누락 → 복구 중...`);
                }
                try {
                    const result = await executeWithRetry(async () => {
                        const res = await executeSqlCommand(dbName, statement, localFlag);
                        if (!res.success) {
                            const errMsg = res.stderr || '';
                            if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
                                throw new Error(`SQLITE_BUSY: ${statement}`);
                            }
                            if (errMsg.includes('duplicate column')) {
                                return { success: true };
                            }
                            return res;
                        }
                        return res;
                    });

                    if (result.success) {
                        repairedCount++;
                        if (verbose) console.log(`      ✅ ${tableName}.${columnName} 복구 완료`);
                    } else {
                        if (verbose) console.log(`      ❌ ${tableName}.${columnName}: ${result.stderr}`);
                    }
                } catch (e) {
                    if (verbose) console.log(`      ❌ ${tableName}.${columnName}: ${e.message}`);
                }
            }
        }
    }

    // 비-ALTER 마이그레이션 중 CREATE TABLE IF NOT EXISTS도 재실행
    // (테이블 자체가 누락된 경우 대비)
    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // CREATE TABLE IF NOT EXISTS가 있고, ALTER TABLE은 없는 파일
        if (/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(sql) && parseAllAlterTableStatements(sql).length === 0) {
            try {
                await executeWithRetry(async () => {
                    const res = await runCommand(
                        `npx wrangler d1 execute ${dbName} ${localFlag} --file="${filePath}" --yes`,
                        PROJECT_ROOT, true
                    );
                    if (!res.success) {
                        const errMsg = (res.stderr || '') + (res.stdout || '');
                        if (errMsg.includes('SQLITE_BUSY')) throw new Error('SQLITE_BUSY');
                    }
                    return res;
                });
            } catch (_) { /* 실패해도 계속 */ }
        }
    }

    if (verbose) {
        if (repairedCount > 0) {
            console.log(`   ✅ ${repairedCount}개 컬럼 복구 완료 (${checkedCount}개 검사)`);
        } else {
            console.log(`   ✅ 컬럼 누락 없음 (${checkedCount}개 검사 통과)`);
        }
    }

    return { success: true, repaired: repairedCount, checked: checkedCount };
}

/**
 * 플러그인 마이그레이션 실행
 * 특정 플러그인의 migration.sql 파일을 실행
 */
export async function runPluginMigration(pluginId, migrationPath, options = {}) {
    const { local = true, verbose = true } = options;
    const dbName = getDbName();

    if (!fs.existsSync(migrationPath)) {
        if (verbose) console.log(`   ℹ️  플러그인 ${pluginId}: 마이그레이션 파일 없음`);
        return { success: true, skipped: true };
    }

    if (verbose) {
        console.log(`   🔄 플러그인 ${pluginId} 마이그레이션 실행 중...`);
    }

    const result = await executeMigration(migrationPath, { local, dbName });

    if (result.success) {
        if (verbose) {
            console.log(`   ✅ 플러그인 ${pluginId} 마이그레이션 완료`);
        }
    } else {
        if (verbose) {
            console.log(`   ❌ 플러그인 ${pluginId} 마이그레이션 실패: ${result.error}`);
        }
    }

    return result;
}

/**
 * 플러그인 폴더의 모든 마이그레이션 실행
 */
export async function runAllPluginMigrations(options = {}) {
    const { local = true, verbose = true } = options;

    const pluginsDir = path.join(PROJECT_ROOT, 'src/plugins');
    if (!fs.existsSync(pluginsDir)) {
        return { success: true, plugins: [] };
    }

    const results = [];
    const pluginFolders = fs.readdirSync(pluginsDir).filter(f => {
        const stat = fs.statSync(path.join(pluginsDir, f));
        return stat.isDirectory();
    });

    for (const pluginId of pluginFolders) {
        const migrationPath = path.join(pluginsDir, pluginId, 'migration.sql');
        if (fs.existsSync(migrationPath)) {
            const result = await runPluginMigration(pluginId, migrationPath, { local, verbose });
            results.push({ pluginId, ...result });
        }
    }

    const failed = results.filter((result) => result.success === false).length;
    return { success: failed === 0, plugins: results, failed };
}

/**
 * CLI 직접 실행 시
 */
async function main() {
    const args = process.argv.slice(2);
    const isLocal = !args.includes('--remote');
    const verbose = !args.includes('--quiet');

    console.log('🚀 Clinic-OS Migration Runner\n');

    // 코어 마이그레이션
    const coreResult = await runMigrations({ local: isLocal, verbose });

    // 플러그인 마이그레이션
    const pluginResult = await runAllPluginMigrations({ local: isLocal, verbose });

    if (coreResult.success && pluginResult.success) {
        console.log('\n✅ 모든 마이그레이션 완료');
        process.exit(0);
    } else {
        const primaryError =
            coreResult.errors?.[0]?.error
            || pluginResult.plugins?.find((plugin) => plugin.success === false)?.error
            || '일부 마이그레이션 실패';
        await reportMigrationError({
            phase: 'migration',
            error: typeof primaryError === 'string' ? primaryError : JSON.stringify(primaryError),
            command: isLocal ? 'npm run db:migrate' : 'npm run db:migrate -- --remote',
            context: {
                local: isLocal,
                core_failed: coreResult.failed || 0,
                plugin_failed: pluginResult.failed || 0,
            },
            recovery: {
                workflow: '.agent/workflows/troubleshooting.md',
                section: 'migration',
                suggestion: 'doctor로 스키마 상태를 확인한 뒤 마이그레이션을 다시 실행하세요.',
                commands: ['npm run doctor', 'npm run db:migrate'],
            },
        });
        console.log('\n❌ 일부 마이그레이션 실패');
        process.exit(1);
    }
}

// CLI로 직접 실행 시
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
