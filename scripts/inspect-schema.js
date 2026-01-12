import { Database } from 'bun:sqlite';

const db = new Database('local.db');
const schema = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lead_events'").all();
const leadsInfo = db.prepare("PRAGMA table_info(leads)").all();
console.log('lead_events table:', schema);
console.log('leads columns:', leadsInfo);
db.close();
