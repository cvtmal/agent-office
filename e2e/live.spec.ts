// Live spec (plan step 9.2, DATA-5 done-when): a change in the config dir reaches the browser
// within 2 s. The server runs on a free port against a copy of fixtures/transcripts/config
// (e2e/helpers/server.ts); the spec writes only into that copy under var/e2e/.
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { jsonl, Transcript } from '../fixtures/gen/records.js';
import { syntheticUuid } from '../fixtures/gen/sample.js';
import { slug } from '../fixtures/gen/transcripts.js';
import { startCli, tempConfig, type Cli, type TempConfig } from './helpers/server.js';

/** DATA-5: a change reaches the browser within this many ms. */
const LIVE_MS = 2_000;

let cfg: TempConfig;
let cli: Cli;

const desktop = (): boolean => test.info().project.name === 'desktop';

test.beforeEach(async () => {
  // The timing check needs no second viewport (plan: green in `desktop`).
  test.skip(!desktop(), 'desktop only');
  cfg = tempConfig(`live-${test.info().project.name}`);
  cli = await startCli(cfg.args, cfg.env);
});

test.afterEach(async () => {
  if (!desktop()) return;
  await cli.stop();
  cfg.cleanup();
});

async function characterCount(page: Page): Promise<number> {
  const text = (await page.locator('#overview .status').textContent()) ?? '';
  const match = /(\d+) characters/.exec(text);
  return match?.[1] === undefined ? -1 : Number(match[1]);
}

async function openReady(page: Page): Promise<number> {
  await page.goto(cli.url);
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#overview .status')).toContainText(' characters');
  return characterCount(page);
}

test('a new session transcript adds a character within 2 s', async ({ page }) => {
  const n = await openReady(page);
  expect(n).toBeGreaterThanOrEqual(0);

  const cwd = '/home/dev/code/gamma';
  const sessionId = syntheticUuid('e2e-live:new-session');
  const t = new Transcript({ seed: 'e2e-live:new-session', sessionId, cwd });
  // Current timestamps: the session must count as recent for the default max age. The reader
  // places a session that is not live only once it has usage, so the user record is followed
  // by one assistant record with usage.
  const now = new Date().toISOString();
  const records = [t.prompt('Start the live check.'), t.assistantText('end_turn', 1000, 'Started.')].map((r) => ({ ...r, timestamp: now }));
  const dir = join(cfg.cfgDir, 'projects', slug(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), jsonl(records));

  await expect.poll(() => characterCount(page), { timeout: LIVE_MS, intervals: [50] }).toBe(n + 1);
});

// Deltas keep `generatedAt` (live/diff.ts), so the append is observed through the character it
// changes: a new tool call is a new activity, which moves #app[data-last-activity-at].
test('a line appended to a transcript updates its character within 2 s', async ({ page }) => {
  await openReady(page);
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-last-activity-at', /\d{4}-\d\d-\d\dT/);
  const before = await app.getAttribute('data-last-activity-at');

  const dir = join(cfg.cfgDir, 'projects', slug('/home/dev/code/beta'));
  const file = readdirSync(dir).find((name) => name.endsWith('.jsonl'));
  expect(file).toBeDefined();
  const sessionId = (file ?? '').replace(/\.jsonl$/, '');
  const t = new Transcript({ seed: 'e2e-live:append', sessionId, cwd: '/home/dev/code/beta' });
  const { rec } = t.toolUse('Read', { file_path: '/home/dev/code/beta/README.md' }, 1000);
  const at = new Date().toISOString();
  appendFileSync(join(dir, file ?? ''), jsonl([{ ...rec, timestamp: at }]));

  await expect.poll(() => app.getAttribute('data-last-activity-at'), { timeout: LIVE_MS, intervals: [50] }).toBe(at);
  expect(before).not.toBe(at);
});
