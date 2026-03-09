import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { unzipSync } from 'fflate';

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function findProjectRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return path.resolve(startDir);
}

export function getSurveyToolPaths(projectRoot, toolId) {
  return {
    rootDir: path.join(projectRoot, 'src', 'survey-tools'),
    coreDir: path.join(projectRoot, 'src', 'survey-tools', toolId),
    localDir: path.join(projectRoot, 'src', 'survey-tools', 'local', toolId),
    storeDir: path.join(projectRoot, 'src', 'survey-tools', 'store', toolId),
  };
}

export function readClinicJsonLicenseKey(projectRoot) {
  const clinicJson = readJsonIfExists(path.join(projectRoot, 'clinic.json'));

  if (!clinicJson) {
    return null;
  }

  return clinicJson.licenseKey || clinicJson.license_key || null;
}

export function readCosLicenseFile(projectRoot) {
  const candidates = [
    path.join(projectRoot, '.cos-license'),
    path.join(process.env.HOME || '', '.cos-license'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const value = fs.readFileSync(candidate, 'utf8').trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function getSurveyToolLicenseKey(projectRoot, explicitLicenseKey) {
  if (explicitLicenseKey) {
    return explicitLicenseKey;
  }

  return readClinicJsonLicenseKey(projectRoot) || readCosLicenseFile(projectRoot);
}

export function safeResolvePath(targetDir, entryPath) {
  if (entryPath.includes('..') || path.isAbsolute(entryPath)) {
    return null;
  }

  const resolved = path.resolve(targetDir, entryPath);
  if (!resolved.startsWith(targetDir + path.sep) && resolved !== targetDir) {
    return null;
  }

  return resolved;
}

export function normalizeSurveyToolManifest(toolId, manifest, fallbackVersion = '1.0.0') {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Downloaded survey tool did not include a valid manifest.');
  }

  const normalized = {
    ...manifest,
    id: toolId,
    source: 'store',
    version: manifest.version || fallbackVersion,
  };

  if (!normalized.name || typeof normalized.name !== 'string') {
    throw new Error('Survey tool manifest must include a name.');
  }

  if (!normalized.description || typeof normalized.description !== 'string') {
    normalized.description = '';
  }

  return normalized;
}

export function decodeSurveyToolDownload(toolId, payload) {
  const download = payload?.download || payload || {};
  const manifest = normalizeSurveyToolManifest(
    toolId,
    download.manifest || payload?.manifest,
    download.version || '1.0.0',
  );

  return {
    manifest,
    version: download.version || manifest.version,
    packageData: typeof download.packageData === 'string' ? download.packageData : null,
    packageHash: typeof download.packageHash === 'string' ? download.packageHash : null,
  };
}

export function inspectSurveyToolDownload(toolId, payload) {
  const decoded = decodeSurveyToolDownload(toolId, payload);
  let files = [];

  if (decoded.packageData) {
    const entries = unzipSync(Buffer.from(decoded.packageData, 'base64'));
    files = Object.keys(entries).sort();
  }

  return {
    ...decoded,
    files,
    manifestOnly: files.length === 0,
    hasMigration: files.includes('migration.sql'),
    hasSeed: files.includes('seed.sql'),
    hasSurveyRenderer: files.includes('survey.astro'),
    hasResultRenderer: files.includes('result.astro'),
    hasReportRenderer: files.includes('report.astro'),
  };
}

export function planSurveyToolInstall(projectRoot, toolId, payload, options = {}) {
  const { force = false } = options;
  const paths = getSurveyToolPaths(projectRoot, toolId);
  const inspection = inspectSurveyToolDownload(toolId, payload);

  const blockingConflict = fs.existsSync(paths.localDir)
    ? { type: 'local', path: paths.localDir, reason: '로컬 검사도구가 같은 ID를 사용 중입니다.' }
    : fs.existsSync(paths.coreDir)
      ? { type: 'core', path: paths.coreDir, reason: '코어 기본 검사도구와 같은 ID는 스토어 설치로 덮어쓸 수 없습니다.' }
      : null;

  const existingStoreInstall = fs.existsSync(paths.storeDir)
    ? {
        path: paths.storeDir,
        manifestPath: path.join(paths.storeDir, 'manifest.json'),
        manifest: readJsonIfExists(path.join(paths.storeDir, 'manifest.json')),
      }
    : null;

  const actions = [];
  if (existingStoreInstall) {
    actions.push(force ? 'backup_existing_store_dir' : 'skip_existing_store_dir');
  }
  actions.push(inspection.manifestOnly ? 'write_manifest' : 'extract_package');
  if (inspection.hasMigration) {
    actions.push('run_migration_sql');
  }
  if (inspection.hasSeed) {
    actions.push('run_seed_sql');
  }

  return {
    toolId,
    manifest: inspection.manifest,
    version: inspection.version,
    targetDir: paths.storeDir,
    blockingConflict,
    existingStoreInstall,
    canInstall: !blockingConflict && (!existingStoreInstall || force),
    actions,
    package: {
      manifestOnly: inspection.manifestOnly,
      files: inspection.files,
      hasMigration: inspection.hasMigration,
      hasSeed: inspection.hasSeed,
      hasSurveyRenderer: inspection.hasSurveyRenderer,
      hasResultRenderer: inspection.hasResultRenderer,
      hasReportRenderer: inspection.hasReportRenderer,
    },
  };
}

export function installSurveyToolFiles(projectRoot, toolId, payload, options = {}) {
  const { force = false } = options;
  const plan = planSurveyToolInstall(projectRoot, toolId, payload, { force });

  if (plan.blockingConflict) {
    throw new Error(plan.blockingConflict.reason);
  }

  if (plan.existingStoreInstall && !force) {
    throw new Error('이미 스토어에 설치된 검사도구입니다. 다시 설치하려면 force 옵션을 사용하세요.');
  }

  const { storeDir } = getSurveyToolPaths(projectRoot, toolId);
  let backupDir = null;

  if (fs.existsSync(storeDir)) {
    backupDir = `${storeDir}.backup-${Date.now()}`;
    fs.renameSync(storeDir, backupDir);
  }

  try {
    fs.mkdirSync(storeDir, { recursive: true });

    const decoded = decodeSurveyToolDownload(toolId, payload);
    let computedHash = '';
    let filesExtracted = false;

    if (decoded.packageData) {
      const zipBytes = Buffer.from(decoded.packageData, 'base64');
      computedHash = createHash('sha256').update(zipBytes).digest('hex');

      if (decoded.packageHash && computedHash !== decoded.packageHash) {
        throw new Error('Package hash mismatch. Download may be corrupted.');
      }

      const unzipped = unzipSync(zipBytes);

      for (const [entryPath, entryData] of Object.entries(unzipped)) {
        const safePath = safeResolvePath(storeDir, entryPath);
        if (!safePath) {
          continue;
        }

        if (entryPath.endsWith('/')) {
          fs.mkdirSync(safePath, { recursive: true });
          continue;
        }

        fs.mkdirSync(path.dirname(safePath), { recursive: true });
        fs.writeFileSync(safePath, entryData);
      }

      filesExtracted = true;
    }

    const manifestPath = path.join(storeDir, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(decoded.manifest, null, 2)}\n`);

    return {
      ...plan,
      targetDir: storeDir,
      manifestPath,
      backupDir,
      filesExtracted,
      computedHash,
      manifest: decoded.manifest,
      version: decoded.version,
    };
  } catch (error) {
    fs.rmSync(storeDir, { recursive: true, force: true });
    if (backupDir && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, storeDir);
    }
    throw error;
  }
}

export function getSurveyToolSchemaFiles(projectRoot, toolId) {
  const { storeDir } = getSurveyToolPaths(projectRoot, toolId);
  const migrationPath = path.join(storeDir, 'migration.sql');
  const seedPath = path.join(storeDir, 'seed.sql');

  return {
    migrationPath: fs.existsSync(migrationPath) ? migrationPath : null,
    seedPath: fs.existsSync(seedPath) ? seedPath : null,
  };
}

function readLocalDbName(projectRoot) {
  const wranglerPath = path.join(projectRoot, 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    return null;
  }

  const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
  const match = wranglerContent.match(/database_name\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

export function applySurveyToolSchema(projectRoot, toolId, options = {}) {
  const {
    skipMigration = false,
    skipSeed = false,
    dryRun = false,
    stdio = 'pipe',
  } = options;
  const actions = [];
  const dbName = readLocalDbName(projectRoot);
  const { migrationPath, seedPath } = getSurveyToolSchemaFiles(projectRoot, toolId);

  if (!dbName) {
    return {
      dbName: null,
      actions,
      warnings: ['wrangler.toml 에서 database_name 을 찾지 못해 migration/seed 를 실행하지 않았습니다.'],
    };
  }

  if (migrationPath && !skipMigration) {
    actions.push({ type: 'migration', file: migrationPath });
  }

  if (seedPath && !skipSeed) {
    actions.push({ type: 'seed', file: seedPath });
  }

  if (!dryRun) {
    for (const action of actions) {
      execSync(
        `npx wrangler d1 execute ${dbName} --local --file="${action.file}" --yes`,
        { cwd: projectRoot, stdio },
      );
    }
  }

  return {
    dbName,
    actions,
    warnings: [],
  };
}
