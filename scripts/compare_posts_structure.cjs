const cheerio = require('cheerio');

async function fetchUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return await response.text();
}

async function analyze(url, label) {
    console.log(`\n=== Analyzing ${label} ===`);
    console.log(`URL: ${url}`);
    const html = await fetchUrl(url);
    const $ = cheerio.load(html);

    // Content extraction (similar to migration script)
    let $content = $('.entry-content');
    if ($content.length === 0) $content = $('.post-content');
    if ($content.length === 0) $content = $('article');

    console.log(`Content found: ${$content.length > 0}`);

    // Check H1s
    console.log('--- H1 Tags inside content ---');
    $content.find('h1').each((i, el) => {
        console.log(`[${i}] ${$(el).text().trim().substring(0, 50)}... (id: ${$(el).attr('id')})`);
    });

    // Check H2s
    console.log('--- H2 Tags inside content ---');
    $content.find('h2').each((i, el) => {
        console.log(`[${i}] ${$(el).text().trim().substring(0, 50)}...`);
    });

    // Check Blockquotes
    console.log('--- Blockquotes inside content ---');
    $content.find('blockquote').each((i, el) => {
        console.log(`[${i}] ${$(el).text().trim().substring(0, 50)}...`);
    });
}

async function main() {
    // Gold Standard (Post-Aug 27)
    await analyze('https://snowhitebambi.com/neul-sogi-deoburughago-dabdabhaeyo-40dae-yeoseongyi-manseong-sohwabulryang/', 'Gold Standard (Newer)');

    // Problematic (Pre-Aug 27 / Boundary)
    await analyze('https://snowhitebambi.com/onmomi-apayo-yeogijeogi-tongjeungi-doladanindamyeon-inceon-seomyugeunyugtong/', 'Problematic (Older)');
}

main().catch(console.error);
