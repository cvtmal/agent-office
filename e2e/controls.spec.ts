// Controls spec (plan step 6.2, UI-3 and UI-5): zoom, hide ended, pause and sound
// each work and survive a reload (prefs in localStorage); a throwing localStorage
// does not stop the app; prefers-reduced-motion holds the idle frames without
// pause. "Holds" is checked with a hash of the canvas pixels under an idle
// character's hotspot box. No console errors or warnings.
import { expect, test, type Page } from '@playwright/test';
import type { Snapshot } from '../src/shared/types.js';

/** How long a held frame must stay unchanged, in ms. */
const HOLD_MS = 1_500;

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

/** Id of the first idle character of the project named `name`. */
function idleIn(snapshot: Snapshot, name: string): string {
  const project = snapshot.projects.find((p) => p.name === name);
  const c = snapshot.characters.find((x) => x.projectId === project?.id && x.status === 'idle');
  if (c === undefined) throw new Error(`no idle character in ${name}`);
  return c.id;
}

// e2e is type-checked without the DOM lib: browser code reaches the document and
// window through the #office element passed to `locator.evaluate`.

/** FNV-1a hash of the canvas pixels under the hotspot box of character `id` (scene pixels). */
async function regionHash(page: Page, id: string): Promise<string> {
  return page.locator('#office').evaluate((canvas, characterId): string => {
    const doc = canvas.ownerDocument;
    const spot = doc.querySelector(`#room .hotspot[data-character-id="${characterId}"]`);
    if (!spot) throw new Error('no hotspot');
    const pct = (v: string): number => parseFloat(v) / 100;
    const x = Math.floor(pct(spot.style.left) * canvas.width);
    const y = Math.floor(pct(spot.style.top) * canvas.height);
    const w = Math.ceil(pct(spot.style.width) * canvas.width);
    const h = Math.ceil(pct(spot.style.height) * canvas.height);
    // Read through a fresh copy: repeated getImageData on #office itself makes
    // Chrome warn about willReadFrequently.
    const copy = doc.createElement('canvas');
    copy.width = w;
    copy.height = h;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    const data: ArrayLike<number> = ctx.getImageData(0, 0, w, h).data;
    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ (data[i] ?? 0), 0x01000193) >>> 0;
    return `${String(w)}x${String(h)}:${hash.toString(16)}`;
  }, id);
}

/** Waits two animation frames, so a state change has been drawn. */
async function settle(page: Page): Promise<void> {
  await page.locator('#office').evaluate((canvas) => {
    const win = canvas.ownerDocument.defaultView;
    return new Promise<void>((done) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => done())));
  });
}

/** Counts writes of `data-frame-ms` on #office over `ms` (the loop reports once a second). */
async function frameReports(page: Page, ms: number): Promise<number> {
  return page.locator('#office').evaluate(
    (office, wait) =>
      new Promise<number>((done) => {
        let n = 0;
        const win = office.ownerDocument.defaultView;
        const obs = new win.MutationObserver((records: unknown[]) => (n += records.length));
        obs.observe(office, { attributes: true, attributeFilter: ['data-frame-ms'] });
        setTimeout(() => {
          obs.disconnect();
          done(n);
        }, wait);
      }),
    ms,
  );
}

/** The idle character's pixels hold for HOLD_MS while the loop keeps running. */
async function expectHeld(page: Page, id: string): Promise<void> {
  await settle(page);
  const before = await regionHash(page, id);
  expect(await frameReports(page, HOLD_MS)).toBeGreaterThan(0);
  expect(await regionHash(page, id)).toBe(before);
}

/** The idle character's pixels change while animated (proves the hash sees the idle frames). */
async function expectAnimated(page: Page, id: string): Promise<void> {
  const before = await regionHash(page, id);
  await expect.poll(() => regionHash(page, id), { timeout: 3_000, intervals: [100] }).not.toBe(before);
}

