#!/usr/bin/env node
/**
 * Clinic-OS Setup Stepper (Always Conservative Mode)
 * 
 * 메모리 제한 환경에서도 안전하게 실행되는 설치 스크립트
 * - 한 번에 하나의 단계만 실행
 * - 각 단계는 멱등성 보장 (이미 완료된 단계는 skip)
 * - SIGKILL 발생 시 해당 단계부터 재시작 가능
 * 
 * 사용법:
 *   npm run setup:step -- --next        # 다음 pending 단계 실행
 *   npm run setup:step -- --step=init   # 특정 단계 실행
 *   npm run setup:step -- --status      # 현재 상태 확인
 *   npm run setup:step -- --reset       # 상태 초기화 (주의!)
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import yaml from 'js-yaml';
import { buildNpmCommand } from './lib/npm-cli.js';
import { buildLocalDbBootstrapReport } from './lib/setup-db-bootstrap.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const PROGRESS_PATH = path.join(PROJECT_ROOT, '.agent', 'setup-progress.json');

// 기본 설정
const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

// 설치 단계 정의 (항상 보수적/저메모리 모드)
const SETUP_STEPS = [
  // Phase 1: 환경 (Light)
  { id: 'check-system', name: '시스템 환경 확인', phase: 1, weight: 'light' },
  { id: 'init-config', name: '초기 설정 파일 생성', phase: 1, weight: 'light' },
  { id: 'cf-login', name: 'Cloudflare 로그인 및 리소스 생성', phase: 1, weight: 'light' },

  // Phase 2: 디바이스 (Light)
  { id: 'device-register', name: '디바이스 등록', phase: 2, weight: 'light' },
  
  // Phase 3: 의존성 (Heavy - 순차 설치로 메모리 절약)
  { id: 'npm-install-root', name: '루트 의존성 설치 (순차)', phase: 3, weight: 'heavy' },
  { id: 'npm-install-core', name: '코어 의존성 설치 (순차)', phase: 3, weight: 'heavy' },
  
  // Phase 4: Git (Medium)
  { id: 'git-init', name: 'Git 저장소 초기화', phase: 4, weight: 'medium' },
  { id: 'core-pull', name: '코어 파일 다운로드 (shallow)', phase: 4, weight: 'medium' },
  
  // Phase 5: DB (Medium - 파일별 분리)
  { id: 'db-migrate', name: '데이터베이스 마이그레이션', phase: 5, weight: 'medium' },
  { id: 'db-seed:clinic', name: 'DB 시드: 병원 기본 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:terms', name: 'DB 시드: 약관 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:pages', name: 'DB 시드: 페이지 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:staff', name: 'DB 시드: 운영 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:content', name: 'DB 시드: 콘텐츠 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:patients', name: 'DB 시드: 환자 샘플 데이터', phase: 5, weight: 'medium' },
  { id: 'db-seed:system', name: 'DB 시드: 시스템 데이터', phase: 5, weight: 'medium' },
  
  // Phase 6: 온볼딩 준비 (Light)
  { id: 'onboarding-init', name: '온볼딩 상태 초기화', phase: 6, weight: 'light' }
];

// ═══════════════════════════════════════════════════════════════
// 상태 관리
// ═══════════════════════════════════════════════════════════════

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    try {
      return fs.readJsonSync(PROGRESS_PATH);
    } catch (e) {
      console.error('⚠️  상태 파일 손상, 초기화합니다.');
    }
  }
  return initializeProgress();
}

function initializeProgress() {
  return {
    version: '1.0.0',
    startedAt: new Date().toISOString(),
    steps: SETUP_STEPS.map(step => ({
      id: step.id,
      status: 'pending',
      attempts: 0
    })),
    context: {}
  };
}

function saveProgress(progress) {
  fs.ensureDirSync(path.dirname(PROGRESS_PATH));
  fs.writeJsonSync(PROGRESS_PATH, progress, { spaces: 2 });
}

function getNextStep(progress) {
  // 이전에 실패한 in_progress 단계가 있으면 해당 단계부터
  const interrupted = progress.steps.find(s => s.status === 'in_progress');
  if (interrupted) return { step: interrupted, isRetry: true };
  
  // 다음 pending 단계
  const pending = progress.steps.find(s => s.status === 'pending');
  if (pending) return { step: pending, isRetry: false };
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 단계 실행 함수들 (각 함수는 멱등성 보장)
// ═══════════════════════════════════════════════════════════════

async function runCheckSystem(progress) {
  console.log('🔍 시스템 환경을 확인합니다...\n');

  if (process.platform === 'win32') {
    throw new Error('네이티브 Windows 설치는 지원하지 않습니다. macOS 또는 WSL Ubuntu에서 다시 실행하세요.');
  }
  
  const checks = [
    { name: 'Node.js', cmd: 'node --version', minVersion: '18.0.0' },
    { name: 'npm', cmd: 'npm --version', minVersion: '9.0.0' },
    { name: 'Git', cmd: 'git --version', minVersion: '2.0.0' }
  ];
  
  for (const check of checks) {
    try {
      const { stdout } = await execAsync(check.cmd);
      console.log(`   ✅ ${check.name}: ${stdout.trim()}`);
    } catch (e) {
      console.error(`   ❌ ${check.name}를 찾을 수 없습니다.`);
      throw new Error(`${check.name} 설치 필요`);
    }
  }
  
  // 메모리 정보 출력 (경고용, 강제하지 않음)
  const totalMem = os.totalmem() / 1024 / 1024 / 1024;
  console.log(`   💾 총 메모리: ${totalMem.toFixed(1)}GB`);
  if (totalMem < 2) {
    console.log('   ⚠️  메모리가 2GB 미만입니다. 순차 설치 모드를 사용합니다.');
  }
  
  return { success: true };
}

async function runInitConfig(progress) {
  console.log('📄 초기 설정 파일을 생성합니다...\n');
  
  // clinic.json 확인
  const signedPath = path.join(PROJECT_ROOT, 'clinic.json');
  if (fs.existsSync(signedPath)) {
    const signed = fs.readJsonSync(signedPath);
    progress.context.clinicName = signed.organization || 'My Clinic';
    progress.context.licenseKey = signed.license_key || '';
    progress.context.channel = signed.channel || 'stable';
    console.log(`   ✅ clinic.json에서 설정 로드: ${progress.context.clinicName}`);
  } else {
    progress.context.clinicName = 'My Clinic';
    console.log('   ℹ️  clinic.json 없음, 기본값 사용');
  }

  // wrangler.toml 템플릿 생성 (없을 경우)
  const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    // Issue #2 Fix: client_id를 기반으로 안전한 slug 생성 (한국어 등 non-ASCII 문제 방지)
    const signed = fs.existsSync(signedPath) ? fs.readJsonSync(signedPath) : {};
    const clientId = signed.client_id || '';
    const slug = clientId.substring(0, 12) || 'clinic';
    const cleanName = `cos-${slug}`;
    
    const dbName = `${cleanName}-db`;
    const bucketName = `${cleanName}-uploads`;
    
    // CRITICAL Fix: 랜덤 임시 비밀번호 생성 (평문 "change-me-in-production" 제거)
    const tempPassword = crypto.randomBytes(16).toString('hex').substring(0, 16);
    
    const wranglerContent = `# Clinic-OS Configuration for ${progress.context.clinicName}
name = "${cleanName}"
# Note: 한국어 기관명은 client_id 기반 slug로 자동 변환됩니다
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "core/dist"

# R2 버킷
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "${bucketName}"

[vars]
CLINIC_NAME = "${progress.context.clinicName}"
ADMIN_PASSWORD = "${tempPassword}"
ALIGO_TESTMODE = "Y"

# D1 데이터베이스
[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "local-db-placeholder"
`;
    fs.writeFileSync(wranglerPath, wranglerContent);
    console.log(`   ✅ wrangler.toml 생성: ${dbName}`);
    console.log(`   🔐 임시 관리자 비밀번호 생성됨: ${tempPassword}`);
    console.log(`   ⚠️  프로덕션 배포 전 반드시 변경하세요: wrangler secret put ADMIN_PASSWORD`);
    progress.context.dbName = dbName;
  } else {
    console.log('   ⏭️  wrangler.toml 이미 존재');
  }
  
  return { success: true };
}

async function runCfLogin(progress) {
  console.log('☁️  Cloudflare 로그인 및 리소스를 확인합니다...\n');

  const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
  const wranglerCmd = getWranglerCmd();

  // 1. CF 인증 확인
  const hasToken = !!process.env.CLOUDFLARE_API_TOKEN;
  if (hasToken) {
    console.log('   🔑 CLOUDFLARE_API_TOKEN 감지 — 토큰 모드로 진행합니다.');
    progress.context.cfTokenMode = true;
  } else {
    console.log('   🔍 Wrangler 로그인 상태를 확인합니다...');
    try {
      const { stdout } = await execAsync(`${wranglerCmd} whoami`, { timeout: 30000 });
      console.log(`   ✅ Cloudflare 로그인 확인됨`);
      // account_id 추출 시도
      const accountMatch = stdout.match(/Account ID[:\s]+([a-f0-9]{32})/i) || stdout.match(/([a-f0-9]{32})/);
      if (accountMatch) {
        progress.context.cfAccountId = accountMatch[1];
        console.log(`   📋 Account ID: ${accountMatch[1]}`);
      }
    } catch (e) {
      console.error('\n   ❌ Cloudflare에 로그인되어 있지 않습니다.\n');
      console.log('   Cloudflare 계정이 없으면 먼저 가입하세요:');
      console.log('   👉 https://dash.cloudflare.com/sign-up (무료)\n');
      console.log('   계정이 있으면 로그인하세요:');
      console.log('   npx wrangler login\n');
      console.log('   📖 상세 가이드: https://clinic-os-hq.pages.dev/guide/cloudflare-setup');
      console.log('   📖 로컬: docs/CLOUDFLARE_SETUP_GUIDE.md\n');
      throw new Error('Cloudflare 로그인 필요. 계정 가입 후 npx wrangler login 실행하세요.');
    }
  }

  // 2. wrangler.toml 로드
  if (!fs.existsSync(wranglerPath)) {
    console.log('   ⏭️  wrangler.toml 없음 — init-config 단계를 먼저 실행하세요.');
    throw new Error('wrangler.toml이 없습니다. init-config 단계를 먼저 실행하세요.');
  }

  let tomlContent = fs.readFileSync(wranglerPath, 'utf8');

  // 3. D1 database 생성 (placeholder인 경우)
  const dbIdMatch = tomlContent.match(/database_id\s*=\s*"([^"]+)"/);
  const dbNameMatch = tomlContent.match(/database_name\s*=\s*"([^"]+)"/);
  const dbName = dbNameMatch ? dbNameMatch[1] : progress.context.dbName || 'my-clinic-db';

  if (dbIdMatch && dbIdMatch[1] === 'local-db-placeholder') {
    console.log(`   📦 D1 데이터베이스 생성: ${dbName}...`);
    try {
      const { stdout } = await execAsync(`${wranglerCmd} d1 create ${dbName}`, { timeout: 30000 });
      const newIdMatch = stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
      if (newIdMatch) {
        tomlContent = tomlContent.replace('local-db-placeholder', newIdMatch[1]);
        fs.writeFileSync(wranglerPath, tomlContent);
        console.log(`   ✅ D1 생성 완료: ${newIdMatch[1]}`);
        progress.context.dbId = newIdMatch[1];
      } else {
        console.log('   ⚠️  D1 생성 출력에서 database_id를 추출할 수 없습니다.');
        console.log('      wrangler.toml의 database_id를 수동으로 설정하세요.');
      }
    } catch (e) {
      if (e.message && e.message.includes('already exists')) {
        console.log(`   ℹ️  D1 "${dbName}" 이미 존재합니다. database_id를 수동으로 설정하세요.`);
      } else {
        console.log(`   ⚠️  D1 생성 실패: ${e.message}`);
        console.log('      배포 전에 npx wrangler d1 create 으로 수동 생성하세요.');
      }
    }
  } else {
    console.log('   ⏭️  D1 database_id 이미 설정됨');
  }

  // 4. R2 버킷 생성
  const bucketMatch = tomlContent.match(/bucket_name\s*=\s*"([^"]+)"/);
  const bucketName = bucketMatch ? bucketMatch[1] : null;

  if (bucketName) {
    console.log(`   📦 R2 버킷 확인: ${bucketName}...`);
    try {
      await execAsync(`${wranglerCmd} r2 bucket create ${bucketName}`, { timeout: 30000 });
      console.log(`   ✅ R2 버킷 생성 완료: ${bucketName}`);
    } catch (e) {
      if (e.message && (e.message.includes('already exists') || e.message.includes('already owned'))) {
        console.log(`   ⏭️  R2 버킷 "${bucketName}" 이미 존재`);
      } else {
        console.log(`   ⚠️  R2 버킷 생성 실패: ${e.message}`);
        console.log('      배포 전에 npx wrangler r2 bucket create 으로 수동 생성하세요.');
      }
    }
  }

  // 5. softgate-state 업데이트 (있으면)
  const softgatePath = path.join(PROJECT_ROOT, '.agent', 'softgate-state.json');
  if (fs.existsSync(softgatePath)) {
    try {
      const state = fs.readJsonSync(softgatePath);
      if (state.cloudflare) state.cloudflare.logged_in = true;
      if (state.r2 && bucketName) {
        state.r2.configured = true;
        state.r2.bucket_name = bucketName;
      }
      fs.writeJsonSync(softgatePath, state, { spaces: 2 });
      console.log('   ✅ softgate-state 업데이트 완료');
    } catch (e) {
      // 무시 — softgate-state가 없거나 구조가 다를 수 있음
    }
  }

  console.log('\n   ✅ Cloudflare 설정 완료');
  return { success: true };
}

async function runDeviceRegister(progress) {
  console.log('🔐 디바이스를 등록합니다...\n');
  
  const machineId = crypto.createHash('sha256')
    .update(`${os.hostname()}-${os.platform()}-${os.userInfo().username}`)
    .digest('hex').substring(0, 32);
  
  progress.context.machineId = machineId;
  progress.context.hqUrl = DEFAULT_HQ_URL;
  
  // 이미 토큰이 있으면 skip
  if (progress.context.deviceToken) {
    console.log('   ⏭️  이미 디바이스 토큰이 있습니다.');
    return { success: true };
  }
  
  // clinic.json에 licenseKey가 있으면 자동 등록 시도
  if (progress.context.licenseKey) {
    console.log('   📝 라이선스 키로 자동 등록 시도...');
    try {
      const response = await fetch(`${progress.context.hqUrl}/api/v1/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: progress.context.licenseKey,
          machine_id: machineId,
          os_info: `${os.platform()} ${os.release()}`,
          name: progress.context.clinicName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        progress.context.deviceToken = data.device_token;
        console.log('   ✅ 자동 등록 성공');
        
        // .docking/config.yaml 생성
        await saveDockingConfig(progress);
        return { success: true };
      }
    } catch (e) {
      console.log(`   ⚠️  자동 등록 실패: ${e.message}`);
    }
  }
  
  // 수동 등록 필요 — 브라우저 인증 안내
  console.log('\n   ⚠️  수동 디바이스 등록이 필요합니다.');
  console.log('   다음 중 하나를 진행하세요:\n');
  console.log('   방법 1) 모놀리식 셋업의 브라우저 인증 사용:');
  console.log('          npm run setup\n');
  console.log('   방법 2) clinic.json에 license_key 추가 후 재시도:');
  console.log('          npm run setup:step -- --step=device-register\n');
  console.log('   방법 3) HQ 웹사이트에서 직접 디바이스 등록:');
  console.log(`          ${progress.context.hqUrl || DEFAULT_HQ_URL}/register\n`);

  throw new Error('수동 디바이스 등록 필요');
}

async function saveDockingConfig(progress) {
  const configPath = path.join(PROJECT_ROOT, '.docking', 'config.yaml');
  fs.ensureDirSync(path.dirname(configPath));
  
  const content = `hq_url: "${progress.context.hqUrl}"
device_token: "${progress.context.deviceToken}"
clinic_name: "${progress.context.clinicName}"
`;
  fs.writeFileSync(configPath, content);
}

async function runNpmInstallRoot(progress) {
  return runNpmInstallSafe(PROJECT_ROOT, '루트');
}

async function runNpmInstallCore(progress) {
  const corePath = path.join(PROJECT_ROOT, 'core');
  if (!fs.existsSync(corePath)) {
    console.log('   ⏭️  core 디렉토리 없음, skip');
    return { success: true };
  }
  if (!fs.existsSync(path.join(corePath, 'package.json'))) {
    console.log('   ⏭️  core/package.json 없음, skip');
    return { success: true };
  }
  return runNpmInstallSafe(corePath, '코어');
}

/**
 * 메모리 안전 npm install
 * - max-old-space-size=512로 V8 힙 제한
 * - SIGKILL 시 step이 in_progress로 남아 재시도 가능
 * - 재시도 시 부분 설치된 node_modules 위에 이어서 설치 (더 빠름)
 */
