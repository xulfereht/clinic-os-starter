import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { findProjectRoot, readClinicJsonLicenseKey, readCosLicenseFile } from './survey-tool-installer.js';
import { getSkinPaths, installSkinBundle, planSkinInstall } from './skin-package.js';

const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export { findProjectRoot };

export function getSkinInstallerHqUrl(explicitUrl) {
  return explicitUrl || process.env.COS_HQ_URL || process.env.PUBLIC_HQ_URL || DEFAULT_HQ_URL;
}

export function getSkinStoreLicenseKey(projectRoot, explicitLicenseKey) {
  if (explicitLicenseKey) {
    return explicitLicenseKey;
  }

  return readClinicJsonLicenseKey(projectRoot) || readCosLicenseFile(projectRoot);
}

export async function downloadSkinPackage({ skinId, version, licenseKey, hqUrl }) {
  const response = await fetch(`${hqUrl}/api/skins/${skinId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      version: version || null,
      includePackage: true,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || '스킨 다운로드에 실패했습니다.');
  }

  if (payload.skin?.installable === false) {
    throw new Error('코어 기본 스킨은 HQ store install 대상이 아닙니다.');
  }

  if (!payload.download?.packageData) {
    throw new Error('다운로드된 스킨 package 데이터가 없습니다.');
  }

  return payload;
}

export function stageDownloadedSkinBundle(payload) {
  const skinId = payload?.skin?.id || payload?.download?.skinId;
  if (!skinId) {
    throw new Error('다운로드 payload 에 skin ID 가 없습니다.');
  }

  const zipBuffer = Buffer.from(payload.download.packageData, 'base64');
  if (payload.download.packageHash && sha256Hex(zipBuffer) !== payload.download.packageHash) {
    throw new Error('패키지 checksum 검증에 실패했습니다.');
  }

  const tempZipPath = path.join(os.tmpdir(), `clinic-os-skin-${skinId}-${Date.now()}.zip`);
  fs.writeFileSync(tempZipPath, zipBuffer);

  return {
    skinId,
    tempZipPath,
    payload,
  };
}

export function cleanupStagedSkinBundle(staged) {
  if (staged?.tempZipPath && fs.existsSync(staged.tempZipPath)) {
    fs.rmSync(staged.tempZipPath, { force: true });
  }
}

export function planSkinStoreInstall(projectRoot, payload, options = {}) {
  const staged = stageDownloadedSkinBundle(payload);
  try {
    const plan = planSkinInstall(projectRoot, staged.tempZipPath, {
      force: Boolean(options.force),
    });
    return {
      ...plan,
      hqSkin: payload.skin || null,
    };
  } finally {
    cleanupStagedSkinBundle(staged);
  }
}

export function installSkinFromDownloadedPayload(projectRoot, payload, options = {}) {
  const staged = stageDownloadedSkinBundle(payload);
  try {
    const result = installSkinBundle(projectRoot, staged.tempZipPath, {
      force: Boolean(options.force),
    });
    return {
      ...result,
      hqSkin: payload.skin || null,
    };
  } finally {
    cleanupStagedSkinBundle(staged);
  }
}

export async function reportSkinInstall({ skinId, version, licenseKey, hqUrl }) {
  try {
    await fetch(`${hqUrl}/api/skins/${skinId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, version }),
    });
  } catch (error) {
    console.error(`Warning: HQ 스킨 설치 보고 실패: ${error.message}`);
  }
}

export async function reportSkinUninstall({ skinId, licenseKey, hqUrl }) {
  try {
    await fetch(`${hqUrl}/api/skins/${skinId}/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
  } catch (error) {
    console.error(`Warning: HQ 스킨 제거 보고 실패: ${error.message}`);
  }
}

export function planSkinRemoval(projectRoot, skinId) {
  const { coreDir, localDir, storeDir } = getSkinPaths(projectRoot, skinId);
  const manifestPath = path.join(storeDir, 'manifest.json');
  const manifest = readJsonIfExists(manifestPath);

  let blockingReason = null;
  if (fs.existsSync(localDir)) {
    blockingReason = '로컬 커스텀 스킨은 skin:remove 대상이 아닙니다.';
  } else if (fs.existsSync(coreDir) && !fs.existsSync(storeDir)) {
    blockingReason = '코어 기본 스킨은 제거할 수 없습니다.';
  } else if (!fs.existsSync(storeDir)) {
    blockingReason = '설치된 store 스킨을 찾지 못했습니다.';
  }

  return {
    skinId,
    targetDir: storeDir,
    manifest,
    canRemove: blockingReason == null,
    blockingReason,
  };
}

export function removeInstalledSkin(projectRoot, skinId) {
  const plan = planSkinRemoval(projectRoot, skinId);
  if (!plan.canRemove) {
    throw new Error(plan.blockingReason);
  }

  fs.rmSync(plan.targetDir, { recursive: true, force: true });
  return plan;
}
