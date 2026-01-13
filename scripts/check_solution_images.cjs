const { exec } = require('child_process');

// Check Solution section image paths for all programs
const sql = `
SELECT 
  id,
  json_extract(value, '$.type') as type,
  json_extract(value, '$.title') as title,
  json_extract(value, '$.image') as image
FROM programs, json_each(programs.sections)
WHERE json_extract(value, '$.type') = 'Solution';
`;

exec(`npx wrangler d1 execute brd-clinic-db --remote --command "${sql.replace(/\n/g, ' ')}" --json`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    try {
        const result = JSON.parse(stdout);
        console.log("Solution Section Images:");
        console.log(JSON.stringify(result[0].results, null, 2));
    } catch (e) {
        console.log("Raw output:", stdout);
    }
});
