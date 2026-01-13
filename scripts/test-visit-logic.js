
const BASE_URL = 'http://localhost:4321';

async function runTest() {
    console.log('--- Starting Patient Status Logic Test ---');
    console.log('Target URL:', BASE_URL);

    // 1. Create a dummy patient
    const patientName = `TestPatient_${Date.now()}`;
    const patientPhone = `010-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;

    console.log(`\n1. Creating dummy patient: ${patientName} (${patientPhone})`);

    // Using intake API for convenience (simulates new patient entry)
    const intakeRes = await fetch(`${BASE_URL}/api/intake/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'general',
            name: patientName,
            phone: patientPhone,
            visit_category: 'Test',
            main_symptom: 'Testing Status',
            privacy_consent: true
        })
    });

    // Intake API returns { success: true, message: '...' } but created lead only, not full patient record instantly unless processed?
    // Wait, the regular intake (api/intake/new) only creates a lead. 
    // But `src/pages/api/intake/submit.ts` logic I read handles detailed intake too.
    // Let's assume we need to manually ensure a patient exists or use the 'Detailed Intake' payload if 'general' only makes a lead.
    // The code I read showed: if (data.type === 'general') -> Insert into leads.
    // We want a PATIENT. So let's use the detailed intake format or manual insert if endpoints unavailable.
    // Better: Use `api/admin/patients` to create if available, or just use the detailed intake payload.

    /* 
    Reviewing `submit.ts` again:
    if (data.type === 'general') ... return;
    
    // --- Detailed Intake Logic ---
    ...
    const existingPatient = ...
    if (!existingPatient) { INSERT INTO patients ... }
    */

    // Let's use detailed intake payload to force patient creation
    const intakePayload = {
        type: 'visit', // detailed
        name: patientName,
        phone: patientPhone,
        rrn_front: '900101',
        rrn_back: '1234567',
        address: 'Test Address',
        visit_category: '침치료',
        main_symptom: 'Test Symptom',
        privacy_consent: true,
        marketing_consent: false
    };

    const patientRes = await fetch(`${BASE_URL}/api/intake/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intakePayload)
    });

    const patientData = await patientRes.json();
    if (!patientData.success) {
        console.error('Failed to create patient:', patientData);
        return;
    }
    const patientId = patientData.patientId;
    console.log(`Patient Created. ID: ${patientId}`);

    // 2. Create First Reservation
    console.log('\n2. Creating First Reservation...');
    const now = new Date();
    const reservedAt = new Date(now.getTime() + 3600000).toISOString(); // 1 hour later

    // Create reservation directly via DB or API? 
    // We don't have a public reservation creation API easily accessible maybe?
    // Let's try `api/admin/reservations` if it exists, or just direct DB insert if I were local, but I must use tools.
    // wait, I can use `run_command` to execute a script on the server that does local DB ops, or use the API.
    // Let's check `src/pages/api/reservations/index.ts` or similar.
    // I can see `src/pages/api/reservations/[id].ts` exists.
    // Is there a create endpoint? 
    // checking list_dir of `src/pages/api/reservations`...
    // Assume `src/pages/api/admin/reservations/create.ts` or similar? 
    // I will just use `api/admin/reservations` (POST) if standard rest.

    // Actually, I can use the `sqlite3` command to verify or insert data if API interactions are hard.
    // But I need to verify the LOGIC in `[id].ts` so I MUST call the API.

    // Let's Assume POST /api/admin/reservations exists.
    const resCreate = await fetch(`${BASE_URL}/api/admin/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            patient_id: patientId,
            doctor_id: 'doctor-1', // assuming dummy doctor exists or nullable
            reserved_at: reservedAt,
            status: 'scheduled',
            notes: 'First Visit Test'
        })
    });

    // If that fails, I might need to find the correct endpoint.
    // Let's assume it works or I'll see error.
    let reservationId;
    if (resCreate.ok) {
        const resJson = await resCreate.json();
        // Assuming it returns { id: ... } or check success
        // If it returns success: true, I might need to query to get ID.
        // For now let's hope it returns id.
        reservationId = resJson.id || resJson.reservation?.id;
    }

    if (!reservationId) {
        console.log('⚠️ Could not create reservation via API (maybe endpoint differs). attempting alternate...');
        // Fallback: If I can't easily create via API, I can't easily test the full flow without more discovery.
        // But wait, the user wants me to VERIFY.
        // Let's try to verify by creating a reservation MANUALLY in DB then calling PATCH API.
        console.log('Creating reservation via DB directly...');
        // This part would be done via `run_command` with sqlite3 but I am writing a JS script to run via node.
        // I cannot execute sqlite3 inside this JS script unless I spawn a process, which is complex.
        // Let's just trust the PATCH API exists and I can manually create the reservation row using `run_command` in the agent tool, then run this script to Call PATCH.
        return;
    }

    console.log(`Reservation Created: ${reservationId}`);

    // 3. Mark as Completed (Visit Confirm)
    console.log('\n3. Marking Reservation as Completed (First Visit)...');
    await fetch(`${BASE_URL}/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
    });

    // 4. Verify Event Type -> Should be '초진 내원'
    // I'll leave the verification of the DB state to the agent tool `run_command`
}

runTest();
