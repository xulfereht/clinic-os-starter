import { expect, test } from '@playwright/test';
import {
  E2E_BLOG_SLUG,
  E2E_CONDITION_SLUG,
  E2E_FAQ_SLUG,
  E2E_NOTICE_ID,
  E2E_PROGRAM_ID,
  E2E_TOPIC_SLUG,
} from '../../scripts/lib/e2e-admin-config.js';

test.setTimeout(180_000);

async function saveSkin(page: import('@playwright/test').Page, skinId: string) {
  await page.goto('/admin/design');
  await expect(page.getByTestId('design-loading-overlay')).toBeHidden();
  await page.getByTestId(`skin-card-${skinId}`).click();

  const saveResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/admin/design') && response.request().method() === 'POST';
  });

  await page.getByTestId('design-save-button').click();
  const response = await saveResponse;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByTestId('design-save-button')).toContainText('저장 완료');
}

async function restoreDefaultSkin(page: import('@playwright/test').Page) {
  try {
    await saveSkin(page, 'clinicLight');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[admin-design-contract] clinicLight 복구를 건너뜁니다:', message);
  }
}

test('관리자 디자인 설정에서 저장한 skin 이 토픽/공지 상세에 반영된다', async ({ page }) => {

  try {
    await saveSkin(page, 'midnightSignal');
    await page.goto('/');
    await expect(page.locator('html[data-skin="midnightSignal"]')).toBeVisible();
    await page.goto(`/topics/${E2E_TOPIC_SLUG}`);
    await expect(page.locator('html[data-skin="midnightSignal"]')).toBeVisible();
    await expect(page.locator('[data-skin-page-template="topicDetail"]')).toBeVisible();

    await page.goto(`/topics/${E2E_TOPIC_SLUG}/${E2E_CONDITION_SLUG}`);
    await expect(page.locator('[data-skin-page-template="conditionDetail"]')).toBeVisible();

    await page.goto(`/topics/${E2E_TOPIC_SLUG}/${E2E_CONDITION_SLUG}/${E2E_FAQ_SLUG}`);
    await expect(page.locator('[data-skin-page-template="faqDetail"]')).toBeVisible();

    await page.goto(`/notices/${E2E_NOTICE_ID}`);
    await expect(page.locator('[data-skin-page-template="noticeDetail"]')).toBeVisible();
  } finally {
    await restoreDefaultSkin(page);
  }
});

test('관리자 디자인 설정에서 저장한 새 프리셋이 블로그/프로그램 퍼블릭 페이지에 반영된다', async ({ page }) => {
  try {
    await saveSkin(page, 'scandiCare');

    await page.goto('/blog');
    await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();
    await expect(page.locator('[data-skin-page-template="blogList"]')).toBeVisible();

    await page.goto(`/blog/${E2E_BLOG_SLUG}`);
    await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();
    await expect(page.locator('[data-skin-page-template="blogDetail"]')).toBeVisible();

    await page.goto('/programs');
    await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();
    await expect(page.locator('[data-skin-page-template="programList"]').first()).toBeVisible();

    await page.goto(`/programs/${E2E_PROGRAM_ID}`);
    await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();
    await expect(page.locator('[data-skin-page-template="programDetail"]')).toBeVisible();
  } finally {
    await restoreDefaultSkin(page);
  }
});

test('관리자 디자인 설정은 저장된 skin 으로 메인 프리뷰를 다시 로드하고 surface 전환이 가능하다', async ({ page }) => {
  try {
    await saveSkin(page, 'ivoryLedger');

    await page.goto('/admin/design');
    await expect(page.getByTestId('design-loading-overlay')).toBeHidden();

    const previewFrame = page.getByTestId('design-preview-frame');
    await expect(previewFrame).toHaveAttribute('src', /skin=ivoryLedger/);
    await expect(page.getByTestId('preview-surface-full')).toHaveAttribute('data-active', 'true');

    await page.getByTestId('preview-surface-topic').click();
    await expect(previewFrame).toHaveAttribute('src', /surface=topic/);
    await expect(previewFrame).toHaveAttribute('src', /skin=ivoryLedger/);
  } finally {
    await restoreDefaultSkin(page);
  }
});