test('each control works and survives a reload', async ({ page }) => {
  const problems = watchConsole(page);
  const snapshot = await fetchSnapshot(page);
  const office = page.locator('#office');
  const control = (name: string) => page.locator(`#overview .controls button.control[data-control="${name}"]`);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(office).toHaveAttribute('data-scale', '2');
  await expect(control('zoom-fit')).toHaveAttribute('aria-pressed', 'true');

  // Zoom: 3x, back to fit (2 at 1280x800), then 3x again for the reload check.
  await control('zoom-3').click();
  await expect(office).toHaveAttribute('data-scale', '3');
  await expect(control('zoom-3')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('zoom-fit')).toHaveAttribute('aria-pressed', 'false');
  await control('zoom-fit').click();
  await expect(office).toHaveAttribute('data-scale', '2');
  await control('zoom-3').click();
  await expect(office).toHaveAttribute('data-scale', '3');

  // Hide ended: harbor 8, notes-app 3. The sample's ended characters ended hours ago, so
  // their desks are already tidied (#5, R2) and hiding them changes no count here.
  await expect(office).toHaveAttribute('data-drawn', '8');
  await control('hide-ended').click();
  await expect(control('hide-ended')).toHaveAttribute('aria-pressed', 'true');
  await expect(office).toHaveAttribute('data-drawn', '8');
  await page.getByRole('tab', { name: 'notes-app' }).click();
  await expect(office).toHaveAttribute('data-room', 'notes-app');
  await expect(office).toHaveAttribute('data-drawn', '3');

  // Pause: the loop still reports frames, the idle character's pixels hold.
  const idle = idleIn(snapshot, 'notes-app');
  await expect(page.locator(`#room .hotspot[data-character-id="${idle}"]`)).toHaveCount(1);
  await expectAnimated(page, idle);
  await control('pause').click();
  await expect(control('pause')).toHaveAttribute('aria-pressed', 'true');
  await expectHeld(page, idle);

  // Sound: a switch only.
  await expect(control('sound')).toHaveText('Sound off');
  await control('sound').click();
  await expect(control('sound')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('sound')).toHaveText('Sound on');

  // Reload: every pref and the tab come back.
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(office).toHaveAttribute('data-scale', '3');
  await expect(control('zoom-3')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('hide-ended')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('pause')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('sound')).toHaveAttribute('aria-pressed', 'true');
  await expect(control('sound')).toHaveText('Sound on');
  await expect(page.getByRole('tab', { name: 'notes-app' })).toHaveAttribute('aria-selected', 'true');
  await expect(office).toHaveAttribute('data-room', 'notes-app');
  await expect(office).toHaveAttribute('data-drawn', '3');
  await expect(page.locator(`#room .hotspot[data-character-id="${idle}"]`)).toHaveCount(1);
  await expectHeld(page, idle);
  expect(problems).toEqual([]);
});

test('a localStorage that throws does not stop the app', async ({ page }) => {
  const problems = watchConsole(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked');
      },
    });
  });

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#office')).toHaveAttribute('data-drawn', '8');
  // Controls still work; their state just is not remembered.
  await page.locator('#overview button.control[data-control="zoom-3"]').click();
  await expect(page.locator('#office')).toHaveAttribute('data-scale', '3');
  await page.locator('#overview button.control[data-control="pause"]').click();
  await expect(page.locator('#overview button.control[data-control="pause"]')).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('reduced motion holds the idle frames without pause', async ({ page }) => {
  const problems = watchConsole(page);
  const snapshot = await fetchSnapshot(page);
  const idle = idleIn(snapshot, 'harbor');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#office')).toHaveAttribute('data-room', 'harbor');
  await expect(page.locator(`#room .hotspot[data-character-id="${idle}"]`)).toHaveCount(1);
  await expect(page.locator('#overview button.control[data-control="pause"]')).toHaveAttribute('aria-pressed', 'false');
  await expectHeld(page, idle);

  // The media query applies live: without it the character animates again.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectAnimated(page, idle);
  expect(problems).toEqual([]);
});
