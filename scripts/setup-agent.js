#!/usr/bin/env node
/**
 * Clinic-OS Agent Installer
 * 
 * 에이전트가 스타터킷을 열자마자 자동으로 실행하는 완전 자동화 인스톨러
 * 
 * 특징:
 * - 브라우저 없이 CLI 기반 인증 (Device Code Flow)
 * - 자동 상태 감지 및 진행
 * - 대화 없이 선언적 실행
 * - 진행 상황을 .agent/agent-context.json에 저장
 * 
 * 사용법:
 *   npm run setup:agent              # 완전 자동 모드
 *   npm run setup:agent -- --token=xxx  # 미리 발급받은 토큰으로 진행
 *   npm run setup:agent -- --skip-auth  # 인증 없이 로컬만 설정
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const CONTEXT_PATH = path.join(PROJECT_ROOT, '.agent', 'agent-context.json');
const PROGRESS_PATH = path.join(PROJECT_ROOT, '.agent', 'setup-progress.json');
const HQ_URL = 'https://clinic-os-hq.pages.dev';

// 색상 코드
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

const log = {
  info: (msg) => console.log(`${C.blue}ℹ${C.reset} ${msg}`),
  success: (msg) => console.log(`${C.green}✓${C.reset} ${msg}`),
  warning: (msg) => console.log(`${C.yellow}⚠${C.reset} ${msg}`),
  error: (msg) => console.log(`${C.red}✗${C.reset} ${msg}`),
  step: (msg) => console.log(`\n${C.cyan}${C.bold}▶${C.reset} ${C.bold}${msg}${C.reset}`),
  agent: (msg) => console.log(`${C.cyan}🤖${C.reset} ${msg}`),
};

// 컨텍스트 관리
class AgentContext {
  constructor() {
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(CONTEXT_PATH)) {
      return fs.readJsonSync(CONTEXT_PATH);
    }
    return {
      version: '1.0',
      created_at: new Date().toISOString(),
      stage: 'init', // init → auth → download → install → setup → complete
      auth: { method: null, token: null, status: 'pending' },
      setup: { step: 0, total: 16, status: 'pending' },
      onboarding: { tier: 1, status: 'pending' },
      logs: [],
    };
  }

  save() {
    fs.ensureDirSync(path.dirname(CONTEXT_PATH));
    fs.writeJsonSync(CONTEXT_PATH, this.data, { spaces: 2 });
  }

  log(message) {
    this.data.logs.push({
      time: new Date().toISOString(),
      message,
    });
    this.save();
  }

  setStage(stage) {
    this.data.stage = stage;
    this.save();
  }

  setAuth(method, token = null) {
    this.data.auth = { method, token, status: token ? 'complete' : 'pending' };
    this.save();
  }
}

// 디바이스 코드 인증 (CLI 친화적)
async function deviceAuthCLI() {
  log.step('HQ 인증 시작');
  log.info('브라우저가 열리면 코드를 입력해주세요...');

  try {
    const response = await fetch(`${HQ_URL}/api/auth/device`, { method: 'POST' });
    const data = await response.json();
    
    if (!data.device_code || !data.user_code) {
      throw new Error('인증 서버 응답 오류');
    }

    console.log(`\n${C.yellow}${C.bold}╔══════════════════════════════════════╗${C.reset}`);
    console.log(`${C.yellow}${C.bold}║${C.reset}  ${C.bold}브라우저에서 이 코드를 입력하세요:${C.reset}  ${C.yellow}${C.bold}║${C.reset}`);
    console.log(`${C.yellow}${C.bold}║${C.reset}                                      ${C.yellow}${C.bold}║${C.reset}`);
    console.log(`${C.yellow}${C.bold}║${C.reset}        ${C.cyan}${C.bold}${data.user_code}${C.reset}              ${C.yellow}${C.bold}║${C.reset}`);
    console.log(`${C.yellow}${C.bold}║${C.reset}                                      ${C.yellow}${C.bold}║${C.reset}`);
    console.log(`${C.yellow}${C.bold}╚══════════════════════════════════════╝${C.reset}\n`);

    // 브라우저 열기 시도
    const openCommands = [
      () => import('child_process').then(cp => cp.execSync(`open "${data.verification_uri}"`, { stdio: 'ignore' })),
      () => import('child_process').then(cp => cp.execSync(`xdg-open "${data.verification_uri}"`, { stdio: 'ignore' })),
      () => import('child_process').then(cp => cp.execSync(`start "" "${data.verification_uri}"`, { stdio: 'ignore' })),
    ];

    for (const cmd of openCommands) {
      try { await cmd(); break; } catch (e) { /* ignore */ }
    }

    log.info(`URL: ${data.verification_uri}`);
    log.info('인증 대기 중... (최대 15분)');

    // 폴링
    const maxAttempts = 180;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      process.stdout.write('.');

      const pollResponse = await fetch(`${HQ_URL}/api/auth/device/poll?device_code=${data.device_code}`);
      const pollData = await pollResponse.json();

      if (pollData.status === 'complete') {
        console.log('');
        log.success(`인증 완료! (${pollData.organization || 'Clinic-OS'})`);
        return pollData.access_token;
      } else if (pollData.status === 'expired_token') {
        throw new Error('인증 시간이 만료되었습니다.');
      }
    }

    throw new Error('인증 시간이 초과되었습니다.');
  } catch (error) {
    log.error(`인증 실패: ${error.message}`);
    throw error;
  }
}

