import { expect, test } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../../scripts/lib/e2e-admin-config.js';

test.use({ storageState: { cookies: [], origins: [] } });

test('관리자 로그인 페이지에서 로그인할 수 있다', async ({ page }) => {
  await page.goto('/admin/login');

  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();

  await page.getByTestId('admin-login-email').fill(E2E_ADMIN_EMAIL);
  await page.getByTestId('admin-login-password').fill(E2E_ADMIN_PASSWORD);
  await page.getByTestId('admin-login-submit').click();

  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});
