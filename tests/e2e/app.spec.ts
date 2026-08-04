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

test('search replaces the center icon and hides empty rings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.center-flip')).toBeVisible();

  await page.keyboard.press('Meta+f');
  // 搜索框位于圆心，替换圆心图片
  await expect(page.locator('#search-input')).toBeVisible();
  await expect(page.locator('.center-flip')).toBeHidden();
  await expect(page.locator('#center-icon')).toBeHidden();

  // 无匹配时不应显示空圈
  await page.locator('#search-input').fill('__no_such_app__');
  await expect(page.locator('#donut')).toBeHidden();
  await expect(page.locator('.center-flip')).toBeHidden();

  await page.screenshot({ path: 'work/verify-search.png' });

  // 关闭搜索后圆心图片恢复
  await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+f');
  await expect(page.locator('#search-input')).toBeHidden();
  await expect(page.locator('.center-flip')).toBeVisible();
});

test('opens the settings panel', async ({ page }) => {
  await page.goto('/');
  await page.locator('#center-icon').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await expect(page.locator('#settings-tabs')).toBeVisible();
});
