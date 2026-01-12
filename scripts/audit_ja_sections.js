// Script to audit Japanese program sections against Korean source
const programIds = ['diet', 'digestive', 'head', 'neuro', 'pain', 'pediatric', 'skin', 'wellness', 'women'];

async function main() {
    const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/27800fe4107c459a7c19f03056d1618183625b44e7ba01d6a175dd53d683ab5a.sqlite';
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    console.log('='.repeat(80));
    console.log('日本語プログラムセクション 監査レポート');
    console.log('='.repeat(80));
    console.log('');

    for (const programId of programIds) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`프로그램: ${programId.toUpperCase()}`);
        console.log(`${'─'.repeat(60)}`);

        // Get Korean sections (source of truth)
        const koRow = db.prepare("SELECT sections FROM programs WHERE id = ?").get(programId);
        const koSections = koRow?.sections ? JSON.parse(koRow.sections) : [];

        // Get Japanese sections
        const jaRow = db.prepare("SELECT sections FROM program_translations WHERE program_id = ? AND locale = 'ja'").get(programId);
        const jaSections = jaRow?.sections ? JSON.parse(jaRow.sections) : [];

        console.log(`\n한국어 섹션 (${koSections.length}개):`);
        koSections.forEach((s, i) => {
            const img = s.image ? `📷 ${s.image.split('/').pop()}` : '(이미지없음)';
            console.log(`  ${i + 1}. [${s.type}] ${s.title?.replace(/<br\/?>/g, ' ').substring(0, 30)}... ${img}`);
        });

        console.log(`\n일본어 섹션 (${jaSections.length}개):`);
        jaSections.forEach((s, i) => {
            const img = s.image ? `📷 ${s.image.split('/').pop()}` : '(이미지없음)';
            console.log(`  ${i + 1}. [${s.type}] ${s.title?.replace(/<br\/?>/g, ' ').substring(0, 30)}... ${img}`);
        });

        // Compare
        console.log('\n🔍 비교 결과:');

        // Check count
        if (koSections.length !== jaSections.length) {
            console.log(`  ⚠️  섹션 개수 불일치: 한국어 ${koSections.length}개 vs 일본어 ${jaSections.length}개`);
        } else {
            console.log(`  ✅ 섹션 개수 일치: ${koSections.length}개`);
        }

        // Check order and types
        const maxLen = Math.max(koSections.length, jaSections.length);
        const orderIssues = [];
        const imageIssues = [];

        for (let i = 0; i < maxLen; i++) {
            const ko = koSections[i];
            const ja = jaSections[i];

            if (!ko) {
                orderIssues.push(`  ⚠️  ${i + 1}번: 한국어에 없는 추가 섹션 [${ja?.type}]`);
            } else if (!ja) {
                orderIssues.push(`  ❌ ${i + 1}번: 일본어에 누락된 섹션 [${ko?.type}]`);
            } else if (ko.type !== ja.type) {
                orderIssues.push(`  ❌ ${i + 1}번: 타입 불일치 - 한국어 [${ko.type}] vs 일본어 [${ja.type}]`);
            }

            // Check images
            if (ko && ja && ko.image !== ja.image) {
                imageIssues.push(`  ❌ ${i + 1}번 [${ko.type}]: 이미지 불일치\n      한국어: ${ko.image || '없음'}\n      일본어: ${ja.image || '없음'}`);
            }
        }

        if (orderIssues.length > 0) {
            console.log('\n  📋 순서/타입 문제:');
            orderIssues.forEach(issue => console.log(issue));
        } else {
            console.log('  ✅ 섹션 순서 일치');
        }

        if (imageIssues.length > 0) {
            console.log('\n  🖼️  이미지 문제:');
            imageIssues.forEach(issue => console.log(issue));
        } else {
            console.log('  ✅ 이미지 경로 일치');
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('감사 완료');
    console.log('='.repeat(80));

    db.close();
}

main().catch(console.error);
