/**
 * image-pipeline.js
 * 네이버 이미지 다운로드 → R2 업로드 + 본문 URL 치환
 */

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const CONCURRENCY = 5;
const DELAY_MS = 1000;
const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * 이미지 목록 다운로드 → R2 업로드 → URL 매핑 반환
 * @param {string[]} imageUrls - 네이버 이미지 URL 목록
 * @param {object} options
 * @param {string} options.bucket - R2 버킷 이름
 * @param {boolean} options.dryRun - true면 다운로드/업로드 안 함
 * @param {string} options.env - wrangler 환경 (production/preview)
 * @returns {Promise<Map<string, string>>} 원본URL → R2 URL 매핑
 */
export async function processImages(imageUrls, options = {}) {
  const { bucket, dryRun = false, env = 'production' } = options;
  const urlMap = new Map();

  if (!imageUrls || imageUrls.length === 0) return urlMap;
  if (dryRun) {
    console.log(`[이미지] dry-run: ${imageUrls.length}개 이미지 발견 (스킵)`);
    imageUrls.forEach(url => urlMap.set(url, url));
    return urlMap;
  }

  if (!bucket) {
    console.error('[이미지] R2 버킷 이름이 필요합니다');
    return urlMap;
  }

  const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const chunks = chunkArray(imageUrls, CONCURRENCY);

  let processed = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(url => downloadAndUpload(url, { bucket, env, yearMonth }))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalUrl = chunk[i];
      if (result.status === 'fulfilled' && result.value) {
        urlMap.set(originalUrl, result.value);
        processed++;
      } else {
        console.warn(`[이미지] 실패: ${originalUrl} - ${result.reason?.message || 'unknown'}`);
        urlMap.set(originalUrl, originalUrl); // 실패 시 원본 URL 유지
        failed++;
      }
    }

    // Rate limit: 청크 간 딜레이
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`[이미지] 완료: ${processed}개 성공, ${failed}개 실패 (전체 ${imageUrls.length}개)`);
  return urlMap;
}

/**
 * 단일 이미지 다운로드 → R2 업로드
 * @returns {Promise<string>} R2 키
 */
async function downloadAndUpload(url, { bucket, env, yearMonth }) {
  // 1. 다운로드
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://m.blog.naver.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; ClinicOS/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const ext = MIME_TO_EXT[contentType] || guessExtension(url);

  if (!ext || !VALID_EXTENSIONS.includes(ext)) {
    throw new Error(`지원하지 않는 이미지 형식: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 2. 크기 검증
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`파일 크기 초과: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
  }

  if (buffer.length < 100) {
    throw new Error('파일이 너무 작음 (깨진 이미지 가능)');
  }

  // 3. R2 업로드 (wrangler CLI, execFileSync로 안전하게)
  const uuid = crypto.randomUUID().split('-')[0];
  const r2Key = `blog-imports/${yearMonth}/${uuid}.${ext}`;
  const tmpPath = `/tmp/clinic-os-img-${uuid}.${ext}`;

  const fs = await import('fs/promises');
  await fs.writeFile(tmpPath, buffer);

  try {
    const args = [
      'wrangler', 'r2', 'object', 'put',
      `${bucket}/${r2Key}`,
      `--file=${tmpPath}`,
      `--content-type=${contentType}`,
    ];
    if (env) {
      args.push(`--env`, env);
    }
    execFileSync('npx', args, { stdio: 'pipe', timeout: 30000 });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }

  return r2Key;
}

/**
 * HTML 본문 내 이미지 URL 일괄 치환
 * @param {string} html - 본문 HTML
 * @param {Map<string, string>} urlMap - 원본URL → R2키 매핑
 * @param {string} baseUrl - R2 프록시 기본 URL (e.g. /api/files/)
 * @returns {string} 치환된 HTML
 */
export function replaceImageUrls(html, urlMap, baseUrl = '/api/files/') {
  let result = html;
  for (const [originalUrl, r2Key] of urlMap.entries()) {
    if (originalUrl !== r2Key) {
      const newUrl = r2Key.startsWith('http') ? r2Key : `${baseUrl}${r2Key}`;
      result = result.replaceAll(originalUrl, newUrl);
    }
  }
  return result;
}

/**
 * URL에서 확장자 추측
 */
function guessExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    return VALID_EXTENSIONS.includes(ext) ? ext : 'jpg';
  } catch {
    return 'jpg';
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
