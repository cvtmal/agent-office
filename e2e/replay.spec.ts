// Replay spec (plan step 9.3, DATA-9 done-when): `--replay fixtures/replay/harness --speed 60`
// plays the 12-minute set in 12 s; the office ends with the set's final characters (read in one
// go by test/replay-set.ts, with the live windows active at the end), all drawn, and the server
// prints `replay finished`. The end state is shot at 2x (`desktop`) and 4x (`desktop-2x`) for the
// visual check: .rpi-tracking/screens/live-api/replay-end-<n>x.png.
import { expect, test, type Page } from '@playwright/test';
import { readSet } from '../test/replay-set.js';
import { removeReplayCopies, replayCopies, startCli, type Cli } from './helpers/server.js';

const SPEED = 60;
const set = readSet('harness', { live: 'end' });
const final = set.snapshot;
/** Wall time of the set at SPEED (720 s / 60 = 12 s). */
const playMs = set.manifest.durationMs / SPEED;

let cli: Cli | null = null;
let copiesBefore: Set<string> = new Set();

test.beforeEach(() => {
  copiesBefore = replayCopies('harness');
});

test.afterEach(async () => {
  await cli?.stop();
  cli = null;
  removeReplayCopies('harness', copiesBefore);
});

async function characterCount(page: Page): Promise<number> {
  const text = (await page.locator('#overview .status').textContent()) ?? '';
  const match = /(\d+) characters/.exec(text);
  return match?.[1] === undefined ? -1 : Number(match[1]);
}

test('a replay at speed 60 ends with the set’s final characters drawn', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  expect(final.projects).toHaveLength(1);
  const room = final.projects[0]?.name ?? '';

  cli = await startCli(['--replay', 'fixtures/replay/harness', '--speed', String(SPEED)]);
  await page.goto(cli.url);
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');

  // Characters appear while the set plays.
  await expect.poll(() => characterCount(page), { timeout: playMs + 10_000 }).toBeGreaterThan(0);

  const server = cli;
  await expect.poll(() => server.stdout(), { timeout: playMs + 20_000 }).toContain('replay finished');
  await expect.poll(() => characterCount(page), { timeout: 5_000 }).toBe(final.characters.length);

  const office = page.locator('#office');
  await expect(office).toHaveAttribute('data-room', room);
  // Ended characters walk out of the door and are not drawn (#5, R2/R4).
  const inRoom = final.characters.filter((c) => c.status !== 'ended').length;
  await expect(office).toHaveAttribute('data-drawn', String(inRoom), { timeout: 15_000 });
  await expect(office).toHaveAttribute('data-overflow', '0');

  const zoom = testInfo.project.name === 'desktop-2x' ? '4x' : '2x';
  await page.screenshot({ path: `.rpi-tracking/screens/live-api/replay-end-${zoom}.png` });
});
