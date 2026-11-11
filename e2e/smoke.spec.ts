// Smoke test: the shell loads the sample and shows an empty, integer-scaled canvas.
import { expect, test } from '@playwright/test';

test('shell loads the sample and scales the canvas', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#overview')).toContainText('14 characters');

  const office = page.locator('#office');
  await expect(office).toHaveAttribute('width', '480');
  await expect(office).toHaveAttribute('height', '270');
  await expect(office).toHaveAttribute('data-scale', '2');

  const cssWidth = await office.evaluate((el) => el.getBoundingClientRect().width);
  const scale = Number(await office.getAttribute('data-scale'));
  expect(scale).toBeGreaterThanOrEqual(1);
  expect(cssWidth % 480).toBe(0);
  expect(cssWidth).toBe(480 * scale);

  await page.screenshot({ path: `var/screens/bootstrap-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});
