import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { buildSkinBundlePlan, writeSkinBundle } from './skin-package.js';
import { findProjectRoot, readClinicJsonLicenseKey, readCosLicenseFile } from './survey-tool-installer.js';

const DEFAULT_HQ_URL = 'https://clinic-os-hq.pages.dev';

export { findProjectRoot };

export function getSkinSubmissionHqUrl(explicitUrl) {
  return explicitUrl || process.env.COS_HQ_URL || process.env.PUBLIC_HQ_URL || DEFAULT_HQ_URL;
}

export function getSkinSubmissionLicenseKey(projectRoot, explicitLicenseKey) {
  if (explicitLicenseKey) {
    return explicitLicenseKey;
  }

  return readClinicJsonLicenseKey(projectRoot) || readCosLicenseFile(projectRoot);
}

export function buildSkinSubmissionPlan(projectRoot, options = {}) {
  const tempOutDir = options.outDir || fs.mkdtempSync(path.join(os.tmpdir(), 'clinic-os-skin-submit-'));
  const bundlePlan = buildSkinBundlePlan(projectRoot, {
    id: options.id,
    source: options.source,
    outDir: tempOutDir,
  });

  return {
    projectRoot,
    tempOutDir,
    bundlePlan,
    skinId: bundlePlan.skinId,
    source: bundlePlan.source,
    manifest: bundlePlan.manifest,
    version: bundlePlan.version,
  };
}

export function createSkinSubmissionPayload(plan) {
  const bundleResult = writeSkinBundle(plan.bundlePlan);
  const archiveBuffer = fs.readFileSync(bundleResult.bundlePath);

  return {
    ...plan,
    bundleResult,
    archiveBuffer,
    packageData: archiveBuffer.toString('base64'),
    packageHash: createHash('sha256').update(archiveBuffer).digest('hex'),
  };
}

export async function submitSkinPayload({ hqUrl, licenseKey, manifest, packageData, packageHash }) {
  const response = await fetch(`${hqUrl}/api/skins/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      manifest,
      packageData,
      packageHash,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || '스킨 제출에 실패했습니다.');
  }

  return payload;
}
