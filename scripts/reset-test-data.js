import { Database } from 'bun:sqlite';

const db = new Database('local.db');

try {
    console.log('Resetting test data...');

    // List tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables found:', tables.map(t => t.name).join(', '));

    // Disable foreign keys
    db.run('PRAGMA foreign_keys = OFF;');

    const tablesToClear = ['leads', 'intake_submissions', 'patients', 'contact_history'];

    for (const table of tablesToClear) {
        const exists = tables.some(t => t.name === table);
        if (exists) {
            db.run(`DELETE FROM ${table};`);
            console.log(`Cleared ${table} table.`);
        } else {
            console.log(`Table ${table} does not exist, skipping.`);
        }
    }

    db.run('PRAGMA foreign_keys = ON;');

    console.log('Data reset complete.');
} catch (error) {
    console.error('Error resetting data:', error);
} finally {
    db.close();
}
