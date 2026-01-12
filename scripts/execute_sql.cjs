
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node execute_sql.cjs <file_path>');
    process.exit(1);
}

const sqlFile = args[0];
if (!fs.existsSync(sqlFile)) {
    console.error(`File not found: ${sqlFile}`);
    process.exit(1);
}

console.log(`Executing ${sqlFile}...`);
try {
    execSync(`npx wrangler d1 execute brd-clinic-db --local --file=${sqlFile}`, { stdio: 'inherit' });
    console.log('Success!');
} catch (e) {
    console.error('Execution failed:', e.message);
    process.exit(1);
}
