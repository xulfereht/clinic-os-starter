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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// 기본 설정 (wrangler.toml에서 읽지 못할 경우의 fallback)
const DEFAULT_DB_NAME = 'clinic-os-db';

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
 * 단일 마이그레이션 파일 실행
 */
async function executeMigration(filePath, options = {}) {
    const { local = true, dbName = getDbName() } = options;
    const localFlag = local ? '--local' : '--remote';
    const fileName = path.basename(filePath);

    // 파일이 존재하는지 확인
    if (!fs.existsSync(filePath)) {
        return { success: false, error: `파일을 찾을 수 없음: ${filePath}` };
    }

    // SQL 실행
    const result = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --file="${filePath}" --yes`,
        PROJECT_ROOT,
        true
    );

    if (!result.success) {
        // "already exists" 오류는 무시 (멱등성)
        if (result.stderr?.includes('already exists')) {
            return { success: true, skipped: true };
        }
        return { success: false, error: result.stderr };
    }

    // d1_migrations 테이블에 기록
    const recordResult = await runCommand(
        `npx wrangler d1 execute ${dbName} ${localFlag} --command "INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${fileName}', datetime('now'))"`,
        PROJECT_ROOT,
        true
    );

    return { success: true };
}

/**
 * 코어 마이그레이션 실행
 * migrations/ 폴더의 모든 마이그레이션을 순서대로 실행
 */
export async function runMigrations(options = {}) {
    const { local = true, verbose = true } = options;
    const dbName = getDbName();

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

    // 적용된 마이그레이션 조회
    const applied = await getAppliedMigrations({ local, dbName });

    // 마이그레이션 파일 목록
    const files = getMigrationFiles(migrationsDir);

    // 적용할 마이그레이션 필터링
    const toApply = files.filter(f => !applied.has(f));

    if (toApply.length === 0) {
        if (verbose) console.log('   ✅ 적용할 새 마이그레이션이 없습니다.');
        return { success: true, applied: 0, skipped: files.length };
    }

    if (verbose) {
        console.log(`   📋 ${toApply.length}개 마이그레이션 적용 예정...`);
    }

    let appliedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const file of toApply) {
        const filePath = path.join(migrationsDir, file);

        if (verbose) {
            process.stdout.write(`   🔄 ${file}... `);
        }

        const result = await executeMigration(filePath, { local, dbName });

        if (result.success) {
            appliedCount++;
            if (verbose) {
                console.log(result.skipped ? '⏭️ (이미 적용됨)' : '✅');
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

    return {
        success: failedCount === 0,
        applied: appliedCount,
        failed: failedCount,
        errors
    };
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

    return { success: true, plugins: results };
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
        console.log('\n❌ 일부 마이그레이션 실패');
        process.exit(1);
    }
}

// CLI로 직접 실행 시
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
