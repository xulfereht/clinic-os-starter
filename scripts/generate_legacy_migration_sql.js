
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');

const INPUT_FILE = './차트환자 관련.xlsx';
const OUTPUT_FILE = './migrations/legacy_data_import.sql';

function normalizePhone(phone) {
    if (!phone) return null;
    let p = String(phone).trim().replace(/[^0-9]/g, '');
    if (p.startsWith('10') && p.length === 10) p = '0' + p; // 10-xxxx-xxxx -> 010-xxxx-xxxx fix
    if (p.length === 11) return p.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    if (p.length === 10) return p.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    if (p.length === 9) return p.replace(/(\d{2})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return p;
}

function formatDate(excelDate) {
    if (!excelDate) return null;
    // Excel date might be string "2019-02-18" or "2016-03-16 오전 12:00:00"
    // or sometimes undefined/empty
    const dStr = String(excelDate).trim();
    if (!dStr) return null;

    // Simple check for YYYY-MM-DD
    if (dStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dStr;

    // Handle "2016-03-16 오전 12:00:00" format
    // Matches YYYY-MM-DD followed by Korean AM/PM and time
    const korDateMatch = dStr.match(/^(\d{4}-\d{2}-\d{2})\s.*$/);
    if (korDateMatch) {
        return korDateMatch[1];
    }

    // Try parsing
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return null;

    return d.toISOString().split('T')[0];
}

function getTimestamp(excelDate) {
    const dateStr = formatDate(excelDate);
    if (!dateStr) return Math.floor(Date.now() / 1000);
    return Math.floor(new Date(dateStr).getTime() / 1000);
}

function escapeSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/'/g, "''") + "'";
}

try {
    const workbook = XLSX.readFile(INPUT_FILE);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet); // Array of objects

    console.log(`Processing ${rows.length} rows...`);

    let fileCount = 1;
    let currentRowCount = 0;
    const ROWS_PER_FILE = 2000;

    let sql = "-- Legacy Data Migration Part " + fileCount + "\n";

    let count = 0;
    const currentYear = new Date().getFullYear();

    for (const row of rows) {
        // Map fields
        const chartNumber = row['차트번호'];
        if (!chartNumber) continue;

        const name = row['이름'] || 'Unknown';

        let gender = null;
        if (row['성별'] === '남자') gender = 'M';
        if (row['성별'] === '여자') gender = 'F';

        // Age -> Birth Date (YYYY-01-01)
        let birthDate = null;
        if (row['나이']) {
            const age = parseInt(row['나이'], 10);
            if (!isNaN(age)) {
                birthDate = `${currentYear - age}-01-01`;
            }
        }

        // Phone Validation Logic
        const mobile = row['휴대번호'];
        const phone = row['전화번호'];

        let currentPhone = '000-0000-0000';

        const normMobile = normalizePhone(mobile);
        const normPhone = normalizePhone(phone);

        const isValidPhone = (p) => {
            if (!p) return false;
            const digits = p.replace(/[^0-9]/g, '');
            // Korea: Min 9 digits (02-XXX-XXXX), Max 11 digits
            return digits.length >= 9;
        };

        if (isValidPhone(normMobile)) {
            currentPhone = normMobile;
        } else if (isValidPhone(normPhone)) {
            currentPhone = normPhone;
        }

        // SMS Consent
        const smsRefuse = String(row['SMS거부']).toLowerCase();
        const smsConsent = (smsRefuse === 'true') ? 0 : 1;

        // Address
        const zip = row['우편번호'];
        const addrText = row['주소'];
        let address = null;
        if (addrText) {
            address = zip ? `(${zip}) ${addrText}` : addrText;
        }

        // Tags generation from Medical History
        const segments = [];
        if (row['진행중인치료']) {
            segments.push(...row['진행중인치료'].split(/[,/]+/).map(s => s.trim()).filter(Boolean));
        }
        if (row['예정된치료']) {
            segments.push(...row['예정된치료'].split(/[,/]+/).map(s => s.trim()).filter(Boolean));
        }
        // Deduplicate and JSON stringify
        const uniqueSegments = [...new Set(segments)];
        const segmentsJson = JSON.stringify(uniqueSegments);

        // Dates
        const lastVisit = formatDate(row['최근내원']);
        const createdAt = getTimestamp(row['등록일']);

        // Medical History
        const treating = row['진행중인치료'] ? `진행중: ${row['진행중인치료']}` : '';
        const planning = row['예정된치료'] ? `예정: ${row['예정된치료']}` : '';
        const historyParts = [treating, planning].filter(Boolean);
        const legacyHistory = historyParts.length > 0 ? historyParts.join(' / ') : null;

        const id = crypto.randomUUID();

        const values = [
            escapeSql(id),
            escapeSql(chartNumber),
            escapeSql(name),
            escapeSql(currentPhone),
            escapeSql(gender),
            escapeSql(birthDate),
            escapeSql(address),
            escapeSql(zip),          // zipcode
            escapeSql(addrText),     // address_road
            smsConsent,
            escapeSql(lastVisit),
            createdAt,
            createdAt,
            escapeSql(legacyHistory),
            escapeSql(segmentsJson), // segments
            "'imported'",
            "'active'"
        ];

        // Updated Query using Upsert
        // Added columns: zipcode, address_road, segments
        sql += `INSERT INTO patients (id, chart_number, name, current_phone, gender, birth_date, address, zipcode, address_road, sms_consent, last_visit_date, created_at, updated_at, legacy_medical_history, segments, source, status) VALUES (${values.join(', ')}) ON CONFLICT(chart_number) DO UPDATE SET created_at = excluded.created_at, status = excluded.status, legacy_medical_history = excluded.legacy_medical_history, last_visit_date = excluded.last_visit_date, segments = excluded.segments, zipcode = excluded.zipcode, address_road = excluded.address_road, address = excluded.address, current_phone = excluded.current_phone;\n`;

        currentRowCount++;
        count++;

        if (currentRowCount >= ROWS_PER_FILE) {
            const fileName = `./migrations/legacy_data_import_part_${fileCount}.sql`;
            fs.writeFileSync(fileName, sql);
            console.log(`Saved ${fileName} with ${currentRowCount} rows.`);

            fileCount++;
            currentRowCount = 0;
            sql = "-- Legacy Data Migration Part " + fileCount + "\n";
        }
    }

    // Write remaining
    if (currentRowCount > 0) {
        const fileName = `./migrations/legacy_data_import_part_${fileCount}.sql`;
        fs.writeFileSync(fileName, sql);
        console.log(`Saved ${fileName} with ${currentRowCount} rows.`);
    }

    console.log(`Generated SQL for ${count} patients in ${fileCount} files.`);

} catch (e) {
    console.error("Error:", e);
}
