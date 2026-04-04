#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const AGENT_DIR = path.join(PROJECT_ROOT, '.agent');

const REGISTRY_PATH = path.join(AGENT_DIR, 'onboarding-registry.json');
const STATE_PATH = path.join(AGENT_DIR, 'onboarding-state.json');
const SETUP_PATH = path.join(AGENT_DIR, 'setup-progress.json');

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readJsonSync(filePath);
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = new Set();
  const values = {};

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [key, rawValue] = arg.slice(2).split('=');
    if (rawValue === undefined) {
      flags.add(key);
    } else {
      values[key] = rawValue;
    }
  }

  return { flags, values };
}

function loadRegistry() {
  const registry = readJson(REGISTRY_PATH);
  if (!registry?.features) {
    throw new Error('.agent/onboarding-registry.json을 읽을 수 없습니다.');
  }
  return registry;
}

function loadState() {
  return readJson(STATE_PATH);
}

function createDefaultState(registry) {
  const features = {};
  for (const feature of registry.features || []) {
    features[feature.id] = {
      status: 'pending',
      updated_at: null,
      notes: null,
      history: [],
      deferred_reason: null,
    };
  }

  return {
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
      notes: null,
    },
    current_focus: {
      feature_id: null,
      checkpoint: null,
      updated_at: null,
    },
    session_notes: [],
    deferred_items: [],
    features,
  };
}

function ensureStateShape(registry, state) {
  const base = createDefaultState(registry);
  const next = {
    ...base,
    ...(state || {}),
    chosen_track: {
      ...base.chosen_track,
      ...(state?.chosen_track || {}),
    },
    current_focus: {
      ...base.current_focus,
      ...(state?.current_focus || {}),
    },
    session_notes: Array.isArray(state?.session_notes) ? state.session_notes : [],
    deferred_items: Array.isArray(state?.deferred_items) ? state.deferred_items : [],
    features: { ...base.features },
  };

  for (const feature of registry.features || []) {
    const current = state?.features?.[feature.id] || {};
    next.features[feature.id] = {
      status: 'pending',
      updated_at: null,
      notes: null,
      history: [],
      deferred_reason: null,
      ...current,
      history: Array.isArray(current.history) ? current.history : [],
    };
  }

  return next;
}

function saveState(state) {
  fs.ensureDirSync(path.dirname(STATE_PATH));
  fs.writeJsonSync(STATE_PATH, state, { spaces: 2 });
}

function loadSetup() {
  return readJson(SETUP_PATH);
}

function summarizeSetup(setup) {
  if (!setup?.steps) {
    return { exists: false, done: 0, total: 0, pending: 0, completed: false };
  }

  const total = setup.steps.length;
  const done = setup.steps.filter((step) => step.status === 'done').length;
  const pending = setup.steps.filter((step) => step.status === 'pending').length;

  return {
    exists: true,
    done,
    total,
    pending,
    completed: total > 0 && done === total,
  };
}

