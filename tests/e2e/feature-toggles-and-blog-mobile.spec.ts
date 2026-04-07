import { test, expect } from '@playwright/test';

test.describe('Blog mobile UI - padding fix', () => {
  test('blog detail article card has reduced padding on mobile', async ({ browser }) => {
    // Use iPhone-sized viewport
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    });
    const page = await context.newPage();

    // Get a blog post slug from the listing page
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Find first blog post link
    const firstPostLink = page.locator('a[href*="/blog/"]').first();
    const href = await firstPostLink.getAttribute('href');
    expect(href).toBeTruthy();

    // Navigate to blog detail
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    // Find the article content wrapper (the div right after the featured image area)
    // It should have p-4 on mobile (16px padding)
    const articleContent = page.locator('article > div').last();
    const padding = await articleContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        paddingLeft: parseInt(style.paddingLeft),
        paddingRight: parseInt(style.paddingRight),
      };
    });

    // p-4 = 16px, previously p-8 = 32px
    // Allow some tolerance but should be <= 24px (sm:p-6 at most, won't trigger at 375px)
    expect(padding.paddingLeft).toBeLessThanOrEqual(24);
    expect(padding.paddingRight).toBeLessThanOrEqual(24);
    // Must be exactly 16px (p-4) on 375px viewport
    expect(padding.paddingLeft).toBe(16);

    // Verify the content area (clientWidth includes padding) is wider than the old layout
    // Old: p-8 gave clientWidth ~261px on 375px viewport, new: p-4 gives ~293px
    const textWidth = await articleContent.evaluate((el) => el.clientWidth);
    expect(textWidth).toBeGreaterThanOrEqual(280);

    await context.close();
  });

  test('reviews detail also has reduced padding on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();

    await page.goto('/reviews');
    await page.waitForLoadState('networkidle');

    // Check if any review links exist; skip if no seed data
    const reviewLinks = page.locator('a[href*="/reviews/"]');
    const count = await reviewLinks.count();

    if (count === 0) {
      await context.close();
      test.skip(true, 'No review posts in seed data');
      return;
    }

    const href = await reviewLinks.first().getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');

    const articleContent = page.locator('article > div').last();
    const padding = await articleContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.paddingLeft);
    });

    expect(padding).toBeLessThanOrEqual(24);

    await context.close();
  });
});

test.describe('Feature toggles - settings UI', () => {
  test('admin settings page shows reservation and inquiry toggles', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Click on the operations tab (운영 tab)
    const operationsTab = page.locator('[data-tab="operations"], button:has-text("운영")');
    if (await operationsTab.isVisible()) {
      await operationsTab.click();
    }

    // Check that all 5 feature toggle checkboxes exist
    await expect(page.locator('input[name="feature_remote_consultation"]')).toBeAttached();
    await expect(page.locator('input[name="feature_multilingual"]')).toBeAttached();
    await expect(page.locator('input[name="feature_reservation"]')).toBeAttached();
    await expect(page.locator('input[name="feature_inquiry"]')).toBeAttached();
    await expect(page.locator('input[name="feature_aeo_recommendations"]')).toBeAttached();

    // Verify labels are present
    await expect(page.getByText('예약 기능')).toBeVisible();
    await expect(page.getByText('문의/접수 기능')).toBeVisible();
    await expect(page.getByText('AEO 스마트 추천')).toBeVisible();
  });

  test('reservation and inquiry toggles are enabled by default', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to operations tab
    const operationsTab = page.locator('[data-tab="operations"], button:has-text("운영")');
    if (await operationsTab.isVisible()) {
      await operationsTab.click();
    }

    // Reservation and inquiry should be checked by default, AEO should be unchecked
    const reservationToggle = page.locator('input[name="feature_reservation"]');
    const inquiryToggle = page.locator('input[name="feature_inquiry"]');
    const aeoToggle = page.locator('input[name="feature_aeo_recommendations"]');

    await expect(reservationToggle).toBeChecked();
    await expect(inquiryToggle).toBeChecked();
    await expect(aeoToggle).not.toBeChecked();
  });
});

test.describe('Feature toggles - inquiry gate', () => {
  test('intake page is accessible when inquiry is enabled', async ({ page }) => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect away - intake form should be visible
    expect(page.url()).toContain('/intake');
    await expect(page.locator('#intakeForm')).toBeVisible();
  });

  test('navbar shows inquiry CTA button when enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // At least one CTA pointing to intake should exist in the page
    const intakeLinks = page.locator('a[href*="/intake"]');
    const count = await intakeLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('AEO recommendations toggle', () => {
  test('blog detail shows basic related posts when AEO is off (default)', async ({ page }) => {
    // Navigate to a blog post
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const firstPostLink = page.locator('a[href*="/blog/"]').first();
    const href = await firstPostLink.getAttribute('href');
    if (!href) {
      test.skip(true, 'No blog posts in seed data');
      return;
    }

    await page.goto(href);
    await page.waitForLoadState('networkidle');

    // AEO is off by default, so InternalLinkingModule should NOT be visible
    const aeoSection = page.locator('text=함께 보면 좋은 문서');
    await expect(aeoSection).not.toBeVisible();

    // Basic related posts section may or may not have posts, but the AEO section should be absent
  });
});
