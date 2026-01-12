
const fs = require('fs');
const iconv = require('iconv-lite');

const content = fs.readFileSync('bf3140c4.csv');
const decoded = iconv.decode(content, 'EUC-KR'); // Most likely for Korean CSVs

console.log('--- Decoded Content Preview ---');
const lines = decoded.split('\n');
lines.slice(0, 5).forEach((line, i) => {
    console.log(`[Line ${i}] ${line}`);
});
