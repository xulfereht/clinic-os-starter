/**
 * naver-place-extractor.js
 * 네이버 플레이스 정보 추출 → clinic-profile.json / site_settings 보완
 *
 * 전략 (2026-03 검증 완료):
 *   m.place.naver.com은 SSR로 Apollo GraphQL 캐시를 스크립트에 포함.
 *   fetch + regex 파싱으로 상호명, 주소, 전화, 영업시간, 좌표, 리뷰 등 전부 추출 가능.
 *   Playwright 불필요.
 *
 *   바로한의원(43832430) 테스트: 상호/주소/전화/카테고리/영업시간/좌표/리뷰/편의시설 전체 추출 확인.
 */

import * as cheerio from 'cheerio';
import { analyzeImages, summarizeImages } from './image-analyzer.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

// naver.me 단축 URL → map.naver.com → placeId 추출 후 m.place.naver.com으로 접근
const PLACE_CATEGORIES = ['hospital', 'restaurant', 'place', 'hairshop', 'beauty'];

/**
 * 네이버 플레이스 URL에서 정보 추출
 * @param {string} placeUrl - 네이버 플레이스 URL (naver.me 단축, map.naver.com, m.place.naver.com 등)
 * @returns {Promise<PlaceInfo|null>}
 */
export async function extractPlace(placeUrl) {
  console.log(`[플레이스] 추출 시작: ${placeUrl}`);

  // 1. URL에서 place ID 추출 (리디렉트 포함)
  const { placeId, category } = await resolvePlaceId(placeUrl);

  if (!placeId) {
    console.warn('[플레이스] place ID를 찾을 수 없습니다');
    return null;
  }

  console.log(`[플레이스] ID: ${placeId}, category: ${category}`);

  // 2. m.place.naver.com에서 SSR 데이터 추출
  const placeInfo = await fetchPlaceData(placeId, category);

  if (!placeInfo) {
    console.warn('[플레이스] 정보를 추출할 수 없습니다');
    return null;
  }

  placeInfo.source_url = placeUrl;
  placeInfo.place_id = placeId;

  // 업체 이미지 메타데이터 분석
  if (placeInfo.business_images?.length > 0) {
    placeInfo.image_metadata = analyzeImages(placeInfo.business_images);
    placeInfo.image_summary = summarizeImages(placeInfo.image_metadata);
    console.log(`[플레이스] 이미지 ${placeInfo.business_images.length}개 분석 완료: ${placeInfo.image_summary.categories_found.join(', ')}`);
  }

  console.log(`[플레이스] 추출 완료: ${placeInfo.name}`);
  return placeInfo;
}

// ═══════════════════════════════════════════════════════════════
// Place ID 해석
// ═══════════════════════════════════════════════════════════════

/**
 * 다양한 URL 형식에서 place ID 추출
 *   - naver.me/xxx → 리디렉트 → map.naver.com/p/entry/place/{id}
 *   - map.naver.com/p/entry/place/{id}
 *   - m.place.naver.com/{category}/{id}
 *   - place.naver.com/{category}/{id}
 */
