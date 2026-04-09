/**
 * image-analyzer.js
 * 이미지 URL에서 메타데이터 추출 + 파일명 기반 분류
 *
 * Phase 1: 파일명/URL 패턴 분석으로 분류
 * Phase 2 (TODO): Vision API로 실제 이미지 내용 분석
 */

// 파일명 → 카테고리 매핑 (한글 키워드)
const FILENAME_CATEGORIES = [
  { keywords: ['진료', '치료', '시술', '약침', '추나', '침', '도침'], category: 'treatment', label: '진료/시술' },
  { keywords: ['원장', '의사', '대표', '프로필', '의료진', '스탭', '지현', '태석'], category: 'doctor', label: '의료진' },
  { keywords: ['내부', '인테리어', '실내', '대기', '접수', '로비'], category: 'interior', label: '내부 시설' },
  { keywords: ['외부', '외관', '건물', '간판', '입구', '외전'], category: 'exterior', label: '외관' },
  { keywords: ['장비', '기기', '초음파', '기계', '레이저', '장치'], category: 'equipment', label: '의료 장비' },
  { keywords: ['진료과목', '과목', '메뉴', '프로그램', '서비스'], category: 'menu', label: '진료 과목' },
  { keywords: ['특수', '특색', '특징', '차별', '강점'], category: 'feature', label: '특색/강점' },
  { keywords: ['자보', '자동차', '교통', '보험'], category: 'insurance', label: '보험/자보' },
  { keywords: ['후기', '리뷰', '사례', '비포', '애프터', 'before', 'after'], category: 'case', label: '치료 사례' },
  { keywords: ['플레이스', '대표', 'ex_', 'main'], category: 'representative', label: '대표 이미지' },
  { keywords: ['이벤트', '할인', '프로모션', '특가'], category: 'promotion', label: '이벤트/프로모션' },
  { keywords: ['약', '한약', '공진단', '경옥고', '보약'], category: 'medicine', label: '한약/약재' },
  { keywords: ['안내', '공지', '가격', '비용', '수가'], category: 'info', label: '안내/가격' },
];

/**
 * EUC-KR percent-encoded 문자열을 한글로 디코딩
 */
function decodeEucKr(str) {
  try {
    const bytes = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === '%' && i + 2 < str.length) {
        bytes.push(parseInt(str.substring(i + 1, i + 3), 16));
        i += 3;
      } else {
        bytes.push(str.charCodeAt(i));
        i++;
      }
    }
    return new TextDecoder('euc-kr').decode(new Uint8Array(bytes));
  } catch {
    // UTF-8 시도
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }
}

/**
 * 이미지 URL 목록에 메타데이터 부여
 * @param {string[]} imageUrls - 이미지 URL 목록
 * @returns {ImageMeta[]}
 */
export function analyzeImages(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) return [];

  return imageUrls.map((url, index) => {
    const meta = extractUrlMeta(url);
    meta.index = index;
    meta.category = classifyByFilename(meta.decoded_filename);
    return meta;
  });
}

/**
 * URL에서 메타데이터 추출
 */
function extractUrlMeta(url) {
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  const rawFilename = pathname.split('/').pop() || '';
  const decoded = decodeEucKr(rawFilename);
  const ext = rawFilename.split('.').pop()?.toLowerCase() || '';

  // 업로드 날짜 (URL 경로에서)
  const dateMatch = pathname.match(/\/(\d{8})_/);
  const uploadDate = dateMatch ? dateMatch[1] : null;

  // 소스 구분
  const source = url.includes('naverbooking') ? 'booking' : 'owner';

  // 순서 힌트 (파일명에 숫자)
  const orderMatch = decoded.match(/(\d+)/);
  const order = orderMatch ? parseInt(orderMatch[1]) : null;

  return {
    url,
    raw_filename: rawFilename,
    decoded_filename: decoded,
    extension: ext,
    upload_date: uploadDate,
    source, // 'owner' (업체 직접) | 'booking' (네이버 예약)
    order,
    category: null,
    category_label: null,
    is_animated: ext === 'gif',
  };
}

/**
 * 파일명에서 카테고리 분류
 */
function classifyByFilename(filename) {
  if (!filename) return { category: 'uncategorized', label: '미분류' };

  const lower = filename.toLowerCase();

  for (const { keywords, category, label } of FILENAME_CATEGORIES) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { category, label };
      }
    }
  }

  // KakaoTalk 전송 이미지
  if (lower.includes('kakaotalk')) {
    return { category: 'misc_photo', label: '기타 사진' };
  }

  // 숫자만인 파일명 (순서 기반 업로드)
  if (/^\d+\.\w+$/.test(filename)) {
    return { category: 'gallery', label: '갤러리' };
  }

  return { category: 'uncategorized', label: '미분류' };
}

/**
 * 분석 결과 요약
 * @param {ImageMeta[]} images
 * @returns {object}
 */
export function summarizeImages(images) {
  const byCategory = {};
  const bySource = { owner: 0, booking: 0 };

  for (const img of images) {
    const cat = img.category?.category || 'uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    bySource[img.source]++;
  }

  return {
    total: images.length,
    by_category: byCategory,
    by_source: bySource,
    animated: images.filter(i => i.is_animated).length,
    categories_found: Object.keys(byCategory),
  };
}
