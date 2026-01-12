const cheerio = require('cheerio');

const categoryKeywords = {
    'digestive': ['소화', '위장', '담적', '과민성', '변비', '설사', '체함', '가스', '복부', '속쓰림', '역류성', '위염', '장상피'],
    'diet': ['다이어트', '비만', '감량', '요요', '살', '체중', '지방', '식욕'],
    'pain': ['통증', '어깨', '허리', '관절', '무릎', '목', '디스크', '근육', '교통사고', '엘보', '손목', '발목'],
    'skin': ['피부', '아토피', '건선', '두드러기', '여드름', '지루성', '습진', '가려움', '사마귀', '한포진', '모낭염'],
    'women': ['여성', '생리', '갱년기', '질염', '방광염', '산후', '임신', '난임', '자궁', '다낭성'],
    'neuro': ['신경', '불면', '우울', '공황', '자율신경', '틱', '강박', '불안', '두근', '가슴', '화병'],
    'pediatric': ['소아', '성장', '비염', '틱', 'adhd', '수험생', '아이'],
    'wellness': ['보약', '공진단', '경옥고', '만성피로', '면역', '기력', '수액'],
    'head': ['두통', '어지럼', '이명', '편두통', '머리', '뇌명', '삼차신경'],
    'traffic': ['교통사고', '후유증']
};

function determineCategory(title, content) {
    const text = (title + ' ' + content).toLowerCase();
    let bestCategory = null;
    let maxScore = 0;

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'g');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestCategory = cat;
        }
    }
    return bestCategory;
}

async function fetchUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return await response.text();
}

async function main() {
    const url = process.argv[2];
    if (!url) {
        console.error('Please provide a URL');
        process.exit(1);
    }

    console.log(`Fetching ${url}...`);
    const html = await fetchUrl(url);
    const $ = cheerio.load(html);

    // Extract Data
    console.log('--- Debugging Title Location ---');
    $('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes('속이 뒤틀리고') && text.length < 100) {
            console.log(`Found title in: <${el.tagName}> class="${$(el).attr('class')}" id="${$(el).attr('id')}"`);
        }
    });
    console.log('--- Debugging H2s ---');
    $('h2').each((i, el) => {
        console.log(`H2 [${i}]: class="${$(el).attr('class')}", text="${$(el).text().trim().substring(0, 50)}..."`);
    });
    console.log('---------------------');

    let title = $('h1.article-title').text().trim() ||
        $('h1.post-full-title').text().trim() ||
        $('h1.entry-title').text().trim() ||
        $('h2.article-title').text().trim() ||
        $('h2.post-full-title').text().trim() ||
        $('h2.entry-title').text().trim();

    if (!title) {
        // Fallback: try to find the first h1/h2 that is NOT the subscribe overlay
        title = $('h1').not('.subscribe-overlay-title').first().text().trim();
        if (!title) {
            title = $('h2').not('.subscribe-overlay-title').first().text().trim();
        }
    }

    // Date extraction
    let dateStr = $('meta[property="article:published_time"]').attr('content');
    if (!dateStr) {
        const timeTag = $('time.entry-date').attr('datetime');
        if (timeTag) dateStr = timeTag;
    }

    // Content extraction
    let $content = $('.entry-content');
    if ($content.length === 0) $content = $('.post-content');
    if ($content.length === 0) $content = $('article');

    // Clean content
    $content.find('script, style, .sharedaddy, .jp-relatedposts, #jp-post-flair').remove();

    // Remove Ghost/WordPress comments
    $content.contents().each(function () {
        if (this.type === 'comment') $(this).remove();
    });

    // Remove inline styles from all elements for clean HTML
    $content.find('*').removeAttr('style');

    // Remove h1 tags from content (usually redundant title)
    $content.find('h1').remove();

    // Remove empty p tags
    $content.find('p').each((i, el) => {
        if ($(el).text().trim() === '' && $(el).find('img').length === 0) {
            $(el).remove();
        }
    });

    // Process images
    $content.find('img').each((i, el) => {
        $(el).removeAttr('width');
        $(el).removeAttr('height');
        $(el).removeAttr('srcset');
        $(el).removeAttr('sizes');
        $(el).css('width', '100%');
        $(el).css('height', 'auto');
        $(el).css('border-radius', '12px');
        $(el).css('margin', '2rem 0');
    });

    const content = $content.html() || '';
    const excerpt = $content.text().substring(0, 150).replace(/\n/g, ' ').trim() + '...';
    const slug = url.split('/').filter(Boolean).pop();
    const category = determineCategory(title, $content.text());

    console.log(JSON.stringify({
        title,
        slug,
        category,
        date: dateStr,
        excerpt,
        contentLength: content.length,
        contentPreview: content.substring(0, 500)
    }, null, 2));
}

main().catch(console.error);