async function runNpmInstallSafe(cwd, label) {
  console.log(`📦 ${label} 의존성을 설치합니다...\n`);

  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('   ⏭️  package.json 없음');
    return { success: true };
  }

  // 이미 설치 완료되었으면 skip
  const markerPath = path.join(cwd, 'node_modules', '.package-lock.json');
  if (fs.existsSync(markerPath)) {
    console.log('   ⏭️  이미 설치됨 (node_modules 존재)');
    return { success: true };
  }

  // 메모리 제한 npm install (512MB 힙)
  const installCmd = buildNpmCommand('install --no-audit --no-fund');
  console.log(`   ${installCmd} (max-old-space-size=512)`);
  await execAsync(installCmd, {
    cwd,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
    timeout: 300000 // 5분
  });

  console.log(`\n   ✅ ${label} 의존성 설치 완료`);
  return { success: true };
}

async function runGitInit(progress) {
  console.log('🔧 Git 저장소를 초기화합니다...\n');
  
  const gitDir = path.join(PROJECT_ROOT, '.git');
  if (fs.existsSync(gitDir)) {
    console.log('   ⏭️  이미 Git 저장소 존재');
    return { success: true };
  }
  
  await execAsync('git init -b main', { cwd: PROJECT_ROOT });
  await execAsync('git config user.name "ClinicOS Local"', { cwd: PROJECT_ROOT });
  await execAsync('git config user.email "local@clinic-os.local"', { cwd: PROJECT_ROOT });
  
  // core/.git 제거 (embedded git 문제 방지)
  const coreGitDir = path.join(PROJECT_ROOT, 'core', '.git');
  if (fs.existsSync(coreGitDir)) {
    fs.removeSync(coreGitDir);
    console.log('   🧹 core/.git 제거');
  }
  
  // 초기 커밋
  await execAsync('git add -A', { cwd: PROJECT_ROOT });
  await execAsync('git commit -m "Initial: Clinic-OS 설치" --no-verify', { cwd: PROJECT_ROOT })
    .catch(() => console.log('   ⚠️  초기 커밋 실패 (무시)'));
  
  console.log('   ✅ Git 초기화 완료');
  return { success: true };
}

