
import { getPlatformProxy } from 'wrangler';

async function main() {
    const { env } = await getPlatformProxy();

    console.log("🔍 [Webhook Logs] Latest 3 entries:");
    try {
        const logs = await env.DB.prepare(`
            SELECT received_at, source, status, message, payload_preview
            FROM webhook_logs
            ORDER BY received_at DESC
            LIMIT 3
        `).all();

        logs.results.forEach(log => {
            const date = new Date(log.received_at * 1000).toLocaleString();
            console.log(`  [${date}] ${log.status} - ${log.message}`);
            console.log(`    Preview: ${log.payload_preview}`);
        });
    } catch (e) {
        console.error("  ❌ Error:", e);
    }

    console.log("\n🔍 [Leads] Latest 3 entries:");
    try {
        const leads = await env.DB.prepare(`
            SELECT id, name, status, channel, created_at, summary, intake_data
            FROM leads
            ORDER BY created_at DESC
            LIMIT 3
        `).all();

        leads.results.forEach(lead => {
            const date = new Date(lead.created_at * 1000).toLocaleString();
            console.log(`  [${date}] ${lead.name} (${lead.status})`);
            console.log(`    Summary: ${lead.summary}`);
            // Check if intake_data has useful info
            try {
                const intake = JSON.parse(lead.intake_data);
                if (intake.notes) console.log(`    Notes excerpt: ${intake.notes.substring(0, 200)}...`);
            } catch (e) { }
            console.log("-----------------------------------------");
        });
    } catch (e) {
        console.error("  ❌ Error:", e);
    }
}

main();
