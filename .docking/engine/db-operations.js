/**
 * Database operations for core:pull — D1 local DB management
 *
 * Handles: ensureLocalDb, migrations, seeds, orphan recovery, sample cleanup.
 * All functions receive dependencies as parameters (no global state).
 *
 * Extracted from fetch.js.
 */

import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Create a DB operations context bound to a project.
 * @param {Object} deps - External dependencies
 * @param {string} deps.projectRoot - Project root directory
 * @param {boolean} deps.isStarterKit - Whether running in starter kit structure
 * @param {Function} deps.runCommand - Bound runCommand(cmd, silent, timeout)
 * @param {Object|null} deps.migrateEngine - Optional migrate.js module
 * @returns {Object} All DB operation functions
 */
export function createDbOperations({ projectRoot, isStarterKit, runCommand, migrateEngine }) {

    function getDbNameFromWrangler() {
        const wranglerPath = path.join(projectRoot, 'wrangler.toml');
        if (!fs.existsSync(wranglerPath)) return 'clinic-os-db';
        const content = fs.readFileSync(wranglerPath, 'utf8');
        const match = content.match(/database_name\s*=\s*"([^"]+)"/);
        return match ? match[1] : 'clinic-os-db';
    }

    async function runNewMigrations(migrationFiles) {
        // 하위 호환성 유지 — 실제로는 runAllMigrations 사용
        if (migrationFiles.length > 0) {
            console.log(`\n🗃️  새 마이그레이션 ${migrationFiles.length}개 감지됨 (전체 마이그레이션 체크로 처리)`);
        }
    }

    /**
     * 현재 wrangler 설정으로 활성화된 DB 파일 경로 찾기
     */
    function findActiveDbFile(d1StateDir, dbName) {
        try {
            const files = fs.readdirSync(d1StateDir)
                .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'))
                .map(f => ({
                    name: f,
                    path: path.join(d1StateDir, f),
                    mtime: fs.statSync(path.join(d1StateDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            return files.length > 0 ? files[0].path : null;
        } catch {
            return null;
        }
    }

    /**
     * 로컬 D1 DB 준비 상태 확인 및 자동 초기화
     *
     * 핵심 원칙: 기존 데이터는 절대 삭제하지 않는다.
     */
    async function ensureLocalDb() {
        const wranglerPath = path.join(projectRoot, 'wrangler.toml');
        if (!fs.existsSync(wranglerPath)) {
            console.log('\n⚠️  wrangler.toml이 없습니다. npm run setup을 먼저 실행하세요.');
            return false;
        }

        const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
        const dbIdMatch = wranglerContent.match(/database_id\s*=\s*"([^"]+)"/);
        const dbNameMatch = wranglerContent.match(/database_name\s*=\s*"([^"]+)"/);

        if (!dbIdMatch || dbIdMatch[1].includes('your-') || dbIdMatch[1].includes('placeholder')) {
            console.log('\n⚠️  D1 데이터베이스가 설정되지 않았습니다.');
            console.log('   npm run setup을 먼저 실행하세요.');
            console.log('   마이그레이션/시드를 건너뜁니다.\n');
            return false;
        }

        const dbName = dbNameMatch ? dbNameMatch[1] : 'clinic-os-db';
        const d1StateDir = path.join(projectRoot, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

        // Case 1: 현재 설정으로 DB 접근 시도
        try {
            execFileSync(
                'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
                { cwd: projectRoot, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
            );
            await recoverOrphanedData(d1StateDir, dbName);
            return true;
        } catch {
            // DB 접근 실패 — 아래에서 복구 시도
        }

        // Case 2: .wrangler/ 안에 기존 DB 파일이 있는지 스캔
        if (fs.existsSync(d1StateDir)) {
            const recovered = await recoverExistingDb(d1StateDir, dbName);
            if (recovered) return true;
        }

        // Case 3: DB가 전혀 없음 → 빈 DB 생성
        console.log(`\n🔧 로컬 D1 데이터베이스 생성 중... (${dbName})`);
        try {
            execFileSync(
                'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
                { cwd: projectRoot, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
            );
            console.log('   ✅ 빈 DB 생성 완료');
            return true;
        } catch (e) {
            const errMsg = (e.stderr || e.message || '').slice(0, 200);
            console.log(`   ⚠️  DB 생성 실패: ${errMsg}`);
            console.log('   npm run db:init → npm run db:migrate → npm run db:seed\n');
            return false;
        }
    }

    /**
     * .wrangler/state/v3/d1/ 안에서 데이터가 있는 고아 SQLite 파일 찾기
     */
    async function recoverOrphanedData(d1StateDir, dbName) {
        if (!fs.existsSync(d1StateDir)) return;

        try {
            const sqliteFiles = fs.readdirSync(d1StateDir)
                .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'));

            if (sqliteFiles.length <= 1) return;

            const activeDbFile = findActiveDbFile(d1StateDir, dbName);

            let activeTableCount = 0;
            try {
                const result = execFileSync(
                    'npx', ['wrangler', 'd1', 'execute', dbName, '--local',
                        '--command', "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
                        '--json', '--yes'],
                    { cwd: projectRoot, encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
                );
                const parsed = JSON.parse(result);
                if (parsed?.[0]?.results?.[0]?.cnt) {
                    activeTableCount = parsed[0].results[0].cnt;
                }
            } catch { /* ignore */ }

            if (activeTableCount > 10) return;

            let bestCandidate = null;
            let bestSize = 0;

            for (const file of sqliteFiles) {
                const filePath = path.join(d1StateDir, file);
                if (activeDbFile && filePath === activeDbFile) continue;
                const stat = fs.statSync(filePath);
                if (stat.size > 100 * 1024 && stat.size > bestSize) {
                    bestSize = stat.size;
                    bestCandidate = filePath;
                }
            }

            if (!bestCandidate) return;

            console.log(`\n🔍 고아 데이터베이스 발견 (${(bestSize / 1024 / 1024).toFixed(1)}MB)`);
            console.log(`   경로: ${path.basename(bestCandidate)}`);
            console.log('   기존 데이터를 현재 DB로 복구합니다...');

            if (activeTableCount === 0 && activeDbFile) {
                const backupPath = activeDbFile + '.empty-backup';
                fs.copySync(activeDbFile, backupPath);
                fs.copySync(bestCandidate, activeDbFile);
                console.log('   ✅ 기존 데이터 복구 완료 (스키마는 마이그레이션에서 업데이트)');

                const walFile = bestCandidate + '-wal';
                const shmFile = bestCandidate + '-shm';
                if (fs.existsSync(walFile)) fs.copySync(walFile, activeDbFile + '-wal');
                if (fs.existsSync(shmFile)) fs.copySync(shmFile, activeDbFile + '-shm');
            } else if (activeTableCount > 0) {
                console.log(`   ℹ️  현재 DB에 ${activeTableCount}개 테이블 존재 — 고아 DB 복구 건너뜀`);
                console.log(`   💡 수동 복구가 필요하면: ${bestCandidate}`);
            }
        } catch (e) {
            console.log(`   ⚠️  고아 DB 복구 건너뜀: ${e.message}`);
        }
    }

    /**
     * .wrangler/ 안에 DB 파일은 있지만 현재 wrangler 설정으로 접근 안 되는 경우
     */
    async function recoverExistingDb(d1StateDir, dbName) {
        try {
            const sqliteFiles = fs.readdirSync(d1StateDir)
                .filter(f => f.endsWith('.sqlite') && !f.endsWith('-shm') && !f.endsWith('-wal'));

            if (sqliteFiles.length === 0) return false;

            let bestFile = null;
            let bestSize = 0;

            for (const file of sqliteFiles) {
                const filePath = path.join(d1StateDir, file);
                const stat = fs.statSync(filePath);
                if (stat.size > bestSize) {
                    bestSize = stat.size;
                    bestFile = filePath;
                }
            }

            if (!bestFile || bestSize < 1024) return false;

            const sizeMB = (bestSize / 1024 / 1024).toFixed(1);
            console.log(`\n🔍 기존 데이터베이스 발견 (${sizeMB}MB) — 현재 설정으로 연결 중...`);

            try {
                execFileSync(
                    'npx', ['wrangler', 'd1', 'execute', dbName, '--local', '--command', 'SELECT 1', '--yes'],
                    { cwd: projectRoot, encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
                );
            } catch {
                console.log('   ⚠️  DB 생성 실패');
                return false;
            }

            const newActiveFile = findActiveDbFile(d1StateDir, dbName);
            if (newActiveFile && newActiveFile !== bestFile) {
                fs.copySync(bestFile, newActiveFile);
                const walFile = bestFile + '-wal';
                const shmFile = bestFile + '-shm';
                if (fs.existsSync(walFile)) fs.copySync(walFile, newActiveFile + '-wal');
                if (fs.existsSync(shmFile)) fs.copySync(shmFile, newActiveFile + '-shm');

                console.log('   ✅ 기존 데이터 연결 완료 (스키마는 마이그레이션에서 최신화)');
            } else {
                console.log('   ✅ 기존 DB 직접 사용');
            }

            return true;
        } catch (e) {
            console.log(`   ⚠️  DB 복구 실패: ${e.message}`);
            return false;
        }
    }

    async function ensureMigrationsTable(dbName) {
        const createTableSql = `CREATE TABLE IF NOT EXISTS d1_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at TEXT DEFAULT (datetime('now'))
        )`;
        await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "${createTableSql}" --yes 2>&1`,
            true
        );
    }

    async function getAppliedMigrations(dbName) {
        try {
            const result = await runCommand(
                `npx wrangler d1 execute ${dbName} --local --command "SELECT name FROM d1_migrations ORDER BY id" --json 2>&1`,
                true
            );

            if (result.success && result.stdout) {
                const data = JSON.parse(result.stdout);
                if (data && data[0] && data[0].results) {
                    return new Set(data[0].results.map(r => r.name));
                }
            }
        } catch (e) {
            // 테이블이 없거나 파싱 실패 시 빈 Set 반환
        }
        return new Set();
    }

    async function recordMigration(dbName, migrationName) {
        await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${migrationName}')" --yes 2>&1`,
            true
        );
    }

    async function updateSchemaDoc() {
        const scriptPath = path.join(projectRoot, 'scripts/generate-schema-doc.js');
        if (!fs.existsSync(scriptPath)) {
            return;
        }

        console.log('\n📝 스키마 문서 갱신 중...');
        const result = await runCommand(`node "${scriptPath}" 2>&1`, true);
        if (result.success) {
            console.log('   ✅ SCHEMA.md 갱신 완료');
        }
    }

    /**
     * 마이그레이션 실행 — migrate.js 통합 엔진 사용
     */
    async function runAllMigrations(forceBootstrap = false) {
        // migrate.js 통합 엔진 사용
        if (migrateEngine) {
            console.log('\n🗃️  통합 마이그레이션 엔진 실행 (PRAGMA 안전 모드)');
            try {
                const result = await migrateEngine.runMigrations({
                    local: true,
                    verbose: true,
                    verify: true
                });

                if (result.applied > 0) {
                    await updateSchemaDoc();
                }

                if (!result.success) {
                    console.log(`   ⚠️  일부 마이그레이션 실패 (${result.failed}개)`);
                    if (result.errors) {
                        for (const err of result.errors) {
                            console.log(`      - ${err.file}: ${err.error}`);
                        }
                    }
                }
                return result;
            } catch (e) {
                console.log(`   ⚠️  통합 엔진 오류, fallback 사용: ${e.message}`);
            }
        }

        // ── Fallback: migrate.js가 없을 때 기본 동작 ──
        const dbName = getDbNameFromWrangler();

        const migrationsDir = isStarterKit
            ? path.join(projectRoot, 'core', 'migrations')
            : path.join(projectRoot, 'migrations');

        if (!fs.existsSync(migrationsDir)) {
            console.log('\n⚠️  마이그레이션 폴더 없음');
            return { success: false, applied: 0, failed: 0, error: '마이그레이션 폴더 없음' };
        }

        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (migrationFiles.length === 0) {
            console.log('\n✅ 마이그레이션 파일 없음');
            return { success: true, applied: 0, failed: 0 };
        }

        await ensureMigrationsTable(dbName);
        const appliedMigrations = await getAppliedMigrations(dbName);
        const pendingMigrations = migrationFiles.filter(f => !appliedMigrations.has(f));

        if (pendingMigrations.length === 0) {
            console.log(`\n🗃️  마이그레이션 (${migrationFiles.length}개 파일) — 모두 적용됨`);
            return { success: true, applied: 0, failed: 0 };
        }

        console.log(`\n🗃️  마이그레이션 (${pendingMigrations.length}개 적용 예정, fallback 모드)`);

        let applied = 0;
        let errors = 0;

        for (const fileName of pendingMigrations) {
            const filePath = path.join(migrationsDir, fileName);
            const result = await runCommand(
                `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes 2>&1`,
                true
            );
            const output = (result.stdout || '') + (result.stderr || '');

            if (result.success || output.includes('already exists') || output.includes('duplicate')) {
                applied++;
                await recordMigration(dbName, fileName);
                console.log(`   ✅ ${fileName}`);
            } else {
                errors++;
                console.log(`   ❌ ${fileName}: ${output.substring(0, 100)}`);
            }
        }

        console.log(`   → 적용: ${applied}, 오류: ${errors}`);
        if (applied > 0) {
            await updateSchemaDoc();
        }

        return { success: errors === 0, applied, failed: errors };
    }

    async function ensureSeedsTable(dbName) {
        const createTableSql = `CREATE TABLE IF NOT EXISTS d1_seeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at TEXT DEFAULT (datetime('now'))
        )`;
        await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "${createTableSql}" --yes 2>&1`,
            true
        );
    }

    async function getAppliedSeeds(dbName) {
        try {
            const result = await runCommand(
                `npx wrangler d1 execute ${dbName} --local --command "SELECT name FROM d1_seeds ORDER BY id" --json 2>&1`,
                true
            );

            if (result.success && result.stdout) {
                const data = JSON.parse(result.stdout);
                if (data && data[0] && data[0].results) {
                    return new Set(data[0].results.map(r => r.name));
                }
            }
        } catch (e) {
            // 테이블이 없거나 파싱 실패 시 빈 Set 반환
        }
        return new Set();
    }

    async function recordSeed(dbName, seedName) {
        await runCommand(
            `npx wrangler d1 execute ${dbName} --local --command "INSERT OR IGNORE INTO d1_seeds (name) VALUES ('${seedName}')" --yes 2>&1`,
            true
        );
    }

    async function runAllSeeds() {
        const dbName = getDbNameFromWrangler();

        const seedsDir = isStarterKit
            ? path.join(projectRoot, 'core', 'seeds')
            : path.join(projectRoot, 'seeds');

        if (!fs.existsSync(seedsDir)) {
            console.log(`\n🌱 Seeds 폴더 없음: ${seedsDir}`);
            return;
        }

        // 항상 제외되는 seeds
        const SKIP_SEEDS = [
            'go_live.sql',
            'seed_digestive_content.sql',
            'screenshot_sample_data.sql',
        ];

        // 샘플/더미 데이터 seeds (개발용, 클라이언트 제외)
        const SAMPLE_SEEDS = [
            'generated_faqs.sql',
            'prepare_samples.sql',
            'knowledge_cards.sql',
            'knowledge_seed.sql',
            'program_translations_sample.sql',
        ];

        const seedFiles = fs.readdirSync(seedsDir)
            .filter(f => f.endsWith('.sql'))
            .filter(f => !SKIP_SEEDS.includes(f))
            .filter(f => {
                if (isStarterKit) {
                    if (f.startsWith('sample_') || f.startsWith('dummy_') || f.startsWith('screenshot_')) return false;
                    if (SAMPLE_SEEDS.includes(f)) return false;
                }
                return true;
            })
            .sort();

        if (seedFiles.length === 0) {
            return;
        }

        await ensureSeedsTable(dbName);
        const appliedSeeds = await getAppliedSeeds(dbName);
        const pendingSeeds = seedFiles.filter(f => !appliedSeeds.has(f));

        if (pendingSeeds.length === 0) {
            console.log(`\n🌱 Seeds (${seedFiles.length}개 파일)`);
            console.log(`   → 모든 seeds 이미 적용됨`);
            return;
        }

        console.log(`\n🌱 Seeds 적용 중... (${pendingSeeds.length}/${seedFiles.length}개)`);

        let appliedCount = 0;
        let errorCount = 0;

        for (const fileName of pendingSeeds) {
            const filePath = path.join(seedsDir, fileName);

            try {
                const result = await runCommand(
                    `npx wrangler d1 execute ${dbName} --local --file="${filePath}" --yes 2>&1`,
                    true
                );

                const output = result.stderr || result.stdout || '';

                if (result.success) {
                    await recordSeed(dbName, fileName);
                    console.log(`   ✅ ${fileName}`);
                    appliedCount++;
                } else {
                    if (output.includes('UNIQUE constraint failed')) {
                        await recordSeed(dbName, fileName);
                        console.log(`   ⏭️  ${fileName}: 데이터 이미 존재 (트래킹 등록)`);
                        appliedCount++;
                    } else {
                        const errorLines = output.split('\n').filter(l =>
                            l.includes('ERROR') || l.includes('error') || l.includes('Parse error') || l.includes('SQLITE')
                        );
                        const errorMsg = errorLines.length > 0
                            ? errorLines.slice(0, 3).join('\n      ')
                            : output.substring(0, 300) || '실행 실패 (상세 오류 없음)';
                        console.log(`   ⚠️  ${fileName}: 실행 실패`);
                        console.log(`      └─ ${errorMsg}`);
                        errorCount++;
                    }
                }
            } catch (e) {
                console.log(`   ❌ ${fileName}: ${e.message}`);
                errorCount++;
            }
        }

        console.log(`   → 적용: ${appliedCount}, 오류: ${errorCount}`);

        if (isStarterKit) {
            await cleanupSampleData(dbName);
        }
    }

    async function cleanupSampleData(dbName) {
        const appliedSeeds = await getAppliedSeeds(dbName);

        const sampleSeedNames = [...appliedSeeds].filter(name =>
            name.startsWith('sample_') || name.startsWith('dummy_') ||
            name === 'generated_faqs.sql' || name === 'prepare_samples.sql' ||
            name === 'knowledge_cards.sql' || name === 'knowledge_seed.sql' ||
            name === 'program_translations_sample.sql'
        );

        if (sampleSeedNames.length === 0) return;

        console.log(`\n🧹 샘플 데이터 정리 중... (${sampleSeedNames.length}개 시드 감지)`);

        const cleanupSql = [
            'DELETE FROM patients WHERE is_sample = 1;',
            'DELETE FROM reservations WHERE is_sample = 1;',
            'DELETE FROM payments WHERE is_sample = 1;',
            'DELETE FROM posts WHERE is_sample = 1;',
            'DELETE FROM medical_records WHERE is_sample = 1;',
            'DELETE FROM knowledge_cards WHERE is_sample = 1;',
            'DELETE FROM faq_items WHERE is_sample = 1;',
            'DELETE FROM vendors WHERE is_sample = 1;',
            'DELETE FROM inventory_items WHERE is_sample = 1;',
            'DELETE FROM products WHERE is_sample = 1;',
            'DELETE FROM promotions WHERE is_sample = 1;',
            'DELETE FROM manual_pages WHERE is_sample = 1;',
            'DELETE FROM tasks WHERE is_sample = 1;',
            'DELETE FROM task_templates WHERE is_sample = 1;',
            'DELETE FROM leads WHERE is_sample = 1;',
            'DELETE FROM programs WHERE is_sample = 1;',
            "DELETE FROM web_members WHERE id LIKE 'member_sample_%';",
            "DELETE FROM site_settings WHERE category = 'features' AND key = 'sample_mode';",
        ].join('\n');

        const tmpFile = path.join(projectRoot, '.cleanup_sample_data.sql');
        try {
            fs.writeFileSync(tmpFile, cleanupSql, 'utf8');
            const result = await runCommand(
                `npx wrangler d1 execute ${dbName} --local --file="${tmpFile}" --yes 2>&1`,
                true
            );
            const output = result.stderr || result.stdout || '';
            if (result.success) {
                console.log(`   ✅ is_sample = 1 데이터 삭제 완료`);
            } else {
                console.log(`   ⚠️  일부 테이블 정리 실패 (무시): ${output.substring(0, 200)}`);
            }
        } catch (e) {
            console.log(`   ⚠️  샘플 데이터 정리 실패 (무시): ${e.message}`);
        } finally {
            try { fs.unlinkSync(tmpFile); } catch (_) {}
        }

        for (const seedName of sampleSeedNames) {
            try {
                await runCommand(
                    `npx wrangler d1 execute ${dbName} --local --command "DELETE FROM d1_seeds WHERE name = '${seedName}'" --yes 2>&1`,
                    true
                );
            } catch (e) { /* ignore */ }
        }

        console.log(`   ✅ ${sampleSeedNames.length}개 샘플 시드 기록 제거 완료`);
    }

    return {
        runNewMigrations,
        ensureLocalDb,
        runAllMigrations,
        runAllSeeds,
        cleanupSampleData,
        updateSchemaDoc,
    };
}
