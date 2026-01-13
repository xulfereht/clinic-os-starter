import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../migrations');

function runCommand(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        // console.error(error.stderr); // Ignore error here to keep output clean if table empty
        return null;
    }
}

function normalizeName(name) {
    return name.trim();
}

async function main() {
    console.log('🔍 Analyzing migration state...');

    // 1. Get all local migration files
    const localFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Alpha sort should be roughly correct for numbered files

    // 2. Get executed migrations from DB
    const dbOutput = runCommand(`npx wrangler d1 execute brd-clinic-db --local --command "SELECT name FROM d1_migrations" --json`);
    let executedMigrations = new Set();

    if (dbOutput) {
        try {
            const parsed = JSON.parse(dbOutput);
            if (parsed && parsed[0] && parsed[0].results) {
                parsed[0].results.forEach(r => executedMigrations.add(normalizeName(r.name)));
            }
        } catch (e) {
            console.error('Failed to parse DB output', e);
        }
    }

    console.log(`   Found ${localFiles.length} local files.`);
    console.log(`   Found ${executedMigrations.size} executed migrations in DB.`);

    // 3. Find missing
    // Exclude our known new file '0113_unify_messenger.sql' -> actually I should exclude anything that is truly new.
    // But since we just pulled from remote, we assume EVERYTHING from remote is applied.
    // The only thing I added is '0113_unify_messenger.sql'.
    // So I should mark everything EXCEPT '0113...' as applied.

    const targetFile = '0113_unify_messenger.sql';
    const missing = [];

    for (const file of localFiles) {
        if (file === targetFile) continue;
        if (!executedMigrations.has(file)) {
            missing.push(file);
        }
    }

    console.log(`   Found ${missing.length} migrations to backfill.`);

    if (missing.length === 0) {
        console.log('   ✅ No backfill needed.');
        return;
    }

    // 4. Generate SQL
    // We assume they were applied in the past, so we just add them.
    // We don't know the exact ID sequence, but better to let SQLite handle autoincrement if 'id' is distinct, 
    // or we just providing name and applied_at. 
    // Usually d1_migrations has (id, name, applied_at). id is INTEGER PRIMARY KEY.

    const values = missing.map(m => `('${m}', CURRENT_TIMESTAMP)`).join(',\n');
    const sql = `INSERT INTO d1_migrations (name, applied_at) VALUES \n${values};`;

    fs.writeFileSync('backfill_migrations.sql', sql);
    console.log('   Generated backfill_migrations.sql');

    // 5. Execute
    console.log('🚀 Executing backfill...');
    execSync(`npx wrangler d1 execute brd-clinic-db --local --file=backfill_migrations.sql`, { stdio: 'inherit' });

    console.log('   ✅ Backfill complete.');
}

main();
