#!/usr/bin/env node
/**
 * 통합 Status 명령어
 * 
 * 사용법:
 *   npm run status
 *   npm run status -- --json
 *   npm run status -- --summary
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const AGENT_DIR = path.join(PROJECT_ROOT, '.agent');

async function loadJson(filePath) {
  try {
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
  } catch {}
  return null;
}

async function getSetupStatus() {
  const progressPath = path.join(AGENT_DIR, 'setup-progress.json');
  const progress = await loadJson(progressPath);
  
  if (!progress) {
    return { status: 'NOT_STARTED', message: '설치를 시작하지 않았습니다' };
  }
  
  const total = progress.steps?.length || 0;
  const done = progress.steps?.filter(s => s.status === 'done').length || 0;
  const pending = progress.steps?.filter(s => s.status === 'pending').length || 0;
  const inProgress = progress.steps?.find(s => s.status === 'in_progress');
  
  return {
    status: done === total ? 'COMPLETED' : inProgress ? 'IN_PROGRESS' : 'PARTIAL',
    progress: { done, total, percentage: Math.round((done / total) * 100) },
    currentStep: inProgress?.id || null,
    lastCompleted: progress.steps?.findLast(s => s.status === 'done')?.id
  };
}

async function getOnboardingStatus() {
  const statePath = path.join(AGENT_DIR, 'onboarding-state.json');
  const registryPath = path.join(AGENT_DIR, 'onboarding-registry.json');
  
  const state = await loadJson(statePath);
  const registry = await loadJson(registryPath);
  
  if (!state || !registry) {
    return { status: 'NOT_STARTED' };
  }
  
  const features = Object.entries(state.features || {});
  const total = features.length;
  const done = features.filter(([_, v]) => v.status === 'done').length;
  const pending = features.filter(([_, v]) => v.status === 'pending').length;
  const skipped = features.filter(([_, v]) => v.status === 'skipped').length;
  
  const currentTier = state.current_tier || 1;
  const currentFeature = features.find(([_, v]) => v.status === 'in_progress');
  
  // 다음 작업 찾기
  const nextFeature = registry.features?.find(f => 
    state.features[f.id]?.status === 'pending' && f.tier === currentTier
  );
  
  return {
    status: done === total ? 'COMPLETED' : currentFeature ? 'IN_PROGRESS' : 'PARTIAL',
    currentTier,
    progress: { done, total, pending, skipped, percentage: Math.round((done / total) * 100) },
    currentFeature: currentFeature?.[0] || null,
    nextFeature: nextFeature?.id || null
  };
}

async function getLockStatus() {
  const lockPath = path.join(AGENT_DIR, 'work.lock');
  
  try {
    if (await fs.pathExists(lockPath)) {
      const lock = await fs.readJson(lockPath);
      const now = Date.now();
      const expires = new Date(lock.expiresAt).getTime();
      const isExpired = now > expires;
      
      return {
        locked: true,
        isExpired,
        acquiredBy: lock.acquiredBy,
        task: lock.currentTask,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
        remainingMinutes: isExpired ? 0 : Math.ceil((expires - now) / 1000 / 60)
      };
    }
  } catch {}
  
  return { locked: false };
}

async function getHealthStatus() {
  // 간단한 건강 체크
  const checks = {
    nodeModules: await fs.pathExists(path.join(PROJECT_ROOT, 'node_modules')),
    gitRepo: false,
    coreExists: await fs.pathExists(path.join(PROJECT_ROOT, 'core', 'package.json')),
    wranglerConfig: await fs.pathExists(path.join(PROJECT_ROOT, 'wrangler.toml'))
  };
  
  // Git 확인
  try {
    execSync('git rev-parse --git-dir', { cwd: PROJECT_ROOT, stdio: 'ignore' });
    checks.gitRepo = true;
  } catch {}
  
  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  
  return {
    score: Math.round(score * 100),
    checks
  };
}

async function getLastCheckpoint() {
  try {
    const lastFile = path.join(AGENT_DIR, 'last-checkpoint.txt');
    if (await fs.pathExists(lastFile)) {
      const tag = await fs.readFile(lastFile, 'utf8');
      return tag.trim();
    }
    
    const tags = execSync('git tag -l "checkpoint-*" --sort=-creatordate', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
    
    return tags[0] || null;
  } catch {
    return null;
  }
}

async function getRecentAudit() {
  const auditPath = path.join(AGENT_DIR, 'audit.log');
  
  try {
    if (await fs.pathExists(auditPath)) {
      const lines = (await fs.readFile(auditPath, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(-5); // 최근 5개
      
      return lines.map(line => JSON.parse(line));
    }
  } catch {}
  
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const isSummary = args.includes('--summary');
  
  const [setup, onboarding, lock, health, checkpoint, recentAudit] = await Promise.all([
    getSetupStatus(),
    getOnboardingStatus(),
    getLockStatus(),
    getHealthStatus(),
    getLastCheckpoint(),
    getRecentAudit()
  ]);
  
  const status = {
    timestamp: new Date().toISOString(),
    setup,
    onboarding,
    lock,
    health,
    checkpoint,
    recentActivity: recentAudit.slice(-3)
  };
  
  if (isJson) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  
  // Human-readable 출력
  console.log('\n📊 Clinic-OS 현재 상태\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 진행 중인 작업
  if (lock.locked) {
    console.log('\n🔄 진행 중인 작업');
    if (lock.isExpired) {
      console.log(`   ⚠️  Lock 만료됨: ${lock.acquiredBy}`);
    } else {
      console.log(`   Lock: ${lock.acquiredBy}`);
      console.log(`   Task: ${lock.task}`);
      console.log(`   남은 시간: ${lock.remainingMinutes}분`);
    }
  }
  
  // 설치 상태
  console.log('\n✅ 설치 상태');
  if (setup.status === 'NOT_STARTED') {
    console.log('   설치를 시작하지 않았습니다');
    console.log('   → npm run setup:step -- --next');
  } else if (setup.status === 'COMPLETED') {
    console.log(`   완료: ${setup.progress.done}/${setup.progress.total} 단계 (100%)`);
  } else {
    console.log(`   진행 중: ${setup.progress.done}/${setup.progress.total} 단계 (${setup.progress.percentage}%)`);
    if (setup.currentStep) {
      console.log(`   현재: ${setup.currentStep}`);
    }
  }
  
  // 온볼딩 상태
  console.log('\n📋 온볼딩 상태');
  if (onboarding.status === 'NOT_STARTED') {
    if (setup.status === 'COMPLETED') {
      console.log('   준비 완료. 온볼딩을 시작하세요');
    }
  } else if (onboarding.status === 'COMPLETED') {
    console.log(`   완료: ${onboarding.progress.done}/${onboarding.progress.total} 기능`);
  } else {
    console.log(`   Tier ${onboarding.currentTier}/5`);
    console.log(`   진행: ${onboarding.progress.done}/${onboarding.progress.total} 기능 (${onboarding.progress.percentage}%)`);
    if (onboarding.nextFeature) {
      console.log(`   다음: ${onboarding.nextFeature}`);
    }
  }
  
  // 체크포인트
  if (checkpoint) {
    console.log('\n🔄 마지막 체크포인트');
    console.log(`   ${checkpoint}`);
    console.log(`   → npm run tx:rollback`);
  }
  
  // 건강 상태
  if (!isSummary) {
    console.log('\n💚 환경 건강도');
    console.log(`   점수: ${health.score}/100`);
    if (health.score < 100) {
      const failed = Object.entries(health.checks)
        .filter(([_, v]) => !v)
        .map(([k]) => k);
      console.log(`   부족: ${failed.join(', ')}`);
    }
  }
  
  // 최근 활동
  if (recentAudit.length > 0 && !isSummary) {
    console.log('\n📝 최근 활동');
    recentAudit.slice(-3).forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      console.log(`   ${time} - ${entry.event}`);
    });
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 다음 단계 안내
  if (setup.status !== 'COMPLETED') {
    console.log('💡 다음 단계: npm run setup:step -- --next\n');
  } else if (onboarding.status !== 'COMPLETED') {
    console.log('💡 다음 단계: 온볼딩 계속 진행\n');
  } else {
    console.log('✨ 모든 설정 완료! npm run dev\n');
  }
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
