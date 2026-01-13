const { exec } = require('child_process');

// Check all programs' image paths
const sql = `
SELECT id, 
  json_extract(sections, '$[0].type') as section0_type,
  json_extract(sections, '$[0].image') as section0_image,
  json_extract(sections, '$[3].type') as section3_type,
  json_extract(sections, '$[3].image') as section3_image,
  json_extract(sections, '$[7].type') as section7_type,
  json_extract(sections, '$[7].image') as section7_image
FROM programs;
`;

exec(`npx wrangler d1 execute brd-clinic-db --remote --command "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}" --json`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    try {
        const result = JSON.parse(stdout);
        console.log("Image paths in DB:");
        console.log(JSON.stringify(result[0].results, null, 2));
    } catch (e) {
        console.log("Raw output:", stdout);
    }
});
