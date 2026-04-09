/**
 * naver-blog-extractor.js
 * 네이버 블로그 글 추출
 *
 * 전략 (2026-03 검증 완료):
 *   글 목록: m.blog.naver.com/api/blogs/{id}/post-list (JSON API, 페이지네이션)
 *   글 본문: m.blog.naver.com/{id}/{logNo} fetch + cheerio (SSR 렌더링됨)
 *
 * varo_clinic 블로그 테스트: 481개 글 전체 수집, 본문+이미지 정상 추출 확인.
 */

import * as cheerio from 'cheerio';
import { cleanNaverHtml, extractPlainText } from './html-cleaner.js';

const DELAY_MS = 1500; // 요청 간 딜레이 (네이버 rate limit 방지)
const ITEMS_PER_PAGE = 24; // API 기본값
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 블로그 글 목록 + 본문 추출
 * @param {string} blogId - 네이버 블로그 ID
 * @param {object} options
 * @param {number} options.limit - 최대 글 수 (기본 50)
 * @param {boolean} options.skipImages - 이미지 URL 수집 스킵
 * @returns {Promise<ExtractResult>}
 */
export async function extractBlog(blogId, options = {}) {
  const { limit = 50, skipImages = false } = options;

  console.log(`[블로그] ${blogId} 추출 시작 (limit: ${limit})`);

  // Step 1: 모바일 API로 전체 글 목록 수집
  const postList = await fetchPostList(blogId, limit);

  if (postList.length === 0) {
    console.warn(`[블로그] ${blogId}: 글을 찾을 수 없습니다`);
    return { blogId, posts: [], errors: ['글 목록을 가져올 수 없습니다'] };
  }

  console.log(`[블로그] ${postList.length}개 글 발견, 본문 추출 시작`);

  // Step 2: 각 글 본문 fetch + cheerio 파싱
  const posts = [];
  const errors = [];

  for (let i = 0; i < postList.length; i++) {
    const entry = postList[i];
    try {
      const post = await fetchPostContent(blogId, entry, { skipImages });
      if (post) {
        posts.push(post);
      }
      if ((i + 1) % 10 === 0) {
        console.log(`[블로그] 진행: ${i + 1}/${postList.length}`);
      }
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('403')) {
        console.warn(`[블로그] Rate limit on ${entry.logNo}, 5초 대기 후 재시도...`);
        await sleep(5000);
        try {
          const retryPost = await fetchPostContent(blogId, entry, { skipImages });
          if (retryPost) posts.push(retryPost);
        } catch (retryErr) {
          errors.push(`${entry.logNo || entry.title}: ${retryErr.message} (retry failed)`);
        }
      } else {
        errors.push(`${entry.logNo || entry.title}: ${err.message}`);
      }
    }

    // Rate limiting
    if (i < postList.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`[블로그] ${blogId} 완료: ${posts.length}개 추출, ${errors.length}개 오류`);
  return { blogId, posts, errors };
}

// ═══════════════════════════════════════════════════════════════
// 글 목록: 모바일 API
// ═══════════════════════════════════════════════════════════════

/**
 * m.blog.naver.com/api/blogs/{blogId}/post-list API로 글 목록 수집
 * categoryNo=0 → 전체 카테고리, itemCount=24씩 페이지네이션
 * items가 빈 배열이면 종료
 */
async function fetchPostList(blogId, limit) {
  const posts = [];
  let page = 1;

  while (posts.length < limit) {
    const url = `https://m.blog.naver.com/api/blogs/${encodeURIComponent(blogId)}/post-list?categoryNo=0&itemCount=${ITEMS_PER_PAGE}&page=${page}&userId=`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': MOBILE_UA,
          'Referer': `https://m.blog.naver.com/${encodeURIComponent(blogId)}`,
        },
      });

      if (response.status === 429 || response.status === 403) {
        // Rate limit — exponential backoff retry (최대 2회)
        const retryDelay = response.status === 429 ? 5000 : 3000;
        console.warn(`[블로그] ${response.status} rate limit (page ${page}), ${retryDelay/1000}초 후 재시도...`);
        await sleep(retryDelay);
        const retry = await fetch(url, { headers: { 'User-Agent': MOBILE_UA, 'Referer': `https://m.blog.naver.com/${encodeURIComponent(blogId)}` } });
        if (!retry.ok) {
          console.warn(`[블로그] 재시도 실패: ${retry.status} — 수집 중단`);
          break;
        }
        const retryData = await retry.json();
        const retryItems = retryData?.result?.items || [];
        if (retryItems.length === 0) break;
        for (const item of retryItems) {
          posts.push({ logNo: String(item.logNo), title: item.titleWithInspectMessage || '', date: item.addDate ? new Date(item.addDate).toISOString() : '', categoryName: item.categoryName || '', categoryNo: item.categoryNo, briefContents: item.briefContents || '', thumbnailUrl: item.thumbnailUrl || null, smartEditorVersion: item.smartEditorVersion });
        }
        page++;
        await sleep(2000);
        continue;
      }
      if (!response.ok) {
        console.warn(`[블로그] API 응답 오류: ${response.status} (page ${page})`);
        break;
      }

      const data = await response.json();
      const items = data?.result?.items || [];

      if (items.length === 0) break;

      for (const item of items) {
        posts.push({
          logNo: String(item.logNo),
          title: item.titleWithInspectMessage || '',
          date: item.addDate ? new Date(item.addDate).toISOString() : '',
          categoryName: item.categoryName || '',
          categoryNo: item.categoryNo,
          briefContents: item.briefContents || '',
          thumbnailUrl: item.thumbnailUrl || null,
          smartEditorVersion: item.smartEditorVersion,
        });
      }

      page++;

      // API rate limit 방지
      if (posts.length < limit) {
        await sleep(500);
      }
    } catch (err) {
      console.warn(`[블로그] API 호출 실패 (page ${page}): ${err.message}`);
      break;
    }
  }

  return posts.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// 글 본문: 모바일 페이지 fetch + cheerio
