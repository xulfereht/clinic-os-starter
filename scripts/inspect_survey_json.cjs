
const { spawn } = require('child_process');

const surveyId = process.argv[2] || 'digestive_age';

const cmd = `npx wrangler d1 execute brd-clinic-db --remote --command "SELECT definition FROM surveys WHERE id = '${surveyId}'" --json`;

const child = spawn('sh', ['-c', cmd]);

let stdout = '';
child.stdout.on('data', (data) => {
    stdout += data.toString();
});

child.on('close', (code) => {
    if (code !== 0) {
        console.error('Error executing command');
        return;
    }
    try {
        const result = JSON.parse(stdout);
        if (result[0] && result[0].results && result[0].results.length > 0) {
            const definition = JSON.parse(result[0].results[0].definition);
            console.log('First Question:', JSON.stringify(definition.questions[0], null, 2));
        } else {
            console.log('No results found');
        }
    } catch (e) {
        console.error('Error parsing JSON:', e);
        console.log('Raw output:', stdout);
    }
});
