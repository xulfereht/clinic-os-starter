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
const AUTO_YES = CLI_ARGS.has('--yes');
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

async function runCommand(cmd, silent = false) {
    if (!silent) console.log(`   Running: ${cmd}`);
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: PROJECT_ROOT });
        return { success: true, stdout, stderr };
    } catch (error) {
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

    // 0.5 건강 검진 (차단 — score < 50이면 배포 중단)
    try {
        const healthPath = path.join(PROJECT_ROOT, 'scripts', 'health-audit.js');
        if (fs.existsSync(healthPath)) {
            const { runHealthAudit } = await import(healthPath);
            const health = await runHealthAudit({ quiet: false });
            if (health.score < 50) {
                console.error(`\n❌ 건강 점수 ${health.score}/100 — 배포를 중단합니다.`);
                console.log('   💡 npm run health:fix 실행 후 다시 시도하세요.\n');
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

    // 1. Check Wrangler Login
    console.log("👤 Step 1: Cloudflare 로그인 확인...");
    const whoami = await runCommand('npx wrangler whoami', true);
    if (!whoami.success) {
        console.error("❌ Cloudflare에 로그인되어 있지 않습니다.");
        console.log("   명령어를 실행하세요: npx wrangler login\n");
        process.exit(1);
    }
    console.log("   ✅ 로그인 확인됨.\n");

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
            const localMigrations = fs.readdirSync(path.join(PROJECT_ROOT, 'migrations'))
                .filter(f => f.endsWith('.sql')).length;
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
                        console.log(`   ⚠️  리모트 마이그레이션 ${remoteMigCount}개 / 로컬 ${localMigrations}개 — 미적용 마이그레이션 존재`);
                        console.log("      💡 배포 후 npx wrangler d1 migrations apply <DB_NAME> --remote 를 실행하세요.");
                        warnings++;
                    } else {
                        console.log(`   ✅ 리모트 마이그레이션 ${remoteMigCount}개 적용됨.`);
                    }
                }
            } catch {
                console.log("   ⚠️  리모트 마이그레이션 상태를 확인할 수 없습니다 (d1_migrations 테이블 미존재 가능).");
                warnings++;
            }
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
    const buildResult = await runCommand('npm run build');
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
    console.log(`   ✅ 빌드 산출물 검증 완료 (${buildOutput.relative}/_routes.json, _worker.js)\n`);

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
