import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { runSkinCheck } from './skin-check.js';

const PACKAGE_KIND = 'clinic-os-skin-pack';
const PACKAGE_SCHEMA_VERSION = 1;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeResolvePath(targetDir, entryPath) {
  if (!entryPath || entryPath.includes('..') || path.isAbsolute(entryPath)) {
    return null;
  }

  const resolved = path.resolve(targetDir, entryPath);
  if (!resolved.startsWith(targetDir + path.sep) && resolved !== targetDir) {
    return null;
  }

  return resolved;
}

function walkSkinFiles(rootDir, currentDir = rootDir) {
  const files = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name.startsWith('.git')) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSkinFiles(rootDir, absolutePath));
      continue;
    }

    files.push({
      absolutePath,
      relativePath: toPosix(path.relative(rootDir, absolutePath)),
    });
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function getSkinPaths(projectRoot, skinId) {
  return {
    coreDir: path.join(projectRoot, 'src', 'skins', skinId),
    localDir: path.join(projectRoot, 'src', 'skins', 'local', skinId),
    storeDir: path.join(projectRoot, 'src', 'skins', 'store', skinId),
  };
}

export function resolveSkinSource(projectRoot, skinId, preferredSource = null) {
  const paths = getSkinPaths(projectRoot, skinId);
  const matches = [
    fs.existsSync(paths.localDir) ? 'local' : null,
    fs.existsSync(paths.storeDir) ? 'store' : null,
    fs.existsSync(paths.coreDir) ? 'core' : null,
  ].filter(Boolean);

  if (preferredSource) {
    if (!matches.includes(preferredSource)) {
      throw new Error(`"${skinId}" 스킨을 source="${preferredSource}" 에서 찾지 못했습니다.`);
    }
    return preferredSource;
  }

  if (matches.length === 0) {
    throw new Error(`"${skinId}" 스킨을 찾지 못했습니다.`);
  }

  if (matches.length > 1) {
    throw new Error(`"${skinId}" 스킨이 여러 source(${matches.join(', ')})에 있습니다. --source 로 명시하세요.`);
  }

  return matches[0];
}

function getSkinDir(projectRoot, skinId, source) {
  const paths = getSkinPaths(projectRoot, skinId);
  if (source === 'local') return paths.localDir;
  if (source === 'store') return paths.storeDir;
  return paths.coreDir;
}

function normalizeBundledManifest(manifest) {
  return {
    ...manifest,
    source: 'store',
    status: manifest.status || 'ready',
  };
}

function createContentHash(files) {
  const hash = createHash('sha256');

  for (const file of files) {
    hash.update(file.relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(file.absolutePath));
    hash.update('\0');
  }

  return hash.digest('hex');
}

export function buildSkinBundlePlan(projectRoot, options = {}) {
  const skinId = String(options.id || options.skinId || '').trim();
  if (!skinId) {
    throw new Error('--id is required');
  }

  const source = resolveSkinSource(projectRoot, skinId, options.source ? String(options.source).trim() : null);
  const validation = runSkinCheck(projectRoot, { id: skinId, source });
  if (validation.summary.errors > 0) {
    throw new Error(`"${skinId}" 스킨이 검증에 실패했습니다. 먼저 npm run skin:check -- --id ${skinId} --source ${source} 로 문제를 해결하세요.`);
  }

  const sourceDir = getSkinDir(projectRoot, skinId, source);
  const manifestPath = path.join(sourceDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  const files = walkSkinFiles(sourceDir);
  const outDir = path.resolve(projectRoot, options.outDir || 'dist-skins');
  const version = manifest.version || '1.0.0';
  const bundleFileName = `${skinId}-skin-v${version}.zip`;
  const bundlePath = path.join(outDir, bundleFileName);
  const contentHash = createContentHash(files);

  const packageMeta = {
    kind: PACKAGE_KIND,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    builtAt: new Date().toISOString(),
    skinId,
    version,
    source,
    installSource: 'store',
    installTarget: `src/skins/store/${skinId}`,
    contentHash,
    manifest: {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      extends: manifest.extends || null,
      stylesheet: manifest.stylesheet || null,
      preview: manifest.preview || null,
    },
    files: files.map((file) => file.relativePath),
  };

  return {
    skinId,
    source,
    sourceDir,
    manifest,
    files,
    outDir,
    version,
    bundleFileName,
    bundlePath,
    packageMeta,
  };
}

export function writeSkinBundle(plan) {
  ensureDir(plan.outDir);

  const zipEntries = {};
  for (const file of plan.files) {
    zipEntries[file.relativePath] = fs.readFileSync(file.absolutePath);
  }
  zipEntries['skin-package.json'] = strToU8(`${JSON.stringify(plan.packageMeta, null, 2)}\n`);

  const zipBytes = zipSync(zipEntries, { level: 6 });
  fs.writeFileSync(plan.bundlePath, Buffer.from(zipBytes));

  const archiveHash = createHash('sha256').update(Buffer.from(zipBytes)).digest('hex');
  return {
    ...plan,
    archiveHash,
    bytes: zipBytes.byteLength,
  };
}

export function inspectSkinBundle(bundlePath) {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`번들 파일을 찾지 못했습니다: ${bundlePath}`);
  }

  const zipBytes = fs.readFileSync(bundlePath);
  const entries = unzipSync(zipBytes);
  const packageEntry = entries['skin-package.json'];
  if (!packageEntry) {
    throw new Error('skin-package.json 이 없는 번들입니다.');
  }

  const packageMeta = JSON.parse(strFromU8(packageEntry));
  if (packageMeta.kind !== PACKAGE_KIND) {
    throw new Error(`지원하지 않는 패키지 kind 입니다: ${packageMeta.kind}`);
  }

  const manifestEntry = entries['manifest.json'];
  if (!manifestEntry) {
    throw new Error('manifest.json 이 없는 번들입니다.');
  }

  const manifest = JSON.parse(strFromU8(manifestEntry));
  const files = Object.keys(entries)
    .filter((entryPath) => entryPath !== 'skin-package.json')
    .sort((a, b) => a.localeCompare(b));

  return {
    bundlePath,
    packageMeta,
    manifest,
    files,
    entries,
  };
}

