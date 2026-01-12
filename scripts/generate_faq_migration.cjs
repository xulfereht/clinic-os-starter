const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
    console.error('Usage: node generate_faq_migration.cjs <input_json> <output_sql>');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const { topic_id, condition_id, items } = data;

if (!topic_id || !condition_id || !Array.isArray(items)) {
    console.error('Invalid JSON structure. simplified schema: { topic_id, condition_id, items: [] }');
    process.exit(1);
}

let sql = `-- Migration to add FAQs for Topic ${topic_id}, Condition ${condition_id}\n\n`;

items.forEach(item => {
    const { cluster, question, answer_short, answer_detail } = item;
    const author_id = 'auto-gen';
    const status = 'published';

    // Simple escaping for single quotes
    const qEscaped = question.replace(/'/g, "''");
    const asEscaped = answer_short.replace(/'/g, "''");
    const adEscaped = answer_detail.replace(/'/g, "''");
    const slug = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substr(2, 6);

    sql += `INSERT INTO faq_items (topic_id, condition_id, cluster, question, answer_short, answer_detail, author_id, status, slug, created_at, updated_at) VALUES (${topic_id}, ${condition_id}, '${cluster}', '${qEscaped}', '${asEscaped}', '${adEscaped}', '${author_id}', '${status}', '${slug}', unixepoch(), unixepoch());\n`;
});

fs.writeFileSync(outputFile, sql);
console.log(`Generated ${items.length} SQL inserts to ${outputFile}`);
