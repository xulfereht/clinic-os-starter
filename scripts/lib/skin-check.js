import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_SOURCES = new Set(['core', 'store', 'local']);
const SOURCE_PRIORITY = {
  core: 1,
  store: 2,
  local: 3,
};

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`JSON 파싱 실패: ${filePath} (${error.message})`);
  }
}

function pushIssue(issues, level, skinId, source, message) {
  issues.push({
    level,
    skinId,
    source,
    message,
  });
}

function listSkinDirs(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function getSkinRoots(projectRoot) {
  return {
    core: path.join(projectRoot, 'src', 'skins'),
    store: path.join(projectRoot, 'src', 'skins', 'store'),
    local: path.join(projectRoot, 'src', 'skins', 'local'),
  };
}

function loadSkinEntry(entry) {
  if (!fs.existsSync(entry.manifestPath)) {
    return {
      ...entry,
      manifest: null,
      readError: 'manifest.json 이 없습니다.',
    };
  }

  try {
    return {
      ...entry,
      manifest: readJson(entry.manifestPath),
      readError: null,
    };
  } catch (error) {
    return {
      ...entry,
      manifest: null,
      readError: error.message,
    };
  }
}

export function discoverSkinEntries(projectRoot) {
  const roots = getSkinRoots(projectRoot);
  const entries = [];

  for (const skinId of listSkinDirs(roots.core).filter((name) => !['local', 'store'].includes(name))) {
    entries.push({
      id: skinId,
      source: 'core',
      dir: path.join(roots.core, skinId),
      manifestPath: path.join(roots.core, skinId, 'manifest.json'),
    });
  }

  for (const skinId of listSkinDirs(roots.store)) {
    entries.push({
      id: skinId,
      source: 'store',
      dir: path.join(roots.store, skinId),
      manifestPath: path.join(roots.store, skinId, 'manifest.json'),
    });
  }

  for (const skinId of listSkinDirs(roots.local)) {
    entries.push({
      id: skinId,
      source: 'local',
      dir: path.join(roots.local, skinId),
      manifestPath: path.join(roots.local, skinId, 'manifest.json'),
    });
  }

  return entries;
}

function buildEffectiveCatalog(entries, issues, options = {}) {
  const warnOverrides = options.warnOverrides !== false;
  const effective = new Map();

  for (const entry of entries) {
    const existing = effective.get(entry.id);
    if (!existing || SOURCE_PRIORITY[entry.source] >= SOURCE_PRIORITY[existing.source]) {
      if (existing && warnOverrides) {
        pushIssue(
          issues,
          'warning',
          entry.id,
          entry.source,
          `${existing.source} skin "${entry.id}" 을 ${entry.source} skin 이 override 합니다.`
        );
      }
      effective.set(entry.id, entry);
    }
  }

  return effective;
}

function validateManifestBasics(entry, issues) {
  const manifest = entry.manifest;

  if (!manifest || typeof manifest !== 'object') {
    pushIssue(issues, 'error', entry.id, entry.source, 'manifest.json 이 비어 있거나 객체가 아닙니다.');
    return;
  }

  if (manifest.id !== entry.id) {
    pushIssue(issues, 'error', entry.id, entry.source, `manifest.id("${manifest.id}") 와 디렉토리명("${entry.id}") 이 일치하지 않습니다.`);
  }

  for (const field of ['name', 'description', 'version']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      pushIssue(issues, 'error', entry.id, entry.source, `${field} 이 비어 있습니다.`);
    }
  }

  if (manifest.source && manifest.source !== entry.source) {
    pushIssue(issues, 'error', entry.id, entry.source, `manifest.source("${manifest.source}") 와 실제 source("${entry.source}") 가 다릅니다.`);
  }

  if (manifest.source && !ALLOWED_SOURCES.has(manifest.source)) {
    pushIssue(issues, 'error', entry.id, entry.source, `지원하지 않는 source 값입니다: ${manifest.source}`);
  }

  if (manifest.extends && manifest.extends === entry.id) {
    pushIssue(issues, 'error', entry.id, entry.source, '자기 자신을 extends 할 수 없습니다.');
  }

  if (manifest.stylesheet && typeof manifest.stylesheet !== 'string') {
    pushIssue(issues, 'error', entry.id, entry.source, 'stylesheet 는 문자열 경로여야 합니다.');
  }

  if (manifest.preview?.surfaces && !Array.isArray(manifest.preview.surfaces)) {
    pushIssue(issues, 'error', entry.id, entry.source, 'preview.surfaces 는 배열이어야 합니다.');
  }

  if (manifest.componentRecipes && (typeof manifest.componentRecipes !== 'object' || Array.isArray(manifest.componentRecipes))) {
    pushIssue(issues, 'error', entry.id, entry.source, 'componentRecipes 는 객체여야 합니다.');
  }

  if (manifest.pageTemplates && (typeof manifest.pageTemplates !== 'object' || Array.isArray(manifest.pageTemplates))) {
    pushIssue(issues, 'error', entry.id, entry.source, 'pageTemplates 는 객체여야 합니다.');
  }
}

