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

    console.log('--- Root Children ---');
    $content.children().each((i, el) => {
        console.log(`[${i}] <${el.tagName}> class="${$(el).attr('class')}"`);
        if (el.tagName === 'blockquote') {
            console.log(`    Text: ${$(el).text().trim().substring(0, 50)}...`);
        }
        if (el.tagName === 'table') {
            console.log(`    Table Content: ${$(el).text().trim().substring(0, 50)}...`);
        }
    });

    console.log('\n--- All Blockquotes ---');
    $content.find('blockquote').each((i, el) => {
        console.log(`[${i}] Parent: <${$(el).parent()[0].tagName}>`);
        console.log(`    Text: ${$(el).text().trim().substring(0, 50)}...`);
    });
}

main().catch(console.error);