async function resolvePlaceId(url) {
  // m.place.naver.com 또는 place.naver.com에서 직접 추출
  const directMatch = url.match(/place\.naver\.com\/(\w+)\/(\d+)/);
  if (directMatch) {
    return { placeId: directMatch[2], category: directMatch[1] };
  }

  // map.naver.com에서 추출
  const mapMatch = url.match(/map\.naver\.com\/p\/entry\/place\/(\d+)/);
  if (mapMatch) {
    return { placeId: mapMatch[1], category: 'hospital' };
  }

  // naver.me 단축 URL → 리디렉트 추적
  if (url.includes('naver.me')) {
    try {
      // 1차: HTTP redirect follow
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': MOBILE_UA },
      });
      const resolved = response.url;
      const idMatch = resolved.match(/place\/(\d+)/) || resolved.match(/entry\/place\/(\d+)/);
      if (idMatch) {
        const catMatch = resolved.match(/place\.naver\.com\/(\w+)\//);
        return { placeId: idMatch[1], category: catMatch?.[1] || 'hospital' };
      }

      // 2차: JS redirect 대응 — response body에서 place URL 추출
      const body = await response.text();
      const jsRedirect = body.match(/location\s*[=.]\s*['"]([^'"]*place[^'"]*)['"]/i)
        || body.match(/url=([^"'\s>]*place[^"'\s>]*)/i)
        || body.match(/place\.naver\.com\/\w+\/(\d+)/);
      if (jsRedirect) {
        const redirectUrl = jsRedirect[1] || jsRedirect[0];
        const placeMatch = redirectUrl.match(/place\.naver\.com\/(\w+)\/(\d+)/);
        if (placeMatch) {
          return { placeId: placeMatch[2], category: placeMatch[1] };
        }
        const numMatch2 = redirectUrl.match(/\/(\d{6,})/);
        if (numMatch2) {
          return { placeId: numMatch2[1], category: 'hospital' };
        }
      }
    } catch (err) {
      console.warn(`[플레이스] naver.me 리디렉트 실패: ${err.message}`);
    }
  }

  // 숫자만 입력된 경우
  const numMatch = url.match(/^(\d{6,})$/);
  if (numMatch) {
    return { placeId: numMatch[1], category: 'hospital' };
  }

  return { placeId: null, category: null };
}

// ═══════════════════════════════════════════════════════════════
// 데이터 추출 (SSR GraphQL 캐시 파싱)
// ═══════════════════════════════════════════════════════════════

/**
 * m.place.naver.com/{category}/{id}/home 페이지에서 SSR 데이터 추출
 * 스크립트 태그 안의 Apollo GraphQL 캐시(PlaceDetailBase:{id})를 파싱
 */
async function fetchPlaceData(placeId, category) {
  // category가 맞지 않으면 404이므로 여러 카테고리 시도
  const categoriesToTry = category
    ? [category, ...PLACE_CATEGORIES.filter(c => c !== category)]
    : PLACE_CATEGORIES;

  let lastHttpStatus = null;
  let triedCategories = [];

  for (const cat of categoriesToTry) {
    const url = `https://m.place.naver.com/${cat}/${placeId}/home`;
    triedCategories.push(cat);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': MOBILE_UA },
      });

      lastHttpStatus = response.status;
      if (!response.ok) continue;

      const html = await response.text();

      // PlaceDetailBase가 포함된 스크립트 찾기
      const $ = cheerio.load(html);
      let scriptData = '';
      $('script').each((_, el) => {
        const text = $(el).html() || '';
        if (text.includes(`PlaceDetailBase:${placeId}`)) {
          scriptData = text;
        }
      });

      if (!scriptData) continue;

      // PlaceDetailBase에서 정보 추출
      const info = parsePlaceDetailBase(scriptData, placeId);
      if (info) {
        // OG 태그로 보완
        const ogImage = $('meta[property="og:image"]').attr('content') || '';
        if (ogImage) info.og_image = ogImage;

        return info;
      }
    } catch (err) {
      console.warn(`[플레이스] ${cat}/${placeId} 요청 실패: ${err.message}`);
      continue;
    }
  }

  console.warn(`[플레이스] ${placeId} 데이터 추출 실패 — 시도한 카테고리: ${triedCategories.join(', ')}, 마지막 HTTP: ${lastHttpStatus}`);
  return null;
}

/**
 * Apollo 캐시 스크립트에서 PlaceDetailBase 데이터 파싱
 */
