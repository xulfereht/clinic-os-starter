#!/usr/bin/env node
/**
 * Clinic-OS Agent Installer
 * 
 * 에이전트가 스타터킷을 열자마자 자동으로 실행하는 완전 자동화 인스톨러
 * - 고성능 fresh install + signed clinic.json 환경에서는 setup:fast를 자동 선택할 수 있음
 * - 실패 시 setup:step으로 자동 폴백
 * 
 * 사용법:
 *   npm run setup:agent              # 완전 자동 모드
 *   npm run setup:agent -- --prefer-fast  # fast setup 우선 시도
 *   npm run setup:agent -- --token=xxx  # 미리 발급받은 토큰으로 진행
 *   npm run setup:agent -- --skip-auth  # 인증 없이 로컬만 설정
 */

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const CONTEXT_PATH = path.join(PROJECT_ROOT, '.agent', 'agent-context.json');
const PROGRESS_PATH = path.join(PROJECT_ROOT, '.agent', 'setup-progress.json');
const RUNTIME_CONTEXT_CMD = ['node', 'scripts/generate-agent-context.js', '--quiet'];
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

function readAgentContext() {
  try {
    return fs.existsSync(CONTEXT_PATH) ? fs.readJsonSync(CONTEXT_PATH) : null;
  } catch {
    return null;
  }
}

function writeAgentContext(patch) {
  const current = readAgentContext() || {
    version: '1.1',
    stage: 'detect',
    updated_at: null,
    setup: {
      step: 0,
      total: 16,
      completed: 0,
      status: 'pending'
    }
  };

  const next = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
    setup: {
      ...current.setup,
      ...(patch.setup || {})
    }
  };

  fs.ensureDirSync(path.dirname(CONTEXT_PATH));
  fs.writeJsonSync(CONTEXT_PATH, next, { spaces: 2 });
  return next;
}

function summarizeProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) {
    return { total: 16, completed: 0, pending: 16 };
  }

  try {
    const progress = fs.readJsonSync(PROGRESS_PATH);
    const steps = progress.steps || [];
    return {
      total: steps.length || 16,
      completed: steps.filter((step) => step.status === 'done').length,
      pending: steps.filter((step) => step.status === 'pending').length
    };
  } catch {
    return { total: 16, completed: 0, pending: 16 };
  }
}

function getSystemProfile() {
  const totalMemoryGb = os.totalmem() / 1024 / 1024 / 1024;
  const platform = os.platform();

  return {
    platform,
    totalMemoryGb: Number(totalMemoryGb.toFixed(1)),
    isWindows: platform === 'win32',
    supportsFastSetup: platform !== 'win32' && totalMemoryGb >= 8
  };
}

function assertSupportedInstallPlatform() {
  const profile = getSystemProfile();
  if (!profile.isWindows) return;

  throw new Error('네이티브 Windows 설치는 지원하지 않습니다. macOS 또는 WSL Ubuntu에서 setup:agent를 실행하세요.');
}

function readSignedClinicConfig() {
  const clinicPath = path.join(PROJECT_ROOT, 'clinic.json');
  if (!fs.existsSync(clinicPath)) return null;

  try {
    const config = fs.readJsonSync(clinicPath);
    return {
      exists: true,
      licenseKey: config.license_key || '',
      organization: config.organization || '',
      channel: config.channel || 'stable'
    };
  } catch {
    return {
      exists: true,
      licenseKey: '',
      organization: '',
      channel: 'stable'
    };
  }
}

