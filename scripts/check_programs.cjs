const { exec } = require('child_process');

const query = `SELECT id, sections FROM programs WHERE id IN ('digestive', 'skin')`;

exec(`npx wrangler d1 execute brd-clinic-db --remote --command "${query}" --json`, (err, stdout) => {
    if (err) { console.error(err); return; }
    const result = JSON.parse(stdout);
    if (result && result[0] && result[0].results) {
        result[0].results.forEach(row => {
            console.log(`--- Program: ${row.id} ---`);
            const sections = JSON.parse(row.sections);
            console.log(JSON.stringify(sections, null, 2));
        });
    }
});