function parsePlaceDetailBase(script, placeId) {
  const extract = (pattern) => {
    const match = script.match(pattern);
    return match?.[1] || null;
  };

  const name = extract(
    new RegExp(`PlaceDetailBase:${placeId}"[^}]*"name":"([^"]+)"`)
  );
  if (!name) return null;

  const info = {
    name,
    address: extract(/"address":"([^"]+)"/) || null,
    road_address: extract(/"roadAddress":"([^"]+)"/) || null,
    phone: extract(/"virtualPhone":"([^"]+)"/) || extract(/"phone":"([^"]+)"/) || null,
    category: extract(
      new RegExp(`PlaceDetailBase:${placeId}"[\\s\\S]*?"category":"([^"]+)"`)
    ) || null,
    business_hours: null,
    og_image: null,
    description: null,
    coordinate: null,
    visitor_reviews_total: null,
    visitor_reviews_score: null,
    conveniences: null,
    payment_info: null,
    directions: null,
  };

  // 영업시간 파싱
  const hoursPattern = /"day":"([^"]+)","businessHours":\{"__typename":"StartEndTime","start":"([^"]+)","end":"([^"]+)"/g;
  const hours = [];
  let hm;
  while ((hm = hoursPattern.exec(script)) !== null) {
    hours.push(`${hm[1]} ${hm[2]}-${hm[3]}`);
  }
  if (hours.length > 0) {
    info.business_hours = hours.join(', ');
  }

  // 좌표
  const x = extract(/"coordinate":\{[^}]*"x":"([^"]+)"/);
  const y = extract(/"coordinate":\{[^}]*"y":"([^"]+)"/);
  if (x && y) {
    info.coordinate = { lng: parseFloat(x), lat: parseFloat(y) };
  }

  // 리뷰
  const reviewTotal = extract(/"visitorReviewsTotal":(\d+)/);
  const reviewScore = extract(/"visitorReviewsScore":([\d.]+)/);
  if (reviewTotal) info.visitor_reviews_total = parseInt(reviewTotal);
  if (reviewScore) info.visitor_reviews_score = parseFloat(reviewScore);

  // 편의시설
  const convMatch = script.match(/"conveniences":\[([^\]]+)\]/);
  if (convMatch) {
    try {
      info.conveniences = JSON.parse(`[${convMatch[1]}]`);
    } catch { /* ignore */ }
  }

  // 결제 정보
  const payMatch = script.match(/"paymentInfo":\[([^\]]+)\]/);
  if (payMatch) {
    try {
      info.payment_info = JSON.parse(`[${payMatch[1]}]`);
    } catch { /* ignore */ }
  }

  // 오시는 길 (road 필드 — escape 처리)
  const roadInfo = extract(/"road":"((?:[^"\\]|\\.)*)"/);
  if (roadInfo) {
    info.directions = roadInfo
      .replace(/\\n/g, '\n')
      .replace(/\\u002F/g, '/');
  }

  // 소개글 (description 중 가장 긴 텍스트 = 업체 소개)
  const descPattern = /"description":"((?:[^"\\]|\\.){20,})"/g;
  let descMatch;
  let longestDesc = '';
  while ((descMatch = descPattern.exec(script)) !== null) {
    const val = descMatch[1];
    // i18n 문자열이나 URL 제외
    if (val.length > longestDesc.length && !val.includes('{{') && !val.startsWith('http')) {
      longestDesc = val;
    }
  }
  if (longestDesc) {
    info.description = longestDesc
      .replace(/\\n/g, '\n')
      .replace(/\\u002F/g, '/');
  }

  // 업체 등록 이미지 (ldb-phinf, naverbooking-phinf — 리뷰 이미지 제외)
  const imgPattern = /https?:\\u002F\\u002F(?:ldb-phinf|naverbooking-phinf)\.pstatic\.net\\u002F[^"]+/g;
  const rawImgUrls = script.match(imgPattern) || [];
  info.business_images = [...new Set(
    rawImgUrls.map(u => u.replace(/\\u002F/g, '/'))
  )];

  return info;
}

// ═══════════════════════════════════════════════════════════════
// 변환 유틸리티
// ═══════════════════════════════════════════════════════════════

/**
 * 플레이스 정보를 clinic-profile.json 패치 포맷으로 변환
 */
export function toProfilePatch(placeInfo) {
  if (!placeInfo) return {};

  const patch = {};
  if (placeInfo.name) patch.clinic_name = placeInfo.name;
  if (placeInfo.road_address) patch.address = placeInfo.road_address;
  else if (placeInfo.address) patch.address = placeInfo.address;
  if (placeInfo.phone) patch.phone = placeInfo.phone;
  if (placeInfo.business_hours) patch.business_hours = placeInfo.business_hours;
  if (placeInfo.category) patch.naver_category = placeInfo.category;
  if (placeInfo.coordinate) patch.coordinate = placeInfo.coordinate;
  if (placeInfo.directions) patch.directions = placeInfo.directions;
  if (placeInfo.conveniences) patch.conveniences = placeInfo.conveniences;
  if (placeInfo.description) {
    patch.content = patch.content || {};
    patch.content.naver_description = placeInfo.description;
  }
  if (placeInfo.business_images?.length > 0) {
    patch.business_images = placeInfo.business_images;
  }

  return patch;
}

/**
 * 플레이스 정보를 site_settings INSERT 포맷으로 변환
 */
export function toSiteSettings(placeInfo) {
  if (!placeInfo) return [];

  const settings = [];
  const add = (key, value) => {
    if (value != null) {
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      settings.push({ category: 'naver_place', key, value: str });
    }
  };

  add('name', placeInfo.name);
  add('address', placeInfo.address);
  add('road_address', placeInfo.road_address);
  add('phone', placeInfo.phone);
  add('business_hours', placeInfo.business_hours);
  add('category', placeInfo.category);
  add('og_image', placeInfo.og_image);
  add('source_url', placeInfo.source_url);
  add('place_id', placeInfo.place_id);
  add('coordinate', placeInfo.coordinate);
  add('visitor_reviews_total', placeInfo.visitor_reviews_total);
  add('visitor_reviews_score', placeInfo.visitor_reviews_score);
  add('conveniences', placeInfo.conveniences);
  add('payment_info', placeInfo.payment_info);
  add('directions', placeInfo.directions);
  add('description', placeInfo.description);
  add('business_images', placeInfo.business_images);

  return settings;
}
