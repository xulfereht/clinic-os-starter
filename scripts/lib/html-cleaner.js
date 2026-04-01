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
  '.se-module-oglink',        // OG 링크 카드
  '.se-oglink-thumbnail',
  '.se-section-oglink',
  '.se-sticker',              // 스티커
  '.se-section-sticker',
  '.se-module-map',           // 지도 임베드
  '.se-section-map',
  '.se-video',                // 비디오 임베드
  '.se-section-video',
  '.se-module-code',          // 코드 블록 (보존하되 정리)
  '.u_cbox_wrap',             // 댓글
  '#printPost',               // 인쇄 버튼
  '.post_btm',                // 하단 버튼
  '.post_navi',               // 네비게이션
  '.wrap_postcomment',        // 댓글 영역
  '.post_writer',             // 작성자 정보
  '.post_addinfo',            // 추가 정보
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

  // 2. 이미지 URL 수집 및 blank.gif 처리
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

  // 3. 속성 정리
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

  // 4. 빈 요소 제거 (이미지/br 제외)
  $('div, span, p, section').each((_, el) => {
    const $el = $(el);
    if (!$el.text().trim() && !$el.find('img, br, hr, table').length) {
      $el.remove();
    }
  });

  // 5. 불필요한 래퍼 평탄화 — 의미 없는 중첩 div 제거
  flattenWrappers($);

  // 6. SE 주석 제거
  let resultHtml = $('body').html() || '';
  resultHtml = resultHtml.replace(/<!--\s*(?:}|{)\s*SE-\w+\s*(?:}|{)?\s*-->/g, '');

  // 7. 연속 br 정리 (3개 이상 → 2개)
  resultHtml = resultHtml.replace(/(<br\s*\/?>[\s\n]*){3,}/gi, '<br><br>');

  // 8. 빈 span/div/a 래퍼 제거 (내용만 보존)
  resultHtml = resultHtml.replace(/<(span|div|a)\s*>\s*<\/(span|div|a)>/gi, '');

  // 9. 불필요한 중첩 축소: <div><div><p>...</p></div></div> → <p>...</p>
  resultHtml = resultHtml.replace(/<div>\s*<div>\s*(<(?:p|blockquote|h[1-6]|img)[^]*?<\/(?:p|blockquote|h[1-6])>)\s*<\/div>\s*<\/div>/gi, '$1');

  // 10. 연속 빈 줄/공백 정리
  resultHtml = resultHtml.replace(/\n\s*\n\s*\n/g, '\n\n');
  resultHtml = resultHtml.trim();

  const textLength = $('body').text().replace(/\s+/g, ' ').trim().length;

  // 11. HTML → 마크다운 변환 (Clinic-OS는 content를 마크다운으로 기대)
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