function validateFiles(entry, issues) {
  const manifest = entry.manifest;
  if (!manifest || typeof manifest !== 'object') {
    return;
  }

  if (manifest.stylesheet) {
    const stylesheetPath = path.join(entry.dir, manifest.stylesheet);
    if (!fs.existsSync(stylesheetPath)) {
      pushIssue(issues, 'error', entry.id, entry.source, `stylesheet 파일이 없습니다: ${manifest.stylesheet}`);
    }
  }

  const overrideTypes = new Set();
  for (const override of manifest.overrides?.sections || []) {
    if (!override?.type || !override?.file) {
      pushIssue(issues, 'error', entry.id, entry.source, 'overrides.sections 항목에는 type 과 file 이 모두 필요합니다.');
      continue;
    }

    const normalizedType = String(override.type).trim().toLowerCase();
    if (overrideTypes.has(normalizedType)) {
      pushIssue(issues, 'warning', entry.id, entry.source, `중복된 section override 타입입니다: ${override.type}`);
    }
    overrideTypes.add(normalizedType);

    const filePath = path.join(entry.dir, override.file);
    if (!fs.existsSync(filePath)) {
      pushIssue(issues, 'error', entry.id, entry.source, `section override 파일이 없습니다: ${override.file}`);
    }
  }

  if (!manifest.documentation?.summary) {
    pushIssue(issues, 'warning', entry.id, entry.source, 'documentation.summary 가 없어 에이전트가 스킨 의도를 파악하기 어렵습니다.');
  }

  if (manifest.componentRecipes) {
    for (const [recipeId, recipe] of Object.entries(manifest.componentRecipes)) {
      if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
        pushIssue(issues, 'error', entry.id, entry.source, `componentRecipes.${recipeId} 는 객체여야 합니다.`);
      }
    }
  }

  if (manifest.pageTemplates) {
    for (const [templateId, template] of Object.entries(manifest.pageTemplates)) {
      if (!template || typeof template !== 'object' || Array.isArray(template)) {
        pushIssue(issues, 'error', entry.id, entry.source, `pageTemplates.${templateId} 는 객체여야 합니다.`);
      }
    }
  }
}

function validateInheritance(effectiveCatalog, issues, entries = Array.from(effectiveCatalog.values())) {
  for (const entry of entries) {
    const manifest = entry.manifest;
    const skinId = entry.id;

    if (manifest?.extends && !effectiveCatalog.has(manifest.extends)) {
      pushIssue(issues, 'error', skinId, entry.source, `extends 대상 skin 을 찾을 수 없습니다: ${manifest.extends}`);
    }
  }

  for (const entry of entries) {
    const visited = new Set();
    let current = entry;

    while (current?.manifest?.extends) {
      const nextId = current.manifest.extends;
      if (visited.has(nextId)) {
        pushIssue(issues, 'error', entry.id, entry.source, `skin inheritance cycle 이 감지되었습니다: ${[...visited, nextId].join(' -> ')}`);
        break;
      }
      visited.add(nextId);
      current = effectiveCatalog.get(nextId);
      if (!current) break;
    }
  }
}

export function runSkinCheck(projectRoot, options = {}) {
  const onlyId = typeof options.id === 'string' ? options.id : null;
  const onlySource = typeof options.source === 'string' ? options.source : null;
  const issues = [];

  const allDiscovered = discoverSkinEntries(projectRoot)
    .map((entry) => loadSkinEntry(entry));

  const discovered = allDiscovered
    .filter((entry) => !onlyId || entry.id === onlyId)
    .filter((entry) => !onlySource || entry.source === onlySource);

  if (discovered.length === 0) {
    return {
      skins: [],
      issues: [{
        level: 'error',
        skinId: onlyId || '*',
        source: onlySource || '*',
        message: '검사할 skin pack 이 없습니다.',
      }],
      summary: {
        skins: 0,
        errors: 1,
        warnings: 0,
      },
    };
  }

  for (const entry of discovered) {
    if (entry.readError) {
      pushIssue(issues, 'error', entry.id, entry.source, entry.readError);
      continue;
    }
    validateManifestBasics(entry, issues);
    validateFiles(entry, issues);
  }

  const catalogEntries = onlyId || onlySource
    ? allDiscovered.filter((entry) => !entry.readError)
    : discovered;

  const effectiveCatalog = buildEffectiveCatalog(catalogEntries, issues, {
    warnOverrides: !(onlyId || onlySource),
  });
  validateInheritance(
    effectiveCatalog,
    issues,
    discovered.filter((entry) => !entry.readError),
  );

  const skins = discovered.map((entry) => ({
    id: entry.id,
    source: entry.source,
    dir: path.relative(projectRoot, entry.dir),
    extends: entry.manifest?.extends || null,
    stylesheet: entry.manifest?.stylesheet || null,
    overrides: (entry.manifest?.overrides?.sections || []).map((override) => ({
      type: override.type,
      file: override.file,
    })),
  }));

  return {
    skins,
    issues,
    summary: {
      skins: skins.length,
      errors: issues.filter((issue) => issue.level === 'error').length,
      warnings: issues.filter((issue) => issue.level === 'warning').length,
    },
  };
}

export function formatSkinCheckResult(result) {
  const lines = [];

  for (const skin of result.skins) {
    lines.push(`${skin.id} (${skin.source})  ${skin.dir}`);
    if (skin.stylesheet) {
      lines.push(`  - stylesheet: ${skin.stylesheet}`);
    }
    if (skin.extends) {
      lines.push(`  - extends: ${skin.extends}`);
    }
    if (skin.overrides.length > 0) {
      lines.push(`  - overrides: ${skin.overrides.map((item) => `${item.type}:${item.file}`).join(', ')}`);
    }

    const skinIssues = result.issues.filter((issue) => issue.skinId === skin.id && issue.source === skin.source);
    if (skinIssues.length === 0) {
      lines.push('  - 문제 없음');
    } else {
      for (const issue of skinIssues) {
        lines.push(`  - [${issue.level}] ${issue.message}`);
      }
    }
  }

  lines.push(`요약: skins=${result.summary.skins}, errors=${result.summary.errors}, warnings=${result.summary.warnings}`);
  return lines.join('\n');
}
