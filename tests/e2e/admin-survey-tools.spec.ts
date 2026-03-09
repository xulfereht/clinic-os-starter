import { expect, test } from '@playwright/test';

test('관리자가 검사도구 관리 화면을 볼 수 있다', async ({ page }) => {
  await page.goto('/admin/surveys/tools');

  await expect(page.getByRole('heading', { name: '검사도구 관리' })).toBeVisible();
  await expect(page.getByTestId('survey-tool-card-stress-check')).toBeVisible();
  await expect(page.getByText('스트레스 자가진단')).toBeVisible();
});

test('관리자가 검사도구 결과 화면을 볼 수 있다', async ({ page }) => {
  await page.goto('/admin/surveys/tools/stress-check/results');

  await expect(page.getByRole('heading', { name: '스트레스 자가진단 결과' })).toBeVisible();
  await expect(page.getByTestId('survey-tool-results-table')).toBeVisible();
  await expect(page.getByRole('link', { name: '결과 보기' }).first()).toBeVisible();
});
