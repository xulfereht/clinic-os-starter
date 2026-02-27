/**
 * Clinic-OS Health Audit
 *
 * 통합 건강 진단 모듈 — 독립 실행 + import 가능
 * Usage:
 *   npm run health         → 진단만
 *   npm run health:fix     → 진단 + 자동 수정
 *   import { runHealthAudit } from './scripts/health-audit.js'
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(startDir) {
    let current = startDir;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'wrangler.toml'))) return current;
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    current = startDir;
    const fallbackMarkers = ['.docking/config.yaml', 'clinic.json'];
    for (let i = 0; i < 5; i++) {
        for (const marker of fallbackMarkers) {
            if (fs.existsSync(path.join(current, marker))) return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return path.join(startDir, '..');
}

const PROJECT_ROOT = findProjectRoot(__dirname);
const IS_STARTER_KIT = fs.existsSync(path.join(PROJECT_ROOT, 'core', 'package.json'));

// ─────────────────────────────────────────────────────────
// Helper: safe read
// ─────────────────────────────────────────────────────────

function readJsonSafe(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return null; }
}

function readTextSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────
// Check 1: 버전 일관성 (package.json vs .core/version)
// ─────────────────────────────────────────────────────────

function checkVersionConsistency() {
    const result = { name: 'version_consistency', ok: true, score: 0, issues: [] };

    const pkgPath = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'package.json')
        : path.join(PROJECT_ROOT, 'package.json');
    const versionPath = path.join(PROJECT_ROOT, '.core', 'version');

    const pkg = readJsonSafe(pkgPath);
    const coreVersion = readTextSafe(versionPath);

    if (!pkg) {
        result.ok = false;
        result.score = -20;
        result.issues.push('package.json을 읽을 수 없음');
        return result;
    }

    if (!coreVersion) {
        result.ok = false;
        result.score = -10;
        result.issues.push('.core/version 파일 없음 (자동 생성 가능)');
        result.fixable = 'create_core_version';
        return result;
    }

    const pkgVer = pkg.version?.startsWith('v') ? pkg.version : `v${pkg.version}`;
    if (pkgVer !== coreVersion) {
        result.ok = false;
        result.score = -20;
        result.issues.push(`package.json(${pkgVer}) ≠ .core/version(${coreVersion})`);
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Check 2: 스타터 호환성
// ─────────────────────────────────────────────────────────

function checkStarterCompatibility() {
    const result = { name: 'starter_compatibility', ok: true, score: 0, issues: [] };

    const starterVersionPath = path.join(PROJECT_ROOT, '.core', 'starter-version');
    const starterVersion = readTextSafe(starterVersionPath);

    const pkgPath = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'package.json')
        : path.join(PROJECT_ROOT, 'package.json');
    const pkg = readJsonSafe(pkgPath);
    const minStarter = pkg?.clinicOs?.minStarterVersion;

    if (!starterVersion) {
        result.ok = false;
        result.score = -10;
        result.issues.push('.core/starter-version 파일 없음 (자동 생성 가능)');
        result.fixable = 'create_starter_version';
        return result;
    }

    if (minStarter && semverLt(starterVersion, minStarter)) {
        result.ok = false;
        result.score = -30;
        result.issues.push(`스타터 ${starterVersion} < 최소 요구 ${minStarter} → npm run update:starter 필요`);
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Check 3: 핵심 파일 존재
// ─────────────────────────────────────────────────────────

function checkCriticalFiles() {
    const result = { name: 'critical_files', ok: true, score: 0, issues: [] };

    const prefix = IS_STARTER_KIT ? 'core/' : '';
    const criticalFiles = [
        `${prefix}src/middleware.ts`,
        `${prefix}astro.config.mjs`,
        '.docking/engine/fetch.js',
        '.docking/engine/migrate.js'
    ];

    for (const file of criticalFiles) {
        const fullPath = path.join(PROJECT_ROOT, file);
        if (!fs.existsSync(fullPath)) {
            result.ok = false;
            result.score -= 15;
            result.issues.push(`핵심 파일 누락: ${file}`);
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Check 4: DB 스키마 건강 (doctor.js 재사용)
// ─────────────────────────────────────────────────────────

async function checkSchemaHealth() {
    const result = { name: 'schema_health', ok: true, score: 0, issues: [], fixable: null };

    try {
        const doctorPath = path.join(PROJECT_ROOT, 'scripts', 'doctor.js');
        if (!fs.existsSync(doctorPath)) {
            result.issues.push('doctor.js 없음 — 스키마 검증 건너뜀');
            return result;
        }

        const { getDbNameFromWrangler, checkLocalDbExists, runSchemaDoctor } = await import(doctorPath);
        const dbName = getDbNameFromWrangler();
        if (!dbName) {
            result.issues.push('wrangler.toml에 database_name 없음');
            return result;
        }

        const localDb = checkLocalDbExists();
        if (!localDb.exists) {
            result.issues.push('로컬 DB 없음 — 스키마 검증 건너뜀');
            return result;
        }

        const schemaResult = await runSchemaDoctor(dbName, { fix: false, verbose: false });
        if (!schemaResult.ok && schemaResult.missing) {
            const missingCount = schemaResult.missing.tables.length + schemaResult.missing.columns.length;
            result.ok = false;
            result.score = -(missingCount * 5);
            result.issues.push(`스키마 누락: 테이블 ${schemaResult.missing.tables.length}개, 컬럼 ${schemaResult.missing.columns.length}개`);
            result.fixable = 'schema_doctor';
        }
    } catch (e) {
        result.issues.push(`스키마 검증 오류: ${e.message}`);
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Check 5: 마이그레이션 상태
// ─────────────────────────────────────────────────────────

async function checkMigrationState() {
    const result = { name: 'migration_state', ok: true, score: 0, issues: [] };

    const migrationsDir = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'migrations')
        : path.join(PROJECT_ROOT, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        result.issues.push('마이그레이션 폴더 없음');
        return result;
    }

    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    if (sqlFiles.length === 0) return result;

    // d1_migrations 레코드 수 확인
    try {
        const { getDbNameFromWrangler } = await import(path.join(PROJECT_ROOT, 'scripts', 'doctor.js'));
        const dbName = getDbNameFromWrangler();
        if (!dbName) return result;

        // execSync is safe here — dbName comes from wrangler.toml, not user input
        const output = execSync(
            `npx wrangler d1 execute "${dbName}" --local --command "SELECT COUNT(*) as cnt FROM d1_migrations" --json`,
            { cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }
        ).toString();

        const data = JSON.parse(output);
        const appliedCount = data?.[0]?.results?.[0]?.cnt || 0;

        if (appliedCount < sqlFiles.length) {
            result.ok = false;
            result.score = -10;
            result.issues.push(`마이그레이션 불일치: 적용 ${appliedCount}개 / 파일 ${sqlFiles.length}개`);
        }
    } catch {
        // d1_migrations 테이블이 없거나 DB 접근 불가 → 경고만
        result.issues.push('마이그레이션 상태 확인 불가 (DB 접근 실패)');
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Check 6: node_modules 상태
// ─────────────────────────────────────────────────────────

function checkNodeModules() {
    const result = { name: 'node_modules', ok: true, score: 0, issues: [] };

    const nodeModules = path.join(PROJECT_ROOT, 'node_modules');
    const pkgJson = path.join(PROJECT_ROOT, 'package.json');

    if (!fs.existsSync(nodeModules)) {
        result.ok = false;
        result.score = -10;
        result.issues.push('node_modules 없음 → npm install 필요');
        result.fixable = 'npm_install';
        return result;
    }

    if (fs.existsSync(pkgJson)) {
        try {
            const pkgMtime = fs.statSync(pkgJson).mtimeMs;
            const nmMtime = fs.statSync(nodeModules).mtimeMs;
            if (pkgMtime > nmMtime) {
                result.ok = false;
                result.score = -10;
                result.issues.push('node_modules가 package.json보다 오래됨 → npm install 필요');
                result.fixable = 'npm_install';
            }
        } catch { /* stat 실패 무시 */ }
    }

    return result;
}

