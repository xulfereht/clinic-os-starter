const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Correct Solution image paths for all programs
const solutionImages = {
    neuro: '/images/programs/neuro/solution.png',
    women: '/images/programs/women/solution.png',
    pain: '/images/programs/pain/solution.png',
    pediatric: '/images/programs/pediatric/solution.png',
    wellness: '/images/programs/wellness/solution.png',
    head: '/images/programs/head/solution.png',
    skin: '/images/programs/skin/solution.png',
    digestive: '/images/programs/digestive/solution_tea.png'
};

// Also fix the Solution section titles to prevent awkward line breaks
const solutionTitles = {
    neuro: '백록담 마음건강 치료 프로그램',
    women: '백록담 여성건강 치료 프로그램',
    pain: '백록담 통증 치료 프로그램',
    pediatric: '백록담 성장클리닉 치료 프로그램',
    wellness: '백록담 명품 보약 프로그램',
    head: '백록담 두통어지럼증 치료 프로그램',
    skin: '백록담 피부질환 치료 프로그램',
    digestive: '백록담 소화기 치료 프로그램'
};

let sql = '';

// For each program, find and update the Solution section
for (const [progId, imagePath] of Object.entries(solutionImages)) {
    // Update Solution section image - trying different common indices (6, 7, 8)
    for (const idx of [6, 7, 8]) {
        sql += `UPDATE programs SET sections = json_set(sections, '$[${idx}].image', '${imagePath}') WHERE id = '${progId}' AND json_extract(sections, '$[${idx}].type') = 'Solution';\n`;
    }

    // Also update Solution section title for cleaner text
    const title = solutionTitles[progId];
    for (const idx of [6, 7, 8]) {
        sql += `UPDATE programs SET sections = json_set(sections, '$[${idx}].title', '${title}') WHERE id = '${progId}' AND json_extract(sections, '$[${idx}].type') = 'Solution';\n`;
    }
}

console.log("Fixing Solution section images and titles...");
const tempFile = path.join(__dirname, 'temp_fix_solution.sql');
fs.writeFileSync(tempFile, sql);

exec(`npx wrangler d1 execute brd-clinic-db --remote --file=${tempFile}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
    }
    console.log(`Output: ${stdout}`);
    console.log("Successfully fixed Solution sections.");
    fs.unlinkSync(tempFile);
});
