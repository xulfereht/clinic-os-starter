#!/usr/bin/env node
/**
 * Error Recovery System
 * 
 * Transaction System과 통합된 에러 복구 메커니즘
 * - last-error.json 자동 생성/관리
 * - Transaction 실패 시 자동 복구 절차 실행
 * - Audit log와 연동
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const MODULE_PATH = fileURLToPath(import.meta.url);
const __dirname = path.dirname(MODULE_PATH);
const PROJECT_ROOT = path.join(__dirname, '../..');
const AGENT_DIR = path.join(PROJECT_ROOT, '.agent');
const LAST_ERROR_FILE = path.join(AGENT_DIR, 'last-error.json');
const ERROR_SCHEMA_VERSION = 2;

// 에러 단계별 복구 시나리오
const RECOVERY_SCENARIOS = {
  'git-fetch': {
    name: 'Git Fetch 실패',
    description: 'upstream fetch 실패',
    commands: [
      'git init',
      'npm run core:pull -- --auto'
    ]
  },
  'migration': {
    name: 'DB 마이그레이션 실패',
    description: 'DB 마이그레이션/시드 실패',
    commands: [
      'npm run doctor',
      'npm run db:migrate'
    ]
  },
  'precondition': {
    name: '전제 조건 미충족',
    description: 'wrangler.toml 등 설정 파일 누락',
    commands: [
      'npm run setup:step -- --next'
    ]
  },
  'core-update': {
    name: '코어 업데이트 실패',
    description: 'core:pull 중 오류',
    commands: [
      'npm run core:rollback',
      'npm run core:pull'
    ]
  },
  'unknown': {
    name: '알 수 없는 에러',
    description: '분류 불가 에러',
    commands: [
      'npm run health',
      'npm run status'
    ]
  }
};

function ensureCommands(commands = []) {
  if (Array.isArray(commands)) {
    return commands.filter(Boolean).map((command) => String(command));
  }

  if (typeof commands === 'string' && commands.trim()) {
    return [commands.trim()];
  }

  return [];
}

function resolveCommand(command, context = {}) {
  if (command) {
    return String(command);
  }

  if (context.command) {
    return String(context.command);
  }

  const argv = process.argv.slice(1).filter(Boolean);
  if (argv.length === 0) {
    return null;
  }

  return ['node', ...argv].join(' ');
}

function normalizeError(error) {
  if (typeof error === 'string') {
    return {
      message: error,
      stack: null,
      code: 'UNKNOWN',
    };
  }

  if (error && typeof error === 'object') {
    return {
      message: error.message || String(error),
      stack: error.stack || null,
      code: error.code || 'UNKNOWN',
    };
  }

  return {
    message: String(error || 'Unknown error'),
    stack: null,
    code: 'UNKNOWN',
  };
}

function normalizeRecovery(phase, recovery = {}) {
  const scenario = RECOVERY_SCENARIOS[phase] || RECOVERY_SCENARIOS.unknown;
  const commands = ensureCommands(recovery.commands || scenario.commands);

  return {
    section: recovery.section || phase,
    name: recovery.name || scenario.name,
    description: recovery.description || scenario.description,
    workflow: recovery.workflow || '.agent/workflows/troubleshooting.md',
    suggestion: recovery.suggestion || null,
    commands,
    autoRecoverable:
      typeof recovery.autoRecoverable === 'boolean'
        ? recovery.autoRecoverable
        : ['precondition', 'git-fetch'].includes(phase),
  };
}

export function buildErrorRecord({
  error,
  phase,
  command,
  context = {},
  recovery = {},
  timestamp = new Date().toISOString(),
  attempts = [],
  source = 'runtime',
} = {}) {
  const normalizedError = normalizeError(error);
  const resolvedPhase = phase || classifyErrorPhase(normalizedError);
  const normalizedRecovery = normalizeRecovery(resolvedPhase, recovery);

  return {
    schema_version: ERROR_SCHEMA_VERSION,
    source,
    timestamp,
    command: resolveCommand(command, context),
    phase: resolvedPhase,
    error: normalizedError,
    context,
    recovery: normalizedRecovery,
    attempts: Array.isArray(attempts) ? attempts : [],
  };
}

export async function writeErrorRecord(errorRecord, projectRoot = PROJECT_ROOT) {
  const lastErrorFile = path.join(projectRoot, '.agent', 'last-error.json');
  await fs.ensureDir(path.dirname(lastErrorFile));
  await fs.writeJson(lastErrorFile, errorRecord, { spaces: 2 });
  return { filePath: lastErrorFile, errorRecord };
}

export async function recordStructuredError({
  projectRoot = PROJECT_ROOT,
  error,
  phase,
  command,
  context = {},
  recovery = {},
  timestamp,
  attempts = [],
  source = 'runtime',
} = {}) {
  const errorRecord = buildErrorRecord({
    error,
    phase,
    command,
    context,
    recovery,
    timestamp,
    attempts,
    source,
  });

  const { filePath } = await writeErrorRecord(errorRecord, projectRoot);
  return { filePath, errorRecord };
}

export async function clearLastError(projectRoot = PROJECT_ROOT) {
  const lastErrorFile = path.join(projectRoot, '.agent', 'last-error.json');
  if (await fs.pathExists(lastErrorFile)) {
    await fs.remove(lastErrorFile);
  }
}

/**
 * 에러 기록 및 복구 정보 생성
 */
export async function recordError(error, context = {}) {
  const phase = context.phase || classifyErrorPhase(error);
  const scenario = RECOVERY_SCENARIOS[phase];

  const { filePath, errorRecord } = await recordStructuredError({
    projectRoot: PROJECT_ROOT,
    error,
    phase,
    command: context.command,
    context,
    recovery: {
      section: phase,
      name: scenario.name,
      description: scenario.description,
      commands: scenario.commands,
      autoRecoverable: ['precondition', 'git-fetch'].includes(phase),
    },
    source: 'error-recovery',
  });

  console.log(`Error recorded: ${filePath}`);
  return errorRecord;
}