export function planSkinInstall(projectRoot, bundlePath, options = {}) {
  const inspection = inspectSkinBundle(bundlePath);
  const skinId = inspection.packageMeta.skinId || inspection.manifest.id;
  const paths = getSkinPaths(projectRoot, skinId);

  const blockingConflict = fs.existsSync(paths.localDir)
    ? { type: 'local', path: paths.localDir, reason: '로컬 skin pack 과 같은 ID는 store 설치로 덮어쓸 수 없습니다.' }
    : fs.existsSync(paths.coreDir)
      ? { type: 'core', path: paths.coreDir, reason: '코어 skin pack 과 같은 ID는 store 설치로 덮어쓸 수 없습니다.' }
      : null;

  const existingStoreInstall = fs.existsSync(paths.storeDir)
    ? {
        path: paths.storeDir,
        manifestPath: path.join(paths.storeDir, 'manifest.json'),
        manifest: fs.existsSync(path.join(paths.storeDir, 'manifest.json'))
          ? readJson(path.join(paths.storeDir, 'manifest.json'))
          : null,
      }
    : null;

  return {
    skinId,
    version: inspection.packageMeta.version || inspection.manifest.version || '1.0.0',
    targetDir: paths.storeDir,
    bundlePath,
    packageMeta: inspection.packageMeta,
    manifest: inspection.manifest,
    files: inspection.files,
    blockingConflict,
    existingStoreInstall,
    canInstall: !blockingConflict && (!existingStoreInstall || options.force === true),
  };
}

export function installSkinBundle(projectRoot, bundlePath, options = {}) {
  const force = options.force === true;
  const plan = planSkinInstall(projectRoot, bundlePath, { force });

  if (plan.blockingConflict) {
    throw new Error(plan.blockingConflict.reason);
  }

  if (plan.existingStoreInstall && !force) {
    throw new Error('이미 store 에 설치된 skin pack 입니다. 다시 설치하려면 --force 를 사용하세요.');
  }

  const { skinId, targetDir } = plan;
  const inspection = inspectSkinBundle(bundlePath);
  let backupDir = null;

  if (fs.existsSync(targetDir)) {
    backupDir = `${targetDir}.backup-${Date.now()}`;
    fs.renameSync(targetDir, backupDir);
  }

  try {
    ensureDir(targetDir);

    for (const [entryPath, entryData] of Object.entries(inspection.entries)) {
      if (entryPath === 'skin-package.json') {
        continue;
      }

      const safePath = safeResolvePath(targetDir, entryPath);
      if (!safePath) {
        continue;
      }

      ensureDir(path.dirname(safePath));
      fs.writeFileSync(safePath, entryData);
    }

    const normalizedManifest = normalizeBundledManifest(inspection.manifest);
    fs.writeFileSync(
      path.join(targetDir, 'manifest.json'),
      `${JSON.stringify(normalizedManifest, null, 2)}\n`
    );
    fs.writeFileSync(
      path.join(targetDir, 'skin-package.json'),
      `${JSON.stringify({
        ...inspection.packageMeta,
        installedAt: new Date().toISOString(),
        installedSource: 'store',
      }, null, 2)}\n`
    );

    const validation = runSkinCheck(projectRoot, { id: skinId, source: 'store' });
    if (validation.summary.errors > 0) {
      throw new Error(`설치 후 skin 검증에 실패했습니다: ${validation.issues.map((issue) => issue.message).join('; ')}`);
    }

    return {
      ...plan,
      backupDir,
      manifest: normalizedManifest,
    };
  } catch (error) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    if (backupDir && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, targetDir);
    }
    throw error;
  }
}
