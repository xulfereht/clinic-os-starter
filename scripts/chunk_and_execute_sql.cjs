const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SQL_FILE = path.join(__dirname, '../migrations/seed_all_posts.sql');
const CHUNK_SIZE = 50; // Number of inserts per chunk

function main() {
    console.log(`Reading ${SQL_FILE}...`);
    const content = fs.readFileSync(SQL_FILE, 'utf8');

    // Split by INSERT statement
    // The file starts with BEGIN TRANSACTION; and ends with COMMIT;
    // We want to extract the INSERT statements.

    const statements = content.split('INSERT OR REPLACE INTO posts').slice(1).map(s => 'INSERT OR REPLACE INTO posts' + s.split(');')[0] + ');');

    console.log(`Found ${statements.length} statements.`);

    let chunkIndex = 0;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
        chunkIndex++;
        const chunk = statements.slice(i, i + CHUNK_SIZE);
        const chunkFile = path.join(__dirname, `../migrations/temp_chunk_${chunkIndex}.sql`);

        // Wrap in transaction - REMOVED for remote compatibility
        // const chunkContent = `BEGIN TRANSACTION;\n${chunk.join('\n')}\nCOMMIT;`;
        const chunkContent = chunk.join('\n');

        fs.writeFileSync(chunkFile, chunkContent);

        console.log(`Executing chunk ${chunkIndex} (${chunk.length} statements)...`);
        const isRemote = process.argv.includes('--remote');
        const flag = isRemote ? '--remote' : '--local';
        try {
            execSync(`npx wrangler d1 execute brd-clinic-db ${flag} --file=${chunkFile}`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`Failed to execute chunk ${chunkIndex}`);
            // Don't exit, try next chunk or inspect
            // process.exit(1); 
        }

        // Cleanup
        fs.unlinkSync(chunkFile);
    }

    console.log('Done!');
}

main();
