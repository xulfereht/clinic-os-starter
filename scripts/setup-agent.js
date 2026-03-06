#!/usr/bin/env node
/**
 * Clinic-OS Agent Installer
 * 
 * 에이전트가 스타터킷을 열자마자 자동으로 실행하는 완전 자동화 인스톨러
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

// setup:step 실행 (Issue #4 Fix: 실패 시 재시작하지 않고 해당 단계부터 재시도)
async function runSetupSteps() {
  log.step('설치 단계 자동 실행');
  log.info('총 16단계를 순차적으로 실행합니다...\n');
  log.info('ℹ️  이미 완료된 단계는 자동으로 skip됩니다.\n');

  // 각 단계 순차 실행 (--reset 없이, 이미 완료된 단계는 skip)
  let step = 1;
  let failedStep = null;
  
  while (step <= 16) {
    log.agent(`단계 ${step}/16 확인 중...`);
    
    // setup-progress.json 확인하여 이미 완료된 단계인지 체크
    if (fs.existsSync(PROGRESS_PATH)) {
      const progress = fs.readJsonSync(PROGRESS_PATH);
      const currentStepInfo = progress.steps?.[step - 1];
      
      if (currentStepInfo?.status === 'done') {
        log.success(`단계 ${step} 이미 완료 ✓`);
        step++;
        continue;
      }
    }
    
    // 미완료 단계 실행
    log.agent(`단계 ${step}/16 실행 중...`);
    
    const result = await new Promise((resolve) => {
      const proc = spawn('npm', ['run', 'setup:step', '--', '--next'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
      
      proc.on('close', (code) => resolve(code));
    });

    if (result !== 0) {
      failedStep = step;
      log.error(`\n❌ 단계 ${step} 실패`);
      log.info(`\n💡 재시도 방법:`);
      log.info(`   npm run setup:step -- --step=<단계ID>`);
      log.info(`   또는: npm run setup:step -- --next`);
      throw new Error(`설치 단계 ${step} 실패. 위 명령어로 재시도하세요.`);
    }

    step++;
  }

  log.success('모든 설치 단계 완료!');
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  const skipAuth = args.includes('--skip-auth');

  console.log(`\n${C.cyan}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     ${C.bold}Clinic-OS Agent Installer${C.reset}              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     자동화 설치를 시작합니다...              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);

  // 🔍 스타터킷 초기 상태 감지
  const isStarterKitFresh = fs.existsSync(path.join(PROJECT_ROOT, '.agent', 'AGENT_INSTALLER.md'));
  const hasNodeModules = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'));
  const hasProgress = fs.existsSync(PROGRESS_PATH);

  try {
    // 이미 clinic-os 안에 있고 스타터킷이 설치된 상태면 바로 설치 진행
    if (isStarterKitFresh && hasNodeModules) {
      log.success('스타터킷 초기 상태가 확인되었습니다.');
      log.info('설치를 바로 진행합니다.\n');
      
      // 바로 설치 단계로 진행
      if (!hasProgress) {
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
      
      // 완료
      console.log(`\n${C.green}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
      console.log(`${C.green}${C.bold}║${C.reset}     ${C.bold}🎉 설치가 완료되었습니다!${C.reset}               ${C.green}${C.bold}║${C.reset}`);
      console.log(`${C.green}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);
      
      log.info('다음 명령어로 개발 서버를 시작하세요:');
      console.log(`\n  ${C.cyan}npm run dev${C.reset}\n`);
      
      return;
    }

    // 스타터킷이 없으면 안내
    log.warning('스타터킷이 설치되지 않았습니다.');
    log.info('다음 명령어로 스타터킷을 다운로드하세요:');
    console.log(`\n  ${C.cyan}curl -fsSL https://clinic-os-hq.pages.dev/cos-setup.sh | bash${C.reset}\n`);
    
    if (skipAuth) {
      log.info('또는 로컬 모드로 설치:');
      console.log(`  ${C.cyan}npm run setup${C.reset} (대화형)`);
      console.log(`  ${C.cyan}npm run setup:step -- --reset && npm run setup:step -- --next${C.reset} (단계별)\n`);
    }

  } catch (error) {
    log.error(`설치 실패: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  log.error(`예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
