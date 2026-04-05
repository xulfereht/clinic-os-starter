import { expect, test } from '@playwright/test';

test.describe('admin shipping interactions', () => {
  test('배송 목록 체크박스를 클릭해도 상세 페이지로 이동하지 않는다', async ({ page }) => {
    await page.goto('/admin/shipping', { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr:has(td[data-nav-url^="/admin/shipping/"])').first();
    const checkbox = row.locator('.order-check');
    await expect(checkbox).toBeVisible();

    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/admin\/shipping(?:\?.*)?$/);

    await checkbox.focus();
    await checkbox.press(' ');
    await expect(checkbox).not.toBeChecked();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/admin\/shipping(?:\?.*)?$/);
  });

  test('환자 정보 셀을 누르면 배송 상세 페이지로 이동한다', async ({ page }) => {
    await page.goto('/admin/shipping', { waitUntil: 'domcontentloaded' });

    const navCell = page.locator('td[data-nav-url^="/admin/shipping/"]').first();
    const targetUrl = await navCell.getAttribute('data-nav-url');

    await expect(navCell).toBeVisible();
    await navCell.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(targetUrl);
  });
});
