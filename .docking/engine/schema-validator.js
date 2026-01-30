/**
 * Schema Validator Module
 *
 * SPEC-CORE-001: Pre-flight 스키마 검증 및 재시도 메커니즘
 *
 * 기능:
 * - 스키마 해시 계산 (sqlite_master 기반)
 * - d1_migrations 테이블 상태 검증
 * - Bootstrap 상태 확인
 * - SQLITE_BUSY 재시도 래퍼
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// ═══════════════════════════════════════════════════════════════
// 재시도 설정 (TASK-001)
// ═══════════════════════════════════════════════════════════════

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 200, // ms
    retryableErrors: ['SQLITE_BUSY', 'database is locked', 'SQLITE_LOCKED']
};

/**
 * TASK-001: Exponential Backoff 재시도 래퍼
 *
 * SQLITE_BUSY 등 일시적 오류 발생 시 자동 재시도
 * 지연 시간: 200ms, 400ms, 800ms (Exponential Backoff)
 *
 * @param {Function} fn - 실행할 비동기 함수
 * @param {Object} config - 재시도 설정
 * @returns {Promise<any>} - 함수 실행 결과
 */
export async function executeWithRetry(fn, config = RETRY_CONFIG) {
    let lastError;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const errorMessage = error.message || error.stderr || String(error);

            const isRetryable = config.retryableErrors.some(
                pattern => errorMessage.includes(pattern)
            );

            if (isRetryable && attempt < config.maxRetries) {
                const delay = Math.pow(2, attempt) * config.baseDelay;
                console.log(`   \u23F3 SQLITE_BUSY - ${delay}ms \uD6C4 \uC7AC\uC2DC\uB3C4 (${attempt}/${config.maxRetries})`);
                await sleep(delay);
                continue;
            }

            // 최대 재시도 횟수 초과 또는 재시도 불가능한 오류
            if (isRetryable) {
                throw new Error(`\uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD69F\uC218 \uCD08\uACFC (${config.maxRetries}\uD68C): ${errorMessage}`);
            }
            throw error;
        }
    }

    throw lastError;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// 명령어 실행 헬퍼
// ═══════════════════════════════════════════════════════════════

async function runCommand(cmd, silent = false) {
    if (!silent) console.log(`   > ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: PROJECT_ROOT,
            maxBuffer: 10 * 1024 * 1024
        });
        return { success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' };
    } catch (error) {
        const stdout = error.stdout?.trim() || '';
        const stderr = error.stderr?.trim() || error.message || '';
        return { success: false, stdout, stderr };
    }
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
    return 'local-clinic-db';
}

/**
 * JSON 결과 파싱 헬퍼
 */
function parseJsonResult(result) {
    if (!result.success || !result.stdout) return [];

    try {
        const data = JSON.parse(result.stdout);
        if (data && data[0] && data[0].results) {
            return data[0].results;
        }
    } catch (e) {
        // JSON 파싱 실패
    }
    return [];
}

// ═══════════════════════════════════════════════════════════════
// TASK-003: 스키마 해시 계산
// ═══════════════════════════════════════════════════════════════

/**
 * TASK-003: 현재 DB 스키마의 해시 계산
 *
 * sqlite_master에서 모든 테이블의 CREATE 문을 조회하여
 * 정규화 후 SHA-256 해시를 계산합니다.
 *
 * @param {string} dbName - 데이터베이스 이름
 * @param {boolean} isLocal - 로컬 DB 여부
 * @returns {Promise<string>} - 16자리 해시 문자열
 */
export async function calculateSchemaHash(dbName = null, isLocal = true) {
    dbName = dbName || getDbName();
    const localFlag = isLocal ? '--local' : '--remote';

    // 1. 테이블 목록 조회 (시스템 테이블 제외)
    const tablesResult = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} ` +
        `--command "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name" --json 2>&1`,
        true
    );

    if (!tablesResult.success) {
        // DB가 비어있거나 접근 불가
        return 'empty_db';
    }

    const tables = parseJsonResult(tablesResult);

    if (tables.length === 0) {
        return 'empty_db';
    }

    // 2. CREATE 문 정규화 및 해시 계산
    const schemas = tables
        .map(t => t.sql || '')
        .filter(sql => sql.length > 0)
        .map(sql => normalizeCreateStatement(sql))
        .sort();

    // 3. SHA-256 해시 계산 (앞 16자리만 사용)
    const hash = createHash('sha256')
        .update(schemas.join('\n'))
        .digest('hex')
        .substring(0, 16);

    return hash;
}

/**
 * CREATE 문 정규화
 * - 공백 정규화
 * - 대소문자 통일
 */
function normalizeCreateStatement(sql) {
    return sql
        .replace(/\s+/g, ' ')  // 다중 공백을 단일 공백으로
        .replace(/\(\s+/g, '(')  // 괄호 내부 공백 제거
        .replace(/\s+\)/g, ')')
        .replace(/,\s+/g, ', ')
        .trim()
        .toLowerCase();
}

/**
 * 테이블 목록 조회
 */
export async function getTableList(dbName = null, isLocal = true) {
    dbName = dbName || getDbName();
    const localFlag = isLocal ? '--local' : '--remote';

    const result = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} ` +
        `--command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name" --json 2>&1`,
        true
    );

    const tables = parseJsonResult(result);
    return tables.map(t => t.name);
}

