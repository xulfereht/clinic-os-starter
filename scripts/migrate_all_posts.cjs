const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const SITEMAP_URL = 'https://snowhitebambi.com/sitemap-posts.xml';
const OUTPUT_FILE = path.join(__dirname, '../migrations/seed_all_posts.sql');

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
    return bestCategory; // Can be null
}

function escapeSql(str) {
    if (!str) return '';
    return str.replace(/'/g, "''");
}

async function fetchUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return await response.text();
}

async function main() {
    console.log('Fetching sitemap...');
    const sitemapXml = await fetchUrl(SITEMAP_URL);

    // Simple regex to extract URLs and Images from sitemap
    // <url><loc>URL</loc>...<image:loc>IMG</image:loc></url>
    const urlMatches = sitemapXml.match(/<url>(.*?)<\/url>/gs);

    if (!urlMatches) {
        console.error('No URLs found in sitemap');
        return;
    }

    console.log(`Found ${urlMatches.length} posts.`);

    let sqlContent = "BEGIN TRANSACTION;\n";
    // Clear existing posts except the one we just manually migrated (ID 118) to avoid duplicates if re-running
    // Actually, let's just use INSERT OR REPLACE or handle duplicates by slug.
    // User said "기존의 글들을 다 가져와서 수정하자".
    // Let's assume we want to keep ID 118 as is, or overwrite it if it's in the list.
    // Since we are generating a seed file, maybe we should just INSERT.

    let count = 0;
    for (const urlBlock of urlMatches) {
        const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
        const imgMatch = urlBlock.match(/<image:loc>(.*?)<\/image:loc>/);

        if (!locMatch) continue;

        const url = locMatch[1];
        const featuredImage = imgMatch ? imgMatch[1] : null;

        console.log(`Processing [${++count}/${urlMatches.length}]: ${url}`);

        try {
            const html = await fetchUrl(url);
            let $ = cheerio.load(html);

            // Extract Data
            let title = $('h1.article-title').text().trim() ||
                $('h1.post-full-title').text().trim() ||
                $('h2.post-full-title').text().trim() ||
                $('h1.entry-title').text().trim() ||
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
                // Fallback to sitemap lastmod if needed, or try to find date in text
                const timeTag = $('time.entry-date').attr('datetime');
                if (timeTag) dateStr = timeTag;
            }

            // Convert date to unix timestamp
            let createdAt = Math.floor(Date.now() / 1000);
            if (dateStr) {
                createdAt = Math.floor(new Date(dateStr).getTime() / 1000);
            }

            const postDate = dateStr ? new Date(dateStr) : new Date(0);
            const BOUNDARY_DATE = new Date('2025-08-27');

            // Content extraction
            // WordPress usually puts content in .entry-content
            // Use decodeEntities: false to prevent escaping of non-ASCII characters and HTML tags
            // Reload with decodeEntities: false for content processing
            $ = cheerio.load(html, { decodeEntities: false });
            let $content = $('.entry-content');
            if ($content.length === 0) $content = $('.post-content');
            if ($content.length === 0) $content = $('article');

            // Clean content common to all
            $content.find('script, style, .sharedaddy, .jp-relatedposts, #jp-post-flair').remove();

            // Remove Ghost/WordPress comments
            $content.contents().each(function () {
                if (this.type === 'comment') $(this).remove();
            });

            // Remove inline styles from all elements for clean HTML
            $content.find('*').removeAttr('style');

            // Date-based parsing logic
            if (postDate < BOUNDARY_DATE) {
                // Older posts: H1 is redundant title, H2 is heading, Blockquote is quote
                $content.find('h1').remove();
            } else {
                // Newer posts (>= Aug 27, 2025): 
                // 1. Remove the first blockquote (Summary/Blue Box)
                const $blockquotes = $content.find('blockquote');
                if ($blockquotes.length > 0) {
                    $blockquotes.first().remove();
                }

                // 2. Convert remaining blockquotes to h2 (Headings)
                $content.find('blockquote').each((i, el) => {
                    const text = $(el).text().trim();
                    // Create new h2 element string to avoid object issues
                    const h2Html = `<h2 id="section-${i}">${text}</h2>`;
                    $(el).replaceWith(h2Html);
                });

                // 3. Unwrap "Blue Tables" (Summary/Content Boxes)
                // These tables have blue background/border and contain the main text
                $content.find('table').each((i, el) => {
                    const $table = $(el);
                    const style = $table.find('td').attr('style') || '';
                    // Check for blue styling
                    if (style.includes('#002FA7') || style.includes('#F0F4FF')) {
                        // Extract content (p tags)
                        const innerContent = $table.find('td').html();
                        $table.replaceWith(innerContent);
                    }
                });

                // 4. Remove specific footer image
                $content.find('img[src*="88745182f1af889bb9da887eaf990537784f707a8ddcfacdae62cbc8a8345833"]').remove();

                // Also remove h1 just in case
                $content.find('h1').remove();
            }

            // Remove empty p tags
            $content.find('p').each((i, el) => {
                if ($(el).text().trim() === '' && $(el).find('img').length === 0) {
                    $(el).remove();
                }
            });

            // Process images to ensure they are responsive-ish (remove fixed width/height)
            $content.find('img').each((i, el) => {
                $(el).removeAttr('width');
                $(el).removeAttr('height');
                $(el).removeAttr('srcset'); // Remove srcset to avoid confusion, just use src
                $(el).removeAttr('sizes');
                $(el).css('width', '100%');
                $(el).css('height', 'auto');
                $(el).css('border-radius', '12px');
                $(el).css('margin', '2rem 0');
            });

            // Trim content to prevent Markdown code block interpretation of indented HTML
            const content = ($content.html() || '').trim();

            // Generate excerpt from the first paragraph, ignoring headings
            // This prevents the "Blue Box" (Excerpt) from duplicating the title/heading
            let excerptText = $content.find('p').first().text().trim();
            if (!excerptText) excerptText = $content.text().trim(); // Fallback
            const excerpt = excerptText.substring(0, 150).replace(/\n/g, ' ').trim() + '...';

            // Slug from URL
            const slug = url.split('/').filter(Boolean).pop();

            // Category
            const category = determineCategory(title, $content.text());

            // Generate SQL
            const sql = `INSERT OR REPLACE INTO posts (title, slug, content, excerpt, category, type, status, author_id, doctor_id, featured_image, created_at, updated_at) VALUES (
    '${escapeSql(title)}',
    '${escapeSql(slug)}',
    '${escapeSql(content)}',
    '${escapeSql(excerpt)}',
    ${category ? `'${category}'` : 'NULL'},
    'blog',
    'published',
    'doc_choi',
    'doc_choi',
    ${featuredImage ? `'${featuredImage}'` : 'NULL'},
    ${createdAt},
    ${createdAt}
);\n`;

            sqlContent += sql;

            // Be nice to the server
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (e) {
            console.error(`Error processing ${url}:`, e.message);
        }
    }

    sqlContent += "COMMIT;\n";
    fs.writeFileSync(OUTPUT_FILE, sqlContent);
    console.log(`Migration SQL written to ${OUTPUT_FILE}`);
}

main().catch(console.error);
