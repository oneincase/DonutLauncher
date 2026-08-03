import { expect, test } from '@playwright/test';

test('renders the donut with icons and supports search', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#donut')).toBeVisible();
  await expect(page.locator('#icons .app-icon').first()).toBeVisible();
  const count = await page.locator('#icons .app-icon').count();
  expect(count).toBeGreaterThan(0);

  await page.keyboard.press('Meta+f');
  await page.locator('#search-input').fill('语音');
  await expect(page.locator('#icons .app-icon')).toHaveCount(1);

  await page.screenshot({ path: 'work/verify-vue.png' });
});

test('opens the settings panel', async ({ page }) => {
  await page.goto('/');
  await page.locator('#center-icon').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await expect(page.locator('#settings-tabs')).toBeVisible();
});
