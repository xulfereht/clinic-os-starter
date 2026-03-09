import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function clickSkinCardAndWait(page: import('@playwright/test').Page, skinId: string) {
  await Promise.all([
    page.waitForURL(new RegExp(`skin=${skinId}`)),
    page.getByTestId(`skin-card-${skinId}`).click(),
  ]);
}

test('데모 페이지에서 스킨 프리셋을 쿼리로 로드할 수 있다', async ({ page }) => {
  await page.goto('/demo/design-system?skin=editorialCalm');

  await expect(page.getByTestId('demo-current-skin')).toHaveText('editorialCalm');
  await expect(page.locator('html[data-skin="editorialCalm"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-editorialCalm')).toBeVisible();
  await expect(page.locator('.skin-hero-editorialCalm')).toBeVisible();
});

test('데모 페이지에서 프리셋 카드를 클릭하면 다른 스킨으로 전환된다', async ({ page }) => {
  await page.goto('/demo/design-system?skin=editorialCalm');

  await clickSkinCardAndWait(page, 'forestTherapy');
  await expect(page).toHaveURL(/skin=forestTherapy/);
  await expect(page.getByTestId('demo-current-skin')).toHaveText('forestTherapy');
  await expect(page.locator('html[data-skin="forestTherapy"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-forestTherapy')).toBeVisible();

  await clickSkinCardAndWait(page, 'midnightSignal');
  await expect(page).toHaveURL(/skin=midnightSignal/);
  await expect(page.getByTestId('demo-current-skin')).toHaveText('midnightSignal');
  await expect(page.locator('html[data-skin="midnightSignal"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-midnightSignal')).toBeVisible();

  await clickSkinCardAndWait(page, 'scandiCare');
  await expect(page).toHaveURL(/skin=scandiCare/);
  await expect(page.getByTestId('demo-current-skin')).toHaveText('scandiCare');
  await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-scandiCare')).toBeVisible();

  await clickSkinCardAndWait(page, 'ivoryLedger');
  await expect(page).toHaveURL(/skin=ivoryLedger/);
  await expect(page.getByTestId('demo-current-skin')).toHaveText('ivoryLedger');
  await expect(page.locator('html[data-skin="ivoryLedger"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-ivoryLedger')).toBeVisible();
});

test('데모 페이지에서 surface 쿼리로 축약 프리뷰를 볼 수 있다', async ({ page }) => {
  await page.goto('/demo/design-system?skin=forestTherapy&surface=hero');

  await expect(page.getByTestId('demo-preview-surface')).toContainText('Hero Surface');
  await expect(page.locator('html[data-skin="forestTherapy"]')).toBeVisible();
  await expect(page.locator('.skin-mainhero-forestTherapy')).toBeVisible();
  await expect(page.locator('.skin-hero-forestTherapy')).toBeVisible();
  await expect(page.getByTestId('demo-current-skin')).toHaveCount(0);

  await page.goto('/demo/design-system?skin=scandiCare&surface=blog');
  await expect(page.getByTestId('demo-preview-blog')).toBeVisible();
  await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();

  await page.goto('/demo/design-system?skin=ivoryLedger&surface=program');
  await expect(page.getByTestId('demo-preview-program')).toBeVisible();
  await expect(page.locator('html[data-skin="ivoryLedger"]')).toBeVisible();

  await page.goto('/demo/design-system?skin=scandiCare&surface=blog-detail');
  await expect(page.getByTestId('demo-preview-blog-detail')).toBeVisible();
  await expect(page.locator('html[data-skin="scandiCare"]')).toBeVisible();

  await page.goto('/demo/design-system?skin=ivoryLedger&surface=program-detail');
  await expect(page.getByTestId('demo-preview-program-detail')).toBeVisible();
  await expect(page.locator('html[data-skin="ivoryLedger"]')).toBeVisible();
});

test('데모 페이지에서 detail surface 프리뷰를 볼 수 있다', async ({ page }) => {
  await page.goto('/demo/design-system?skin=midnightSignal&surface=topic');

  await expect(page.getByTestId('demo-preview-topic')).toBeVisible();
  await expect(page.locator('[data-skin-mini-banner="topic"]')).toHaveAttribute('data-template-shell', /split|magazine|stacked|editorial|immersive|minimal/);
  await expect(page.locator('html[data-skin="midnightSignal"]')).toBeVisible();

  await page.goto('/demo/design-system?skin=editorialCalm&surface=faq');
  await expect(page.getByTestId('demo-preview-faq')).toBeVisible();
  await expect(page.locator('[data-skin-mini-banner="faq"]')).toHaveAttribute('data-template-layout', 'split');

  await page.goto('/demo/design-system?skin=clinicLight&surface=notice');
  await expect(page.getByTestId('demo-preview-notice')).toBeVisible();
});

test('기존 코어 프리셋도 고유 hero override를 가진다', async ({ page }) => {
  for (const skinId of ['clinicLight', 'wellnessWarm', 'hanbangClassic', 'dataDark']) {
    await page.goto(`/demo/design-system?skin=${skinId}`);
    await expect(page.locator(`.skin-mainhero-${skinId}`)).toBeVisible();
    await expect(page.locator(`.skin-hero-${skinId}`)).toBeVisible();
    await expect(page.locator(`html[data-skin="${skinId}"]`)).toBeVisible();
  }
});
