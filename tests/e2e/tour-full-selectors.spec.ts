import { test, expect } from '@playwright/test';

test.describe('Tour Selector Verification (auto-generated)', () => {

    test('/admin (12 selectors)', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["[data-tour=\"pending-card\"]","[data-tour=\"shipping-card\"]","[data-tour=\"visits-card\"]","[data-tour=\"reservations-card\"]","[data-tour=\"revenue-card\"]","#pipeline-toggle button","#pipeline-grid","#pipeline-modal","[data-tour=\"activity-feed\"]","[data-tour=\"quick-actions\"]","[data-tour=\"main-shortcuts\"]","[data-tour=\"health-tooltip\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/aeo (4 selectors)', async ({ page }) => {
        await page.goto('/admin/aeo');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["main","h1",".modal-tab-btn[data-tab=\"traffic\"]",".modal-tab-btn[data-tab=\"content\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/aeo:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/analytics (13 selectors)', async ({ page }) => {
        await page.goto('/admin/analytics');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#datePresets","#startDate","#refreshBtn","#consultTypeToggle","#metrics-container","#funnel-chart","#funnel-insights","#patient-type-pie-chart","#consult-type-pie-chart","#medical-perf-grid, #consultant-stats, #verified-source-stats","#detailModal, #detailTableBody, #prevPageBtn, #nextPageBtn","#prevPageBtn","#nextPageBtn"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/analytics:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/campaigns (13 selectors)', async ({ page }) => {
        await page.goto('/admin/campaigns');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["[data-tour=\"campaign-tabs\"]","#createCampaignBtn","input[name=\"name\"]","select[name=\"segment_id\"]","select[name=\"template_id\"]","input[name=\"type\"]","#config_ONE_TIME, #is_scheduled, input[name=\"scheduled_at_local\"]","select[name=\"recurrence_freq\"], #config_RECURRING","#opt_WEEKLY, input[name=\"weekly_days\"], input[name=\"weekly_time\"]","select[name=\"trigger_event\"], #config_TRIGGER","#templatePreview, #previewBubble, #previewContent","#submitCreateBtn","[data-tour=\"campaign-actions\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/campaigns:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/data/converter (12 selectors)', async ({ page }) => {
        await page.goto('/admin/data/converter');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["main","[data-tour=\"emr-select-buttons\"]",".emr-select-btn[data-emr=\"hanisarang\"]",".emr-select-btn[data-emr=\"okchart\"]",".emr-select-btn[data-emr=\"neobogam\"]",".emr-select-btn[data-emr=\"hanimek\"]","#fileUploadArea","[data-tour=\"parsing-loader\"]","#previewSection","table","#errorList","#importBtn"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/data/converter:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/design (23 selectors)', async ({ page }) => {
        await page.goto('/admin/design');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["main","[data-tour=\"skin-store-banner\"]","a[href=\"/admin/skins/store\"]","[data-tour=\"skin-section\"]","label[data-testid^=\"skin-card-\"]","input[name=\"skin\"]","label.group.relative.cursor-pointer","[data-tour=\"detail-settings-section\"]","div:has([name=\"brandHue\"])","input[name=\"brandHue\"]","div:has([name=\"rounding\"])","input[name=\"rounding\"]","div:has([name=\"density\"])","input[name=\"density\"]","[data-tour=\"css-section\"]","input[name=\"css_accent\"]","input[name=\"css_font_heading\"]","textarea[name=\"css_custom\"]","[data-tour=\"custom-skin-guide\"]","#reset-btn","#save-btn","iframe","[data-tour=\"appearance-note\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/design:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/documents (5 selectors)', async ({ page }) => {
        await page.goto('/admin/documents');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["[data-tour=\"category-list\"]","#searchInput","#sortSelect","#uploadForm button[type=\"submit\"]","#dropzone"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/documents:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/events (8 selectors)', async ({ page }) => {
        await page.goto('/admin/events');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["main","#newEventBtn","[data-tab=\"applicants\"]","#saveEventBtn","button[onclick=\"closeEventModal()\"]","#deleteEventBtn",".modal-tab-btn[data-tab=\"settings\"]",".modal-tab-btn[data-tab=\"applicants\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/events:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/expenses (8 selectors)', async ({ page }) => {
        await page.goto('/admin/expenses');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1[id=\"pageTitle\"]","button[onclick=\"changeMonth(-1)\"]","button[onclick=\"changeMonth(1)\"]","button.filter-btn","tbody tr","[data-tour=\"stats-button\"]","[data-tour=\"create-expense-button\"]","#saveTemplate"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/expenses:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/intake (8 selectors)', async ({ page }) => {
        await page.goto('/admin/intake');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["[data-tour=\"stats-total\"]","[data-tour=\"stats-first-visit\"]","[data-tour=\"stats-return-visit\"]","a[href*=\"?date=\"]","input[type=\"date\"]","input[name=\"q\"]","tbody","td[colspan=\"6\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/intake:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/inventory (8 selectors)', async ({ page }) => {
        await page.goto('/admin/inventory');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["[style*=\"bg-red\"], div[class*=\"red-50\"]","#itemSearch","tbody tr:first-child td:last-child","button[class*=\"blue\"][class*=\"50\"]","button[class*=\"amber\"]","button[class*=\"tab-btn\"]","#openItemBtn","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/inventory:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/knowledge (10 selectors)', async ({ page }) => {
        await page.goto('/admin/knowledge');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","#searchInput","#openCatManageBtn","div.mb-6.bg-gradient-to-r",".cat-filter-btn","#filter-needs-revision, #createBtn","#filter-needs-revision","#createBtn","tbody tr","details"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/knowledge:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/leads (13 selectors)', async ({ page }) => {
        await page.goto('/admin/leads');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["div.grid.grid-cols-1","#openCreateModalBtn","input[name=\"q\"]","select[name=\"status\"]","select[name=\"channel\"]","select[name=\"patient_type\"]","select[name=\"tag\"]","button[type=\"submit\"]","form",".draggable-card","span[class*=\"inline-flex\"][class*=\"rounded\"]","#holdReasonModal","#createInquiryModal"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/leads:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/manuals (4 selectors)', async ({ page }) => {
        await page.goto('/admin/manuals');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","div[class*=\"grid\"]","a[href*=\"/admin/manuals/\"][href*=\"/\"]","aside"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/manuals:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/marketing/history (6 selectors)', async ({ page }) => {
        await page.goto('/admin/marketing/history');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","input[name=\"q\"]","button[type=\"submit\"]","#log-detail-modal button[type=\"button\"]","div.grid.grid-cols-2","nav[role=\"navigation\"] .flex.gap-1, div.flex.gap-1"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/marketing/history:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/media (7 selectors)', async ({ page }) => {
        await page.goto('/admin/media');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#gallery","#refresh-btn","#upload-section","input[type=\"file\"]","#search-input","button[onclick*=\"copyURL\"]","button[onclick*=\"deleteFile\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/media:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/members (5 selectors)', async ({ page }) => {
        await page.goto('/admin/members');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["table","tbody tr:first-child","tbody tr","#approvalModeToggle","tbody tr:last-child"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/members:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/messages (11 selectors)', async ({ page }) => {
        await page.goto('/admin/messages');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#sidebar","#channel-search-input, #search-clear-btn","#tab-team, #tab-customer","#public-channels-list","#dm-list, button[onclick=\"openGroupModal()\"]","#staff-list-container, button[onclick=\"toggleStaffList()\"]","#customer-active-list, #customer-closed-list","#chat-header, #header-avatar, #header-title","div[class*=\"rounded\"]","#message-input","#connection-status"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/messages:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/notices (6 selectors)', async ({ page }) => {
        await page.goto('/admin/notices');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["a[href*=\"/admin/notices\"]","input[name=\"q\"]","a[href*=\"/admin/notices/\"]","div.flex.items-center.justify-between","tbody tr td:nth-child(5)","a[href=\"/admin/notices/new\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/notices:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/pages (8 selectors)', async ({ page }) => {
        await page.goto('/admin/pages');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","table","a[href*=\"/admin/pages/\"]","#create-modal, #create-form","input[name=\"title\"]","input[name=\"slug\"]","textarea[name=\"description\"]","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/pages:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/patients (15 selectors)', async ({ page }) => {
        await page.goto('/admin/patients');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["div[class*=\"rounded\"][class*=\"shadow\"]","a[href=\"/admin/crm/segments\"]","#mainSearchInput","div[class*=\"bg-slate\"]","select[name=\"sort\"]","a","td:first-child","td:nth-child(2)","td:nth-child(3)","td:nth-child(4)","td:nth-child(5)","tr","div.text-center","#paginationContainer","span[class*=\"bg-blue\"], span[class*=\"bg-green\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/patients:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/payments (12 selectors)', async ({ page }) => {
        await page.goto('/admin/payments');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["div[class*=\"grid\"]","a[data-period]","select[name=\"status\"]","input[name=\"q\"]","#openPaymentModalBtn","#openRefundRegisterBtn","table tbody","#detailPatientLink","#detailRefundBtn","#paymentPatientSearchInput","#productSelect","#promotionSelect"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/payments:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/plugins (5 selectors)', async ({ page }) => {
        await page.goto('/admin/plugins');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["div[id*=\"pluginsList\"]","div[class*=\"plugin\"]",".toggle-btn","button","a[href*=\"store\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/plugins:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/posts (16 selectors)', async ({ page }) => {
        await page.goto('/admin/posts');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["table","h1","a[href=\"/admin/posts/new\"]","#filterForm","input[name=\"q\"]","select[name=\"type\"]","select[name=\"category\"]","select[name=\"status\"]","table thead","a[href*=\"/admin/posts/\"]","table tbody tr td:nth-child(1) a","table tbody tr","div[class*=\"lg:hidden\"]","a[href*=\"page=\"]","div[class*=\"text-xs\"][class*=\"text-slate\"]","tbody tr"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/posts:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/programs (16 selectors)', async ({ page }) => {
        await page.goto('/admin/programs');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","a[href=\"/admin/programs/new\"]","thead tr",".drag-handle",".visibility-toggle",".program-row","#modal-id-input","#modal-title-input","#modal-desc-input","#modal-order-input","#modal-conditions-input","form button","#saveBtn","#modal-edit-link","#deleteBtn","#closeInfoModalBtn"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/programs:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/reservations (11 selectors)', async ({ page }) => {
        await page.goto('/admin/reservations');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#filter-date","#filter-doctor","#filter-status","#add-reservation-btn","#patient-search","#slot-picker","#res-doctor","#res-notes","#close-modal-btn","button[type=\"submit\"]","#refresh-btn"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/reservations:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/reviews (7 selectors)', async ({ page }) => {
        await page.goto('/admin/reviews');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["input[name=\"q\"]","select[name=\"category\"]","select[name=\"doctor\"]","table.w-full","div[class*=\"lg:hidden\"]","a[href*=\"/admin/reviews/\"]","a[href=\"/admin/reviews/new\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/reviews:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings (27 selectors)', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["form","div[class*=\"grid\"]","nav#settingsTabs",".tab-btn","#tab-basic","input[name=\"name\"]","input[name=\"representativeName\"]","input[name=\"businessLicenseNumber\"]","input[name=\"description\"]","input[name=\"siteUrl\"]","input[name=\"bankInfo\"]","#tab-contact","input[name=\"phone\"]","input[name=\"address\"]","input[name=\"mapUrl\"]","input[name=\"mapSearchKeyword\"]","#tab-branding","input[name=\"logoUrl\"]","input[name=\"faviconUrl\"]","#tab-operation","input[name=\"hours_row1_label\"], input[name=\"hours_row1_value\"]","input[name=\"hours_row1_label\"]","input[name=\"hours_row1_value\"]","input[name=\"hours_row2_label\"], input[name=\"hours_row3_label\"], input[name=\"hours_row4_label\"]","input[name=\"hours_row2_label\"]","input[name=\"hours_row3_label\"]","input[name=\"hours_row4_label\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/ai (13 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/ai');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = [".space-y-6","[data-provider=\"openai\"]",".toggle-active",".input-api-key",".select-model",".input-model-custom",".btn-save","[data-provider=\"gemini\"]","[data-provider=\"claude\"]","[data-provider=\"deepseek\"], [data-provider=\"google_translate\"]","select[name*=\"routing\"], select[class*=\"select\"]","select","button.btn-save"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/ai:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/api-keys (8 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/api-keys');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["main","[data-tour=\"key-status-box\"]","#keyDisplay","#noKeyMessage","#generateBtn","#newKeyDisplay","#copyBtn",".space-y-6"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/api-keys:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/integrations (42 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/integrations');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["div[id*=\"slack\"], div[id*=\"Slack\"]","input[type=\"checkbox\"]#slackEnabled","#slackConfig","#slackWebhookUrl","#slackChannel","#testSlackBtn","#saveSlackBtn","div[id*=\"sms\"], div[id*=\"SMS\"]","input[type=\"checkbox\"]#aligoEnabled","input[name=\"smsProvider\"]","#aligoFields","#copyProxyIpBtn","#aligoApiKey","#aligoSenderKey","#aligoUserId","#aligoSender","button#testAligoBtn","#testAligoBtn","#saveAligoBtn","#aligoTestReceiver","#aligoTestMessage","#sendTestMsgBtn","#solapiFields","#solapiApiKey","#solapiApiSecret","#solapiSender","#solapiPfId","div.bg-white.rounded-xl:nth-child(3)","input[type=\"checkbox\"]#naverTalkEnabled","#naverTalkConfig","#naverTalkToken","#copyWebhookBtn","#testNaverTalkBtn","#saveNaverTalkBtn","div.bg-white.rounded-xl:nth-child(4)","input[type=\"checkbox\"]#kakaoEnabled","#kakaoConfig","#copyKakaoWebhookBtn","#testKakaoBtn","#saveKakaoBtn","button[id*=\"Btn\"]","#statusMessage, #aligoStatusMessage, #naverTalkStatusMessage, #kakaoStatusMessage"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/integrations:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/languages (6 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/languages');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","#languages-list",".toggle-btn","#add-language-form","input[name=\"code\"]","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/languages:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/navigation (20 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/navigation');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#nav-tree-container","#add-item-btn","[data-edit-id]","#edit-panel","#edit-label","#edit-type","#edit-path","#page-selector","#field-programs","#program-checkboxes","#edit-show-view-all","div.drag-handle","button[data-action=\"up\"]","button[data-action=\"down\"]","button[data-action=\"in\"]","button[data-action=\"out\"]","#save-btn","#edit-visible","#delete-item-btn","#close-panel"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/navigation:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/promotions (13 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/promotions');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["table","#addPromoBtn","form","#promoName","#promoType","#promoValue","#statusField","#promoStatus","button[type=\"submit\"]","#cancelBtn","#submitBtn",".edit-btn",".delete-btn"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/promotions:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/seo (6 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/seo');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["form","#inputTitleSuffix","#inputMetaDesc","input[name=\"seo.meta_title_suffix\"]","textarea[name=\"seo.meta_description\"]","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/seo:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/tags (9 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/tags');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","#addTagBtn","#modal","#tagCategory","#tagName",".tag-item","button.delete-btn","div[onclick*=\"openEditModal\"]","#tagSearch"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/tags:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/terms (2 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/terms');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","button:has-text(\"+ 사용자 정의 정책 추가\")"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/terms:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/settings/widget (2 selectors)', async ({ page }) => {
        await page.goto('/admin/settings/widget');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","#enabled"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/settings/widget:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/shipping (6 selectors)', async ({ page }) => {
        await page.goto('/admin/shipping');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["a[href=\"?status=happy_call\"]","a[href=\"?status=overdue\"]","a[href=\"?status=due_soon\"]","input[name=\"q\"]","select[name=\"product\"]","a[href=\"?status=today_shipped\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/shipping:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/staff (13 selectors)', async ({ page }) => {
        await page.goto('/admin/staff');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["a[href=\"?view=staff\"]","a[href=\"?view=admin\"]","#staffSearch","#typeFilter","#statusFilter","#selectAll",".row-checkbox","#bulkDeleteBtn","a[href=\"/admin/staff/new\"]","input[type=\"text\"]","input[type=\"email\"]","input[type=\"password\"]","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/staff:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/staff/new (9 selectors)', async ({ page }) => {
        await page.goto('/admin/staff/new');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["#createForm","select[name*=\"type\"]","input[name=\"image\"]","select#presetSelect","div#presetDescription","button#togglePermissions","#permissionsSection",".toggle-group-btn","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/staff/new:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/surveys (4 selectors)', async ({ page }) => {
        await page.goto('/admin/surveys');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = [".filter-btn","tbody tr:first-child","#qrDownload","a[href=\"/admin/surveys/new\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/surveys:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/tasks (3 selectors)', async ({ page }) => {
        await page.goto('/admin/tasks');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["button[type=\"button\"]","select[name=\"frequency\"]","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/tasks:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/topics (2 selectors)', async ({ page }) => {
        await page.goto('/admin/topics');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","a[href^=\"/admin/topics/\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/topics:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/translations (3 selectors)', async ({ page }) => {
        await page.goto('/admin/translations');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1","table.w-full","a[href^=\"/admin/translations/\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/translations:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });

    test('/admin/trash (4 selectors)', async ({ page }) => {
        await page.goto('/admin/trash');
        await page.waitForLoadState('networkidle');
        const missing: string[] = [];
        const selectors = ["h1",".tab-btn","table tr","button[type=\"submit\"]"];
        for (const sel of selectors) {
            try {
                const parts = sel.split(',').map((s: string) => s.trim());
                let found = false;
                for (const part of parts) {
                    const c = await page.locator(part).count();
                    if (c > 0) { found = true; break; }
                }
                if (!found) missing.push(sel);
            } catch { missing.push(sel + ' (error)'); }
        }
        if (missing.length > 0) console.log('MISSING on /admin/trash:', missing);
        expect(missing.length, 'Missing: ' + missing.join(', ')).toBe(0);
    });
});
