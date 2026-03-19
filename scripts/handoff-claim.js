#!/usr/bin/env node

/**
 * handoff-claim.js — 위임 셋업 완료 프로젝트를 클라이언트가 인수하는 스크립트
 *
 * Usage: npm run handoff:claim
 */

import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PROJECT_ROOT = path.resolve(process.cwd());
const DEFAULT_HQ_URL = 'https://clinic-os-hq.yeonseung-choe.workers.dev';

async function main() {
  console.log('\n🤝 Clinic-OS 위임 셋업 인수 (Handoff Claim)\n');

  // 1. delegated-setup.json 확인
  const delegatedPath = path.join(PROJECT_ROOT, '.agent', 'delegated-setup.json');
  if (!fs.existsSync(delegatedPath)) {
    console.error('❌ 위임 셋업 프로젝트가 아닙니다. (.agent/delegated-setup.json 없음)');
    process.exit(1);
  }

  const delegated = fs.readJsonSync(delegatedPath);
  if (delegated.handoff_status === 'claimed') {
    console.log('✅ 이미 인수 완료된 프로젝트입니다.');
    process.exit(0);
  }

  // 2. .env에서 CLOUDFLARE_API_TOKEN 먼저 제거 (wrangler가 .env를 읽으므로)
  const envPath = path.join(PROJECT_ROOT, '.env');
  let envCfTokenRemoved = false;
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const before = envContent;
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('CLOUDFLARE_API_TOKEN='))
      .join('\n');
    if (before !== envContent) {
      fs.writeFileSync(envPath, envContent);
      delete process.env.CLOUDFLARE_API_TOKEN;
      envCfTokenRemoved = true;
      console.log('🔑 .env에서 위임 CF Token 제거됨 (wrangler 충돌 방지)');
    }
  }

  // 3. wrangler 로그인 확인
  console.log('👤 Cloudflare 로그인 확인...');
  try {
    execFileSync('npx', ['wrangler', 'whoami'], { stdio: 'pipe', timeout: 30000 });
    console.log('   ✅ 로그인 확인됨\n');
  } catch {
    // CF Token 제거 롤백 (wrangler login 안 된 상태에서 토큰마저 삭제하면 안 됨)
    if (envCfTokenRemoved) {
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      envContent = `CLOUDFLARE_API_TOKEN=${delegated.intake_data?.cf_api_token || 'RESTORE_ME'}\n` + envContent;
      fs.writeFileSync(envPath, envContent);
      console.log('   ↩️  CF Token 복원됨 (wrangler login 먼저 필요)');
    }
    console.error('❌ Cloudflare에 로그인되어 있지 않습니다.');
    console.log('   먼저 실행하세요: npx wrangler login\n');
    process.exit(1);
  }

  // 3. clinic.json에서 라이선스 키 읽기
  const clinicJsonPath = path.join(PROJECT_ROOT, 'clinic.json');
  if (!fs.existsSync(clinicJsonPath)) {
    console.error('❌ clinic.json이 없습니다.');
    process.exit(1);
  }
  const clinicJson = fs.readJsonSync(clinicJsonPath);
  const licenseKey = clinicJson.license_key || clinicJson.licenseKey;
  if (!licenseKey) {
    console.error('❌ clinic.json에 license_key가 없습니다.');
    process.exit(1);
  }

  // 4. 새 device_token 발급 (HQ register-device)
  console.log('🔐 새 디바이스를 등록합니다...');
  const machineId = crypto.createHash('sha256')
    .update(`${os.hostname()}-${os.platform()}-${os.userInfo().username}`)
    .digest('hex').substring(0, 32);

  const hqUrl = delegated.hq_url || DEFAULT_HQ_URL;

  try {
    const response = await fetch(`${hqUrl}/api/v1/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        machine_id: machineId,
        os_info: `${os.platform()} ${os.release()}`,
        name: clinicJson.organization || clinicJson.clinic_name || 'Handoff Device'
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('   ✅ 디바이스 등록 성공\n');

    // 5. .docking/config.yaml 교체
    console.log('📝 설정 파일 업데이트...');
    const configPath = path.join(PROJECT_ROOT, '.docking', 'config.yaml');
    fs.ensureDirSync(path.dirname(configPath));

    const configContent = `hq_url: "${hqUrl}"
device_token: "${data.device_token}"
clinic_name: "${clinicJson.organization || clinicJson.clinic_name || ''}"
`;
    fs.writeFileSync(configPath, configContent);
    console.log('   ✅ .docking/config.yaml 업데이트됨');

    // 6. .env CF Token 제거 확인 (이미 Step 2에서 제거됨)
    if (envCfTokenRemoved) {
      console.log('   ✅ .env에서 CLOUDFLARE_API_TOKEN 이미 제거됨');
    }

    // 7. delegated-setup.json 상태 업데이트
    delegated.handoff_status = 'claimed';
    delegated.claimed_at = new Date().toISOString();
    delegated.claimed_machine_id = machineId;
    fs.writeJsonSync(delegatedPath, delegated, { spaces: 2 });
    console.log('   ✅ delegated-setup.json → claimed');

    // 8. softgate-state.json 리셋
    const softgateTemplatePath = path.join(PROJECT_ROOT, '.agent', 'softgate-state.template.json');
    const softgatePath = path.join(PROJECT_ROOT, '.agent', 'softgate-state.json');
    if (fs.existsSync(softgateTemplatePath)) {
      fs.copySync(softgateTemplatePath, softgatePath);
      console.log('   ✅ softgate-state.json 리셋됨');
    }

    // 9. health check
    console.log('\n🏥 환경 검증 중...\n');
    try {
      execFileSync('npm', ['run', 'health'], { stdio: 'inherit', cwd: PROJECT_ROOT, timeout: 60000 });
    } catch {
      console.log('\n⚠️  health check에서 경고가 있습니다. 위의 결과를 확인하세요.');
    }

    console.log('\n✅ 인수 완료! 이제 이 프로젝트는 귀하의 디바이스에서 운영됩니다.');
    console.log('   다음 단계: AI 코딩 에이전트를 열고 온보딩을 진행하세요.\n');

  } catch (e) {
    console.error(`\n❌ 디바이스 등록 실패: ${e.message}`);
    console.log('   clinic.json의 license_key를 확인하고, HQ 서버 상태를 점검하세요.\n');
    process.exit(1);
  }
}

main();