/**
 * 에러 메시지 기반 자동 분류
 */
function classifyErrorPhase(error) {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('fetch') || msg.includes('git') || msg.includes('repository')) {
    return 'git-fetch';
  }
  if (msg.includes('migration') || msg.includes('database') || msg.includes('d1') || msg.includes('sqlite')) {
    return 'migration';
  }
  if (msg.includes('wrangler') || msg.includes('config') || msg.includes('precondition')) {
    return 'precondition';
  }
  if (msg.includes('core') || msg.includes('update')) {
    return 'core-update';
  }
  
  return 'unknown';
}

/**
 * 저장된 에러 읽기
 */
export async function getLastError(projectRoot = PROJECT_ROOT) {
  const lastErrorFile = path.join(projectRoot, '.agent', 'last-error.json');
  if (!await fs.pathExists(lastErrorFile)) {
    return null;
  }
  
  return fs.readJson(lastErrorFile);
}

/**
 * 에러 복구 시도
 */
export async function attemptRecovery(options = {}) {
  const errorRecord = await getLastError(PROJECT_ROOT);
  
  if (!errorRecord) {
    return { success: true, message: 'No error to recover from' };
  }
  
  const { dryRun = false, force = false } = options;
  const { phase, recovery, context } = errorRecord;
  
  // 자동 복구 가능 여부 확인
  if (!recovery.autoRecoverable && !force) {
    return {
      success: false,
      message: `Phase "${phase}" requires manual intervention. Use --force to attempt anyway.`,
      suggestedAction: 'Check .agent/workflows/troubleshooting.md'
    };
  }
  
  const attempt = {
    timestamp: new Date().toISOString(),
    commands: [],
    success: false
  };
  
  try {
    // 복구 명령 실행
    for (const cmd of recovery.commands) {
      attempt.commands.push(cmd);
      
      if (!dryRun) {
        console.log(`▶️  Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
      }
    }
    
    attempt.success = true;
    errorRecord.attempts = Array.isArray(errorRecord.attempts) ? errorRecord.attempts : [];
    errorRecord.attempts.push(attempt);
    
    // 복구 성공 시 에러 파일 삭제
    if (!dryRun) {
      await clearLastError(PROJECT_ROOT);
      console.log('✅ Recovery successful');
    }
    
    return {
      success: true,
      message: dryRun ? 'Dry run completed' : 'Recovery successful',
      phase,
      commands: recovery.commands
    };
    
  } catch (error) {
    attempt.success = false;
    attempt.error = error.message;
    errorRecord.attempts = Array.isArray(errorRecord.attempts) ? errorRecord.attempts : [];
    errorRecord.attempts.push(attempt);
    
    if (!dryRun) {
      await fs.writeJson(LAST_ERROR_FILE, errorRecord, { spaces: 2 });
      console.error(`❌ Recovery failed: ${error.message}`);
    }
    
    return {
      success: false,
      message: `Recovery failed: ${error.message}`,
      phase,
      attemptedCommands: attempt.commands,
      error: error.message
    };
  }
}

/**
 * 에러 상태 보고
 */
export async function reportErrorStatus(projectRoot = PROJECT_ROOT) {
  const errorRecord = await getLastError(projectRoot);
  
  if (!errorRecord) {
    return { hasError: false };
  }
  
  const { phase, error, recovery, timestamp, attempts, command } = errorRecord;
  const attemptCount = Array.isArray(attempts) ? attempts.length : 0;
  const errorMessage = typeof error === 'string' ? error : error?.message;
  
  return {
    hasError: true,
    phase,
    command: command || null,
    error: errorMessage || 'Unknown error',
    errorCode: typeof error === 'object' ? error?.code || null : null,
    occurredAt: timestamp,
    autoRecoverable: Boolean(recovery?.autoRecoverable),
    attemptCount,
    suggestedCommands: ensureCommands(recovery?.commands),
    troubleshooting: `.agent/workflows/troubleshooting.md#${phase}`
  };
}

/**
 * 에러 수동 해결 표시
 */
export async function markErrorResolved(notes = '') {
  const errorRecord = await getLastError(PROJECT_ROOT);
  
  if (!errorRecord) {
    return false;
  }
  
  console.log(`Marking error as resolved: ${errorRecord.phase}`);
  
  await clearLastError(PROJECT_ROOT);
  return true;
}

// CLI 실행
const isCliEntry = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(MODULE_PATH);

if (isCliEntry) {
  const command = process.argv[2];

  switch (command) {
    case 'status': {
      const status = await reportErrorStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    case 'recover': {
      const dryRun = process.argv.includes('--dry-run');
      const force = process.argv.includes('--force');
      const result = await attemptRecovery({ dryRun, force });
      console.log(result.success 
        ? '✅ ' + result.message 
        : '❌ ' + result.message
      );
      process.exit(result.success ? 0 : 1);
    }
    case 'resolve': {
      const notes = process.argv[3] || '';
      const resolved = await markErrorResolved(notes);
      console.log(resolved 
        ? '✅ Error marked as resolved' 
        : '⚠️  No error to resolve'
      );
      break;
    }
    default:
      console.log(`
Usage:
  node error-recovery.mjs status           # Check error status
  node error-recovery.mjs recover          # Attempt recovery
  node error-recovery.mjs recover --force  # Force recovery for manual phases
  node error-recovery.mjs resolve [notes]  # Mark error as manually resolved
    `);
  }
}
