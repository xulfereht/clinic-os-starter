import { Database } from 'bun:sqlite';

const db = new Database('local.db');

try {
    console.log('Creating leads table...');

    db.run(`
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            name TEXT,
            contact TEXT,
            type TEXT,
            status TEXT,
            channel TEXT,
            patient_type TEXT,
            intake_data TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);

    console.log('Leads table created successfully.');

    // Verify
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").all();
    console.log('Verification:', tables);

} catch (error) {
    console.error('Error creating table:', error);
} finally {
    db.close();
}
