// Keyboard spec (plan step 6.3, UI-5): Tab alone reaches the active project tab,
// every control and every character of the room; ArrowRight on the tablist moves
// to the next project and its characters become reachable; Enter on a character
// opens the card, Esc closes it with focus back on that character.
import { expect, test, type Page } from '@playwright/test';
import type { Snapshot } from '../src/shared/types.js';

/** Most Tab presses per walk. */
const MAX_TABS = 40;

const CONTROLS = ['zoom-fit', 'zoom-1', 'zoom-2', 'zoom-3', 'zoom-4', 'pause', 'sound', 'hide-ended'];

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

/** `tab:<name>`, `control:<name>`, `hotspot:<id>`, or the tag name of the focused element. */
async function focused(page: Page): Promise<string> {
  // e2e is type-checked without the DOM lib: the document is reached through <body>.
  return page.locator('body').evaluate((body): string => {
    const el = body.ownerDocument.activeElement;
    if (!el?.dataset) return 'none';
    if (el.getAttribute('role') === 'tab') return `tab:${el.textContent ?? ''}`;
    if (el.classList.contains('control')) return `control:${el.dataset['control'] ?? ''}`;
    if (el.classList.contains('hotspot')) return `hotspot:${el.dataset['characterId'] ?? ''}`;
    return el.tagName.toLowerCase();
  });
}

/** Presses Tab up to MAX_TABS times; returns every focus stop in order. */
async function tabWalk(page: Page): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    stops.push(await focused(page));
  }
  return stops;
}

/**
 * Ids of the characters in a room's office. The sample's ended characters ended hours ago,
 * so their desks are tidied (#5, R2): they are not in the room and have no hotspot.
 */
function idsIn(snapshot: Snapshot, name: string): string[] {
  const project = snapshot.projects.find((p) => p.name === name);
  return snapshot.characters.filter((c) => c.projectId === project?.id && c.status !== 'ended').map((c) => c.id);
}

test('keyboard alone reaches every tab, control and character', async ({ page }) => {
  const problems = watchConsole(page);
  const res = await page.request.get('/api/snapshot');
  const snapshot = (await res.json()) as Snapshot;
  const harbor = idsIn(snapshot, 'harbor');
  const notes = idsIn(snapshot, 'notes-app');
  expect(harbor).toHaveLength(8);
  expect(notes).toHaveLength(3);

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-connection', 'ready');
  await expect(page.locator('#room .hotspot')).toHaveCount(8);

  // Roving tabindex: only the active tab is a Tab stop.
  const stops = await tabWalk(page);
  expect(stops).toContain('tab:harbor');
  expect(stops).not.toContain('tab:notes-app');
  for (const c of CONTROLS) expect(stops).toContain(`control:${c}`);
  for (const id of harbor) expect(stops).toContain(`hotspot:${id}`);

  // ArrowRight on the tablist selects notes-app; its 3 characters in the room become reachable.
  const notesTab = page.getByRole('tab', { name: 'notes-app' });
  await page.getByRole('tab', { name: 'harbor' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(notesTab).toHaveAttribute('aria-selected', 'true');
  await expect(notesTab).toBeFocused();
  await expect(page.locator('#office')).toHaveAttribute('data-room', 'notes-app');
  await expect(page.locator('#room .hotspot')).toHaveCount(3);
  const notesStops = await tabWalk(page);
  for (const id of notes) expect(notesStops).toContain(`hotspot:${id}`);
  for (const id of harbor) expect(notesStops).not.toContain(`hotspot:${id}`);

  // Tab to the first character, Enter opens its card, Esc closes it and focus stays on it.
  await notesTab.focus();
  let stop = '';
  for (let i = 0; i < MAX_TABS && !stop.startsWith('hotspot:'); i++) {
    await page.keyboard.press('Tab');
    stop = await focused(page);
  }
  expect(stop).toMatch(/^hotspot:/);
  const id = stop.slice('hotspot:'.length);
  const spot = page.locator(`#room .hotspot[data-character-id="${id}"]`);
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector > article.card')).toHaveAttribute('data-character-id', id);
  await expect(spot).toHaveAttribute('aria-expanded', 'true');
  await expect(spot).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector > article.card')).toHaveCount(0);
  await expect(spot).toBeFocused();
  expect(problems).toEqual([]);
});
