/**
 * deploy-guard.js — Clinic-OS deploy pipeline (preflight + deploy)
 *
 * Usage:
 *   node scripts/deploy-guard.js                    # Interactive (prompts before deploy)
 *   node scripts/deploy-guard.js --non-interactive   # Preflight only, no deploy
 *   node scripts/deploy-guard.js --non-interactive --yes  # CI: preflight + auto-deploy
 *   node scripts/deploy-guard.js --yes               # Interactive preflight, auto-deploy
 *
 * Flags:
 *   --non-interactive   Skip all prompts (CI mode). Without --yes, only runs preflight.
 *   --yes, -y           Auto-confirm deploy step.
 *   --skip-secrets      Skip secret binding check (implied by --non-interactive).
 *   --skip-e2e          Skip E2E tests.
 *   --allow-target-change  Allow deploying to a different CF project than recorded.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import {
    createProtectionSnapshot,
    detectTargetDrift,
    loadRecordedDeploymentTarget,
    parseWranglerDeploymentTarget,
    recordDeploymentTarget
} from './lib/deployment-safety.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const CLI_ARGS = new Set(process.argv.slice(2));
const IS_NON_INTERACTIVE = CLI_ARGS.has('--non-interactive') || process.env.CI === 'true';
const AUTO_YES = CLI_ARGS.has('--yes') || CLI_ARGS.has('-y');
const SKIP_SECRETS = CLI_ARGS.has('--skip-secrets') || IS_NON_INTERACTIVE;
const ALLOW_TARGET_CHANGE = CLI_ARGS.has('--allow-target-change');
const LAST_DEPLOY_FILE = path.join(PROJECT_ROOT, '.agent', 'last-deploy.json');

const OPTIONAL_SECRETS = ['ALIGO_API_KEY', 'ALIGO_USER_ID', 'ALIGO_SENDER', 'GOOGLE_AUTH_SECRET'];

async function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function runCommand(cmd, silent = false, timeoutMs = 120000) {
    if (!silent) console.log(`   Running: ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: PROJECT_ROOT, timeout: timeoutMs });
        return { success: true, stdout, stderr };
    } catch (error) {
        if (error.killed) {
            error.message = `타임아웃 (${Math.round(timeoutMs/1000)}초): ${cmd}`;
        }
        return { success: false, error };
    }
}

function resolvePagesBuildOutputDir(tomlContent) {
    const match = tomlContent.match(/pages_build_output_dir\s*=\s*"([^"]+)"/);
    if (!match?.[1]) {
        return {
            relative: 'dist',
            absolute: path.join(PROJECT_ROOT, 'dist')
        };
    }

    const relativePath = match[1].replace(/^\.\//, '');
    return {
        relative: relativePath,
        absolute: path.resolve(PROJECT_ROOT, relativePath)
    };
}

function writeLastDeployReport(report) {
    fs.ensureDirSync(path.dirname(LAST_DEPLOY_FILE));
    fs.writeJsonSync(LAST_DEPLOY_FILE, report, { spaces: 2 });
}

async function getGitHeadShortSha() {
    const result = await runCommand('git rev-parse --short HEAD', true);
    if (!result.success) return null;
    return result.stdout.trim() || null;
}

async function getLatestProductionDeployment(projectName) {
    const result = await runCommand(`npx wrangler pages deployment list --project-name ${projectName} --json`, true);
    if (!result.success) return null;

    try {
        const parsed = JSON.parse(result.stdout || '[]');
        return parsed.find((entry) => entry?.Environment === 'Production') || null;
    } catch {
        return null;
    }
}

const PLACEHOLDER_VALUES = [
    'YOUR_DATABASE_ID_HERE',
    'your-database-id-here',
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    '00000000-0000-0000-0000-000000000000',
];

const DANGEROUS_DEFAULTS = {
    ADMIN_PASSWORD: ['change-me-in-production', 'admin', 'password', '1234', 'changeme'],
};
const ALIGO_PLACEHOLDERS = new Set([
    '',
    'your-aligo-api-key',
    'your-aligo-username',
    '02-000-0000',
]);

function extractVarValue(tomlContent, key) {
    return tomlContent.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]?.trim() || '';
}

async function deployGuard() {
    console.log("\n🛡️  Clinic-OS Deployment Guardrails v2.0\n");
    console.log("═══════════════════════════════════════════════════════════\n");
    let warnings = 0;
    let blockers = 0;

    // 0.5 건강 검진 (검증만 — 수리는 core:pull/setup이 담당)
    try {
        const healthPath = path.join(PROJECT_ROOT, 'scripts', 'health-audit.js');
        if (fs.existsSync(healthPath)) {
            const { runHealthAudit } = await import(healthPath);
            const health = await runHealthAudit({ quiet: false });
            if (health.score < 50) {
                console.error(`\n❌ 건강 점수 ${health.score}/100 — 배포를 중단합니다.`);
                if (health.issues?.length) {
                    console.log('   차단 이슈:');
                    for (const issue of health.issues) {
                        console.log(`      - ${issue.issue}`);
                    }
                }
                console.log('\n   💡 해결 방법:');
                console.log('      npm run health:fix    (자동 복구 시도)');
                console.log('      npm run core:pull     (코어 재동기화)');
                console.log('      npm install           (의존성 갱신)\n');
                process.exit(1);
            }
        }
    } catch {
        // health-audit.js 없으면 건너뜀
    }

    // 0.6 코어 import 무결성 검사 (비코어 경로 참조 감지)
    try {
        const { checkCoreImports } = await import('./check-core-imports.js');
        const importCheck = await checkCoreImports({ quiet: false });
        if (!importCheck.ok) {
            console.error(`\n❌ 코어 파일이 비코어 경로를 참조 — 클라이언트 빌드 실패 위험`);
            console.log('   💡 .docking/protection-manifest.yaml에 누락 경로를 추가하세요.\n');
            blockers++;
        }
    } catch {
        // check-core-imports.js 없으면 건너뜀
    }

    // 0.7 이미지 경로 무결성 검사 (DB 경로 ↔ 파일 존재 확인)
    try {
        const { checkImagePaths } = await import('./check-image-paths.js');
        const imgCheck = await checkImagePaths({ quiet: false });
        if (!imgCheck.ok) {
            const staffMissing = imgCheck.missing.filter(m => m.staff);
            console.error(`\n⚠️  DB에 등록된 이미지 ${imgCheck.missing.length}건의 파일이 없습니다.`);
            for (const m of imgCheck.missing) {
                const label = m.program ? `${m.program}/${m.section}` : `staff/${m.staff}`;
                console.log(`      ${label}: ${m.path}`);
            }
            console.log('   💡 이미지 파일을 public/local/images/에 배치하거나 DB 경로를 수정하세요.\n');
            if (staffMissing.length > 0) {
                blockers++;
            } else {
                warnings++;
            }
        }
        if (imgCheck.warnings?.length) {
            for (const w of imgCheck.warnings) console.log(`   ⚠️  ${w}`);
            warnings++;
        }
    } catch {
        // check-image-paths.js 없으면 건너뜀
    }

    // 1. Check Wrangler Login
    console.log("👤 Step 1: Cloudflare 로그인 확인...");
    const whoami = await runCommand('npx wrangler whoami', true);
    if (!whoami.success) {
        if (process.env.CLOUDFLARE_API_TOKEN) {
            console.log("   ✅ CLOUDFLARE_API_TOKEN 토큰 인증 모드로 진행합니다.\n");
        } else {
            console.error("❌ Cloudflare에 로그인되어 있지 않습니다.");
            console.log("   명령어를 실행하세요: npx wrangler login\n");
            process.exit(1);
        }
    } else {
        console.log("   ✅ 로그인 확인됨.\n");
    }

    // 2. Parse wrangler.toml
    console.log("📂 Step 2: 설정 파일 분석...");
    const tomlPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    if (!fs.existsSync(tomlPath)) {
        console.error("❌ wrangler.toml 파일을 찾을 수 없습니다. /setup-clinic 을 실행했는지 확인하세요.");
        process.exit(1);
    }

    const tomlContent = await fs.readFile(tomlPath, 'utf8');
    const currentTarget = parseWranglerDeploymentTarget(PROJECT_ROOT);
    const recordedTarget = loadRecordedDeploymentTarget(PROJECT_ROOT);
    const targetDrift = detectTargetDrift(currentTarget, recordedTarget);
    const projectName = currentTarget.project_name;
    const dbId = currentTarget.database_id;
    const bucketName = currentTarget.bucket_name;
    const buildOutput = resolvePagesBuildOutputDir(tomlContent);
    const dbNameMatch = tomlContent.match(/database_name\s*=\s*"([^"]+)"/);
    const dbName = dbNameMatch ? dbNameMatch[1] : null;
    const dbIdentifier = dbName || dbId;

    if (!projectName) {
        console.error("❌ wrangler.toml에서 Pages 프로젝트 이름을 찾을 수 없습니다.");
        process.exit(1);
    }
    console.log(`   ✅ 프로젝트: ${projectName}`);

    if (targetDrift.risky_fields.length > 0) {
        console.error(`   ❌ 마지막 배포 기록과 연결 대상이 다릅니다: ${targetDrift.risky_fields.join(', ')}`);
        if (!ALLOW_TARGET_CHANGE) {
            console.log('      💡 다른 D1/R2/Pages 프로젝트에 연결될 수 있어 배포를 차단합니다.');
            console.log('      💡 의도된 변경이면 snapshot 확인 후 --allow-target-change로 재실행하세요.\n');
            blockers++;
        } else {
            console.log('      ⚠️  --allow-target-change 플래그로 차단을 해제했습니다.');
            warnings++;
        }
    }

    // DG1: database_id 플레이스홀더 검증
    if (!dbId || PLACEHOLDER_VALUES.some(p => dbId.toLowerCase() === p.toLowerCase())) {
        console.error(`   ❌ database_id가 플레이스홀더입니다: "${dbId || '(없음)'}"`);
        console.log('      💡 wrangler.toml에서 실제 D1 database_id를 설정하세요.');
        console.log('      💡 npx wrangler d1 create <이름> 으로 DB를 생성할 수 있습니다.\n');
        blockers++;
    } else {
        console.log(`   ✅ DB ID: ${dbId}`);
    }

    if (!bucketName) {
        console.log(`   ⚠️  R2 버킷 미설정 (이미지 업로드 불가)`);
        warnings++;
    } else {
        console.log(`   ✅ 버킷: ${bucketName}`);
    }
    console.log("");

    // 2.1 Check CLOUDFLARE_URL Environment Variable
    console.log("🔗 Step 2.1: CLOUDFLARE_URL 확인...");
    const cloudflareUrlMatch = tomlContent.match(/CLOUDFLARE_URL\s*=\s*"([^"]+)"/);
    const cloudflareUrl = cloudflareUrlMatch ? cloudflareUrlMatch[1] : null;
    const defaultPagesUrl = `https://${projectName}.pages.dev`;

    if (!cloudflareUrl) {
        console.log(`   ⚠️  CLOUDFLARE_URL 미설정 → 기본값 사용: ${defaultPagesUrl}`);
        console.log("   💡 커스텀 도메인 연결 후 wrangler.toml [vars]에 추가하거나,");
        console.log("      관리자 페이지(설정 > 기본정보)에서 수정할 수 있습니다.\n");
    } else {
        console.log(`   ✅ CLOUDFLARE_URL: ${cloudflareUrl}`);
    }

    // DG12: astro.config.mjs site URL 고정값 검증
    try {
        const astroConfigPath = path.join(PROJECT_ROOT, 'astro.config.mjs');
        if (fs.existsSync(astroConfigPath)) {
            const astroContent = await fs.readFile(astroConfigPath, 'utf8');
            const siteMatch = astroContent.match(/site:\s*['"]([^'"]+)['"]/);
            if (siteMatch) {
                const siteUrl = siteMatch[1];
                if (siteUrl.includes('sample-clinic') || siteUrl.includes('example.com') || siteUrl.includes('localhost')) {
                    console.log(`   ⚠️  astro.config.mjs site: "${siteUrl}" — 템플릿 기본값입니다.`);
                    console.log('      💡 실제 도메인 또는 Pages URL로 변경하면 SEO/sitemap이 개선됩니다.');
                    warnings++;
                }
            }
        }
    } catch { /* ignore */ }
    console.log("");

    // 2.2 보안 설정 검증 (DG5 + DG9)
    console.log("🔒 Step 2.2: 보안 설정 검증...");

    // DG5: ADMIN_PASSWORD 기본값 검증
    const adminPwdMatch = tomlContent.match(/ADMIN_PASSWORD\s*=\s*"([^"]+)"/);
    const adminPwd = adminPwdMatch ? adminPwdMatch[1] : null;
    if (adminPwd && DANGEROUS_DEFAULTS.ADMIN_PASSWORD.includes(adminPwd.toLowerCase())) {
        console.error(`   ❌ ADMIN_PASSWORD가 기본값("${adminPwd}")입니다 — 프로덕션 배포 차단`);
        console.log('      💡 wrangler.toml [vars]에서 강력한 비밀번호로 변경하세요.');
        blockers++;
    } else if (adminPwd) {
        console.log("   ✅ ADMIN_PASSWORD 설정됨 (기본값 아님)");
    } else {
        console.log("   ⚠️  ADMIN_PASSWORD 미설정 — 로그인 불가할 수 있음");
        warnings++;
    }

    // DG9: ALIGO_TESTMODE 프로덕션 경고
    const testMode = extractVarValue(tomlContent, 'ALIGO_TESTMODE');
    const aligoApiKey = extractVarValue(tomlContent, 'ALIGO_API_KEY');
    const aligoUserId = extractVarValue(tomlContent, 'ALIGO_USER_ID');
    const aligoSender = extractVarValue(tomlContent, 'ALIGO_SENDER');
    const hasRealAligoConfig = [aligoApiKey, aligoUserId, aligoSender].every((value) => !ALIGO_PLACEHOLDERS.has(value));
    if (testMode === 'Y') {
        if (hasRealAligoConfig) {
            console.log('   ⚠️  ALIGO_TESTMODE = "Y" — SMS가 실제 전송되지 않습니다.');
            console.log('      💡 프로덕션에서는 "N"으로 변경하세요.');
            warnings++;
        } else {
            console.log('   ℹ️  ALIGO_TESTMODE = "Y" — 현재는 Aligo 실서버 설정이 없어 테스트 모드 유지가 안전합니다.');
        }
    }

    // DG10: compatibility_date 검증
    const compatMatch = tomlContent.match(/compatibility_date\s*=\s*"([^"]+)"/);
    if (compatMatch) {
        const compatDate = new Date(compatMatch[1]);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (compatDate < sixMonthsAgo) {
            console.log(`   ⚠️  compatibility_date "${compatMatch[1]}" — 6개월 이상 경과`);
            console.log('      💡 Cloudflare Workers 최신 기능을 사용하려면 날짜를 업데이트하세요.');
            warnings++;
        } else {
            console.log(`   ✅ compatibility_date: ${compatMatch[1]}`);
        }
    }
    console.log("");

    // 3. Verify Remote Resources
    console.log("☁️  Step 3: 리모트 리소스 검증...");

    if (dbId && !PLACEHOLDER_VALUES.some(p => dbId.toLowerCase() === p.toLowerCase())) {
        const dbCheck = await runCommand(`npx wrangler d1 info ${dbIdentifier} --json`, true);
        if (!dbCheck.success) {
            console.error(`   ❌ D1 데이터베이스(${dbIdentifier})를 찾을 수 없거나 접근할 수 없습니다.`);
            blockers++;
        } else {
            console.log("   ✅ D1 데이터베이스 확인됨.");

            // DG3: 리모트 D1 마이그레이션 상태 확인
            // 스타터킷(core/ 구조) 폴백 포함
            const migrationsDir = fs.existsSync(path.join(PROJECT_ROOT, 'migrations'))
                ? path.join(PROJECT_ROOT, 'migrations')
                : fs.existsSync(path.join(PROJECT_ROOT, 'core', 'migrations'))
                    ? path.join(PROJECT_ROOT, 'core', 'migrations')
                    : null;
            if (!migrationsDir) {
                console.log("   ⚠️  migrations/ 디렉토리를 찾을 수 없습니다.");
            }
            const localMigrations = migrationsDir
                ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).length
                : 0;
            try {
                const migCheck = await runCommand(
                    `npx wrangler d1 execute ${dbIdentifier} --remote --command "SELECT COUNT(*) as cnt FROM d1_migrations"`,
                    true
                );
                if (migCheck.success) {
                    const countMatch = migCheck.stdout.match(/(\d+)/);
                    const remoteMigCount = countMatch ? parseInt(countMatch[1]) : 0;
                    if (remoteMigCount === 0) {
                        console.error("   ❌ 리모트 DB에 마이그레이션이 적용되지 않았습니다 (빈 DB).");
                        console.log("      💡 npx wrangler d1 migrations apply <DB_NAME> --remote 를 실행하세요.");
                        blockers++;
                    } else if (remoteMigCount < localMigrations) {
                        const gap = localMigrations - remoteMigCount;
                        console.log(`   ⚠️  리모트 마이그레이션 ${remoteMigCount}개 / 로컬 ${localMigrations}개 — ${gap}개 미적용`);

                        // 배포 전 리모트 마이그레이션 자동 적용
                        // DDL 마이그레이션은 멱등(PRAGMA 컬럼 체크)이므로 자동 적용 안전
                        let applyRemote = AUTO_YES || IS_NON_INTERACTIVE;
                        if (!applyRemote) {
                            const answer = await ask(`   🗃️  리모트 DB에 마이그레이션을 적용할까요? (Y/n): `);
                            applyRemote = !answer || answer.toLowerCase() !== 'n';
                        }

                        if (applyRemote) {
                            console.log(`   🚀 리모트 마이그레이션 적용 중...`);
                            try {
                                const migrateEngine = await import('../.docking/engine/migrate.js');
                                const migrationPromise = migrateEngine.runMigrations({
                                    local: false,
                                    verbose: true,
                                    verify: true,
                                    dbName: dbIdentifier
                                });
                                const migrationTimeout = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('리모트 마이그레이션 120초 타임아웃')), 120000)
                                );
                                const result = await Promise.race([migrationPromise, migrationTimeout]);
                                if (result.success) {
                                    console.log(`   ✅ 리모트 마이그레이션 ${result.applied}개 적용 완료`);
                                } else {
                                    console.error(`   ❌ 리모트 마이그레이션 실패: ${result.failed}개 오류`);
                                    if (result.errors) {
                                        for (const err of result.errors) {
                                            console.log(`      - ${err.file}: ${err.error}`);
                                        }
                                    }
                                    blockers++;
                                }
                            } catch (e) {
                                console.error(`   ❌ 리모트 마이그레이션 엔진 오류: ${e.message}`);
                                blockers++;
                            }
                        } else {
                            console.log("   ⏭️  리모트 마이그레이션 건너뜀 (수동 적용 필요)");
                            warnings++;
                        }
                    } else {
                        console.log(`   ✅ 리모트 마이그레이션 ${remoteMigCount}개 적용됨.`);
                    }
                }
            } catch {
                console.log("   ⚠️  리모트 마이그레이션 상태를 확인할 수 없습니다 (d1_migrations 테이블 미존재 가능).");
                warnings++;
            }

            // DG15: 콘텐츠 비어있음 경고 (프로그램/게시글)
            try {
                const progCheck = await runCommand(
                    `npx wrangler d1 execute ${dbIdentifier} --remote --command "SELECT COUNT(*) as cnt FROM programs WHERE deleted_at IS NULL"`,
                    true
                );
                if (progCheck.success) {
                    const progMatch = progCheck.stdout.match(/(\d+)/);
                    const progCount = progMatch ? parseInt(progMatch[1]) : 0;
                    if (progCount === 0) {
                        console.log("   ⚠️  프로그램이 0개입니다. 사이트가 비어보일 수 있습니다.");
                        warnings++;
                    }
                }
            } catch { /* programs 테이블 미존재 시 무시 */ }

            try {
                const postCheck = await runCommand(
                    `npx wrangler d1 execute ${dbIdentifier} --remote --command "SELECT COUNT(*) as cnt FROM posts WHERE deleted_at IS NULL"`,
                    true
                );
                if (postCheck.success) {
                    const postMatch = postCheck.stdout.match(/(\d+)/);
                    const postCount = postMatch ? parseInt(postMatch[1]) : 0;
                    if (postCount === 0) {
                        console.log("   ⚠️  게시글이 0개입니다.");
                        warnings++;
                    }
                }
            } catch { /* posts 테이블 미존재 시 무시 */ }
        }
    }

    if (bucketName) {
        const r2Check = await runCommand(`npx wrangler r2 bucket list`, true);
        if (!r2Check.success || !r2Check.stdout.includes(bucketName)) {
            // DG13: R2 버킷 미존재 → 배포 중단
            console.error(`   ❌ R2 버킷(${bucketName})이 리모트 계정에 존재하지 않습니다.`);
            console.log(`      💡 npx wrangler r2 bucket create ${bucketName} 으로 생성하세요.`);
            blockers++;
        } else {
            console.log("   ✅ R2 버킷 확인됨.");
        }
    }
    console.log("");

    // 4. Check Secrets (Optional)
    // Note: Checking secrets for Pages currently requires them to be set at least once. 
    // Wrangler doesn't have a direct 'list secrets' for Pages yet, but we can attempt to list bindings if deployed.
    // For now, we will guide the user to check them.
    console.log("🔐 Step 4: 환경 변수(Secrets) 확인...");
    console.log("   Clinic-OS 기능 작동에 필요한 비밀키들을 확인합니다.\n");

    // DG6: Secrets 설정 — echo 파이프로 실제 동작 구현
    if (SKIP_SECRETS) {
        console.log('   ℹ️  비대화형 모드 또는 --skip-secrets — 선택형 secret 프롬프트를 건너뜁니다.');
    } else {
        for (const secret of OPTIONAL_SECRETS) {
            const setNow = await ask(`   ❓ ${secret}를 설정하시겠습니까? (현재 설정값이 있다면 덮어씌워집니다) [y/N]: `);
            if (setNow.toLowerCase() === 'y') {
                const val = await ask(`   ${secret} 값을 입력하세요: `);
                if (val) {
                    try {
                        // echo로 값을 stdin에 파이프하여 실제 설정
                        const result = await runCommand(
                            `echo "${val.replace(/"/g, '\\"')}" | npx wrangler pages secret put ${secret} --project-name ${projectName}`,
                            true
                        );
                        if (result.success) {
                            console.log(`   ✅ ${secret} 설정 완료`);
                        } else {
                            console.log(`   ❌ ${secret} 설정 실패 — Cloudflare 대시보드에서 수동 설정하세요.`);
                        }
                    } catch {
                        console.log(`   ❌ ${secret} 설정 실패 — Cloudflare 대시보드에서 수동 설정하세요.`);
                    }
                }
            }
        }
    }
    console.log("");

    // 4.5. Auto snapshot before deploy/update
    console.log("💾 Step 4.5: 보호 스냅샷 생성...");
    try {
        const snapshot = await createProtectionSnapshot({
            projectRoot: PROJECT_ROOT,
            reason: 'predeploy',
            includeDbBackup: true
        });
        console.log(`   ✅ snapshot: ${snapshot.snapshot_dir}`);
    } catch (e) {
        console.log(`   ⚠️  스냅샷 실패 (무시됨): ${e.message}`);
    }

    // Auto-cleanup old backups/snapshots (keep 5)
    try {
        const cleanupPath = path.join(PROJECT_ROOT, 'scripts', 'cleanup.js');
        if (fs.existsSync(cleanupPath)) {
            const { execFileSync } = await import('child_process');
            execFileSync('node', [cleanupPath], { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 10000 });
        }
    } catch { /* cleanup failure is non-blocking */ }
    console.log("");

    // 5. Pre-flight blocker 체크
    if (blockers > 0) {
        console.log("═══════════════════════════════════════════════════════════");
        console.error(`\n❌ ${blockers}개의 차단 이슈가 발견되었습니다. 배포를 중단합니다.`);
        if (warnings > 0) console.log(`   ⚠️  추가 경고 ${warnings}개`);
        console.log("   💡 위의 ❌ 항목들을 해결한 후 다시 시도하세요.\n");
        process.exit(1);
    }
    if (warnings > 0) {
        console.log(`   ⚠️  ${warnings}개의 경고가 있습니다. 배포는 계속 진행됩니다.\n`);
    }

    // 6. Build
    console.log("🔨 Step 6: 애플리케이션 빌드...");
    const astroCacheDir = path.join(PROJECT_ROOT, '.astro');
    if (fs.existsSync(astroCacheDir)) {
        fs.removeSync(astroCacheDir);
        console.log("   🧹 .astro/ 캐시 삭제 (stale 빌드 방지)");
    }
    const buildResult = await runCommand('npm run build', false, 300000);
    if (!buildResult.success) {
        console.error("❌ 빌드에 실패했습니다. 오류를 수정한 후 다시 시도하세요.");
        process.exit(1);
    }
    console.log("   ✅ 빌드 성공.");

    // DG2: 빌드 산출물 검증
    const distDir = buildOutput.absolute;
    const routesJson = path.join(distDir, '_routes.json');
    const workerJs = path.join(distDir, '_worker.js');
    if (!fs.existsSync(routesJson)) {
        console.error(`   ❌ ${buildOutput.relative}/_routes.json이 존재하지 않습니다 — 모든 동적 경로가 404됩니다.`);
        console.log("      💡 빌드 설정(astro.config.mjs)을 확인하세요.");
        process.exit(1);
    }
    if (!fs.existsSync(workerJs)) {
        const workerDir = path.join(distDir, '_worker.js');
        // Astro Cloudflare adapter can output _worker.js as a directory
        if (!fs.existsSync(workerDir)) {
            console.error(`   ❌ ${buildOutput.relative}/_worker.js가 존재하지 않습니다 — SSR이 작동하지 않습니다.`);
            process.exit(1);
        }
    }
    console.log(`   ✅ 빌드 산출물 검증 완료 (${buildOutput.relative}/_routes.json, _worker.js)`);

    // DG15: 이미지 무결성 체크 — 빌드 후 dist/ 검증
    console.log("   🖼️  이미지 무결성 검증...");
    const imageIssues = [];

    // Check 1: logo.png placeholder (68-byte 1x1 transparent)
    const logoPath = path.join(distDir, 'logo.png');
    if (fs.existsSync(logoPath)) {
        const logoSize = fs.statSync(logoPath).size;
        if (logoSize < 500) {
            imageIssues.push(`logo.png이 ${logoSize}바이트 — placeholder 가능성 (실제 로고로 교체 필요)`);
        }
    }

    // Check 2: /local/ 경로 잔류 확인 (_routes.json에 /local/ 경로 없어야 함)
    if (fs.existsSync(routesJson)) {
        const routesContent = fs.readFileSync(routesJson, 'utf8');
        if (routesContent.includes('/local/')) {
            imageIssues.push('_routes.json에 /local/ 경로 잔류 — postbuild 정리 실패 가능성');
        }
    }

    // Check 3: dist/local/ 디렉토리 잔류 확인
    const distLocal = path.join(distDir, 'local');
    if (fs.existsSync(distLocal)) {
        imageIssues.push('dist/local/ 디렉토리 잔류 — postbuild 정리가 완료되지 않음');
    }

    if (imageIssues.length > 0) {
        for (const issue of imageIssues) {
            console.log(`   ⚠️  ${issue}`);
        }
        warnings += imageIssues.length;
    } else {
        console.log("   ✅ 이미지 무결성 정상");
    }
    console.log('');

    // DG14: E2E 테스트 (배포 전 회귀 검증)
    const SKIP_E2E = CLI_ARGS.has('--skip-e2e');
    if (!SKIP_E2E) {
        console.log("🎭 Step 6.5: E2E 테스트 (배포 전 회귀 검증)...");
        const playwrightConfig = path.join(PROJECT_ROOT, 'playwright.config.ts');
        if (fs.existsSync(playwrightConfig)) {
            try {
                // DB 시드 (E2E용)
                await runCommand('npm run db:init && npm run db:seed', true);
                const e2eSeedScript = path.join(PROJECT_ROOT, 'scripts', 'e2e-admin-seed.js');
                if (fs.existsSync(e2eSeedScript)) {
                    await runCommand('node scripts/e2e-admin-seed.js', true);
                }

                // Playwright 실행
                const e2eResult = await runCommand('npx playwright test --project=public', false, 180000);
                if (!e2eResult.success) {
                    console.warn('   ⚠️  E2E 테스트 실패');
                    console.log('   💡 npx playwright test --project=public --headed 로 디버깅하세요.\n');
                    if (IS_NON_INTERACTIVE) {
                        console.log('   ℹ️  비대화형 모드: E2E 실패는 경고로 처리합니다.');
                        warnings++;
                    } else {
                        const e2eContinue = await ask('   E2E 실패에도 배포를 계속할까요? (y/N): ');
                        if (e2eContinue.toLowerCase() === 'y') {
                            warnings++;
                        } else {
                            blockers++;
                        }
                    }
                } else {
                    console.log('   ✅ E2E 테스트 통과\n');
                }
            } catch (e) {
                console.warn(`   ⚠️  E2E 테스트 실행 중 오류: ${e.message}`);
                console.log('   💡 npx playwright install chromium 으로 브라우저를 설치하세요.\n');
                warnings++;
            }
        } else {
            console.log('   ℹ️  playwright.config.ts 없음 — E2E 테스트 건너뜀\n');
        }
    } else {
        console.log("⏭️  E2E 테스트 건너뜀 (--skip-e2e)\n");
    }

    // 7. Deploy
    console.log("🚀 Step 7: 최종 배포...");
    let shouldDeploy = AUTO_YES;
    if (!AUTO_YES && !IS_NON_INTERACTIVE) {
        const confirm = await ask(`   ${projectName}으로 배포를 진행하시겠습니까? (y/n): `);
        shouldDeploy = confirm.toLowerCase() === 'y';
    }

    if (!shouldDeploy && IS_NON_INTERACTIVE) {
        console.log("   ℹ️  비대화형 프리플라이트만 완료했습니다. 실제 배포는 --yes를 추가하세요.");
        return;
    }

    if (shouldDeploy) {
        const deployCmd = `npx wrangler pages deploy "${buildOutput.relative}" --project-name ${projectName}`;
        const deployResult = await runCommand(deployCmd);
        if (deployResult.success) {
            const gitHead = await getGitHeadShortSha();
            const latestProduction = await getLatestProductionDeployment(projectName);
            recordDeploymentTarget(PROJECT_ROOT, currentTarget, {
                source: 'deploy-guard',
                non_interactive: IS_NON_INTERACTIVE,
                allow_target_change: ALLOW_TARGET_CHANGE
            });

            writeLastDeployReport({
                version: 1,
                deployed_at: new Date().toISOString(),
                project_name: projectName,
                site_url: cloudflareUrl || defaultPagesUrl,
                deployment_id: latestProduction?.Id || null,
                deployment_url: latestProduction?.Deployment || defaultPagesUrl,
                deployment_source: latestProduction?.Source || gitHead,
                deployment_status: latestProduction?.Status || null,
                git_head: gitHead,
                non_interactive: IS_NON_INTERACTIVE,
                auto_yes: AUTO_YES
            });
            console.log("\n✅ 배포가 성공적으로 완료되었습니다!");
            console.log(`   🌍 URL: https://${projectName}.pages.dev\n`);

            // 배포 후 스모크 테스트 (CDN 전파 대기 후 실제 응답 확인)
            console.log("   🔍 배포 검증 중 (5초 대기)...");
            await new Promise(r => setTimeout(r, 5000));
            const smokeBaseUrl = cloudflareUrl || `https://${projectName}.pages.dev`;
            for (const smokePath of ['/', '/ko/']) {
                try {
                    const smokeRes = await fetch(`${smokeBaseUrl}${smokePath}`, {
                        headers: { 'Cache-Control': 'no-cache' },
                        redirect: 'follow'
                    });
                    console.log(`   ${smokeRes.ok ? '✅' : '❌'} ${smokePath} → ${smokeRes.status}`);
                } catch (smokeErr) {
                    console.warn(`   ⚠️  ${smokePath} → ${smokeErr.message}`);
                }
            }
            console.log('');

            if (latestProduction?.Source && gitHead && latestProduction.Source !== gitHead) {
                console.log(`   ⚠️  최신 Production 배포 Source(${latestProduction.Source})가 현재 HEAD(${gitHead})와 다릅니다.`);
                console.log('      💡 release-validate DEPLOYED 단계에서 다시 확인하세요.\n');
            }
        } else {
            console.error("\n❌ 배포 중 오류가 발생했습니다.");
            console.error(deployResult.error.message);
        }
    } else {
        console.log("   🛑 배포가 취소되었습니다.");
    }
}

deployGuard().catch(console.error);
