/**
 * html-cleaner.js
 * 네이버 블로그 HTML → 클린 HTML 변환
 * 네이버 에디터 특유의 불필요한 래퍼/스타일/스크립트를 제거하고
 * 의미 있는 콘텐츠만 추출
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

// 제거할 요소 선택자
const REMOVE_SELECTORS = [
  'script', 'style', 'iframe', 'noscript',
  // SE4 (새 에디터) 비콘텐츠 모듈
  '.se-module-oglink',        // OG 링크 카드
  '.se-oglink-thumbnail',
  '.se-section-oglink',
  '.se-sticker',              // 스티커
  '.se-section-sticker',
  '.se-module-map',           // 지도 임베드
  '.se-section-map',
  '.se-video',                // 비디오 임베드
  '.se-section-video',
  '.se-module-code',          // 코드 블록
  // 댓글·UI
  '.u_cbox_wrap',             // 댓글
  '#printPost',               // 인쇄 버튼
  '.post_btm',                // 하단 버튼
  '.post_navi',               // 네비게이션
  '.wrap_postcomment',        // 댓글 영역
  '.post_writer',             // 작성자 정보
  '.post_addinfo',            // 추가 정보 (날짜 등)
  // 공감·좋아요·반응
  '.u_likeit_list_module',    // 공감 버튼 모듈
  '.post_sympathy',           // 공감 영역
  '.u_likeit_module',         // 좋아요 모듈
  '.btn_like',                // 좋아요 버튼
  '.area_sympathy',           // 공감 영역 (구 에디터)
  '.like_wrap',               // 좋아요 래퍼
  // 태그
  '.post_tag',                // 태그 영역
  '.wrap_tag',                // 태그 래퍼
  '.area_tag',                // 태그 영역 (구 에디터)
  '.tag_list',                // 태그 목록
  // 구독·이웃
  '.buddy_wrap',              // 이웃 추가
  '.btn_subscription',        // 구독 버튼
  '.btn_buddy',               // 이웃 버튼
  '.area_buddy',              // 이웃 영역
  // SE2 (구 에디터) 레이아웃 잔해
  '.post_footer',             // 글 하단
  '.post_header',             // 글 상단 메타
  '.blog_view_sns',           // SNS 공유 버튼
  '.post_share',              // 공유 영역
];

// 제거할 속성
const REMOVE_ATTRS = [
  'class', 'id', 'style', 'data-lazy-src', 'data-width', 'data-height',
  'data-phocus', 'data-linktype', 'data-linkdata', 'data-image-src',
  'onclick', 'onload', 'onerror',
];

// 보존할 속성 (img, a 태그)
const KEEP_ATTRS = {
  img: ['src', 'alt', 'width', 'height'],
  a: ['href', 'target'],
};

/**
 * 네이버 블로그 HTML 정리
 * @param {string} html - 원본 HTML
 * @returns {{ html: string, imageUrls: string[], textLength: number }}
 */
export function cleanNaverHtml(html) {
  if (!html || typeof html !== 'string') {
    return { html: '', imageUrls: [], textLength: 0 };
  }

  const $ = cheerio.load(html);

  // 1. 불필요한 요소 제거
  REMOVE_SELECTORS.forEach(sel => $(sel).remove());

  // 2. 네이버 내부 링크 → 텍스트만 보존 (blog.naver.com, m.blog.naver.com 등)
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/(?:m\.)?blog\.naver\.com|naver\.me|search\.naver/i.test(href)) {
      $(el).replaceWith($(el).text());
    }
  });

  // 3. 이미지 URL 수집 및 blank.gif 처리
  const imageUrls = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const lazySrc = $(el).attr('data-lazy-src') || '';

    // blank.gif → data-lazy-src로 치환, 없으면 이미지 제거
    if (src.includes('blank.gif') || src.includes('static/blog/blank')) {
      if (lazySrc && isNaverImageUrl(lazySrc)) {
        $(el).attr('src', toOriginalSize(lazySrc));
      } else {
        $(el).remove();
        return;
      }
    }

    // 유효한 네이버 이미지 URL 수집
    const finalSrc = $(el).attr('data-lazy-src') || $(el).attr('src') || '';
    if (finalSrc && isNaverImageUrl(finalSrc)) {
      const originalUrl = toOriginalSize(finalSrc);
      imageUrls.push(originalUrl);
      $(el).attr('src', originalUrl);
    }
  });

  // 4. SE 래퍼 평탄화 — 속성 정리 전에 실행 (class 속성 필요)
  flattenWrappers($);

  // 5. 속성 정리
  $('*').each((_, el) => {
    const tagName = (el.tagName || '').toLowerCase();
    const keepList = KEEP_ATTRS[tagName] || [];
    const attrs = Object.keys($(el).attr() || {});
    attrs.forEach(attr => {
      if (!keepList.includes(attr)) {
        $(el).removeAttr(attr);
      }
    });
  });

  // 6. 빈 요소 제거 (이미지/br 제외)
  $('div, span, p, section').each((_, el) => {
    const $el = $(el);
    if (!$el.text().trim() && !$el.find('img, br, hr, table').length) {
      $el.remove();
    }
  });

  // 7. SE2 테이블 레이아웃 평탄화 — 이미지 순서 보존
  // 구 에디터는 <table><tr><td><img>...</td></tr></table> 구조로 이미지를 감쌈
  // 이걸 풀지 않으면 이미지가 본문 끝으로 밀림
  $('table').each((_, el) => {
    const $table = $(el);
    const imgs = $table.find('img');
    const text = $table.text().trim();
    // 테이블이 이미지만 담고 있으면 (텍스트 없거나 alt만) → 이미지를 꺼내고 테이블 제거
    if (imgs.length > 0 && text.length < 20) {
      const fragment = $('<div></div>');
      imgs.each((_, img) => fragment.append($(img).clone()));
      $table.replaceWith(fragment.html());
    }
  });

  // 8. SE 주석 제거
  let resultHtml = $('body').html() || '';
  resultHtml = resultHtml.replace(/<!--\s*(?:}|{)\s*SE-\w+\s*(?:}|{)?\s*-->/g, '');

  // 9. 연속 br 정리 (3개 이상 → 2개)
  resultHtml = resultHtml.replace(/(<br\s*\/?>[\s\n]*){3,}/gi, '<br><br>');

  // 10. 빈 span/div/a 래퍼 제거 (내용만 보존)
  resultHtml = resultHtml.replace(/<(span|div|a)\s*>\s*<\/(span|div|a)>/gi, '');

  // 11. 불필요한 중첩 축소: <div><div><p>...</p></div></div> → <p>...</p>
  resultHtml = resultHtml.replace(/<div>\s*<div>\s*(<(?:p|blockquote|h[1-6]|img)[^]*?<\/(?:p|blockquote|h[1-6])>)\s*<\/div>\s*<\/div>/gi, '$1');

  // 12. 연속 빈 줄/공백 정리
  resultHtml = resultHtml.replace(/\n\s*\n\s*\n/g, '\n\n');
  resultHtml = resultHtml.trim();

  const textLength = $('body').text().replace(/\s+/g, ' ').trim().length;

  // 13. HTML → 마크다운 변환 (Clinic-OS는 content를 마크다운으로 기대)
  const markdown = htmlToMarkdown(resultHtml);

  return { html: resultHtml, markdown, imageUrls, textLength };
}

