// Reconnect spec (plan step 9.4, UI-4 done-when): the server stops → the page shows
// `reconnecting` within 3 s; it starts again on the same port → `ready` with the sample's 14
// characters within 20 s, on the same page (no reload: a marker set on `window` survives).
// The server is `--dev` (dist/ may be stale or missing), so the page's WebSockets (Vite's HMR
// client only) are answered by a mock that stays open: a real HMR socket would reload the page
// when the dev server comes back, which is exactly what this spec must rule out for the app.
import { expect, test } from '@playwright/test';
import { freePort, startCli, type Cli } from './helpers/server.js';

const RECONNECTING_MS = 3_000;
const READY_AGAIN_MS = 20_000;

let cli: Cli | null = null;

test.beforeEach(() => {
  // One timing check is enough; the 2x project adds nothing here.
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
});

test.afterEach(async () => {
  await cli?.stop();
  cli = null;
});

test('the page reconnects to a restarted server without a reload', async ({ page }) => {
  test.setTimeout(120_000);
  await page.routeWebSocket(/.*/, () => undefined);
  const port = await freePort();
  const args = ['--sample', '--port', String(port)];

  cli = await startCli(args);
  await page.goto(cli.url);
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#overview .status')).toHaveText('Agent Office · 14 characters');
  await page.evaluate(() => {
    (globalThis as { __marker?: string }).__marker = 'same-page';
  });

  await cli.stop();
  cli = null;
  await expect(app).toHaveAttribute('data-connection', 'reconnecting', { timeout: RECONNECTING_MS });

  // The 20 s count from the restart, the server's own start-up included.
  const restartedAt = Date.now();
  cli = await startCli(args);
  const left = (): number => Math.max(1, READY_AGAIN_MS - (Date.now() - restartedAt));
  await expect(app).toHaveAttribute('data-connection', 'ready', { timeout: left() });
  await expect(page.locator('#overview .status')).toHaveText('Agent Office · 14 characters', { timeout: left() });
  console.log(`ready again after ${String(Date.now() - restartedAt)} ms`);
  expect(await page.evaluate(() => (globalThis as { __marker?: string }).__marker)).toBe('same-page');
});
