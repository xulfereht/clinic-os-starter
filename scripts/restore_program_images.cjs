const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Image path mapping for all programs
const imagePaths = {
    neuro: {
        hero: '/images/programs/neuro/hero.png',
        mechanism: '/images/programs/neuro/mechanism.png',
        solution: '/images/programs/neuro/solution.png',
        process: '/images/programs/neuro/process.png'
    },
    women: {
        hero: '/images/programs/women/hero.png',
        mechanism: '/images/programs/women/mechanism.png',
        solution: '/images/programs/women/solution.png',
        process: '/images/programs/women/process.png'
    },
    pain: {
        hero: '/images/programs/pain/hero.png',
        mechanism: '/images/programs/pain/mechanism.png',
        solution: '/images/programs/pain/solution.png',
        process: '/images/programs/pain/process.png'
    },
    pediatric: {
        hero: '/images/programs/pediatric/hero.png',
        mechanism: '/images/programs/pediatric/mechanism_generated_v2.png',
        solution: '/images/programs/pediatric/solution.png',
        process: '/images/programs/pediatric/process.png'
    },
    wellness: {
        hero: '/images/programs/wellness/hero.png',
        mechanism: '/images/programs/wellness/mechanism_generated_v2.png',
        solution: '/images/programs/wellness/solution.png',
        process: '/images/programs/wellness/process.png'
    },
    head: {
        hero: '/images/programs/head/hero.png',
        mechanism: '/images/programs/head/mechanism.png',
        solution: '/images/programs/head/solution.png',
        process: '/images/programs/head/process.png'
    },
    skin: {
        hero: '/images/programs/skin/hero.png',
        mechanism: '/images/programs/skin/mechanism_generated_v2.png',
        solution: '/images/programs/skin/solution.png',
        process: '/images/programs/skin/process_diagram.png'
    },
    digestive: {
        hero: '/images/programs/digestive/hero.png',
        mechanism: '/images/programs/digestive/mechanism_diag.png',
        solution: '/images/programs/digestive/solution_tea.png',
        process: '/images/programs/digestive/process_diagram.png'
    }
};

// SQL to update images using json_set for each program
let sql = '';

for (const [progId, images] of Object.entries(imagePaths)) {
    // Update Hero image (index 0)
    sql += `UPDATE programs SET sections = json_set(sections, '$[0].image', '${images.hero}') WHERE id = '${progId}';\n`;

    // Update Mechanism image (index 3)
    sql += `UPDATE programs SET sections = json_set(sections, '$[3].image', '${images.mechanism}') WHERE id = '${progId}';\n`;

    // Update Solution image - need to find the correct index first
    // Based on structure: Hero(0), Problem(1), Feature(2), Mechanism(3), MiniDiag(4), SolutionTypes(5), Solution(6/7), ...
    // Let's update commonly expected indices
    sql += `UPDATE programs SET sections = json_set(sections, '$[7].image', '${images.solution}') WHERE id = '${progId}' AND json_extract(sections, '$[7].type') = 'Solution';\n`;

    // Update Process image - typically index 10 or 11
    sql += `UPDATE programs SET sections = json_set(sections, '$[10].image', '${images.process}') WHERE id = '${progId}' AND json_extract(sections, '$[10].type') = 'Process';\n`;
}

console.log("Restoring program images...");
const tempFile = path.join(__dirname, 'temp_restore_images.sql');
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
    console.log("Successfully restored program images.");
    fs.unlinkSync(tempFile);
});
