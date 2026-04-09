/**
 * Tour Selector Verification — checks that key CSS selectors from
 * tour step definitions actually exist in the rendered DOM.
 * One test per admin page.
 */
import { test, expect } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../../scripts/lib/e2e-admin-config.js';

// Page → key selectors to verify (simple, reliable selectors only)
const PAGE_SELECTORS: Record<string, string[]> = {
    // Core pages
    '/admin': ['#op-board-container'],
    '/admin/patients': ['#mainSearchInput', 'select[name="sort"]'],
    '/admin/reservations': ['#filter-date', '#filter-doctor', '#filter-status', '#add-reservation-btn', '#refresh-btn'],
    '/admin/payments': ['input[name="q"]'],
    '/admin/intake': ['input[type="date"]'],
    '/admin/leads': ['select[name="status"]'],
    '/admin/staff': ['#staffSearch', '#typeFilter', '#statusFilter'],
    '/admin/programs': ['a[href="/admin/programs/new"]'],
    '/admin/posts': ['a[href="/admin/posts/new"]'],
    '/admin/design': ['#save-btn', '#reset-btn'],
    '/admin/settings': ['[name="name"]'],
    '/admin/campaigns': ['#createCampaignBtn'],
    '/admin/analytics': ['#refreshBtn'],
    '/admin/reviews': ['input[name="q"]'],
    '/admin/messages': ['#tab-team', '#tab-customer'],
    '/admin/pages': ['#btn-create-page'],

    // Operations pages
    '/admin/surveys': ['table'],
    '/admin/notices': ['form'],
    '/admin/documents': ['#searchInput'],
    '/admin/tasks': ['[draggable="true"]'],
    '/admin/manuals': ['.max-w-4xl'],
    '/admin/members': ['table'],
    '/admin/shipping': ['input[name="q"]'],
    '/admin/media': ['#search-input'],
    '/admin/inventory': ['#itemSearch'],
    '/admin/expenses': ['table'],

    // Settings sub-pages
    '/admin/settings/tags': ['#addTagBtn'],
    '/admin/settings/promotions': ['#addPromoBtn'],
    '/admin/settings/navigation': ['#add-item-btn', '#save-btn'],
    '/admin/settings/widget': ['[type="submit"]'],
    '/admin/settings/seo': ['#seoForm'],
    '/admin/settings/integrations': ['form'],
    '/admin/settings/api-keys': ['#generateBtn'],
    '/admin/settings/ai': ['form'],
    '/admin/settings/terms': ['a[href*="terms/"]'],
    '/admin/settings/languages': ['form'],

    // Marketing/content
    '/admin/events': ['#newEventBtn'],
    '/admin/marketing/history': ['input[name="q"]'],
    '/admin/topics': ['.max-w-7xl'],
    '/admin/aeo': ['.max-w-7xl'],
    '/admin/knowledge': ['#searchInput'],

    // System
    '/admin/translations': ['table'],
    '/admin/trash': ['#searchInput'],
    '/admin/plugins': ['a[href="/admin/plugins/store"]'],
    '/admin/data/converter': ['#fileInput'],
};

test.describe('Tour Selector Verification — All Admin Pages', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/admin/login');
        await page.getByTestId('admin-login-email').fill(E2E_ADMIN_EMAIL);
        await page.getByTestId('admin-login-password').fill(E2E_ADMIN_PASSWORD);
        await page.getByTestId('admin-login-submit').click();
        await page.waitForURL(/\/admin/);
    });

    for (const [pagePath, selectors] of Object.entries(PAGE_SELECTORS)) {
        if (selectors.length === 0) continue;

        test(`${pagePath}`, async ({ page }) => {
            await page.goto(pagePath);
            await page.waitForLoadState('networkidle');

            for (const sel of selectors) {
                const el = page.locator(sel).first();
                await expect(el, `${pagePath}: ${sel}`).toBeAttached({ timeout: 5000 });
            }
        });
    }
});
