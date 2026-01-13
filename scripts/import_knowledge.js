// Script to import knowledge cards from brd-clinic export
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/tmp/knowledge_full.json', 'utf8'));
const cards = data[0].results;

// Generate category inserts
const categories = [...new Set(cards.map(c => c.category))].filter(Boolean);

let sql = `-- Knowledge Cards Import from brd-clinic
-- Generated: ${new Date().toISOString()}
-- Total: ${cards.length} cards

-- Categories
`;

categories.forEach((cat, idx) => {
    const escapedCat = cat.replace(/'/g, "''");
    sql += `INSERT OR IGNORE INTO knowledge_categories (id, name, description, is_enabled, display_order) VALUES ('cat_${idx + 1}', '${escapedCat}', '', 1, ${idx + 1});\n`;
});

sql += `\n-- Knowledge Cards\n`;

cards.forEach(card => {
    const id = card.id.replace(/'/g, "''");
    const topic = card.topic.replace(/'/g, "''");
    const card_type = card.card_type.replace(/'/g, "''");
    const role = card.role.replace(/'/g, "''");
    const tags = card.tags.replace(/'/g, "''");
    const level = card.level.replace(/'/g, "''");
    const content = card.content.replace(/'/g, "''");
    const status = card.status.replace(/'/g, "''");
    const category = (card.category || '').replace(/'/g, "''");

    sql += `INSERT OR REPLACE INTO knowledge_cards (id, topic, card_type, role, tags, level, content, status, category) VALUES ('${id}', '${topic}', '${card_type}', '${role}', '${tags}', '${level}', '${content}', '${status}', '${category}');\n`;
});

fs.writeFileSync('./seeds/knowledge_import.sql', sql);
console.log(`Generated SQL with ${categories.length} categories and ${cards.length} cards`);
