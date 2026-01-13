import { getPlatformProxy } from 'wrangler';

async function inspect() {
    const { env, dispose } = await getPlatformProxy();
    const db = env.DB;

    try {
        console.log('--- Patients Table Schema ---');
        const schema = await db.prepare("PRAGMA table_info(patients)").all();
        console.log(schema.results);
    } catch (e) {
        console.error(e);
    } finally {
        await dispose();
    }
}

inspect();
