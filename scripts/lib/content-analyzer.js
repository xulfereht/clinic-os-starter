/**
 * content-analyzer.js
 * 블로그 글 전체에서 키워드, 전문 분야, 진료 철학 추출
 */

// 한의원 관련 진료 분야 키워드 사전
const SPECIALTY_KEYWORDS = {
  '추나': '추나요법',
  '침': '침치료',
  '한약': '한약처방',
  '부항': '부항요법',
  '뜸': '뜸치료',
  '약침': '약침치료',
  '디스크': '디스크/척추질환',
  '척추': '디스크/척추질환',
  '관절': '관절질환',
  '무릎': '관절질환',
  '어깨': '어깨질환',
  '목통증': '경추질환',
  '허리': '요추질환',
  '골반': '골반교정',
  '다이어트': '한방다이어트',
  '비만': '한방다이어트',
  '피부': '한방피부과',
  '아토피': '아토피치료',
  '여드름': '피부질환',
  '알레르기': '알레르기질환',
  '비염': '비염치료',
  '소화': '소화기질환',
  '위장': '소화기질환',
  '불면': '불면증',
  '수면': '수면장애',
  '스트레스': '스트레스/정신건강',
  '불안': '스트레스/정신건강',
  '우울': '스트레스/정신건강',
  '두통': '두통치료',
  '편두통': '두통치료',
  '갱년기': '갱년기치료',
  '생리': '여성질환',
  '임신': '임산부케어',
  '산후': '산후조리',
  '성장': '성장클리닉',
  '소아': '소아한방',
  '어린이': '소아한방',
  '교통사고': '교통사고치료',
  '자동차보험': '교통사고치료',
  '체형': '체형교정',
  '자세': '자세교정',
  '턱관절': '턱관절치료',
  '안면': '안면질환',
  '중풍': '중풍/뇌질환',
  '마비': '신경질환',
  '면역': '면역력강화',
  '보약': '보약/건강관리',
  '공진단': '보약/건강관리',
  '경옥고': '보약/건강관리',
};

// 카테고리 분류 패턴
const CATEGORY_PATTERNS = [
  { pattern: /치료\s*후기|치료\s*사례|치험례|케이스/i, category: '치료후기' },
  { pattern: /건강\s*정보|건강\s*팁|의학\s*상식|알아보|예방/i, category: '건강정보' },
  { pattern: /공지|안내|휴진|진료\s*시간|오시는/i, category: '공지사항' },
  { pattern: /이벤트|할인|프로모션|특가/i, category: '이벤트' },
  { pattern: /Q\s*&\s*A|질문|답변|FAQ|자주\s*묻/i, category: 'FAQ' },
  { pattern: /일상|소식|근황/i, category: '한의원소식' },
];

// 진료 철학 감지 패턴 (특징적 표현)
const PHILOSOPHY_PATTERNS = [
  /저희\s+[\w가-힣]+은?\s+(.{10,80}(?:합니다|입니다|생각합니다|추구합니다|지향합니다))/g,
  /(?:진료\s*철학|치료\s*원칙|저희의?\s*(?:목표|방향|가치))[은는이가]?\s*(.{10,100})/g,
  /(?:환자|분)(?:들)?(?:을|를|의)\s+(.{10,60}(?:위해|위하여|중심으로|중요하게))/g,
  /(?:근본|원인|뿌리)[을를]?\s+(.{10,60}(?:치료|해결|접근))/g,
];

/**
 * 블로그 글 목록 분석
 * @param {Array<{title: string, text: string, date: string}>} posts
 * @returns {AnalysisResult}
 */
export function analyzeContent(posts) {
  if (!posts || posts.length === 0) {
    return { specialties: [], keywords: [], categories: {}, philosophy: [], topKeywords: [] };
  }

  // text 필드가 없을 수 있음 (DB에서 읽은 경우 등) → excerpt/content fallback
  const getText = (p) => p.text || p.excerpt || p.content || '';
  const allText = posts.map(p => `${p.title} ${getText(p)}`).join(' ');
  const wordCount = allText.length;

  // 1. 전문 분야 추출 (빈도 기반)
  const specialtyCount = {};
  for (const [keyword, specialty] of Object.entries(SPECIALTY_KEYWORDS)) {
    const regex = new RegExp(keyword, 'gi');
    const matches = allText.match(regex);
    if (matches && matches.length > 0) {
      specialtyCount[specialty] = (specialtyCount[specialty] || 0) + matches.length;
    }
  }

  // 빈도순 정렬, 최소 2회 이상 언급
  const specialties = Object.entries(specialtyCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      mentions: count,
      confidence: Math.min(count / posts.length, 1),
    }));

  // 2. 키워드 빈도 분석 (2음절 이상 한글 단어)
  const koreanWords = allText.match(/[가-힣]{2,}/g) || [];
  const wordFreq = {};
  const stopWords = new Set([
    '합니다', '입니다', '있습니다', '됩니다', '하는', '것은', '으로', '에서',
    '그리고', '하지만', '때문에', '이러한', '그래서', '또한', '위해', '통해',
    '대한', '경우', '부분', '정도', '이상', '이하', '때문', '사이', '하여',
    '블로그', '네이버', '오늘', '여러분', '안녕하세요', '감사합니다',
  ]);

  koreanWords.forEach(word => {
    if (!stopWords.has(word) && word.length >= 2) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));

  // 3. 글별 카테고리 분류
  const categories = {};
  posts.forEach(post => {
    const combined = `${post.title} ${getText(post).slice(0, 300)}`;
    let matched = false;
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(combined)) {
        categories[category] = (categories[category] || 0) + 1;
        post._category = category;
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories['기타'] = (categories['기타'] || 0) + 1;
      post._category = '건강정보'; // 기본값
    }
  });

  // 4. 진료 철학 문장 추출
  const philosophy = [];
  const seenPhrases = new Set();
  for (const post of posts) {
    const combined = `${post.title} ${getText(post)}`;
    for (const pattern of PHILOSOPHY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(combined)) !== null) {
        const phrase = match[1]?.trim();
        if (phrase && phrase.length > 10 && !seenPhrases.has(phrase)) {
          seenPhrases.add(phrase);
          philosophy.push({
            text: phrase,
            source: post.title,
          });
        }
      }
    }
  }

  return {
    specialties,
    topKeywords,
    categories,
    philosophy: philosophy.slice(0, 10),
    stats: {
      totalPosts: posts.length,
      totalCharacters: wordCount,
      avgPostLength: Math.round(wordCount / posts.length),
    },
  };
}

/**
 * 분석 결과를 clinic-profile.json 포맷으로 변환
 * @param {AnalysisResult} analysis
 * @returns {object} clinic-profile.json에 병합할 데이터
 */
export function toProfilePatch(analysis) {
  const patch = {};

  if (analysis.specialties.length > 0) {
    patch.services_structured = analysis.specialties
      .slice(0, 8)
      .map(s => s.name);
  }

  if (analysis.philosophy.length > 0) {
    patch.content = patch.content || {};
    patch.content.philosophy = analysis.philosophy
      .slice(0, 3)
      .map(p => p.text)
      .join(' ');
  }

  if (analysis.topKeywords.length > 0) {
    patch.content = patch.content || {};
    patch.content.blog_keywords = analysis.topKeywords
      .slice(0, 15)
      .map(k => k.word);
  }

  return patch;
}