function canAutoRunFastSetup({ skipAuth, hasProgress }) {
  const profile = getSystemProfile();
  const signedClinic = readSignedClinicConfig();
  const hasLocalWranglerState = fs.existsSync(path.join(PROJECT_ROOT, '.wrangler', 'state'));
  const hasDockingConfig = fs.existsSync(path.join(PROJECT_ROOT, '.docking', 'config.yaml'));

  return {
    eligible: profile.supportsFastSetup
      && !skipAuth
      && !hasProgress
      && Boolean(signedClinic?.licenseKey)
      && !hasLocalWranglerState
      && !hasDockingConfig,
    profile,
    signedClinic,
    reasons: {
      supportsFastSetup: profile.supportsFastSetup,
      skipAuth,
      hasProgress,
      hasSignedLicense: Boolean(signedClinic?.licenseKey),
      hasLocalWranglerState,
      hasDockingConfig
    }
  };
}

async function refreshRuntimeContext() {
  await new Promise((resolve) => {
    const proc = spawn(RUNTIME_CONTEXT_CMD[0], RUNTIME_CONTEXT_CMD.slice(1), {
      cwd: PROJECT_ROOT,
      stdio: 'ignore',
    });

    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}

async function runFastSetup() {
  log.step('고성능 빠른 설치 실행');
  log.info('setup:agent가 현재 환경을 고성능 fresh install로 판별했습니다. (macOS / WSL Ubuntu 기준)');
  log.info('setup:fast 실패 시 자동으로 단계별 설치로 폴백합니다.\n');

  const result = await new Promise((resolve) => {
    const proc = spawn('npm', ['run', 'setup:fast', '--', '--auto'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    proc.on('close', (code) => resolve(code));
    proc.on('error', () => resolve(1));
  });

  return result === 0;
}

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
        const summary = summarizeProgress();
        writeAgentContext({
          stage: 'setup',
          setup: {
            step,
            total: summary.total,
            completed: summary.completed,
            status: 'in_progress'
          }
        });
        step++;
        continue;
      }
    }
    
    // 미완료 단계 실행
    log.agent(`단계 ${step}/16 실행 중...`);
    writeAgentContext({
      stage: 'setup',
      setup: {
        step,
        total: 16,
        completed: Math.max(0, step - 1),
        status: 'in_progress'
      }
    });
    
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
  writeAgentContext({
    stage: 'complete',
    setup: {
      step: 16,
      total: 16,
      completed: 16,
      status: 'complete'
    }
  });
  await refreshRuntimeContext();
  
  // MEDIUM Fix: 설치 후 보안 감사 안내
  log.info('\n📋 설치 후 권장 조치:');
  console.log(`   ${C.cyan}npm audit${C.reset} - 의존성 보안 취약점 확인`);
  console.log(`   ${C.cyan}wrangler secret put ADMIN_PASSWORD${C.reset} - 프로덕션 비밀번호 설정`);
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  const argsSet = new Set(args);
  const skipAuth = argsSet.has('--skip-auth');
  const preferFast = argsSet.has('--prefer-fast');

  if (argsSet.has('--reset')) {
    fs.removeSync(CONTEXT_PATH);
    fs.removeSync(PROGRESS_PATH);
    log.success('에이전트 설치 상태를 초기화했습니다.');
    return;
  }

  if (argsSet.has('--status')) {
    const ctx = readAgentContext();
    const summary = summarizeProgress();
    if (ctx) {
      log.info(`현재 stage: ${ctx.stage}`);
      log.info(`완료 단계: ${ctx.setup?.completed || 0}/${ctx.setup?.total || 16}`);
    } else {
      log.info('agent-context.json이 아직 없습니다.');
    }
    log.info(`setup-progress: ${summary.completed}/${summary.total} 완료`);
    return;
  }

  console.log(`\n${C.cyan}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     ${C.bold}Clinic-OS Agent Installer${C.reset}              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}     자동화 설치를 시작합니다...              ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);

  assertSupportedInstallPlatform();

  // 🔍 스타터킷 초기 상태 감지
  const isStarterKitFresh = fs.existsSync(path.join(PROJECT_ROOT, '.agent', 'AGENT_INSTALLER.md'));
  const hasNodeModules = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'));
  const hasProgress = fs.existsSync(PROGRESS_PATH);
  const fastSetupDecision = canAutoRunFastSetup({ skipAuth, hasProgress });

  try {
    writeAgentContext({
      stage: 'detect',
      mode: skipAuth ? 'skip-auth' : 'default',
      system_profile: fastSetupDecision.profile,
      fast_setup: {
        recommended: fastSetupDecision.profile.supportsFastSetup,
        auto_selected: false,
        eligible: fastSetupDecision.eligible
      }
    });

    // 이미 clinic-os 안에 있고 스타터킷이 설치된 상태면 바로 설치 진행
    if (isStarterKitFresh && hasNodeModules) {
      log.success('스타터킷 초기 상태가 확인되었습니다.');
      if (fastSetupDecision.profile.supportsFastSetup) {
        log.info(`고성능 환경 감지: ${fastSetupDecision.profile.platform}, 메모리 ${fastSetupDecision.profile.totalMemoryGb}GB`);
      }
      log.info('설치를 바로 진행합니다.\n');
      writeAgentContext({
        stage: 'setup',
        setup: {
          ...summarizeProgress(),
          status: hasProgress ? 'in_progress' : 'pending'
        }
      });

      const canSafelyAttemptFast = fastSetupDecision.profile.supportsFastSetup
        && !fastSetupDecision.reasons.hasLocalWranglerState
        && !fastSetupDecision.reasons.hasDockingConfig;
      const shouldAutoFast = fastSetupDecision.eligible || (preferFast && canSafelyAttemptFast);
      if (!hasProgress && shouldAutoFast) {
        const fastOk = await runFastSetup();
        if (fastOk) {
          writeAgentContext({
            stage: 'complete',
            fast_setup: {
              recommended: true,
              auto_selected: true,
              eligible: fastSetupDecision.eligible
            },
            setup: {
              step: 16,
              total: 16,
              completed: 16,
              status: 'complete'
            }
          });
          await refreshRuntimeContext();

          console.log(`\n${C.green}${C.bold}╔════════════════════════════════════════════════╗${C.reset}`);
          console.log(`${C.green}${C.bold}║${C.reset}     ${C.bold}🎉 빠른 설치가 완료되었습니다!${C.reset}           ${C.green}${C.bold}║${C.reset}`);
          console.log(`${C.green}${C.bold}╚════════════════════════════════════════════════╝${C.reset}\n`);
          log.info('다음 명령어로 개발 서버를 시작하세요:');
          console.log(`\n  ${C.cyan}npm run dev${C.reset}\n`);
          return;
        }

        log.warning('setup:fast 실패 — 단계별 설치로 자동 전환합니다.');
      } else if (!hasProgress && preferFast && !canSafelyAttemptFast) {
        log.warning('기존 로컬 상태가 감지되어 setup:fast 강제 실행을 건너뜁니다.');
        log.info('이 경우에는 단계별 설치가 더 안전합니다.');
      } else if (!hasProgress && fastSetupDecision.profile.supportsFastSetup) {
        log.info('이 환경은 setup:fast 후보이지만, 현재 상태에서는 단계별 설치를 유지합니다.');
      }
      
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
          writeAgentContext({
            stage: 'complete',
            setup: {
              step: 16,
              total: 16,
              completed: 16,
              status: 'complete'
            }
          });
          await refreshRuntimeContext();
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
      console.log(`  ${C.cyan}npm run setup:fast${C.reset} (고성능 macOS/WSL Ubuntu 환경용 빠른 일괄 설치)`);
      console.log(`  ${C.cyan}npm run setup:step -- --reset && npm run setup:step -- --next${C.reset} (권장, 단계별)`);
      console.log(`  ${C.cyan}npm run setup${C.reset} (레거시 대화형)\n`);
    }

  } catch (error) {
    writeAgentContext({
      stage: 'error',
      last_error: error.message,
      setup: {
        ...summarizeProgress(),
        status: 'error'
      }
    });
    log.error(`설치 실패: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  log.error(`예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