function runDoctor() {
  try {
    const stdout = execFileSync('node', ['scripts/agent-doctor.js', '--json'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function getFeatureStatus(state, featureId) {
  return state?.features?.[featureId]?.status || 'pending';
}

function getTierFeatures(registry, state, tier) {
  return registry.features.filter((feature) => Number(feature.tier) === Number(tier)).map((feature) => ({
    ...feature,
    status: getFeatureStatus(state, feature.id),
  }));
}

function getNextFeature(registry, state) {
  const currentTier = state?.current_tier || 1;

  for (const tier of [currentTier, 1, 2, 3, 4, 5]) {
    const feature = registry.features.find((item) => Number(item.tier) === Number(tier) && getFeatureStatus(state, item.id) === 'pending');
    if (feature) return feature;
  }

  return null;
}

function getDependencyStates(state, feature) {
  return (feature.depends_on || []).map((featureId) => ({
    feature_id: featureId,
    status: getFeatureStatus(state, featureId),
  }));
}

function getExecutionGuide(feature, dependencyStates) {
  const blockedBy = dependencyStates.filter((item) => item.status !== 'done').map((item) => item.feature_id);
  const requiresHumanInputs = Array.isArray(feature.human_inputs) && feature.human_inputs.length > 0;

  return {
    blocked: blockedBy.length > 0,
    blockedBy,
    recommendedStart: blockedBy.length > 0
      ? `선행 feature를 먼저 정리: ${blockedBy.join(', ')}`
      : (feature.admin_path
        ? `관리자 경로 ${feature.admin_path} 기준으로 진행`
        : '문서/로컬 작업 경로 기준으로 진행'),
    requiredInputs: requiresHumanInputs
      ? feature.human_inputs.filter((item) => item.required !== false).map((item) => item.label || item.key)
      : [],
    optionalInputs: requiresHumanInputs
      ? feature.human_inputs.filter((item) => item.required === false).map((item) => item.label || item.key)
      : [],
    verify: [
      feature.admin_path ? `${feature.admin_path} 또는 관련 화면에서 반영 확인` : '관련 화면/파일에서 반영 확인',
      'onboarding 상태 기록 업데이트',
      '필요 시 public/admin 양쪽 영향 확인',
    ],
  };
}

function summarizePreflight(setupSummary, doctor) {
  const schemaOk = doctor?.health?.checks?.schema_health?.ok;
  const migrationOk = doctor?.health?.checks?.migration_state?.ok;
  const installOk = setupSummary.completed;

  if (!setupSummary.exists) {
    return {
      ready: false,
      label: '설치 미시작',
      message: '온보딩 전에 setup을 먼저 시작해야 합니다.',
      commands: ['npm run setup:step -- --next'],
    };
  }

  if (!installOk) {
    return {
      ready: false,
      label: '설치 미완료',
      message: `setup 진행률이 ${setupSummary.done}/${setupSummary.total} 입니다.`,
      commands: ['npm run setup:step -- --next'],
    };
  }

  if (schemaOk === false || migrationOk === false) {
    return {
      ready: false,
      label: 'DB bootstrap 확인 필요',
      message: 'setup은 끝났지만 로컬 DB 스키마 또는 마이그레이션 상태가 정상이 아닙니다.',
      commands: ['npm run agent:doctor -- --json', 'npm run db:migrate', 'npm run db:seed'],
    };
  }

  return {
    ready: true,
    label: '온보딩 진행 가능',
    message: 'setup/DB readiness 기준으로 바로 온보딩을 시작할 수 있습니다.',
    commands: [],
  };
}

function appendFeatureHistory(state, featureId, type, details = {}) {
  const feature = state.features[featureId];
  if (!feature) return;
  feature.history.push({
    type,
    at: new Date().toISOString(),
    ...details,
  });
  feature.updated_at = new Date().toISOString();
}

function updateFeatureState(state, featureId, status, note = null, extra = {}) {
  const feature = state.features[featureId];
  if (!feature) {
    throw new Error(`알 수 없는 feature: ${featureId}`);
  }

  feature.status = status;
  if (note) feature.notes = note;
  if (Object.prototype.hasOwnProperty.call(extra, 'deferred_reason')) {
    feature.deferred_reason = extra.deferred_reason;
  }
  appendFeatureHistory(state, featureId, status, note ? { note } : {});
  state.last_updated = new Date().toISOString();
}

function recordSessionNote(state, summary, detail = null) {
  state.session_notes.push({
    at: new Date().toISOString(),
    summary,
    detail,
  });
  if (state.session_notes.length > 30) {
    state.session_notes = state.session_notes.slice(-30);
  }
  state.last_updated = new Date().toISOString();
}

function setChosenTrack(state, mode, { tier = null, featureId = null, notes = null } = {}) {
  state.chosen_track = {
    mode,
    tier,
    feature_id: featureId,
    updated_at: new Date().toISOString(),
    notes,
  };
  state.last_updated = new Date().toISOString();
}

function setCurrentFocus(state, featureId = null, checkpoint = null) {
  state.current_focus = {
    feature_id: featureId,
    checkpoint,
    updated_at: new Date().toISOString(),
  };
  state.last_updated = new Date().toISOString();
}

function printBrief(registry, state, preflight) {
  console.log('\n🧭 온보딩 브리핑\n');
  console.log(`- preflight: ${preflight.label}`);
  console.log(`- 상태: ${preflight.message}`);
  console.log('\n추천 순서');
  console.log('- Tier 1: 배포 필수');
  console.log('- Tier 2: 핵심 콘텐츠');
  console.log('- Tier 3: 환자 서비스');
  console.log('- Tier 4: 마케팅/확장');
  console.log('- Tier 5: 운영 고도화/커스터마이징');
  console.log('\n주요 커스터마이징 트랙');
  console.log('- 스킨 커스터마이징');
  console.log('- 스타일 오버라이드 계획');
  console.log('- 로컬 플러그인 확장');
  console.log('- 커스텀 페이지 제작');

  const currentTier = state?.current_tier || 1;
  const nextFeature = getNextFeature(registry, state);

  console.log('\n현재 추천');
  console.log(`- 현재 Tier: ${currentTier}`);
  if (nextFeature) {
    console.log(`- 다음 추천 기능: ${nextFeature.id} (${nextFeature.name})`);
  } else {
    console.log('- 다음 추천 기능: 없음');
  }

  console.log('\n선택 가능한 명령');
  console.log('- npm run onboarding:brief-done');
  console.log('- npm run onboarding:status');
  console.log('- npm run onboarding:pending');
  console.log('- npm run onboarding:track -- --mode=custom --tier=5 --note=\"스킨 먼저\"');
  console.log('- npm run onboarding:focus -- --feature=skin-customization --checkpoint=analyze');
  console.log('- npm run onboarding:note -- --summary=\"브랜드 톤 결정 필요\"');
  console.log('- npm run onboarding:tier -- --tier=1');
  console.log('- npm run onboarding:step -- --feature=clinic-info');
}

function printStatus(registry, state, setupSummary, preflight, json = false) {
  const currentTier = state?.current_tier || 1;
  const nextFeature = getNextFeature(registry, state);
  const total = registry.features.length;
  const done = registry.features.filter((feature) => getFeatureStatus(state, feature.id) === 'done').length;
  const skipped = registry.features.filter((feature) => getFeatureStatus(state, feature.id) === 'skipped').length;
  const pending = registry.features.filter((feature) => getFeatureStatus(state, feature.id) === 'pending').length;

  const payload = {
    preflight,
    setup: setupSummary,
    onboarding: {
      currentTier,
      total,
      done,
      pending,
      skipped,
      briefingCompletedAt: state?.briefing_completed_at || null,
      chosenTrack: state?.chosen_track || null,
      currentFocus: state?.current_focus || null,
      sessionNotes: state?.session_notes || [],
      deferredItems: state?.deferred_items || [],
      nextFeature: nextFeature ? { id: nextFeature.id, name: nextFeature.name, tier: nextFeature.tier } : null,
    },
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('\n🧭 온보딩 상태\n');
  console.log(`- preflight: ${preflight.label}`);
  console.log(`- setup: ${setupSummary.exists ? `${setupSummary.done}/${setupSummary.total}` : '미시작'}`);
  console.log(`- 진행률: ${done}/${total} 완료, ${pending} pending, ${skipped} skipped`);
  console.log(`- 현재 Tier: ${currentTier}`);
  if (state?.briefing_completed_at) {
    console.log(`- 브리핑 완료: ${state.briefing_completed_at}`);
  }
  if (state?.chosen_track?.mode) {
    console.log(`- 선택 트랙: ${state.chosen_track.mode}${state.chosen_track.feature_id ? ` (${state.chosen_track.feature_id})` : ''}`);
  }
  if (state?.current_focus?.feature_id) {
    console.log(`- 현재 포커스: ${state.current_focus.feature_id}${state.current_focus.checkpoint ? ` / ${state.current_focus.checkpoint}` : ''}`);
  }
  if (nextFeature) {
    console.log(`- 다음 추천: ${nextFeature.id} (${nextFeature.name})`);
  }
  if (Array.isArray(state?.session_notes) && state.session_notes.length > 0) {
    const lastNote = state.session_notes[state.session_notes.length - 1];
    console.log(`- 최근 메모: ${lastNote.summary}`);
  }

  if (preflight.commands.length > 0) {
    console.log('\n먼저 확인할 명령');
    for (const command of preflight.commands) {
      console.log(`- ${command}`);
    }
  }
}

function printTier(registry, state, tier, json = false) {
  const features = getTierFeatures(registry, state, tier);
  const payload = {
    tier: Number(tier),
    features: features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      status: feature.status,
      depends_on: feature.depends_on || [],
      admin_path: feature.admin_path || null,
      notes: state?.features?.[feature.id]?.notes || null,
    })),
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n📚 Tier ${tier} 기능\n`);
  for (const feature of features) {
    console.log(`- [${feature.status}] ${feature.id} (${feature.name})`);
  }
}

function printPending(registry, state, json = false) {
  const grouped = {};
  for (const feature of registry.features) {
    const status = getFeatureStatus(state, feature.id);
    if (status === 'done') continue;
    const key = String(feature.tier);
    grouped[key] ||= [];
      grouped[key].push({ id: feature.id, name: feature.name, status });
  }

  if (json) {
    console.log(JSON.stringify(grouped, null, 2));
    return;
  }

  console.log('\n📝 미완료 기능\n');
  for (const tier of Object.keys(grouped).sort((a, b) => Number(a) - Number(b))) {
    console.log(`Tier ${tier}`);
    for (const feature of grouped[tier]) {
      console.log(`- [${feature.status}] ${feature.id} (${feature.name})`);
    }
    console.log('');
  }
}

function printFeature(registry, state, featureId, json = false) {
  const feature = registry.features.find((item) => item.id === featureId);
  if (!feature) {
    throw new Error(`알 수 없는 feature: ${featureId}`);
  }

  const payload = {
    ...feature,
    status: getFeatureStatus(state, feature.id),
    dependency_states: getDependencyStates(state, feature),
    state_meta: state?.features?.[feature.id] || null,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n🔎 ${feature.id}\n`);
  console.log(`- 이름: ${feature.name}`);
  console.log(`- 상태: ${payload.status}`);
  console.log(`- Tier: ${feature.tier}`);
  console.log(`- 설명: ${feature.description}`);
  console.log(`- 선행 조건: ${(feature.depends_on || []).join(', ') || '(없음)'}`);
  if (payload.dependency_states.length > 0) {
    console.log(`- 선행 상태: ${payload.dependency_states.map((item) => `${item.feature_id}=${item.status}`).join(', ')}`);
  }
  console.log(`- 관리자 경로: ${feature.admin_path || '(없음)'}`);
  console.log(`- 문서: ${feature.doc_ref || '(없음)'}`);
  if (Array.isArray(feature.human_inputs) && feature.human_inputs.length > 0) {
    const requiredInputs = feature.human_inputs
      .filter((item) => item.required !== false)
      .map((item) => item.label || item.key);
    const optionalInputs = feature.human_inputs
      .filter((item) => item.required === false)
      .map((item) => item.label || item.key);
    console.log(`- 필요 입력: ${requiredInputs.join(', ') || '(없음)'}`);
    if (optionalInputs.length > 0) {
      console.log(`- 선택 입력: ${optionalInputs.join(', ')}`);
    }
  }
  if (feature.setup_notes) {
    console.log(`- 실행 메모: ${feature.setup_notes}`);
  }
  if (payload.state_meta?.notes) {
    console.log(`- 메모: ${payload.state_meta.notes}`);
  }
  if (payload.state_meta?.deferred_reason) {
    console.log(`- 미룬 이유: ${payload.state_meta.deferred_reason}`);
  }
}

function printNext(registry, state, preflight, json = false) {
  const nextFeature = getNextFeature(registry, state);
  const dependencyStates = nextFeature ? getDependencyStates(state, nextFeature) : [];
  const guide = nextFeature ? getExecutionGuide(nextFeature, dependencyStates) : null;
  const payload = {
    preflight,
    nextFeature: nextFeature ? {
      id: nextFeature.id,
      name: nextFeature.name,
      tier: nextFeature.tier,
      depends_on: nextFeature.depends_on || [],
      dependency_states: dependencyStates,
      admin_path: nextFeature.admin_path || null,
      human_inputs: nextFeature.human_inputs || [],
      doc_ref: nextFeature.doc_ref || null,
      setup_notes: nextFeature.setup_notes || null,
      guide,
    } : null,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('\n➡️ 다음 온보딩 제안\n');
  console.log(`- preflight: ${preflight.label}`);
  if (!preflight.ready) {
    console.log(`- 상태: ${preflight.message}`);
    for (const command of preflight.commands) {
      console.log(`- 먼저 실행: ${command}`);
    }
    return;
  }

  if (!nextFeature) {
    console.log('- 남은 pending 기능이 없습니다.');
    return;
  }

  console.log(`- 추천 기능: ${nextFeature.id} (${nextFeature.name})`);
  console.log(`- Tier: ${nextFeature.tier}`);
  console.log(`- 선행 조건: ${(nextFeature.depends_on || []).join(', ') || '(없음)'}`);
  if (dependencyStates.length > 0) {
    console.log(`- 선행 상태: ${dependencyStates.map((item) => `${item.feature_id}=${item.status}`).join(', ')}`);
  }
  console.log(`- 관리자 경로: ${nextFeature.admin_path || '(없음)'}`);
  console.log(`- 문서: ${nextFeature.doc_ref || '(없음)'}`);
  if (guide?.blocked) {
    console.log(`- 가드레일: 아직 바로 진행하지 않음. 먼저 ${guide.blockedBy.join(', ')} 를 완료해야 합니다.`);
  }
  if (guide?.requiredInputs?.length > 0) {
    console.log(`- 먼저 받을 정보: ${guide.requiredInputs.join(', ')}`);
  }
  if (guide?.optionalInputs?.length > 0) {
    console.log(`- 있으면 좋은 정보: ${guide.optionalInputs.join(', ')}`);
  }
  if (nextFeature.setup_notes) {
    console.log(`- 실행 메모: ${nextFeature.setup_notes}`);
  }
  console.log('\n실행 가이드');
  console.log(`- 시작점: ${guide.recommendedStart}`);
  console.log(`- 상태 기록 시작: npm run onboarding:start -- --feature=${nextFeature.id}${guide.blocked ? '' : ' --checkpoint=analyze'}`);
  console.log(`- 포커스 지정: npm run onboarding:focus -- --feature=${nextFeature.id} --checkpoint=analyze`);
  if (!guide.blocked) {
    console.log(`- 상세 보기: npm run onboarding:step -- --feature=${nextFeature.id}`);
  }
  console.log('- 검증:');
  for (const item of guide.verify) {
    console.log(`  ${item}`);
  }
}

function main() {
  const { flags, values } = parseArgs(process.argv);
  const json = flags.has('json');
  const command = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'status';

  const registry = loadRegistry();
  const state = ensureStateShape(registry, loadState());
  const setup = loadSetup();
  const setupSummary = summarizeSetup(setup);
  const doctor = runDoctor();
  const preflight = summarizePreflight(setupSummary, doctor);

  switch (command) {
    case 'brief-done':
      state.briefing_completed_at = new Date().toISOString();
      state.last_updated = new Date().toISOString();
      recordSessionNote(state, '온보딩 시작 브리핑 완료', null);
      saveState(state);
      console.log('브리핑 완료 시각을 기록했습니다.');
      break;
    case 'brief':
      printBrief(registry, state, preflight);
      break;
    case 'status':
      printStatus(registry, state, setupSummary, preflight, json);
      break;
    case 'pending':
      printPending(registry, state, json);
      break;
    case 'next':
      printNext(registry, state, preflight, json);
      break;
    case 'tier':
      printTier(registry, state, values.tier || 1, json);
      break;
    case 'step':
      if (!values.feature) {
        throw new Error('--feature=<id> 가 필요합니다.');
      }
      printFeature(registry, state, values.feature, json);
      break;
    case 'track':
      if (!values.mode) {
        throw new Error('--mode=<recommended|tier|feature|custom> 가 필요합니다.');
      }
      setChosenTrack(state, values.mode, {
        tier: values.tier ? Number(values.tier) : null,
        featureId: values.feature || null,
        notes: values.note || null,
      });
      recordSessionNote(state, `트랙 선택: ${values.mode}`, values.note || null);
      saveState(state);
      console.log(`트랙을 ${values.mode}로 기록했습니다.`);
      break;
    case 'focus':
      if (!values.feature) {
        throw new Error('--feature=<id> 가 필요합니다.');
      }
      setCurrentFocus(state, values.feature, values.checkpoint || null);
      recordSessionNote(state, `현재 포커스: ${values.feature}`, values.checkpoint || null);
      saveState(state);
      console.log(`현재 포커스를 ${values.feature}${values.checkpoint ? ` / ${values.checkpoint}` : ''} 로 기록했습니다.`);
      break;
    case 'note':
      if (!values.summary) {
        throw new Error('--summary=\"...\" 가 필요합니다.');
      }
      recordSessionNote(state, values.summary, values.detail || null);
      saveState(state);
      console.log('세션 메모를 기록했습니다.');
      break;
    case 'start':
      if (!values.feature) {
        throw new Error('--feature=<id> 가 필요합니다.');
      }
      updateFeatureState(state, values.feature, 'in_progress', values.note || null);
      setCurrentFocus(state, values.feature, values.checkpoint || 'analyze');
      saveState(state);
      console.log(`${values.feature} 를 in_progress 로 기록했습니다.`);
      break;
    case 'done':
      if (!values.feature) {
        throw new Error('--feature=<id> 가 필요합니다.');
      }
      updateFeatureState(state, values.feature, 'done', values.note || null);
      if (state.current_focus?.feature_id === values.feature) {
        setCurrentFocus(state, null, null);
      }
      saveState(state);
      console.log(`${values.feature} 를 done 으로 기록했습니다.`);
      break;
    case 'skip':
      if (!values.feature) {
        throw new Error('--feature=<id> 가 필요합니다.');
      }
      updateFeatureState(state, values.feature, 'skipped', values.note || null, {
        deferred_reason: values.reason || values.note || null,
      });
      state.deferred_items = [
        ...state.deferred_items.filter((item) => item.feature_id !== values.feature),
        {
          feature_id: values.feature,
          reason: values.reason || values.note || null,
          at: new Date().toISOString(),
        },
      ];
      if (state.current_focus?.feature_id === values.feature) {
        setCurrentFocus(state, null, null);
      }
      saveState(state);
      console.log(`${values.feature} 를 skipped 로 기록했습니다.`);
      break;
    default:
      throw new Error(`알 수 없는 명령: ${command}`);
  }
}

main();
