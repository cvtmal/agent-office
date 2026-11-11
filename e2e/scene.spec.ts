// Scene spec (plan step 15.1, OFFICE-1): the office draws both rooms of the sample,
// switched with the project tabs, at scale 2 (project `desktop`, 2x), 4 device pixels
// per scene pixel (`desktop-2x`, 4x) and scale 1 (800x600 viewport, 1x); the frame
// time (p95 of update+draw, `data-frame-ms`) stays under 16 ms in harbor and in the
// looks gallery. The shots feed the G2 set (P-14): var/screens/office-<room>-<n>x.png
// and var/screens/looks-<n>x.png. No console errors or warnings.
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Frame-time budget in ms (one 60 Hz frame). */
const FRAME_BUDGET_MS = 16;

/** Device pixels per scene pixel of the project's default 1280x800 viewport: 2x, or 4x at DPR 2. */
function zoom(testInfo: TestInfo): string {
  return testInfo.project.name === 'desktop-2x' ? '4x' : '2x';
}

async function shoot(office: Locator, prefix: string, suffix: string): Promise<void> {
  const room = (await office.getAttribute('data-room')) ?? 'room';
  await office.screenshot({ path: `var/screens/${prefix}${room}-${suffix}.png` });
}

/** Lets the loop run >= 3 s, then checks the p95 frame time it reports. */
async function expectFrameTime(office: Locator, page: Page): Promise<void> {
  await page.waitForTimeout(3_200);
  const ms = Number(await office.getAttribute('data-frame-ms'));
  console.log(`frame-ms ${String(await office.getAttribute('data-room'))}: ${String(ms)}`);
  expect(Number.isFinite(ms)).toBe(true);
  expect(ms).toBeLessThan(FRAME_BUDGET_MS);
}

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

test('office draws both rooms at every scale, switched by the project tabs', async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  const n = zoom(testInfo);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  const office = page.locator('#office');
  await expect(office).toHaveAttribute('data-scale', '2');
  // The sample's first project: harbor, 9 characters. Its ended one (quick-fix) ended hours
  // ago, so its desk is tidied (#5, R2): 8 drawn; notes-app 5 - 2 tidied = 3.
  await expect(office).toHaveAttribute('data-room', 'harbor');
  await expect(office).toHaveAttribute('data-drawn', '8');
  await expect(office).toHaveAttribute('data-overflow', '0');
  await expectFrameTime(office, page);
  await shoot(office, 'office-', n);

  // Three projects → three tabs next to the status line, the first one selected.
  const overview = page.locator('#overview');
  await expect(overview).toContainText('26 characters');
  const tabs = page.getByRole('tablist', { name: 'Projects' }).getByRole('tab');
  await expect(tabs).toHaveText(['harbor', 'notes-app', 'studio']);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await overview.screenshot({ path: `var/screens/scene-tabs-${testInfo.project.name}.png` });

  await page.getByRole('tab', { name: 'notes-app' }).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(office).toHaveAttribute('data-room', 'notes-app');
  await expect(office).toHaveAttribute('data-drawn', '3');
  await expect(overview).toContainText('26 characters');
  await shoot(office, 'office-', n);

  if (testInfo.project.name === 'desktop') {
    // 800x600 leaves room for scale 1 only: one device pixel per scene pixel.
    await page.setViewportSize({ width: 800, height: 600 });
    await expect(office).toHaveAttribute('data-scale', '1');
    await shoot(office, 'office-', '1x');
    await page.getByRole('tab', { name: 'harbor' }).click();
    await expect(office).toHaveAttribute('data-room', 'harbor');
    await expect(office).toHaveAttribute('data-drawn', '8');
    await shoot(office, 'office-', '1x');
  } else {
    await page.getByRole('tab', { name: 'harbor' }).click();
    await expect(office).toHaveAttribute('data-room', 'harbor');
    await expect(office).toHaveAttribute('data-drawn', '8');
  }
  expect(problems).toEqual([]);
});

test('the looks gallery draws 44 characters within the frame budget', async ({ page }, testInfo) => {
  const problems = watchConsole(page);

  await page.goto('/?view=looks');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  const office = page.locator('#office');
  await expect(office).toHaveAttribute('data-room', 'looks');
  await expect(office).toHaveAttribute('data-scale', '2');
  // 30 gallery looks + the first 15 of the sample's 26 characters (one row).
  await expect(office).toHaveAttribute('data-drawn', '45');
  await expectFrameTime(office, page);
  await office.screenshot({ path: `var/screens/looks-${zoom(testInfo)}.png` });
  expect(problems).toEqual([]);
});