// ═══════════════════════════════════════════════════════════════
// TASK-004: Bootstrap 검증
// ═══════════════════════════════════════════════════════════════

/**
 * d1_migrations 테이블에서 적용된 마이그레이션 목록 조회
 */
export async function getAppliedMigrations(dbName = null, isLocal = true) {
    dbName = dbName || getDbName();
    const localFlag = isLocal ? '--local' : '--remote';

    const result = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} ` +
        `--command "SELECT name FROM d1_migrations ORDER BY id" --json 2>&1`,
        true
    );

    if (!result.success) {
        // 테이블이 없을 수 있음
        return [];
    }

    const migrations = parseJsonResult(result);
    return migrations.map(m => m.name);
}

/**
 * TASK-004: 마이그레이션 상태 검증 (Bootstrap 검증)
 *
 * d1_migrations 테이블이 비어있을 때 실제 스키마 상태를 검증합니다.
 * 스키마가 존재하면서 d1_migrations가 비어있으면 경고를 발생시킵니다.
 *
 * @param {Object} options - 검증 옵션
 * @returns {Promise<Object>} - 검증 결과
 */
export async function verifyMigrationState(options = {}) {
    const {
        dbName = null,
        isLocal = true,
        force = false
    } = options;

    const db = dbName || getDbName();

    // 1. d1_migrations 테이블 적용 목록 조회
    const appliedMigrations = await getAppliedMigrations(db, isLocal);
    const migrationCount = appliedMigrations.length;

    // 2. 실제 테이블 목록 조회
    const tables = await getTableList(db, isLocal);

    // 시스템/메타 테이블 제외
    const userTables = tables.filter(t =>
        !t.startsWith('d1_') &&
        !t.startsWith('_cf_')
    );

    // 3. 스키마 해시 계산
    const schemaHash = await calculateSchemaHash(db, isLocal);

    // 4. 상태 분석
    const result = {
        isValid: true,
        needsBootstrap: false,
        hasSchemaConflict: false,
        migrationCount,
        tableCount: userTables.length,
        schemaHash,
        tables: userTables,
        appliedMigrations,
        warnings: [],
        errors: []
    };

    // Case 1: 빈 d1_migrations + 빈 DB = 정상 Bootstrap
    if (migrationCount === 0 && userTables.length === 0) {
        result.needsBootstrap = true;
        result.warnings.push('\uCD5C\uCD08 \uC2E4\uD589: \uBAA8\uB4E0 \uB9C8\uC774\uADF8\uB808\uC774\uC158\uC774 \uC21C\uC11C\uB300\uB85C \uC801\uC6A9\uB429\uB2C8\uB2E4.');
        return result;
    }

    // Case 2: 빈 d1_migrations + 기존 스키마 존재 = 경고만 (차단하지 않음)
    // 기존 클라이언트 호환성을 위해 warning만 출력하고 계속 진행
    if (migrationCount === 0 && userTables.length > 0) {
        result.hasSchemaConflict = true;
        result.isValid = true; // 항상 valid - 차단하지 않음

        result.warnings.push(
            `스키마가 존재하지만 d1_migrations가 비어있습니다.`,
            `테이블 수: ${userTables.length}개 (${userTables.slice(0, 5).join(', ')}${userTables.length > 5 ? '...' : ''})`,
            `스키마 해시: ${schemaHash}`,
            `→ d1_migrations 테이블을 자동으로 초기화합니다.`
        );

        // 자동으로 needsBootstrap 설정하여 마이그레이션 트래킹 초기화
        result.needsBootstrap = true;

        return result;
    }

    // Case 3: d1_migrations에 기록 있음 = 정상 상태
    result.warnings.push(
        `\uC801\uC6A9\uB41C \uB9C8\uC774\uADF8\uB808\uC774\uC158: ${migrationCount}\uAC1C`,
        `\uD14C\uC774\uBE14 \uC218: ${userTables.length}\uAC1C`,
        `\uC2A4\uD0A4\uB9C8 \uD574\uC2DC: ${schemaHash}`
    );

    return result;
}

/**
 * 상태 리포트 출력
 */
export function printStateReport(state) {
    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
    console.log('\uD83D\uDCCA Pre-flight \uC2A4\uD0A4\uB9C8 \uAC80\uC99D \uACB0\uACFC');
    console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

    if (state.hasSchemaConflict) {
        console.log('\u26A0\uFE0F  \uC2A4\uD0A4\uB9C8 \uC0C1\uD0DC \uBD88\uC77C\uCE58 \uAC10\uC9C0');
    } else if (state.needsBootstrap) {
        console.log('\u2139\uFE0F  Bootstrap \uBAA8\uB4DC (\uCD5C\uCD08 \uC2E4\uD589)');
    } else {
        console.log('\u2705 \uC2A4\uD0A4\uB9C8 \uC0C1\uD0DC \uC815\uC0C1');
    }

    console.log('');

    for (const warning of state.warnings) {
        console.log(`   ${warning}`);
    }

    if (state.errors.length > 0) {
        console.log('');
        for (const error of state.errors) {
            console.log(`   \u274C ${error}`);
        }
    }

    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
}

// ═══════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════

export default {
    executeWithRetry,
    calculateSchemaHash,
    getTableList,
    getAppliedMigrations,
    verifyMigrationState,
    printStateReport
};