/**
 * 정리된 HTML → 마크다운 변환
 * Clinic-OS의 blog 렌더러는 marked.parse()로 마크다운을 HTML 변환하므로
 * 저장 시 마크다운 포맷이어야 함
 */
function htmlToMarkdown(html) {
  if (!html) return '';

  const td = new TurndownService({
    headingStyle: 'atx',       // # 스타일 헤딩
    codeBlockStyle: 'fenced',  // ``` 코드블록
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // 이미지: alt 없으면 빈 alt로 유지
  td.addRule('images', {
    filter: 'img',
    replacement: (content, node) => {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      return src ? `![${alt}](${src})` : '';
    },
  });

  // blockquote 보존
  td.addRule('blockquote', {
    filter: 'blockquote',
    replacement: (content) => {
      const lines = content.trim().split('\n');
      return lines.map(l => `> ${l}`).join('\n') + '\n\n';
    },
  });

  // 빈 링크(#) 제거 — 네이버 이미지 래퍼
  td.addRule('emptyLinks', {
    filter: (node) => node.nodeName === 'A' && node.getAttribute('href') === '#',
    replacement: (content) => content,
  });

  let md = td.turndown(html);

  // 네이버 블로그 잔해 텍스트 패턴 제거
  md = md
    // 타임스탬프: "2019.04.13 15:23", "2019. 4. 13. 15:23" 등 (줄 단독)
    .replace(/^\s*\d{4}\.?\s*\d{1,2}\.?\s*\d{1,2}\.?\s*\d{1,2}:\d{2}\s*$/gm, '')
    // 공감/좋아요 텍스트: "공감 0", "좋아요 3", "이 글에 공감한 블로거"
    .replace(/^\s*(?:공감|좋아요|이 글에 공감한 블로거)\s*\d*\s*$/gm, '')
    // 댓글 수: "댓글 0", "댓글 12"
    .replace(/^\s*댓글\s*\d+\s*$/gm, '')
    // "이웃추가", "구독하기"
    .replace(/^\s*(?:이웃추가|서로이웃 추가|구독하기|블로그 구독)\s*$/gm, '')
    // "인쇄", "공유하기", "카카오스토리", "페이스북", "트위터"
    .replace(/^\s*(?:인쇄|공유하기|카카오스토리|페이스북|트위터|URL 복사)\s*$/gm, '')
    // "#태그" 줄 (# + 한글/영문)
    .replace(/^\s*(?:#[가-힣a-zA-Z0-9_]+\s*)+$/gm, '');

  // 연속 빈 줄 정리
  md = md.replace(/\n{3,}/g, '\n\n');
  // 불필요한 이스케이프 정리
  md = md.replace(/\\([[\]()#*+\-_`~])/g, '$1');

  return md.trim();
}

/**
 * 네이버 이미지 URL인지 확인
 */
export function isNaverImageUrl(url) {
  return /pstatic\.net|blogfiles\.naver|naverblogimages|postfiles/i.test(url);
}

/**
 * 네이버 이미지 URL을 원본 크기로 변환
 * w=800 등의 리사이즈 파라미터 제거
 */
export function toOriginalSize(url) {
  try {
    const u = new URL(url);
    // type=w800 등의 쿼리 제거하여 원본 크기 요청
    u.searchParams.delete('type');
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 의미 없는 래퍼 div/span 제거하고 내용만 보존
 */
function flattenWrappers($) {
  // se-main-container 내부의 se-section → se-module → se-text 구조 평탄화
  $('[class^="se-"]').each((_, el) => {
    const $el = $(el);
    // 자식이 하나뿐이고 텍스트/이미지 콘텐츠가 없는 래퍼면 풀기
    if ($el.children().length === 1 && !$el.text().trim() && !$el.find('img').length) {
      $el.replaceWith($el.children());
    }
  });
}

/**
 * HTML에서 순수 텍스트 추출
 * @param {string} html
 * @returns {string}
 */
export function extractPlainText(html) {
  if (!html) return '';
  const $ = cheerio.load(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}
