const cheerio = require('cheerio');

async function fetchUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return await response.text();
}

async function main() {
    const url = 'https://snowhitebambi.com/daieoteuman-hamyeon-sogi-deoburughaeyo-20dae-yeoseong-daieoteoyi-sohwabulryang/';
    console.log(`Fetching ${url}...`);
    const html = await fetchUrl(url);
    const $ = cheerio.load(html);

    let $content = $('.entry-content');
    if ($content.length === 0) $content = $('.post-content');

    // 1. Analyze Blockquotes
    console.log('--- Blockquotes ---');
    $content.find('blockquote').each((i, el) => {
        console.log(`[${i}] Text: ${$(el).text().trim().substring(0, 50)}...`);
        console.log(`    HTML: ${$(el).html().trim().substring(0, 50)}...`);
    });

    // 2. Analyze Images (for footer image)
    console.log('--- Images ---');
    $content.find('img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes('88745182f1af889bb9da887eaf990537784f707a8ddcfacdae62cbc8a8345833')) {
            console.log(`[${i}] FOUND FOOTER IMAGE: ${src}`);
        } else {
            console.log(`[${i}] ${src}`);
        }
    });

    // 3. Test Transformation Logic
    console.log('--- Applying Transformations ---');

    // Remove first blockquote (Summary)
    const firstBlockquote = $content.find('blockquote').first();
    console.log('Removing first blockquote:', firstBlockquote.text().trim().substring(0, 30) + '...');
    firstBlockquote.remove();

    // Convert remaining blockquotes to h2
    $content.find('blockquote').each((i, el) => {
        const text = $(el).text().trim();
        const h2 = $(`<h2>${text}</h2>`); // Use simple h2 without id for now to test
        $(el).replaceWith(h2);
    });

    // Remove footer image
    $content.find('img[src*="88745182f1af889bb9da887eaf990537784f707a8ddcfacdae62cbc8a8345833"]').remove();

    // Output result snippet
    console.log('--- Resulting HTML Snippet ---');
    console.log($content.html().substring(0, 500));
}

main().catch(console.error);
