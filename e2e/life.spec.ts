// Life spec (#5 plan step 9.1, rpi-cycles §5 done-when, UI-5): with the office alive
// (actors, overlays, meters, bubbles) the frame time (p95 of update+draw, `data-frame-ms`)
// stays under 16 ms in every room of `--sample` (studio: 12 characters, OFFICE-1); a replay makes characters walk, and
// `office:layout` fires again with boxes that follow them (R10); with reduced motion
// `data-moving` is never true for two frames in a row (R5). Shots: var/screens/life-*.png.
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { removeReplayCopies, replayCopies, startCli, type Cli } from './helpers/server.js';

/** Frame-time budget in ms (one 60 Hz frame). */
const FRAME_BUDGET_MS = 16;
const SPEED = 60;

function zoom(testInfo: TestInfo): string {
  return testInfo.project.name === 'desktop-2x' ? '4x' : '2x';
}

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

/** Lets the loop run >= 3 s, then checks the p95 frame time it reports. */
async function expectFrameTime(office: Locator, page: Page, label: string): Promise<void> {
  await page.waitForTimeout(3_200);
  const ms = Number(await office.getAttribute('data-frame-ms'));
  console.log(`life frame-ms ${label}: ${String(ms)}`);
  expect(Number.isFinite(ms)).toBe(true);
  expect(ms).toBeLessThan(FRAME_BUDGET_MS);
}

interface Probe {
  layouts: number;
  /** Layout events whose boxes moved against the previous event's. */
  movedLayouts: number;
  sawMoving: boolean;
  /** Longest run of consecutive animation frames with `data-moving="true"`. */
  maxMovingRun: number;
}

// e2e is type-checked without the DOM lib: browser code reaches the window through the
// #office element passed to `locator.evaluate` (as in controls.spec.ts).

/** Counts `office:layout` events and `data-moving` frames on the page's #office from now on. */
async function installProbe(page: Page): Promise<void> {
  await page.locator('#office').evaluate((office) => {
    const win = office.ownerDocument.defaultView;
    if (win === null) throw new Error('no window');
    const probe = { layouts: 0, movedLayouts: 0, sawMoving: false, maxMovingRun: 0 };
    (win as unknown as { lifeProbe: typeof probe }).lifeProbe = probe;
    let last = new Map<string, string>();
    office.addEventListener('office:layout', (e: unknown) => {
      probe.layouts++;
      const boxes = (e as { detail: { id: string; x: number; y: number }[] }).detail;
      const next = new Map(boxes.map((b) => [b.id, `${String(b.x)},${String(b.y)}`]));
      if ([...next].some(([id, at]) => last.has(id) && last.get(id) !== at)) probe.movedLayouts++;
      last = next;
    });
    let run = 0;
    const tick = (): void => {
      const moving = office.dataset['moving'] === 'true';
      run = moving ? run + 1 : 0;
      probe.sawMoving ||= moving;
      probe.maxMovingRun = Math.max(probe.maxMovingRun, run);
      win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  });
}

const readProbe = (page: Page): Promise<Probe> =>
  page
    .locator('#office')
    .evaluate((office) => (office.ownerDocument.defaultView as unknown as { lifeProbe: Probe }).lifeProbe);

test('the living office stays within the frame budget in both sample rooms', async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  const office = page.locator('#office');
  await expect(office).toHaveAttribute('data-room', 'harbor');
  // 9 characters, 1 ended long ago and tidied (R2); nobody walks on load (R4).
  await expect(office).toHaveAttribute('data-drawn', '8');
  await expect(office).toHaveAttribute('data-moving', 'false');
  await expect(office).toHaveAttribute('data-bubbles', '0');
  await expectFrameTime(office, page, `harbor ${testInfo.project.name}`);
  await office.screenshot({ path: `var/screens/life-harbor-${zoom(testInfo)}.png` });

  await page.getByRole('tab', { name: 'notes-app' }).click();
  await expect(office).toHaveAttribute('data-room', 'notes-app');
  await expect(office).toHaveAttribute('data-drawn', '3');
  await expect(office).toHaveAttribute('data-moving', 'false');
  await expectFrameTime(office, page, `notes-app ${testInfo.project.name}`);
  await office.screenshot({ path: `var/screens/life-notes-app-${zoom(testInfo)}.png` });
  expect(problems).toEqual([]);
});

