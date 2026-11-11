// Inspector spec (plan step 6.1, UI-1 and UI-2 done-when): clicking a character
// opens a card whose fields and activities equal `/api/snapshot`; Esc, another
// character and a click outside behave; the overview strip shows the counts,
// highest verdict and drift sign computed from the same snapshot. The shots go to
// var/screens/inspector-<project>.png. No console errors or warnings.
import { expect, test, type Page } from '@playwright/test';
import { THRESHOLDS, VERDICTS } from '../src/shared/constants.js';
import type { Character, Snapshot } from '../src/shared/types.js';

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

async function fetchSnapshot(page: Page): Promise<Snapshot> {
  const res = await page.request.get('/api/snapshot');
  expect(res.ok()).toBe(true);
  return (await res.json()) as Snapshot;
}

function byName(snapshot: Snapshot, name: string): Character {
  const c = snapshot.characters.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no character ${name} in the snapshot`);
  return c;
}

function hotspot(page: Page, c: Character) {
  return page.locator(`#room .hotspot[data-character-id="${c.id}"]`);
}

/** The card of `c` equals the snapshot: fields, bar and activities (newest first, at most 10). */
async function expectCard(page: Page, snapshot: Snapshot, c: Character): Promise<void> {
  const card = page.locator('#inspector > article.card');
  await expect(card).toHaveAttribute('data-character-id', c.id);
  const field = (name: string) => card.locator(`[data-field="${name}"]`);
  const project = snapshot.projects.find((p) => p.id === c.projectId);
  const lane = c.lane === null ? '—' : `${c.lane.letter} · ${c.lane.slug} · :${String(c.lane.port)}`;

  await expect(card.locator('h2#inspector-name')).toHaveText(c.name);
  await expect(field('name')).toHaveText(c.name);
  await expect(field('kind')).toHaveText(c.kind);
  await expect(field('role')).toHaveText(c.role);
  await expect(field('project')).toHaveText(project?.name ?? '');
  await expect(field('lane')).toHaveText(lane);
  await expect(field('status')).toHaveText(c.status);
  await expect(field('tokens')).toHaveText(c.tokens.toLocaleString('en-US'));
  await expect(field('verdict')).toHaveText(c.verdict);
  await expect(field('where')).toHaveText(c.where === '' ? '—' : c.where);
  await expect(field('branch')).toHaveText(c.gitBranch ?? '—');
  await expect(field('age')).toHaveText(/^(\d+[smhd] ago|—)$/);
  if (c.agentType === null) await expect(field('agentType')).toHaveCount(0);
  else await expect(field('agentType')).toHaveText(c.agentType);

  const max = c.role === 'cto' ? THRESHOLDS.cto.handover : THRESHOLDS.teammate.recycle;
  const pct = Math.min(100, Math.round((c.tokens / max) * 100));
  await expect(card.locator('div.bar[role="meter"]')).toHaveAttribute('aria-valuenow', String(pct));

  const portrait = card.locator('canvas.portrait');
  await expect(portrait).toHaveAttribute('width', '48');
  await expect(portrait).toHaveAttribute('height', '48');

  const activities = snapshot.activities
    .filter((a) => a.characterId === c.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10);
  const rows = card.locator('ol.activities > li:not(.hint)');
  await expect(rows).toHaveCount(activities.length);
  if (activities.length === 0) await expect(card.locator('ol.activities > li.hint')).toHaveText('No activity yet');
  await expect(rows.locator('span.tool')).toHaveText(activities.map((a) => a.tool));
  await expect(rows.locator('span.target')).toHaveText(activities.map((a) => a.target));
  expect(await rows.locator('img.icon').evaluateAll((els) => els.map((e) => e.getAttribute('alt')))).toEqual(
    activities.map((a) => a.kind),
  );
  const times = await rows.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime') ?? ''));
  expect(times.map((t) => Date.parse(t))).toEqual(activities.map((a) => Date.parse(a.at)));
}

