
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEDS_DIR = path.join(__dirname, '../seeds');
const OUTPUT_FILE = path.join(SEEDS_DIR, 'generated_faqs.sql');

// Data Mappings
const TOPICS = {
    3: { slug: 'digestive', title: '소화기 질환', summary: '위장병, 담적병 등 소화기 관련 질환입니다.' },
    5: { slug: 'skin', title: '피부 질환', summary: '아토피, 여드름 등 피부 관련 질환입니다.' }
};

const CONDITIONS = {
    2: { name: '과민성 대장 증후군', slug: 'ibs', topic_id: 3 },
    3: { name: '만성 위염', slug: 'gastritis', topic_id: 3 },
    5: { name: '담적병', slug: 'damjeok', topic_id: 3 },
    6: { name: '변비', slug: 'constipation', topic_id: 3 },
    7: { name: '설사', slug: 'diarrhea', topic_id: 3 },
    8: { name: '아토피', slug: 'atopy', topic_id: 5 },
    9: { name: '습진', slug: 'eczema', topic_id: 5 },
    10: { name: '건선', slug: 'psoriasis', topic_id: 5 },
    11: { name: '두드러기', slug: 'urticaria', topic_id: 5 },
    12: { name: '여드름', slug: 'acne', topic_id: 5 },
    58: { name: '지루성 피부염', slug: 'seborrheic', topic_id: 5 },
    59: { name: '사마귀', slug: 'warts', topic_id: 5 }
};

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-\u0080-\uFFFF]+/g, '') // Remove all non-word chars (allow unicode)
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

// Generate unique slug
const usedSlugs = new Set();
function getUniqueSlug(base) {
    let slug = slugify(base);
    if (usedSlugs.has(slug)) {
        let counter = 1;
        while (usedSlugs.has(`${slug}-${counter}`)) {
            counter++;
        }
        slug = `${slug}-${counter}`;
    }
    usedSlugs.add(slug);
    return slug;
}

let sql = `-- Generated FAQ Seeds
-- Run this after sample_clinic.sql

`;

// 1. Insert Topics
for (const [id, data] of Object.entries(TOPICS)) {
    sql += `INSERT OR IGNORE INTO topics (id, slug, title, summary) VALUES (${id}, '${data.slug}', '${data.title}', '${data.summary}');\n`;
}

// 2. Insert Conditions
for (const [id, data] of Object.entries(CONDITIONS)) {
    sql += `INSERT OR IGNORE INTO topic_conditions (id, topic_id, slug, name) VALUES (${id}, ${data.topic_id}, '${data.slug}', '${data.name}');\n`;
}

// 3. Process JSON Files
const files = fs.readdirSync(SEEDS_DIR).filter(f => f.startsWith('faq_') && f.endsWith('.json'));

let faqIdCounter = 100; // Start from 100 to avoid collision with manual small seeds

files.forEach(file => {
    try {
        const content = JSON.parse(fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8'));
        const topicId = content.topic_id;
        const conditionId = content.condition_id;

        if (!content.items) return;

        content.items.forEach(item => {
            const id = faqIdCounter++;
            const question = item.question.replace(/'/g, "''"); // Escape single quotes
            const answerShort = (item.answer_short || '').replace(/'/g, "''");
            const answerDetail = (item.answer_detail || '').replace(/'/g, "''");
            const cluster = (item.cluster || 'General').replace(/'/g, "''");
            const slug = getUniqueSlug(item.question);

            // Insert Item
            sql += `INSERT INTO faq_items (id, topic_id, condition_id, category, cluster, question, answer_short, answer_detail, status, slug) VALUES (${id}, ${topicId}, ${conditionId}, 'faq', '${cluster}', '${question}', '${answerShort}', '${answerDetail}', 'published', '${id}-${slug}');\n`;

            // Insert Translation (Korean default)
            sql += `INSERT INTO faq_translations (faq_id, locale, question, answer_short, answer_detail, status) VALUES (${id}, 'ko', '${question}', '${answerShort}', '${answerDetail}', 'published');\n`;
        });

    } catch (err) {
        console.error(`Error processing ${file}:`, err);
    }
});

fs.writeFileSync(OUTPUT_FILE, sql);
console.log(`Generated SQL to ${OUTPUT_FILE}`);
