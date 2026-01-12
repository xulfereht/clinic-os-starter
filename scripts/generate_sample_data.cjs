const fs = require('fs');

const SAMPLE_PATIENTS_COUNT = 5;
const RESERVATIONS_PER_PATIENT = 3;
const PAYMENTS_PER_PATIENT = 3;
const REVIEWS_PER_PATIENT = 1;

const DOCTOR_NAMES = ["김준후 원장", "이서연 원장", "박지민 원장"];
const DOCTOR_IDS = ["doc-1", "doc-2", "doc-3"]; // Assuming these exist or we will use what's in DB

const TREATMENT_NOTES = [
    "초진 상담 및 침치료",
    "약침 시술 및 물리치료",
    "추나요법 및 침치료",
    "한약 처방 상담",
    "정기 검진 및 상담"
];

const REVIEW_TITLES = [
    "만성 허리 통증이 많이 좋아졌습니다",
    "다이어트 한약 3개월 복용 후기",
    "소화불량 치료 감사합니다",
    "교통사고 후유증 치료 잘 받았습니다",
    "친절한 상담에 감동받았습니다"
];

function generateSQL() {
    let sql = `-- Sample Data Generation (is_sample = 1)\n\n`;

    // 1. Sample Patients
    sql += `-- 1. Sample Patients\n`;
    for (let i = 1; i <= SAMPLE_PATIENTS_COUNT; i++) {
        const id = `sample-patient-${i}`;
        const name = `김샘플${i}`;
        const phone = `010-0000-000${i}`;
        const now = Math.floor(Date.now() / 1000);
        sql += `INSERT OR IGNORE INTO patients (id, name, current_phone, gender, birth_date, created_at, updated_at, is_sample) VALUES ('${id}', '${name}', '${phone}', 'M', '1990-01-01', ${now}, ${now}, 1);\n`;
    }
    sql += `\n`;

    // 2. Sample Reservations
    sql += `-- 2. Sample Reservations\n`;
    for (let i = 1; i <= SAMPLE_PATIENTS_COUNT; i++) {
        const patientId = `sample-patient-${i}`;
        for (let j = 0; j < RESERVATIONS_PER_PATIENT; j++) {
            const resId = `sample-res-${i}-${j}`;
            const doctorId = DOCTOR_IDS[j % DOCTOR_IDS.length]; // Rotation

            // Future dates
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + (j + 1) * 2);
            futureDate.setHours(10 + j, 0, 0, 0);
            const ts = Math.floor(futureDate.getTime() / 1000);

            const note = TREATMENT_NOTES[j % TREATMENT_NOTES.length];

            sql += `INSERT OR IGNORE INTO reservations (id, patient_id, doctor_id, reserved_at, status, notes, created_at, updated_at, is_sample) VALUES ('${resId}', '${patientId}', NULL, ${ts}, 'scheduled', '${note}', ${ts}, ${ts}, 1);\n`;
            // NOTE: doctor_id is NULL because I don't want to break foreign key if doc doesn't exist. 
            // Ideally I should fetch real doctor IDs, but for sample script simple insert is safer.
            // If we want doctor mapping, we need to ensure doctor IDs exist. 
            // Let's assume user might map them manually or we leave them unassigned.
        }
    }
    sql += `\n`;

    // 3. Sample Payments
    sql += `-- 3. Sample Payments\n`;
    for (let i = 1; i <= SAMPLE_PATIENTS_COUNT; i++) {
        const patientId = `sample-patient-${i}`;
        for (let j = 0; j < PAYMENTS_PER_PATIENT; j++) {
            const payId = `sample-pay-${i}-${j}`;
            const amount = (j + 1) * 50000;
            const now = Math.floor(Date.now() / 1000) - (j * 86400); // Past dates

            sql += `INSERT OR IGNORE INTO payments (id, patient_id, amount, method, status, notes, quantity, paid_at, created_at, updated_at, is_sample) VALUES ('${payId}', '${patientId}', ${amount}, 'card', 'paid', '샘플 결제', 1, ${now}, ${now}, ${now}, 1);\n`;
        }
    }
    sql += `\n`;

    // 4. Sample Reviews
    sql += `-- 4. Sample Reviews\n`;
    for (let i = 1; i <= SAMPLE_PATIENTS_COUNT; i++) {
        const patientId = `sample-patient-${i}`;
        for (let j = 0; j < REVIEWS_PER_PATIENT; j++) {
            const title = REVIEW_TITLES[i % REVIEW_TITLES.length];
            const content = `${title} - 정말 좋았습니다. 추천합니다.`;
            const slug = `sample-review-${i}-${j}`;
            const now = Math.floor(Date.now() / 1000);

            sql += `INSERT OR IGNORE INTO posts (type, title, slug, content, patient_id, status, category, created_at, updated_at, is_sample) VALUES ('review', '${title}', '${slug}', '${content}', '${patientId}', 'published', 'wellness', ${now}, ${now}, 1);\n`;
        }
    }

    return sql;
}

const sqlContent = generateSQL();
fs.writeFileSync('migrations/0502_add_sample_data.sql', sqlContent);
console.log('Sample data migration created at migrations/0502_add_sample_data.sql');