test('the card shows the clicked character as in /api/snapshot', async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  const snapshot = await fetchSnapshot(page);
  const cto = snapshot.characters.find((c) => c.role === 'cto');
  if (cto === undefined) throw new Error('the sample has no CTO');
  const agent = byName(snapshot, 'explore-imports');
  expect(agent.projectId).toBe(cto.projectId);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#inspector > p.hint')).toHaveText('Click a character');

  // Open the CTO's card.
  await page.getByRole('button', { name: new RegExp(`^${cto.name}, `) }).click();
  await expectCard(page, snapshot, cto);
  await expect(hotspot(page, cto)).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: `var/screens/inspector-${testInfo.project.name}.png` });

  // Esc closes and gives focus back to the hotspot.
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector > article.card')).toHaveCount(0);
  await expect(page.locator('#inspector > p.hint')).toHaveText('Click a character');
  await expect(hotspot(page, cto)).toBeFocused();
  await expect(hotspot(page, cto)).toHaveAttribute('aria-expanded', 'false');

  // A click on another character switches the card.
  await hotspot(page, cto).click();
  await expectCard(page, snapshot, cto);
  await hotspot(page, agent).click();
  await expectCard(page, snapshot, agent);
  await expect(hotspot(page, cto)).toHaveAttribute('aria-expanded', 'false');

  // A click on an empty spot of #overview closes it.
  const overview = page.locator('#overview');
  const box = await overview.boundingBox();
  if (box === null) throw new Error('#overview has no box');
  const spot = { x: 2, y: 2 };
  // (Browser code reaches the document through the element: e2e is type-checked without the DOM lib.)
  expect(
    await overview.evaluate(
      (el, [x, y]) => el.ownerDocument.elementFromPoint(x, y)?.id,
      [box.x + spot.x, box.y + spot.y] as const,
    ),
  ).toBe('overview');
  await overview.click({ position: spot });
  await expect(page.locator('#inspector > article.card')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the strip shows counts, top verdict and drift per project as in /api/snapshot', async ({ page }) => {
  const problems = watchConsole(page);
  const snapshot = await fetchSnapshot(page);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  const items = page.locator('#overview ul.strip > li');
  await expect(items).toHaveCount(snapshot.projects.length);

  const seen: Record<string, { counts: string; verdict: string; drift: string | null }> = {};
  for (const p of snapshot.projects) {
    const chars = snapshot.characters.filter((c) => c.projectId === p.id);
    const n = (...statuses: string[]): number => chars.filter((c) => statuses.includes(c.status)).length;
    const counts = `${String(n('busy'))} busy · ${String(n('idle', 'waiting', 'stopped'))} idle · ${String(n('ended'))} ended`;
    const verdict = VERDICTS[chars.reduce((max, c) => Math.max(max, VERDICTS.indexOf(c.verdict)), -1)] ?? '';
    const pct = p.health.lines > 0 ? Math.round((p.health.failed / p.health.lines) * 100) : 0;

    const li = page.locator(`#overview ul.strip > li[data-project-id="${p.id}"]`);
    await expect(li).toHaveAttribute('data-drift', String(p.health.drift));
    await expect(li.locator('.strip-name')).toHaveText(p.name);
    await expect(li.locator('.strip-counts')).toHaveText(counts);
    await expect(li.locator('.chip')).toHaveText(verdict);
    await expect(li.locator('.chip')).toHaveClass(new RegExp(`\\bverdict-${verdict.toLowerCase()}\\b`));
    if (p.health.drift) await expect(li.locator('.drift')).toHaveText(`format drift ${String(pct)} %`);
    else await expect(li.locator('.drift')).toHaveCount(0);
    seen[p.name] = { counts, verdict, drift: p.health.drift ? `format drift ${String(pct)} %` : null };
  }

  // The sample's known values (fixtures/snapshots/sample.json).
  expect(seen).toEqual({
    harbor: { counts: '4 busy · 4 idle · 1 ended', verdict: 'HANDOVER', drift: null },
    'notes-app': { counts: '1 busy · 2 idle · 2 ended', verdict: 'WARN', drift: 'format drift 8 %' },
  });
  expect(problems).toEqual([]);
});
