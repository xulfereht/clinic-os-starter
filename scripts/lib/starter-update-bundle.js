import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import zlib from 'zlib';

export const STARTER_UPDATE_BUNDLE_FORMAT = 'clinic-os-starter-update-bundle.v1';

export function hashBufferSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function hashFileSha256(filePath) {
    return hashBufferSha256(fs.readFileSync(filePath));
}

export function getChangedStarterFiles({ projectRoot, files, manifestHashes = {} }) {
    if (!manifestHashes || Object.keys(manifestHashes).length === 0) {
        return [...files];
    }

    return files.filter((file) => {
        const expectedHash = manifestHashes[file];
        if (!expectedHash) return true;

        const filePath = path.join(projectRoot, file);
        if (!fs.existsSync(filePath)) return true;

        try {
            return hashFileSha256(filePath) !== expectedHash;
        } catch {
            return true;
        }
    });
}

export function buildStarterUpdateBundle({ stagingDir, files, version, outputPath }) {
    const bundleFiles = {};
    const hashes = {};

    for (const file of files) {
        const filePath = path.join(stagingDir, file);
        const raw = fs.readFileSync(filePath);
        const text = raw.toString('utf8');

        bundleFiles[file] = text;
        hashes[file] = hashBufferSha256(raw);
    }

    const bundle = {
        format: STARTER_UPDATE_BUNDLE_FORMAT,
        version,
        generated_at: new Date().toISOString(),
        file_count: files.length,
        files: bundleFiles,
    };

    const jsonBuffer = Buffer.from(JSON.stringify(bundle));
    const gzipBuffer = zlib.gzipSync(jsonBuffer, { level: 9 });
    fs.writeFileSync(outputPath, gzipBuffer);

    return {
        outputPath,
        fileCount: files.length,
        byteLength: gzipBuffer.length,
        sha256: hashBufferSha256(gzipBuffer),
        hashes,
    };
}

export function parseStarterUpdateBundle(bundleBuffer) {
    const parsed = JSON.parse(zlib.gunzipSync(bundleBuffer).toString('utf8'));

    if (parsed?.format !== STARTER_UPDATE_BUNDLE_FORMAT) {
        throw new Error(`지원하지 않는 starter bundle format: ${parsed?.format || '(없음)'}`);
    }

    if (!parsed.files || typeof parsed.files !== 'object') {
        throw new Error('starter bundle files payload가 비어 있습니다.');
    }

    return parsed;
}

export function applyStarterUpdateBundle({ projectRoot, bundleBuffer, onlyFiles = null }) {
    const bundle = parseStarterUpdateBundle(bundleBuffer);
    const targetFiles = onlyFiles ? new Set(onlyFiles) : null;
    let appliedCount = 0;

    for (const [file, content] of Object.entries(bundle.files)) {
        if (targetFiles && !targetFiles.has(file)) continue;

        const filePath = path.join(projectRoot, file);
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        appliedCount += 1;
    }

    return {
        bundle,
        appliedCount,
    };
}
