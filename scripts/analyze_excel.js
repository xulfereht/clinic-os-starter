
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

console.log('XLSX keys:', Object.keys(XLSX));

const filenames = ['9826d10f.xlsx', 'uploaded_image_1765848559969.png']; // checking both just in case valid xlsx is masked
const searchDirs = [process.cwd(), '/Users/amu/.gemini/antigravity/brain/d1a9c381-d90d-40de-82fc-80b0a94559ed'];

function findAndRead() {
    for (const dir of searchDirs) {
        for (const name of filenames) {
            const fullPath = path.join(dir, name);
            if (fs.existsSync(fullPath)) {
                console.log(`Found file at: ${fullPath}`);
                try {
                    const fileBuffer = fs.readFileSync(fullPath);
                    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    console.log('--- Excel Content Preview ---');
                    console.log('Headers (Row 0):', json[0]);
                    console.log('Row 1:', json[1]);
                    console.log('---------------------------');
                    return;
                } catch (e) {
                    console.log(`Failed to read as Excel: ${e.message}`);
                }
            }
        }
    }
    console.log('File not found or not readable as Excel.');
}

findAndRead();
