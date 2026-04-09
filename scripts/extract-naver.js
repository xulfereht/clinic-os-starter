#!/usr/bin/env node

/**
 * extract-naver.js
 * 네이버 블로그/플레이스 콘텐츠 추출 → Clinic-OS 임포트
 *
 * Usage:
 *   node scripts/extract-naver.js \
 *     --blog-id=varo_clinic \
 *     --blog-id=just-true \
 *     --place-url="https://naver.me/5YF51amB" \
 *     --dry-run           # 추출만, DB 저장 안 함
 *     --limit=10          # 최근 N개만
 *     --skip-images       # 이미지 건너뛰기
 *     --output=json       # JSON 파일로 출력 (기본: DB)
 *     --env=production    # wrangler 환경
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { extractBlog } from './lib/naver-blog-extractor.js';
import { extractPlace, toProfilePatch as placeToProfile, toSiteSettings } from './lib/naver-place-extractor.js';
import { analyzeContent, toProfilePatch as analysisToProfile } from './lib/content-analyzer.js';
import { processImages, replaceImageUrls } from './lib/image-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
// CLI 인자 파싱
// ═══════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    blogIds: [],
    placeUrl: null,
    dryRun: false,
    limit: 50,
    skipImages: false,
    output: 'db', // 'db' | 'json'
    env: 'production',
    local: false,
    siteUrl: null, // --site-url로 클라이언트 사이트 URL 지정
    apiKey: null, // --api-key로 Admin API Key 지정
    dbName: null, // --db로 직접 지정 가능 (wrangler 폴백용)
    cfToken: null, // --cf-token으로 클라이언트 CF 토큰 지정 (wrangler 폴백용)
    bucket: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--blog-id=')) {
      config.blogIds.push(arg.split('=')[1]);
    } else if (arg.startsWith('--place-url=')) {
      config.placeUrl = arg.split('=').slice(1).join('=');
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1], 10) || 50;
    } else if (arg === '--skip-images') {
      config.skipImages = true;
    } else if (arg.startsWith('--output=')) {
      config.output = arg.split('=')[1];
    } else if (arg.startsWith('--env=')) {
      config.env = arg.split('=')[1];
    } else if (arg.startsWith('--db=')) {
      config.dbName = arg.split('=')[1];
    } else if (arg.startsWith('--site-url=')) {
      config.siteUrl = arg.split('=').slice(1).join('=').replace(/\/$/, '');
    } else if (arg.startsWith('--api-key=')) {
      config.apiKey = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--cf-token=')) {
      config.cfToken = arg.split('=').slice(1).join('=');
    } else if (arg === '--local') {
      config.local = true;
    } else if (arg.startsWith('--bucket=')) {
      config.bucket = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // wrangler.toml에서 버킷 이름 읽기
  if (!config.bucket) {
    config.bucket = readBucketFromWrangler();
  }

  return config;
}

function printHelp() {
  console.log(`
네이버 블로그/플레이스 콘텐츠 추출 → Clinic-OS 임포트

사용법:
  node scripts/extract-naver.js [옵션]

옵션:
  --blog-id=<id>      네이버 블로그 ID (복수 지정 가능)
  --place-url=<url>   네이버 플레이스 URL
  --dry-run           추출만 수행, DB 저장 안 함
  --limit=<n>         최근 N개 글만 추출 (기본: 50)
  --skip-images       이미지 다운로드 스킵
  --output=json       결과를 JSON 파일로 출력
  --env=<env>         wrangler 환경 (기본: production)
  --bucket=<name>     R2 버킷 이름 (자동 감지)

예시:
  node scripts/extract-naver.js --blog-id=varo_clinic --dry-run --limit=5
  node scripts/extract-naver.js --blog-id=varo_clinic --blog-id=just-true --place-url="https://naver.me/5YF51amB"
  `);
}

// ═══════════════════════════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════════════════════════

function readBucketFromWrangler() {
  try {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const match = content.match(/bucket_name\s*=\s*"([^"]+)"/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function runWranglerD1(sql, dbName, env, local = false, cfToken = null) {
  const args = ['wrangler', 'd1', 'execute', dbName, '--command', sql];
  if (local) args.push('--local');
  else {
    args.push('--remote');
    if (env && !cfToken) args.push('--env', env);
  }
  const execOpts = { stdio: 'pipe', timeout: 60000 };
  if (cfToken) {
    // 클라이언트 CF 토큰 사용 시: wrangler OAuth 캐시를 우회하려면
    // CLOUDFLARE_API_TOKEN만 포함한 최소 env를 넘겨야 함
    execOpts.env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CLOUDFLARE_API_TOKEN: cfToken,
      // npm/node 관련
      NODE_PATH: process.env.NODE_PATH || '',
      npm_config_cache: process.env.npm_config_cache || '',
    };
  }
  try {
    const result = execFileSync('npx', args, execOpts);
    return result.toString();
  } catch (err) {
    console.error(`[D1] SQL 실행 실패: ${err.stderr?.toString()?.split('\n').find(l => l.includes('ERROR') || l.includes('error')) || err.message}`);
    return null;
  }
}

function readDbNameFromWrangler() {
  try {
    const wranglerPath = path.join(PROJECT_ROOT, 'wrangler.toml');
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const match = content.match(/database_name\s*=\s*"([^"]+)"/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function escSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ═══════════════════════════════════════════════════════════════
// 메인 실행
// ═══════════════════════════════════════════════════════════════

async function main() {
  const config = parseArgs();
  const startTime = Date.now();

  if (config.blogIds.length === 0 && !config.placeUrl) {
    console.error('오류: --blog-id 또는 --place-url 중 하나 이상 필요합니다');
    console.error('도움말: node scripts/extract-naver.js --help');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════');
  console.log('  네이버 콘텐츠 추출 → Clinic-OS 임포트');
  console.log('═══════════════════════════════════════════');
  console.log(`  블로그: ${config.blogIds.join(', ') || '없음'}`);
  console.log(`  플레이스: ${config.placeUrl || '없음'}`);
  console.log(`  모드: ${config.dryRun ? 'DRY RUN (DB 저장 안 함)' : '실제 임포트'}`);
  console.log(`  최대 글 수: ${config.limit}`);
  console.log(`  이미지: ${config.skipImages ? '스킵' : '다운로드 + R2 업로드'}`);
  console.log('═══════════════════════════════════════════\n');

  const results = {
    blogs: [],
    place: null,
    analysis: null,
    summary: {},
  };

  // ── 블로그 추출 ──
  for (const blogId of config.blogIds) {
    const blogResult = await extractBlog(blogId, {
      limit: config.limit,
      skipImages: config.skipImages,
    });
    results.blogs.push(blogResult);
  }

  // ── 이미지 파이프라인 ──
  if (!config.skipImages && !config.dryRun) {
    for (const blog of results.blogs) {
      const allImageUrls = blog.posts.flatMap(p => p.image_urls || []);
      const uniqueUrls = [...new Set(allImageUrls)];

      if (uniqueUrls.length > 0) {
        console.log(`\n[이미지] ${blog.blogId}: ${uniqueUrls.length}개 이미지 처리 중...`);
        const urlMap = await processImages(uniqueUrls, {
          bucket: config.bucket,
          dryRun: config.dryRun,
          env: config.env,
        });

        // 본문 내 이미지 URL 치환
        for (const post of blog.posts) {
          post.content = replaceImageUrls(post.content, urlMap);
          if (post.featured_image && urlMap.has(post.featured_image)) {
            const r2Key = urlMap.get(post.featured_image);
            post.featured_image = r2Key.startsWith('http') ? r2Key : `/api/files/${r2Key}`;
          }
        }
      }
    }
  }

  // ── 콘텐츠 분석 ──
  const allPosts = results.blogs.flatMap(b => b.posts);
  if (allPosts.length > 0) {
    console.log('\n[분석] 콘텐츠 분석 중...');
    results.analysis = analyzeContent(allPosts);

    // 분석 결과로 카테고리 채우기
    allPosts.forEach(post => {
      if (post._category) {
        post.category = post._category;
        delete post._category;
      }
    });

    console.log(`[분석] 전문 분야: ${results.analysis.specialties.slice(0, 5).map(s => s.name).join(', ')}`);
    console.log(`[분석] 카테고리: ${Object.entries(results.analysis.categories).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }

  // ── 플레이스 추출 ──
  if (config.placeUrl) {
    results.place = await extractPlace(config.placeUrl);
  }

  // ── 결과 요약 ──
  const totalPosts = allPosts.length;
  const totalImages = allPosts.reduce((sum, p) => sum + (p.image_urls?.length || 0), 0);
  const totalErrors = results.blogs.reduce((sum, b) => sum + b.errors.length, 0);

  results.summary = {
    total_posts: totalPosts,
    total_images: totalImages,
    total_errors: totalErrors,
    blogs: results.blogs.map(b => ({
      id: b.blogId,
      posts: b.posts.length,
      errors: b.errors.length,
    })),
    place: results.place ? results.place.name : null,
    specialties: results.analysis?.specialties?.slice(0, 5).map(s => s.name) || [],
    duration_ms: Date.now() - startTime,
  };

  // ── 출력 ──
  if (config.output === 'json' || config.dryRun) {
    const outputPath = path.join(PROJECT_ROOT, `.agent/naver-extract-${new Date().toISOString().slice(0, 10)}.json`);

    // 출력용: text, image_urls 등 대용량 필드 제거
    const outputData = {
      ...results,
      blogs: results.blogs.map(b => ({
        ...b,
        posts: b.posts.map(p => ({
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          type: p.type,
          status: p.status,
          category: p.category,
          source_url: p.source_url,
          featured_image: p.featured_image,
          image_count: p.image_urls?.length || 0,
          content_length: p.content?.length || 0,
          created_at: p.created_at,
        })),
      })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n[출력] 결과 저장: ${outputPath}`);
  }

  // ── DB 저장 ──
  if (!config.dryRun && config.output === 'db') {
    if (config.siteUrl && config.apiKey) {
      // API 모드 (권장): 사이트 API 엔드포인트로 직접 POST
      console.log(`\n[API] ${config.siteUrl}에 임포트 중...`);
      await importViaApi(allPosts, results.place, config);
    } else {
      // Wrangler 폴백: 로컬 D1 또는 직접 지정
      const dbName = config.dbName || readDbNameFromWrangler();
      if (!dbName) {
        console.error('[DB] --site-url + --api-key 또는 --db 옵션이 필요합니다');
      } else {
        console.log(`\n[DB] ${dbName}에 임포트 중 (wrangler)...`);
        await importToD1(allPosts, results.place, config, dbName);
      }
    }
  }

  // ── clinic-profile.json 보완 ──
  if (!config.dryRun) {
    updateClinicProfile(results);
  }

  // ── R2 원본 백업 ──
  if (!config.dryRun && config.bucket) {
    backupRawData(results, config);
  }

  // ── 최종 리포트 ──
  results.summary.duration_ms = Date.now() - startTime;
  console.log('\n═══════════════════════════════════════════');
  console.log('  추출 완료');
  console.log('═══════════════════════════════════════════');
  console.log(`  글: ${totalPosts}개`);
  console.log(`  이미지: ${totalImages}개`);
  console.log(`  오류: ${totalErrors}개`);
  console.log(`  플레이스: ${results.place?.name || '-'}`);
  console.log(`  소요 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);
  if (results.analysis?.specialties?.length) {
    console.log(`  주요 분야: ${results.analysis.specialties.slice(0, 5).map(s => s.name).join(', ')}`);
  }
  console.log('═══════════════════════════════════════════');

  return results;
}

// ═══════════════════════════════════════════════════════════════
// API 임포트 (권장)
// ═══════════════════════════════════════════════════════════════

async function importViaApi(posts, place, config) {
  const { siteUrl, apiKey } = config;
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-API-Key': apiKey,
  };

  // API 연결 확인 (auth 에러 조기 감지)
  try {
    const probe = await fetch(`${siteUrl}/api/admin/posts?type=blog&limit=1`, { headers });
    if (probe.status === 401 || probe.status === 403) {
      console.error(`[API] ❌ 인증 실패 (${probe.status}). API 키를 확인하세요.`);
      return;
    }
    if (!probe.ok) {
      console.error(`[API] ❌ 사이트 응답 오류: ${probe.status}. URL: ${siteUrl}`);
      return;
    }
  } catch (err) {
    console.error(`[API] ❌ 사이트 연결 실패: ${err.message}. URL: ${siteUrl}`);
    return;
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of posts) {
    // 빈 content 스킵
    if (!post.content || post.content.trim().length === 0) {
      console.warn(`[API] 빈 content 스킵: ${post.title?.substring(0, 30)}`);
      skipped++;
      continue;
    }

    // 중복 체크: source_url로 기존 글 검색
    try {
      const checkRes = await fetch(`${siteUrl}/api/admin/posts?type=blog&limit=1&search=${encodeURIComponent(post.source_url)}`, { headers });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const existing = (checkData.data || checkData.posts || []).find(p => p.source_url === post.source_url);
        if (existing) {
          skipped++;
          continue;
        }
      }
    } catch { /* 검색 실패 시 그냥 임포트 시도 */ }

    // 글 생성
    try {
      const res = await fetch(`${siteUrl}/api/admin/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: post.type || 'blog',
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          featured_image: post.featured_image,
          category: post.category,
          status: post.status || 'draft',
          source_url: post.source_url,
        }),
      });

      if (res.ok) {
        imported++;
      } else {
        failed++;
        const err = await res.text();
        console.error(`[API] 글 생성 실패: ${post.title.substring(0, 30)}... — ${res.status} ${err.substring(0, 200)}`);
      }
    } catch (err) {
      failed++;
      console.error(`[API] 요청 실패: ${err.message}`);
    }
  }

  console.log(`[API] 임포트: ${imported}개, 스킵: ${skipped}개${failed > 0 ? `, 실패: ${failed}개` : ''}`);

  // 플레이스 → site_settings
  if (place) {
    const settings = toSiteSettings(place);
    let settingsOk = 0;
    for (const s of settings) {
      try {
        const res = await fetch(`${siteUrl}/api/admin/settings`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(s),
        });
        if (res.ok) settingsOk++;
      } catch { /* continue */ }
    }
    console.log(`[API] 플레이스 설정: ${settingsOk}/${settings.length}개`);
  }
}

// ═══════════════════════════════════════════════════════════════
// DB 임포트 (wrangler 폴백)
// ═══════════════════════════════════════════════════════════════

async function importToD1(posts, place, config, dbName) {
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of posts) {
    // 빈 content 스킵
    if (!post.content || post.content.trim().length === 0) {
      console.warn(`[DB] 빈 content 스킵: ${post.title?.substring(0, 30)}`);
      skipped++;
      continue;
    }

    // 중복 체크 (source_url 기준)
    const checkSql = `SELECT id FROM posts WHERE source_url = ${escSql(post.source_url)} LIMIT 1`;
    const existing = runWranglerD1(checkSql, dbName, config.env, config.local, config.cfToken);

    if (existing && existing.includes('"id"')) {
      skipped++;
      continue;
    }

    // created_at must be unix timestamp (integer) — blog/[slug].astro expects numeric
    let createdAt;
    if (!post.created_at) {
      createdAt = "strftime('%s', 'now')";
    } else if (typeof post.created_at === 'number') {
      createdAt = `${post.created_at}`;
    } else {
      const ts = Math.floor(new Date(post.created_at).getTime() / 1000);
      createdAt = isNaN(ts) ? "strftime('%s', 'now')" : `${ts}`;
    }

    const sql = `INSERT INTO posts (type, title, slug, excerpt, content, featured_image, category, status, source_url, created_at)
VALUES (${escSql(post.type)}, ${escSql(post.title)}, ${escSql(post.slug)}, ${escSql(post.excerpt)}, ${escSql(post.content)}, ${escSql(post.featured_image)}, ${escSql(post.category)}, ${escSql(post.status)}, ${escSql(post.source_url)}, ${createdAt})`;

    const result = runWranglerD1(sql, dbName, config.env, config.local, config.cfToken);
    if (result === null) {
      failed++;
      console.error(`[DB] INSERT 실패: ${post.title?.substring(0, 30)}`);
    } else {
      imported++;
    }
  }

  console.log(`[DB] 임포트: ${imported}개, 스킵: ${skipped}개${failed > 0 ? `, 실패: ${failed}개` : ''}`);

  // 플레이스 → site_settings
  if (place) {
    const settings = toSiteSettings(place);
    for (const s of settings) {
      const sql = `INSERT OR REPLACE INTO site_settings (category, key, value, updated_at)
VALUES (${escSql(s.category)}, ${escSql(s.key)}, ${escSql(s.value)}, strftime('%s', 'now'))`;
      runWranglerD1(sql, dbName, config.env, config.local, config.cfToken);
    }
    console.log(`[DB] 플레이스 설정: ${settings.length}개`);
  }

  // 임포트 이력 기록 (INSERT OR REPLACE로 중복 방지)
  const historySql = `INSERT OR REPLACE INTO site_settings (category, key, value, updated_at)
VALUES ('content_import', 'last_naver_import', ${escSql(JSON.stringify({
    date: new Date().toISOString(),
    posts: posts.length,
    imported,
    skipped,
    failed,
  }))}, strftime('%s', 'now'))`;
  runWranglerD1(historySql, dbName, config.env, config.local, config.cfToken);
}

// ═══════════════════════════════════════════════════════════════
// clinic-profile.json 보완
// ═══════════════════════════════════════════════════════════════

function updateClinicProfile(results) {
  const profilePath = path.join(PROJECT_ROOT, '.agent/clinic-profile.json');

  let profile = {};
  try {
    if (fs.existsSync(profilePath)) {
      profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    }
  } catch { /* start fresh */ }

  // 분석 결과 병합
  if (results.analysis) {
    const analysisPatch = analysisToProfile(results.analysis);
    profile = deepMerge(profile, analysisPatch);
  }

  // 플레이스 결과 병합
  if (results.place) {
    const placePatch = placeToProfile(results.place);
    profile = deepMerge(profile, placePatch);
  }

  // 네이버 소스 URL 기록
  if (results.blogs.length > 0) {
    profile.blog_urls = results.blogs.map(b =>
      `https://blog.naver.com/${b.blogId}`
    );
  }
  if (results.place?.source_url) {
    profile.place_url = results.place.source_url;
  }

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  console.log(`[프로파일] clinic-profile.json 업데이트 완료`);
}

