import { expect, test } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from '../../scripts/lib/e2e-admin-config.js';

// 핵심 관리자 페이지 목록
const criticalAdminPages = [
  '/admin',
  '/admin/reservations',
  '/admin/patients',
  '/admin/leads',
  '/admin/crm',
  '/admin/messages',
  '/admin/shipping',
  '/admin/inventory',
  '/admin/expenses',
  '/admin/analytics',
  '/admin/programs',
  '/admin/topics',
  '/admin/posts',
  '/admin/reviews',
  '/admin/staff',
  '/admin/settings/schedule',
  '/admin/aeo',
];

test.describe.parallel('관리자 페이지 스모크 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByTestId('admin-login-email').fill(E2E_ADMIN_EMAIL);
    await page.getByTestId('admin-login-password').fill(E2E_ADMIN_PASSWORD);
    await page.getByTestId('admin-login-submit').click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  });

  for (const path of criticalAdminPages) {
    test(`페이지 로드: ${path}`, async ({ page }) => {
      const response = await page.goto(path, { timeout: 30000 });
      
      // HTTP 상태 체크
      expect(response?.status(), `${path} - 500 에러`).not.toBe(500);
      expect(response?.status(), `${path} - 404 에러`).not.toBe(404);
      
      // 페이지에 "Error" 또는 "Internal Server Error" 텍스트가 없는지 확인
      const bodyText = await page.locator('body').innerText({ timeout: 5000 });
      expect(bodyText, `${path} - 에러 메시지 포함`).not.toContain('Internal Server Error');
      expect(bodyText, `${path} - 스택 트레이스 포함`).not.toMatch(/at\s+\w+\s+\(/);
      
      // 페이지에 실제 콘텐츠가 있는지 확인
      expect(bodyText.length, `${path} - 빈 페이지`).toBeGreaterThan(200);
    });
  }
});

// API 엔드포인트 스모크 테스트
test.describe.parallel('관리자 API 스모크 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByTestId('admin-login-email').fill(E2E_ADMIN_EMAIL);
    await page.getByTestId('admin-login-password').fill(E2E_ADMIN_PASSWORD);
    await page.getByTestId('admin-login-submit').click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  });

  const apiEndpoints = [
    '/api/auth/profile',
    '/api/admin/posts?limit=1',
    '/api/admin/topics/list',
    '/api/admin/reservations?limit=1',
    '/api/admin/patients?limit=1',
    '/api/admin/leads?limit=1',
  ];

  for (const endpoint of apiEndpoints) {
    test(`API: ${endpoint}`, async ({ request }) => {
      const response = await request.get(endpoint, { timeout: 10000 });
      
      expect(response.status(), `${endpoint} - 500 에러`).not.toBe(500);
      
      if (response.status() === 200) {
        const contentType = response.headers()['content-type'] || '';
        expect(contentType, `${endpoint} - JSON 아님`).toContain('application/json');
      }
    });
  }
});
