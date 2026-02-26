import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

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

const PLACEHOLDER_VALUES = [
    'YOUR_DATABASE_ID_HERE',
    'your-database-id-here',
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    '00000000-0000-0000-0000-000000000000',
];

const DANGEROUS_DEFAULTS = {
    ADMIN_PASSWORD: ['change-me-in-production', 'admin', 'password', '1234', 'changeme'],
};

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
    const projectNameMatch = tomlContent.match(/name\s*=\s*"([^"]+)"/);
    const projectName = projectNameMatch ? projectNameMatch[1] : null;

    const dbIdMatch = tomlContent.match(/database_id\s*=\s*"([^"]+)"/);
    const dbId = dbIdMatch ? dbIdMatch[1] : null;

    const bucketMatch = tomlContent.match(/bucket_name\s*=\s*"([^"]+)"/);
    const bucketName = bucketMatch ? bucketMatch[1] : null;

    if (!projectName) {
        console.error("❌ wrangler.toml에서 Pages 프로젝트 이름을 찾을 수 없습니다.");
        process.exit(1);
    }
    console.log(`   ✅ 프로젝트: ${projectName}`);

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
    const testModeMatch = tomlContent.match(/ALIGO_TESTMODE\s*=\s*"([^"]+)"/);
    const testMode = testModeMatch ? testModeMatch[1] : null;
    if (testMode === 'Y') {
        console.log('   ⚠️  ALIGO_TESTMODE = "Y" — SMS가 실제 전송되지 않습니다.');
        console.log('      💡 프로덕션에서는 "N"으로 변경하세요.');
        warnings++;
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
        const dbCheck = await runCommand(`npx wrangler d1 info ${dbId} --remote`, true);
        if (!dbCheck.success) {
            console.error(`   ❌ D1 데이터베이스(${dbId})를 찾을 수 없거나 접근할 수 없습니다.`);
            blockers++;
        } else {
            console.log("   ✅ D1 데이터베이스 확인됨.");

            // DG3: 리모트 D1 마이그레이션 상태 확인
            const localMigrations = fs.readdirSync(path.join(PROJECT_ROOT, 'migrations'))
                .filter(f => f.endsWith('.sql')).length;
            try {
                const migCheck = await runCommand(
                    `npx wrangler d1 execute ${dbId} --remote --command "SELECT COUNT(*) as cnt FROM d1_migrations"`,
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
    console.log("");

    // 4.5. Auto-backup local DB before deploy
    console.log("💾 Step 4.5: 로컬 DB 백업...");
    try {
        const { backup: dbBackup } = await import('./db-backup.js');
        dbBackup({ force: true });
    } catch (e) {
        console.log(`   ⚠️  백업 실패 (무시됨): ${e.message}`);
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
    const distDir = path.join(PROJECT_ROOT, 'dist');
    const routesJson = path.join(distDir, '_routes.json');
    const workerJs = path.join(distDir, '_worker.js');
    if (!fs.existsSync(routesJson)) {
        console.error("   ❌ dist/_routes.json이 존재하지 않습니다 — 모든 동적 경로가 404됩니다.");
        console.log("      💡 빌드 설정(astro.config.mjs)을 확인하세요.");
        process.exit(1);
    }
    if (!fs.existsSync(workerJs)) {
        const workerDir = path.join(distDir, '_worker.js');
        // Astro Cloudflare adapter can output _worker.js as a directory
        if (!fs.existsSync(workerDir)) {
            console.error("   ❌ dist/_worker.js가 존재하지 않습니다 — SSR이 작동하지 않습니다.");
            process.exit(1);
        }
    }
    console.log("   ✅ 빌드 산출물 검증 완료 (_routes.json, _worker.js)\n");

    // 7. Deploy
    console.log("🚀 Step 7: 최종 배포...");
    const confirm = await ask(`   ${projectName}으로 배포를 진행하시겠습니까? (y/n): `);
    if (confirm.toLowerCase() === 'y') {
        const deployCmd = `npx wrangler pages deploy dist --project-name ${projectName}`;
        const deployResult = await runCommand(deployCmd);
        if (deployResult.success) {
            console.log("\n✅ 배포가 성공적으로 완료되었습니다!");
            console.log(`   🌍 URL: https://${projectName}.pages.dev\n`);
        } else {
            console.error("\n❌ 배포 중 오류가 발생했습니다.");
            console.error(deployResult.error.message);
        }
    } else {
        console.log("   🛑 배포가 취소되었습니다.");
    }
}

deployGuard().catch(console.error);
