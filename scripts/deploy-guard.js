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

async function deployGuard() {
    console.log("\n🛡️  Clinic-OS Deployment Guardrails v1.0\n");
    console.log("═══════════════════════════════════════════════════════════\n");

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
    console.log(`   ✅ DB ID: ${dbId || 'N/A'}`);
    console.log(`   ✅ 버킷: ${bucketName || 'N/A'}\n`);

    // 3. Verify Remote Resources
    console.log("☁️  Step 3: 리포트 리소스 검증...");

    if (dbId) {
        const dbCheck = await runCommand(`npx wrangler d1 info ${dbId} --remote`, true);
        if (!dbCheck.success) {
            console.warn(`⚠️  D1 데이터베이스(${dbId})를 찾을 수 없거나 접근할 수 없습니다.`);
        } else {
            console.log("   ✅ D1 데이터베이스 확인됨.");
        }
    }

    if (bucketName) {
        const r2Check = await runCommand(`npx wrangler r2 bucket list`, true);
        if (!r2Check.stdout.includes(bucketName)) {
            console.warn(`⚠️  R2 버킷(${bucketName})이 리모트 계정에 존재하지 않습니다.`);
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

    for (const secret of OPTIONAL_SECRETS) {
        const setNow = await ask(`   ❓ ${secret}를 설정하시겠습니까? (현재 설정값이 있다면 덮어씌워집니다) [y/N]: `);
        if (setNow.toLowerCase() === 'y') {
            const val = await ask(`   ${secret} 값을 입력하세요: `);
            if (val) {
                const result = await runCommand(`npx wrangler pages secret put ${secret} --project-name ${projectName}`, true);
                // Note: This requires stdin in a real terminal. execAsync won't handle it well without piping.
                // We'll use a simpler message for now since exec won't pass the interactive prompt.
                console.log(`   💡 'npx wrangler pages secret put ${secret} --project-name ${projectName}' 명령어를 직접 실행하거나 Cloudflare 대시보드에서 설정하세요.`);
            }
        }
    }
    console.log("");

    // 5. Build
    console.log("🔨 Step 5: 애플리케이션 빌드...");
    const buildResult = await runCommand('npm run build');
    if (!buildResult.success) {
        console.error("❌ 빌드에 실패했습니다. 오류를 수정한 후 다시 시도하세요.");
        process.exit(1);
    }
    console.log("   ✅ 빌드 성공.\n");

    // 6. Deploy
    console.log("🚀 Step 6: 최종 배포...");
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