// ═══════════════════════════════════════════════════════════════
// R2 원본 백업
// ═══════════════════════════════════════════════════════════════

function backupRawData(results, config) {
  const backupData = {
    extracted_at: new Date().toISOString(),
    blogs: results.blogs.map(b => ({
      blogId: b.blogId,
      posts: b.posts.map(p => ({
        title: p.title,
        source_url: p.source_url,
        content: p.content,
        created_at: p.created_at,
      })),
    })),
    place: results.place,
    analysis: results.analysis,
  };

  const tmpPath = `/tmp/naver-extract-${Date.now()}.json`;
  fs.writeFileSync(tmpPath, JSON.stringify(backupData));

  const r2Key = `raw-backups/naver-extract-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    execFileSync('npx', [
      'wrangler', 'r2', 'object', 'put',
      `${config.bucket}/${r2Key}`,
      `--file=${tmpPath}`,
      '--content-type=application/json',
      '--env', config.env,
    ], { stdio: 'pipe', timeout: 30000 });
    console.log(`[백업] R2 원본 백업: ${r2Key}`);
  } catch (err) {
    console.warn(`[백업] R2 백업 실패: ${err.message}`);
  }

  try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// 헬퍼
// ═══════════════════════════════════════════════════════════════

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════

main().catch(err => {
  console.error('\n치명적 오류:', err.message);
  process.exit(1);
});