// 스타터킷 다운로드
async function downloadStarterKit(token, channel = 'stable') {
  log.step('스타터킷 다운로드');
  
  const downloadUrl = `${HQ_URL}/api/v1/starter-kit?channel=${channel}`;
  const zipPath = path.join(PROJECT_ROOT, 'clinic-os-starter.zip');

  try {
    const response = await fetch(downloadUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`다운로드 실패: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    
    // ZIP 검증
    const stats = fs.statSync(zipPath);
    if (stats.size < 10240) {
      throw new Error('다운로드된 파일이 너무 작습니다.');
    }

    log.success(`스타터킷 다운로드 완료 (${(stats.size / 1024).toFixed(1)} KB)`);
    return zipPath;
  } catch (error) {
    log.error(`다운로드 실패: ${error.message}`);
    throw error;
  }
}

// 압축 해제
async function extractStarterKit(zipPath) {
  log.step('스타터킷 압축 해제');

  const extract = await import('unzipper');
  const targetDir = PROJECT_ROOT;

  // 이미 clinic-os 폴더가 있으면 백업
  const existingFiles = ['.docking', '.agent', 'core', 'scripts'].filter(f => 
    fs.existsSync(path.join(targetDir, f))
  );

  if (existingFiles.length > 0) {
    log.warning('기존 설치 파일이 감지되었습니다');
    log.info(`감지된 항목: ${existingFiles.join(', ')}`);
    
    // 백업
    const backupDir = path.join(PROJECT_ROOT, `backup-${Date.now()}`);
    fs.ensureDirSync(backupDir);
    
    for (const file of existingFiles) {
      fs.moveSync(path.join(targetDir, file), path.join(backupDir, file), { overwrite: true });
    }
    log.success(`기존 파일 백업 완료: ${backupDir}`);
  }

  // 압축 해제
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(extract.default.Extract({ path: targetDir }))
      .on('close', () => {
        fs.removeSync(zipPath);
        log.success('압축 해제 완료');
        resolve();
      })
      .on('error', reject);
  });
}

// npm install
async function npmInstall() {
  log.step('의존성 설치');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['install'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });

    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });

    proc.on('close', (code) => {
      if (code === 0) {
        log.success('의존성 설치 완료');
        resolve();
      } else {
        reject(new Error(`npm install 실패 (코드: ${code})`));
      }
    });
  });
}

// setup:step 자동 실행
async function runSetupSteps() {
  log.step('설치 단계 자동 실행');
  log.info('총 16단계를 순차적으로 실행합니다...\n');

  // setup-progress.json 초기화
  const setupProcess = spawn('npm', ['run', 'setup:step', '--', '--reset'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    setupProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`설치 초기화 실패 (코드: ${code})`));
    });
  });

  // 각 단계 순차 실행
  let step = 1;
  while (step <= 16) {
    log.agent(`단계 ${step}/16 실행 중...`);
    
    const result = await new Promise((resolve) => {
      const proc = spawn('npm', ['run', 'setup:step', '--', '--next'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
      
      proc.on('close', (code) => resolve(code));
    });

    if (result !== 0) {
      log.error(`단계 ${step} 실패`);
      throw new Error(`설치 단계 ${step} 실패`);
    }

    step++;
  }

  log.success('모든 설치 단계 완료!');
}

// 메인 실행 흐름
async function main() {
  const args = process.argv.slice(2);
  const token = args.find(a => a.startsWith('--token='))?.split('=')[1];
  const skipAuth = args.includes('--skip-auth');
  const channel = args.find(a => a.startsWith('--channel='))?.split('=')[1] || 'stable';

  console.log(`\n${C.cyan}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     ${C.bold}Clinic-OS Agent Installer${C.reset}              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     자동화 설치를 시작합니다...              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);

  const ctx = new AgentContext();
  ctx.log('Agent installer started');


  // 🔍 스타터킷 초기 상태 감지 (이미 clinic-os 안에 있는지 확인)
  const isStarterKitFresh = fs.existsSync(path.join(PROJECT_ROOT, '.agent', 'AGENT_INSTALLER.md'));
  const hasCore = fs.existsSync(path.join(PROJECT_ROOT, 'core'));
  const hasNodeModules = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'));

  // 이미 clinic-os 안에 있고 스타터킷이 설치된 상태면 인증/다운로드 스킵
  if (isStarterKitFresh && hasNodeModules) {
    log.success('스타터킷 초기 상태가 확인되었습니다.');
    log.info('인증 및 다운로드를 스킵하고 설치를 바로 진행합니다.');
    ctx.setAuth('none');
    
    // 바로 설치 단계로 진행
    if (!fs.existsSync(PROGRESS_PATH)) {
      ctx.setStage('setup');
      await runSetupSteps();
    } else {
      const progress = fs.readJsonSync(PROGRESS_PATH);
      const pending = progress.steps?.filter(s => s.status === 'pending').length || 0;
      
      if (pending > 0) {
        log.info(`남은 설치 단계: ${pending}개`);
        await runSetupSteps();
      } else {
        log.success('설치가 이미 완료되었습니다.');
      }
    }
    
    // 완료 처리
    ctx.setStage('complete');
    ctx.data.setup.status = 'complete';
    ctx.save();

    console.log(`\n${C.green}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.green}${C.bold}║${C.reset}     ${C.bold}🎉 설치가 완료되었습니다!${C.reset}               ${C.green}${C.bold}║${C.reset}`);
    console.log(`${C.green}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);
    
    log.info('다음 명령어로 개발 서버를 시작하세요:');
    console.log(`\n  ${C.cyan}npm run dev${C.reset}\n`);
    
    return;
  }

  try {
    // 1. 인증 단계
    ctx.setStage('auth');
    let accessToken = null;

    if (token) {
      log.info('제공된 토큰을 사용합니다');
      accessToken = token;
      ctx.setAuth('cli-token', token);
    } else if (!skipAuth) {
      accessToken = await deviceAuthCLI();
      ctx.setAuth('device-code', accessToken);
    } else {
      log.warning('인증을 건너뜁니다 (로컬 모드)');
      ctx.setAuth('none');
    }

    // 2. 다운로드 단계
    if (accessToken && !fs.existsSync(path.join(PROJECT_ROOT, 'core'))) {
      ctx.setStage('download');
      const zipPath = await downloadStarterKit(accessToken, channel);
      await extractStarterKit(zipPath);
    } else {
      log.info('스타터킷이 이미 존재합니다. 다운로드를 건너뜁니다.');
    }

    // 3. 의존성 설치
    if (!fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'))) {
      ctx.setStage('install');
      await npmInstall();
    } else {
      log.info('node_modules가 이미 존재합니다.');
    }

    // 4. 설치 단계 실행
    if (!fs.existsSync(PROGRESS_PATH)) {
      ctx.setStage('setup');
      await runSetupSteps();
    } else {
      const progress = fs.readJsonSync(PROGRESS_PATH);
      const pending = progress.steps?.filter(s => s.status === 'pending').length || 0;
      
      if (pending > 0) {
        log.info(`남은 설치 단계: ${pending}개`);
        await runSetupSteps();
      } else {
        log.success('설치가 이미 완료되었습니다.');
      }
    }

    // 5. 완료
    ctx.setStage('complete');
    ctx.data.setup.status = 'complete';
    ctx.save();

    console.log(`\n${C.green}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.green}${C.bold}║${C.reset}     ${C.bold}🎉 설치가 완료되었습니다!${C.reset}               ${C.green}${C.bold}║${C.reset}`);
    console.log(`${C.green}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);
    
    log.info('다음 명령어로 개발 서버를 시작하세요:');
    console.log(`\n  ${C.cyan}npm run dev${C.reset}\n`);

    log.info('또는 온보딩을 시작하려면:');
    console.log(`\n  ${C.cyan}npm run setup:agent -- --onboarding${C.reset}\n`);

  } catch (error) {
    log.error(`설치 실패: ${error.message}`);
    ctx.log(`ERROR: ${error.message}`);
    ctx.save();
    process.exit(1);
  }
}

main().catch(err => {
  log.error(`예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
