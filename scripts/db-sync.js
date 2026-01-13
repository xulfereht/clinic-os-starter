import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = 'brd-clinic-db';
const RESTORE_FILE = 'restore.sql';

function runCommand(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.stderr);
        throw error;
    }
}

function getWranglerJson(command) {
    const output = runCommand(command + ' --json');
    try {
        const parsed = JSON.parse(output);
        // Wrangler returns an array of results, usually the first one has our data
        return parsed[0].results;
    } catch (e) {
        console.error('Failed to parse Wrangler JSON output');
        console.error(output);
        throw e;
    }
}

function escapeSqlString(value) {
    if (value === null) return 'NULL';
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    // Escape single quotes by doubling them
    return "'" + String(value).replace(/'/g, "''") + "'";
}

async function main() {
    console.log('🔄 Starting robust database sync...');

    // 1. Find and Backup Local Database
    console.log('📦 Backing up local database...');
    const wranglerStateDir = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    let localDbFile = null;

    if (fs.existsSync(wranglerStateDir)) {
        const files = fs.readdirSync(wranglerStateDir);
        localDbFile = files.find(f => f.endsWith('.sqlite'));

        if (localDbFile) {
            const fullPath = path.join(wranglerStateDir, localDbFile);
            const backupPath = path.join(process.cwd(), `local_backup_${Date.now()}.sqlite`);
            fs.copyFileSync(fullPath, backupPath);
            console.log(`   ✅ Backup created: ${backupPath}`);
        } else {
            console.log('   ⚠️ No local database file found to backup.');
        }
    } else {
        console.log('   ⚠️ Wrangler state directory not found.');
    }

    // 2. Fetch Remote Tables
    console.log('🔍 Fetching remote table list...');
    const tables = getWranglerJson(`npx wrangler d1 execute ${DB_NAME} --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"`);
    const tableNames = tables.map(t => t.name);
    console.log(`   Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    // 3. Generate Restore SQL
    console.log('📝 Generating restore SQL...');
    const sqlStream = fs.createWriteStream(RESTORE_FILE);

    sqlStream.write('PRAGMA foreign_keys = OFF;\n');
    sqlStream.write('BEGIN TRANSACTION;\n\n');

    for (const tableName of tableNames) {
        console.log(`   Processing table: ${tableName}`);

        // Get Schema
        const schemaResult = getWranglerJson(`npx wrangler d1 execute ${DB_NAME} --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'"`);
        if (schemaResult.length > 0 && schemaResult[0].sql) {
            sqlStream.write(`DROP TABLE IF EXISTS "${tableName}";\n`);
            sqlStream.write(`${schemaResult[0].sql};\n`);
        }

        // Get Data
        const data = getWranglerJson(`npx wrangler d1 execute ${DB_NAME} --remote --command "SELECT * FROM '${tableName}'"`);
        if (data.length > 0) {
            const columns = Object.keys(data[0]);
            const colNames = columns.map(c => `"${c}"`).join(', ');

            for (const row of data) {
                const values = columns.map(col => escapeSqlString(row[col])).join(', ');
                sqlStream.write(`INSERT INTO "${tableName}" (${colNames}) VALUES (${values});\n`);
            }
        }
        sqlStream.write('\n');
    }

    sqlStream.write('COMMIT;\n');
    sqlStream.write('PRAGMA foreign_keys = ON;\n');
    sqlStream.end();

    // Wait for stream to finish
    await new Promise(resolve => sqlStream.on('finish', resolve));
    console.log(`   ✅ Generated ${RESTORE_FILE}`);

    // 4. Reset Local Database
    console.log('🗑️  Resetting local database...');
    if (localDbFile) {
        const fullPath = path.join(wranglerStateDir, localDbFile);
        fs.unlinkSync(fullPath);
        console.log('   ✅ Deleted local database file.');
    }

    // 5. Recreate Empty DB
    console.log('🆕 Recreating empty database...');
    runCommand(`npx wrangler d1 execute ${DB_NAME} --local --command "SELECT 1"`);

    // Find the new DB file
    const newFiles = fs.readdirSync(wranglerStateDir);
    const newLocalDbFile = newFiles.find(f => f.endsWith('.sqlite'));

    if (!newLocalDbFile) {
        throw new Error('Failed to recreate local database file.');
    }
    const newDbPath = path.join(wranglerStateDir, newLocalDbFile);

    // 6. Import using sqlite3
    console.log('📥 Importing to local database using sqlite3...');
    runCommand(`sqlite3 "${newDbPath}" < "${RESTORE_FILE}"`);
    console.log('   ✅ Import completed.');

    console.log('🎉 Database sync finished successfully!');
}

main().catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