async function runCorePull(progress) {
  console.log('📥 코어 파일을 다운로드합니다...\n');
  
  if (!progress.context.deviceToken) {
    throw new Error('deviceToken 없음. device-register 단계 먼저 실행');
  }
  
  // 이미 core 디렉토리에 파일이 있으면 skip
  const coreIndexPath = path.join(PROJECT_ROOT, 'core', 'src', 'pages', 'index.astro');
  if (fs.existsSync(coreIndexPath)) {
    console.log('   ⏭️  이미 코어 파일이 존재합니다.');
    return { success: true };
  }
  
  const corePath = path.join(PROJECT_ROOT, 'core');
  fs.ensureDirSync(corePath);
  
  // Issue #1 Fix: core/.gitkeep 제거 (git clone이 빈 디렉토리 필요)
  const gitkeepPath = path.join(corePath, '.gitkeep');
  if (fs.existsSync(gitkeepPath)) {
    fs.removeSync(gitkeepPath);
    console.log('   🧹 core/.gitkeep 제거 (git clone 준비)');
  }
  
  // HQ에서 Git URL 획득
  console.log('   🔑 HQ에서 Git URL 획득...');
  let gitUrl = 'https://github.com/xulfereht/clinic-os-core.git';
  try {
    const response = await fetch(`${progress.context.hqUrl}/api/v1/update/git-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_token: progress.context.deviceToken,
        channel: progress.context.channel || 'stable'
      })
    });
    if (response.ok) {
      const data = await response.json();
      gitUrl = data.git_url || gitUrl;
    }
  } catch (e) {
    console.log('   ⚠️  HQ 연결 실패, 기본 URL 사용');
  }
  
  // Shallow clone (메모리 절약)
  console.log('   📦 Shallow clone 진행 (--depth 1)...');
  await execAsync(`git clone --depth 1 --filter=blob:none ${gitUrl} .`, {
    cwd: corePath
  });
  
  // upstream remote 설정
  await execAsync(`git remote add upstream ${gitUrl}`, { cwd: PROJECT_ROOT })
    .catch(() => console.log('   ℹ️  upstream 이미 존재'));
  await execAsync('git remote set-url --push upstream DISABLE', { cwd: PROJECT_ROOT });
  
  // .core/version 생성
  const versionFile = path.join(PROJECT_ROOT, '.core', 'version');
  fs.ensureDirSync(path.dirname(versionFile));
  fs.writeFileSync(versionFile, 'latest-stable');
  
  console.log('   ✅ 코어 다운로드 완료');
  return { success: true };
}

async function runDbMigrate(progress) {
  console.log('🗃️  데이터베이스 마이그레이션을 실행합니다...\n');
  
  const dbName = progress.context.dbName || 'my-clinic-db';
  
  // 마이그레이션 파일 경로 찾기
  let migrationsDir = path.join(PROJECT_ROOT, 'core', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.join(PROJECT_ROOT, 'migrations');
  }
  
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('로컬 DB 마이그레이션 디렉토리가 없습니다.');
  }
  
  // wrangler/workerd 프로세스 정리 (DB 잠금 방지)
  // 주의: DB 상태 자체는 삭제하지 않음 (재시도 시 기존 마이그레이션 보존)
  try {
    execSync('pkill -f workerd', { stdio: 'ignore' });
  } catch (e) {
    // 프로세스 없으면 무시
  }
  
  // 통합 마이그레이션 엔진 사용
  const migratePath = path.join(PROJECT_ROOT, '.docking', 'engine', 'migrate.js');
  if (fs.existsSync(migratePath)) {
    const { runMigrations } = await import(migratePath);
    const result = await runMigrations({ local: true, verbose: false, verify: false });
    let schemaResult = null;

    if (result.success) {
      const { runSchemaDoctor } = await import('./doctor.js');
      schemaResult = await runSchemaDoctor(dbName, { fix: false, verbose: false });
    }

    const report = buildLocalDbBootstrapReport({
      hasMigrationFiles: true,
      migrationResult: result,
      schemaResult,
      seedResults: [],
    });

    if (!report.ok) {
      throw new Error(report.issues.join(' / '));
    }

    console.log(`   ✅ ${result.applied}개 마이그레이션 적용`);
  } else {
    throw new Error('로컬 DB 마이그레이션 엔진을 찾을 수 없습니다.');
  }
  
  return { success: true };
}

async function runDbSeed(progress, seedType) {
  const seedMap = {
    'db-seed:clinic': { file: 'seeds/sample_clinic.sql', name: '병원 기본' },
    'db-seed:terms': { file: 'seeds/terms_definitions.sql', name: '약관' },
    'db-seed:pages': { file: 'seeds/default_pages.sql', name: '기본 페이지' },
    'db-seed:staff': { file: 'seeds/sample_ops_data.sql', name: '운영 데이터' },
    'db-seed:content': { file: 'seeds/program_translations_sample.sql', name: '콘텐츠' },
    'db-seed:patients': { file: 'seeds/sample_patients.sql', name: '환자 샘플' },
    'db-seed:system': { file: 'seeds/knowledge_seed.sql', name: '시스템' }
  };
  
  const config = seedMap[seedType];
  if (!config) {
    throw new Error(`Unknown seed type: ${seedType}`);
  }
  
  console.log(`🌱 DB 시드: ${config.name}...\n`);
  
  const dbName = progress.context.dbName || 'my-clinic-db';
  let seedPath = path.join(PROJECT_ROOT, config.file);
  
  if (!fs.existsSync(seedPath)) {
    // core 내부 시도
    seedPath = path.join(PROJECT_ROOT, 'core', config.file);
  }
  
  if (!fs.existsSync(seedPath)) {
    console.log(`   ⏭️  ${config.file} 없음`);
    return { success: true };
  }
  
  // wrangler d1 execute
  try {
    const wranglerCmd = getWranglerCmd();
    await execAsync(`${wranglerCmd} d1 execute ${dbName} --local --file=${seedPath} --yes`, {
      timeout: 60000 // 60초 타임아웃
    });
    console.log(`   ✅ ${config.name} 시드 완료`);
  } catch (e) {
    throw new Error(`${config.name} 시드 실패: ${e.message}`);
  }
  
  return { success: true };
}

function getWranglerCmd() {
  const rootWrangler = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler');
  const coreWrangler = path.join(PROJECT_ROOT, 'core', 'node_modules', '.bin', 'wrangler');
  
  if (process.platform === 'win32') {
    if (fs.existsSync(rootWrangler + '.cmd')) return rootWrangler + '.cmd';
    if (fs.existsSync(coreWrangler + '.cmd')) return coreWrangler + '.cmd';
  } else {
    if (fs.existsSync(rootWrangler)) return rootWrangler;
    if (fs.existsSync(coreWrangler)) return coreWrangler;
  }
  return 'npx wrangler';
}

async function runOnboardingInit(progress) {
  console.log('📋 온보딩 상태를 초기화합니다...\n');
  
  const agentDir = path.join(PROJECT_ROOT, '.agent');
  const statePath = path.join(agentDir, 'onboarding-state.json');
  
  if (fs.existsSync(statePath)) {
    console.log('   ⏭️  이미 온보딩 상태가 존재합니다.');
    return { success: true };
  }
  
  // onboarding-registry.json 로드
  const registryPath = path.join(agentDir, 'onboarding-registry.json');
  let featureStates = {};
  
  if (fs.existsSync(registryPath)) {
    try {
      const registry = fs.readJsonSync(registryPath);
      for (const feature of registry.features) {
        featureStates[feature.id] = {
          status: 'pending',
          updated_at: null,
          notes: null
        };
      }
      console.log(`   ✅ ${Object.keys(featureStates).length}개 기능 레지스트리 로드`);
    } catch (e) {
      console.log('   ⚠️  레지스트리 읽기 실패:', e.message);
    }
  }
  
  const state = {
    initialized_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    current_tier: 1,
    deployment_count: 0,
    briefing_completed_at: null,
    chosen_track: {
      mode: 'recommended',
      tier: 1,
      feature_id: null,
      updated_at: null,
      notes: null
    },
    current_focus: {
      feature_id: null,
      checkpoint: null,
      updated_at: null
    },
    session_notes: [],
    deferred_items: [],
    clinic_name: progress.context.clinicName,
    features: featureStates
  };
  
  fs.ensureDirSync(agentDir);
  fs.writeJsonSync(statePath, state, { spaces: 2 });
  
  console.log('   ✅ 온보딩 상태 초기화 완료');
  console.log('\n   🎉 설치가 완료되었습니다!');
  console.log('   다음 명령어로 온보딩을 시작하세요:');
  console.log('   npm run dev');
  console.log('   # 브라우저에서 http://localhost:4321/admin 접속');
  
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// 메인 실행 로직
// ═══════════════════════════════════════════════════════════════

async function printStatus(progress) {
  console.log('\n📊 Clinic-OS 설치 상태\n');
  
  const done = progress.steps.filter(s => s.status === 'done').length;
  const pending = progress.steps.filter(s => s.status === 'pending').length;
  const failed = progress.steps.filter(s => s.status === 'failed').length;
  const inProgress = progress.steps.filter(s => s.status === 'in_progress').length;
  
  console.log(`   진행: ${done}/${progress.steps.length} 완료`);
  console.log(`   남음: ${pending}개`);
  if (failed > 0) console.log(`   실패: ${failed}개`);
  if (inProgress > 0) console.log(`   진행중: ${inProgress}개`);
  
  console.log('\n   단계별 상태:');
  let currentPhase = 0;
  for (const step of progress.steps) {
    if (step.phase !== currentPhase) {
      currentPhase = step.phase;
      console.log(`\n   Phase ${currentPhase}:`);
    }
    const icon = step.status === 'done' ? '✅' : 
                 step.status === 'in_progress' ? '🔄' : 
                 step.status === 'failed' ? '❌' : '⏳';
    console.log(`      ${icon} ${step.name}`);
  }
  
  const next = getNextStep(progress);
  if (next) {
    console.log(`\n   다음 단계: ${next.step.id}`);
    if (next.isRetry) {
      console.log('   ⚠️  이전 실행이 중단됨. 해당 단계를 재시도합니다.');
    }
  } else {
    console.log('\n   ✅ 모든 단계 완료!');
  }
  
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  // --status: 상태만 출력
  if (args.includes('--status')) {
    const progress = loadProgress();
    await printStatus(progress);
    process.exit(0);
  }
  
  // --reset: 상태 초기화
  if (args.includes('--reset')) {
    console.log('🗑️  설치 상태를 초기화합니다...');
    if (fs.existsSync(PROGRESS_PATH)) {
      fs.removeSync(PROGRESS_PATH);
    }
    console.log('   ✅ 초기화 완료. 다시 시작하려면:');
    console.log('   npm run setup:step -- --next\n');
    process.exit(0);
  }
  
  // --step=xxx: 특정 단계 실행
  const stepArg = args.find(a => a.startsWith('--step='));
  if (stepArg) {
    const stepId = stepArg.split('=')[1];
    const progress = loadProgress();
    const stepIndex = progress.steps.findIndex(s => s.id === stepId);
    
    if (stepIndex === -1) {
      console.error(`❌ 알 수 없는 단계: ${stepId}`);
      process.exit(1);
    }
    
    const step = progress.steps[stepIndex];
    if (step.status === 'done') {
      console.log(`✅ ${stepId}는 이미 완료되었습니다.`);
      process.exit(0);
    }
    
    // 해당 단계만 실행
    try {
      step.status = 'in_progress';
      step.startedAt = new Date().toISOString();
      step.attempts = (step.attempts || 0) + 1;
      saveProgress(progress);
      
      await executeStep(stepId, progress);
      
      step.status = 'done';
      step.completedAt = new Date().toISOString();
      saveProgress(progress);
      
      console.log(`\n✅ ${stepId} 완료`);
      process.exit(0);
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      saveProgress(progress);
      
      // Error Recovery System에 기록
      try {
        const { recordError } = await import('./lib/error-recovery.mjs');
        const stepDef = SETUP_STEPS.find(s => s.id === stepId);
        await recordError(error, {
          command: `npm run setup:step -- --step=${stepId}`,
          step: stepId,
          stepName: stepDef?.name,
          phase: stepDef?.phase,
          attempt: step.attempts
        });
      } catch (e) {
        // 에러 기록 실패핏도 계속
      }
      
      console.error(`\n❌ ${stepId} 실패: ${error.message}`);
      process.exit(1);
    }
  }
  
  // --next: 다음 pending 단계 실행 (기본)
  const progress = loadProgress();
  const next = getNextStep(progress);
  
  if (!next) {
    console.log('\n✅ 모든 설치 단계가 완료되었습니다!');
    console.log('   다음 명령어로 개발 서버를 실행하세요:');
    console.log('   npm run dev\n');
    process.exit(0);
  }
  
  const { step, isRetry } = next;
  const stepDef = SETUP_STEPS.find(s => s.id === step.id);
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`   ${stepDef.phase}. ${stepDef.name}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  if (isRetry) {
    console.log(`🔄 이전 실행이 중단됨 (시도 ${step.attempts + 1}회차)\n`);
  }
  
  // 실행
  try {
    step.status = 'in_progress';
    step.startedAt = new Date().toISOString();
    step.attempts = (step.attempts || 0) + 1;
    saveProgress(progress);
    
    await executeStep(step.id, progress);
    
    step.status = 'done';
    step.completedAt = new Date().toISOString();
    saveProgress(progress);
    
    console.log(`\n✅ ${stepDef.name} 완료 (${step.attempts}회차)`);
    
    // 다음 단계 안내
    const remaining = progress.steps.filter(s => s.status !== 'done').length;
    if (remaining > 0) {
      console.log(`\n   다음 단계를 실행하려면:`);
      console.log('   npm run setup:step -- --next');
      console.log(`\n   (남은 단계: ${remaining}개)`);
    } else {
      console.log('\n   🎉 모든 설치 완료!');
      console.log('   npm run dev');
    }
    console.log('');
    process.exit(0);
    
  } catch (error) {
    step.status = 'failed';
    step.error = error.message;
    saveProgress(progress);
    
    // Error Recovery System에 기록
    try {
      const { recordError } = await import('./lib/error-recovery.mjs');
      await recordError(error, {
        command: 'npm run setup:step -- --next',
        step: step.id,
        stepName: stepDef.name,
        phase: stepDef.phase,
        attempt: step.attempts
      });
    } catch (e) {
      // 에러 기록 실패핏도 계속
    }
    
    console.error(`\n❌ ${stepDef.name} 실패`);
    console.error(`   오류: ${error.message}\n`);
    console.log('   재시도하려면:');
    console.log('   npm run setup:step -- --next');
    console.log('\n   또는 특정 단계만 재시도:');
    console.log(`   npm run setup:step -- --step=${step.id}\n`);
    console.log('   에러 복구 정보:');
    console.log('   npm run setup:status\n');
    
    process.exit(1);
  }
}

async function executeStep(stepId, progress) {
  switch (stepId) {
    case 'check-system':
      return runCheckSystem(progress);
    case 'init-config':
      return runInitConfig(progress);
    case 'cf-login':
      return runCfLogin(progress);
    case 'device-register':
      return runDeviceRegister(progress);
    case 'npm-install-root':
      return runNpmInstallRoot(progress);
    case 'npm-install-core':
      return runNpmInstallCore(progress);
    case 'git-init':
      return runGitInit(progress);
    case 'core-pull':
      return runCorePull(progress);
    case 'db-migrate':
      return runDbMigrate(progress);
    case 'db-seed:clinic':
      return runDbSeed(progress, 'db-seed:clinic');
    case 'db-seed:terms':
      return runDbSeed(progress, 'db-seed:terms');
    case 'db-seed:pages':
      return runDbSeed(progress, 'db-seed:pages');
    case 'db-seed:staff':
      return runDbSeed(progress, 'db-seed:staff');
    case 'db-seed:content':
      return runDbSeed(progress, 'db-seed:content');
    case 'db-seed:patients':
      return runDbSeed(progress, 'db-seed:patients');
    case 'db-seed:system':
      return runDbSeed(progress, 'db-seed:system');
    case 'onboarding-init':
      return runOnboardingInit(progress);
    default:
      throw new Error(`Unknown step: ${stepId}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