// ─────────────────────────────────────────────────────────
// Semver helper (minimal)
// ─────────────────────────────────────────────────────────

function parseSemver(ver) {
    const cleaned = (ver || '').replace(/^v/, '');
    const parts = cleaned.split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

function semverLt(a, b) {
    const av = parseSemver(a);
    const bv = parseSemver(b);
    if (av.major !== bv.major) return av.major < bv.major;
    if (av.minor !== bv.minor) return av.minor < bv.minor;
    return av.patch < bv.patch;
}

// ─────────────────────────────────────────────────────────
// Fix actions
// ─────────────────────────────────────────────────────────

async function applyFixes(checks, verbose) {
    const fixes = [];

    for (const check of Object.values(checks)) {
        if (!check.fixable) continue;

        switch (check.fixable) {
            case 'create_core_version': {
                const pkgPath = IS_STARTER_KIT
                    ? path.join(PROJECT_ROOT, 'core', 'package.json')
                    : path.join(PROJECT_ROOT, 'package.json');
                const pkg = readJsonSafe(pkgPath);
                if (pkg?.version) {
                    const ver = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
                    const coreDir = path.join(PROJECT_ROOT, '.core');
                    fs.mkdirSync(coreDir, { recursive: true });
                    fs.writeFileSync(path.join(coreDir, 'version'), ver);
                    fixes.push(`.core/version 생성: ${ver}`);
                    if (verbose) console.log(`   🔧 .core/version 생성: ${ver}`);
                }
                break;
            }

            case 'create_starter_version': {
                const pkgPath = IS_STARTER_KIT
                    ? path.join(PROJECT_ROOT, 'core', 'package.json')
                    : path.join(PROJECT_ROOT, 'package.json');
                const pkg = readJsonSafe(pkgPath);
                if (pkg?.version) {
                    const ver = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
                    const coreDir = path.join(PROJECT_ROOT, '.core');
                    fs.mkdirSync(coreDir, { recursive: true });
                    fs.writeFileSync(path.join(coreDir, 'starter-version'), ver);
                    fixes.push(`.core/starter-version 생성: ${ver}`);
                    if (verbose) console.log(`   🔧 .core/starter-version 생성: ${ver}`);
                }
                break;
            }

            case 'schema_doctor': {
                try {
                    const doctorPath = path.join(PROJECT_ROOT, 'scripts', 'doctor.js');
                    const { getDbNameFromWrangler, runSchemaDoctor } = await import(doctorPath);
                    const dbName = getDbNameFromWrangler();
                    if (dbName) {
                        if (verbose) console.log('   🔧 스키마 복구 실행 중...');
                        const fixResult = await runSchemaDoctor(dbName, { fix: true, verbose });
                        if (fixResult.ok) {
                            fixes.push('스키마 복구 완료');
                        } else {
                            fixes.push('스키마 복구 부분 성공');
                        }
                    }
                } catch (e) {
                    if (verbose) console.log(`   ⚠️  스키마 복구 실패: ${e.message}`);
                }
                break;
            }

            case 'npm_install': {
                if (verbose) console.log('   🔧 npm install 실행 중...');
                try {
                    execSync('npm install', { cwd: PROJECT_ROOT, stdio: verbose ? 'inherit' : 'pipe', timeout: 120000 });
                    fixes.push('npm install 완료');
                } catch (e) {
                    if (verbose) console.log(`   ⚠️  npm install 실패: ${e.message}`);
                }
                break;
            }
        }
    }

    return fixes;
}

// ─────────────────────────────────────────────────────────
// Schema hash (optional)
// ─────────────────────────────────────────────────────────

async function getSchemaHash() {
    try {
        const svPath = path.join(PROJECT_ROOT, '.docking/engine/schema-validator.js');
        if (!fs.existsSync(svPath)) return null;
        const { calculateSchemaHash } = await import(svPath);
        const { getDbNameFromWrangler } = await import(path.join(PROJECT_ROOT, 'scripts', 'doctor.js'));
        const dbName = getDbNameFromWrangler();
        if (!dbName) return null;
        return await calculateSchemaHash(dbName, true);
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────
// Main: runHealthAudit
// ─────────────────────────────────────────────────────────

export async function runHealthAudit(options = {}) {
    const { quiet = false, fix = false } = options;
    const verbose = !quiet;

    if (verbose) {
        console.log('\n🏥 Clinic-OS Health Audit\n');
        console.log('════════════════════════════════════════════');
    }

    // Run all checks
    const checks = {};

    checks.version_consistency = checkVersionConsistency();
    checks.starter_compatibility = checkStarterCompatibility();
    checks.critical_files = checkCriticalFiles();
    checks.schema_health = await checkSchemaHealth();
    checks.migration_state = await checkMigrationState();
    checks.node_modules = checkNodeModules();

    // Calculate score
    let score = 100;
    const allIssues = [];

    for (const [key, check] of Object.entries(checks)) {
        score += check.score; // scores are negative deductions
        for (const issue of check.issues) {
            allIssues.push({ check: key, issue, fixable: !!check.fixable });
        }
    }

    score = Math.max(0, Math.min(100, score));

    // Print results
    if (verbose) {
        for (const [key, check] of Object.entries(checks)) {
            const icon = check.ok ? '✅' : '⚠️';
            const name = {
                version_consistency: '버전 일관성',
                starter_compatibility: '스타터 호환성',
                critical_files: '핵심 파일',
                schema_health: 'DB 스키마',
                migration_state: '마이그레이션',
                node_modules: 'node_modules'
            }[key] || key;

            console.log(`   ${icon} ${name}`);
            for (const issue of check.issues) {
                console.log(`      → ${issue}`);
            }
        }

        console.log('\n════════════════════════════════════════════');

        const scoreIcon = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
        console.log(`\n   ${scoreIcon} 건강 점수: ${score}/100\n`);
    }

    // Fix mode
    let fixes = [];
    if (fix && allIssues.some(i => i.fixable)) {
        if (verbose) console.log('🔧 자동 수정 시작...\n');
        fixes = await applyFixes(checks, verbose);
        if (verbose && fixes.length > 0) {
            console.log(`\n   ✅ ${fixes.length}개 항목 수정 완료\n`);
        }
    } else if (verbose && allIssues.some(i => i.fixable)) {
        console.log('💡 자동 수정 가능한 항목이 있습니다: npm run health:fix\n');
    }

    // Gather metadata
    const pkgPath = IS_STARTER_KIT
        ? path.join(PROJECT_ROOT, 'core', 'package.json')
        : path.join(PROJECT_ROOT, 'package.json');
    const pkg = readJsonSafe(pkgPath);
    const coreVersion = readTextSafe(path.join(PROJECT_ROOT, '.core', 'version'));
    const starterVersion = readTextSafe(path.join(PROJECT_ROOT, '.core', 'starter-version'));
    let schemaHash = null;
    try { schemaHash = await getSchemaHash(); } catch { /* ignore */ }

    return {
        score,
        issues: allIssues,
        checks,
        fixes,
        coreVersion: coreVersion || null,
        starterVersion: starterVersion || null,
        packageVersion: pkg?.version || null,
        schemaHash,
        nodeVersion: process.version,
        os: `${os.platform()}-${os.arch()}`
    };
}

// ─────────────────────────────────────────────────────────
// CLI Entry
// ─────────────────────────────────────────────────────────

const isDirectRun = process.argv[1] && (
    process.argv[1].endsWith('/health-audit.js') ||
    process.argv[1].endsWith('\\health-audit.js')
);

if (isDirectRun) {
    const args = process.argv.slice(2);
    const fix = args.includes('--fix');
    const quiet = args.includes('--quiet');

    runHealthAudit({ fix, quiet }).then(result => {
        process.exit(result.score >= 50 ? 0 : 1);
    }).catch(err => {
        console.error('Health audit failed:', err);
        process.exit(1);
    });
}
