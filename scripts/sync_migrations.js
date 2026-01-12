import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const DB_NAME = 'brd-clinic-db';

function runCommand(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.stderr);
        throw error;
    }
}

function getAppliedMigrations() {
    const output = runCommand(`npx wrangler d1 execute ${DB_NAME} --local --command "SELECT name FROM d1_migrations" --json`);
    try {
        const parsed = JSON.parse(output);
        return new Set(parsed[0].results.map(r => r.name));
    } catch (e) {
        console.error('Failed to parse migrations');
        return new Set();
    }
}

function main() {
    console.log('🔄 Syncing migration history...');

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
    const applied = getAppliedMigrations();

    console.log(`Found ${files.length} files and ${applied.size} applied migrations.`);

    const toApply = files.filter(f => !applied.has(f) && f !== '0109_clinic_os_tables.sql');

    if (toApply.length === 0) {
        console.log('✅ No missing migrations found.');
        return;
    }

    console.log(`📝 Marking ${toApply.length} migrations as applied...`);

    // Generate bulk insert
    const values = toApply.map(name => `('${name}', datetime('now'))`).join(',\n');
    const sql = `INSERT INTO d1_migrations (name, applied_at) VALUES \n${values};`;

    // Write to temp file to avoid command line length limits
    const tempFile = path.join(__dirname, 'temp_sync.sql');
    fs.writeFileSync(tempFile, sql);

    try {
        runCommand(`npx wrangler d1 execute ${DB_NAME} --local --file "${tempFile}"`);
        console.log('✅ Successfully synced migration history.');
    } catch (e) {
        console.error('❌ Failed to sync migrations');
    } finally {
        fs.unlinkSync(tempFile);
    }
}

main();