// ═══════════════════════════════════════════════════════════════

/**
 * 블로그 글 본문 HTML 추출
 *
 * 전략:
 *   SE4 (새 에디터): 모바일 페이지 → .se-main-container (SSR, 이미지 포함)
 *   SE2 (구 에디터): 데스크톱 PostView → #postViewArea (모바일에서는 blank.gif)
 *   Fallback: 모바일 .post_ct → API briefContents
 */
async function fetchPostContent(blogId, entry, { skipImages }) {
  const logNo = entry.logNo;
  if (!logNo) return null;

  const seVer = entry.smartEditorVersion;
  const isSE2 = seVer == 2 || seVer === '2'; // loose equality handles null/undefined safely

  let contentHtml = '';

  if (isSE2) {
    // SE2: 데스크톱 PostView에서 추출 (모바일은 blank.gif 이미지만 반환)
    contentHtml = await fetchDesktopPostView(blogId, logNo);
  }

  if (!contentHtml) {
    // SE4 또는 SE2 폴백: 모바일 페이지에서 추출
    contentHtml = await fetchMobileContent(blogId, logNo);
  }

  // 최종 폴백: API briefContents 사용
  if (!contentHtml && entry.briefContents) {
    contentHtml = `<p>${entry.briefContents}</p>`;
  }

  // HTML 정리
  const cleaned = cleanNaverHtml(contentHtml);

  return buildPost(entry, cleaned, blogId, skipImages);
}

/**
 * 모바일 페이지에서 본문 추출 (SE4 새 에디터에 최적)
 */
async function fetchMobileContent(blogId, logNo) {
  const mobileUrl = `https://m.blog.naver.com/${encodeURIComponent(blogId)}/${logNo}`;

  const response = await fetch(mobileUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      'Referer': 'https://m.blog.naver.com/',
    },
  });

  if (!response.ok) return '';

  const html = await response.text();
  const $ = cheerio.load(html);

  const seMain = $('.se-main-container');
  if (seMain.length) return seMain.html() || '';

  const postView = $('#postViewArea');
  if (postView.length) return postView.html() || '';

  const postCt = $('.post_ct');
  if (postCt.length) return postCt.html() || '';

  return '';
}

/**
 * 데스크톱 PostView에서 본문 추출 (SE2 구 에디터에 필요)
 * 데스크톱 PostView는 실제 이미지 URL과 전체 HTML을 SSR로 제공
 */
async function fetchDesktopPostView(blogId, logNo) {
  const url = `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_UA,
      'Referer': `https://blog.naver.com/${encodeURIComponent(blogId)}`,
    },
  });

  if (!response.ok) return '';

  const html = await response.text();
  const $ = cheerio.load(html);

  const postView = $('#postViewArea');
  if (postView.length) return postView.html() || '';

  return '';
}

// ═══════════════════════════════════════════════════════════════
// 헬퍼
// ═══════════════════════════════════════════════════════════════

function buildPost(entry, cleaned, blogId, skipImages) {
  const text = extractPlainText(cleaned.html);

  // 날짜 파싱
  let createdAt = null;
  if (entry.date) {
    const d = new Date(entry.date);
    if (!isNaN(d.getTime())) {
      createdAt = Math.floor(d.getTime() / 1000);
    }
  }

  // slug 생성
  const slug = (entry.title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + (entry.logNo || Date.now());

  return {
    title: entry.title || '제목 없음',
    slug,
    content: cleaned.markdown,
    text,
    excerpt: text.slice(0, 200),
    type: 'blog',
    status: 'draft',
    category: entry.categoryName || null,
    source_url: `https://blog.naver.com/${blogId}/${entry.logNo}`,
    featured_image: skipImages ? null : (cleaned.imageUrls[0] || entry.thumbnailUrl || null),
    image_urls: skipImages ? [] : cleaned.imageUrls,
    created_at: createdAt,
    _logNo: entry.logNo,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