// OFFICE-1 (#7, U2): the sample's third room `studio` seats 12 characters
// (6 busy at desks, 4 in the kitchen, 2 on the couch); the README quotes this value.
test('frame time with 12 characters', async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  const office = page.locator('#office');
  await page.getByRole('tab', { name: 'studio' }).click();
  await expect(office).toHaveAttribute('data-room', 'studio');
  await expect(office).toHaveAttribute('data-drawn', '12');
  if ((await office.getAttribute('data-overflow')) !== null) await expect(office).toHaveAttribute('data-overflow', '0');
  await expectFrameTime(office, page, `studio 12 characters ${testInfo.project.name}`);
  await office.screenshot({ path: `var/screens/life-studio-${zoom(testInfo)}.png` });
  expect(problems).toEqual([]);
});

let cli: Cli | null = null;
let copiesBefore: Set<string> = new Set();

test.describe('replay', () => {
  test.beforeEach(() => {
    copiesBefore = replayCopies('harness');
  });

  test.afterEach(async () => {
    await cli?.stop();
    cli = null;
    removeReplayCopies('harness', copiesBefore);
  });

  test('walking re-emits office:layout; reduced motion never walks', async ({ page, browser }, testInfo) => {
    test.setTimeout(90_000);
    const problems = watchConsole(page);
    const { viewport, deviceScaleFactor } = testInfo.project.use;
    const reducedContext = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'reduce' });
    const reduced = await reducedContext.newPage();
    const reducedProblems = watchConsole(reduced);

    cli = await startCli(['--replay', 'fixtures/replay/harness', '--speed', String(SPEED)]);
    await Promise.all([page.goto(cli.url), reduced.goto(cli.url)]);
    await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
    await expect(reduced.locator('#app')).toHaveAttribute('data-connection', 'ready');
    await installProbe(page);
    await installProbe(reduced);

    // Characters walk in from the door while the set plays.
    const office = page.locator('#office');
    await expect(office).toHaveAttribute('data-moving', 'true', { timeout: 20_000 });
    await page.waitForTimeout(400);
    await office.screenshot({ path: `var/screens/life-replay-walk-${zoom(testInfo)}.png` });
    const frameMs = Number(await office.getAttribute('data-frame-ms'));
    console.log(`life frame-ms replay walking ${testInfo.project.name}: ${String(frameMs)}`);
    expect(frameMs).toBeLessThan(FRAME_BUDGET_MS);

    const server = cli;
    await expect.poll(() => server.stdout(), { timeout: 30_000 }).toContain('replay finished');
    // Everyone arrives: nobody keeps walking after the set has ended.
    await expect(office).toHaveAttribute('data-moving', 'false', { timeout: 20_000 });

    const walk = await readProbe(page);
    console.log(`life probe ${testInfo.project.name}: ${JSON.stringify(walk)}`);
    expect(walk.sawMoving).toBe(true);
    // The boxes moved between layout events: the event fired while characters walked.
    expect(walk.movedLayouts).toBeGreaterThanOrEqual(2);
    expect(walk.maxMovingRun).toBeGreaterThan(1);

    const still = await readProbe(reduced);
    console.log(`life probe reduced ${testInfo.project.name}: ${JSON.stringify(still)}`);
    expect(still.maxMovingRun).toBeLessThanOrEqual(1);
    await reduced.locator('#office').screenshot({ path: `var/screens/life-replay-reduced-${zoom(testInfo)}.png` });
    await office.screenshot({ path: `var/screens/life-replay-end-${zoom(testInfo)}.png` });
    await reducedContext.close();
    expect(problems).toEqual([]);
    expect(reducedProblems).toEqual([]);
  });
});
