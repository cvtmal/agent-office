// The inspector card (UI-1): the selected character as plain fields, built from
// the snapshot and the UI state (research Q1, R3, R4, R9). `cardModel` is pure;
// `mountInspector` renders it into #inspector with createElement / textContent.
// Esc or a pointerdown outside the card and the hotspots closes it (R9).
import { THRESHOLDS, type ActivityKind, type CharacterKind, type Role, type Status, type Verdict } from '../../shared/constants.js';
import type { Character, LaneRef, Snapshot } from '../../shared/types.js';
import type { AppState, Store, UiState } from '../app/store.js';
import { lookFor } from '../office/look.js';
import { selectProject } from '../office/scene.js';
import type { Raster } from '../render/raster.js';
import { portraitFor } from '../sprites/characters/portrait.js';
import { ICON_SIZE, iconId } from '../sprites/icons/index.js';
import { rasterizeSprite, spriteById } from '../sprites/registry.js';

/** Most activities listed on the card. */
export const CARD_ACTIVITIES = 10;

/** Placeholder for an unknown value. */
export const NONE = '—';

export interface CardActivity {
  kind: ActivityKind;
  tool: string;
  target: string;
  /** Local `HH:MM`. */
  clock: string;
  /** ISO time of the call. */
  at: string;
}

export interface CardModel {
  id: string;
  name: string;
  kind: CharacterKind;
  role: Role;
  /** Project name. */
  project: string;
  /** `A · <slug> · :<port>`, or "—". */
  lane: string;
  status: Status;
  tokens: number;
  verdict: Verdict;
  /** Token bar fill, 0-100, against the role's last threshold (R4). */
  barPct: number;
  /** `4m ago` from the newest of last activity / last usage, or "—" (R3). */
  age: string;
  /** ISO time behind `age` (for `title`), or null. */
  ageIso: string | null;
  /** Working directory relative to the project root (`Character.where`), or "—". */
  where: string;
  /** Git branch, or "—". */
  branch: string;
  /** Agent type for agents, else null. */
  agentType: string | null;
  /** Newest first, at most `CARD_ACTIVITIES`. */
  activities: CardActivity[];
}

/** Relative age of `ms` milliseconds: `59s ago`, `4m ago`, `3h ago`, `2d ago` (floored, never negative). */
export function ageText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${String(s)}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${String(m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${String(h)}h ago`;
  return `${String(Math.floor(h / 24))}d ago`;
}

/** Local `HH:MM` of an ISO time. */
export function clock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The role's last threshold: the token count the bar is full at. */
function barMax(role: Role): number {
  return role === 'cto' ? THRESHOLDS.cto.handover : THRESHOLDS.teammate.recycle;
}

function laneText(lane: LaneRef | null): string {
  return lane === null ? NONE : `${lane.letter} · ${lane.slug} · :${String(lane.port)}`;
}

/** The newest of the character's last activity and last usage, or null. */
function lastSeen(c: Character): string | null {
  const times = [c.lastActivityAt, c.lastUsageAt].filter((t): t is string => t !== null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/**
 * The card of `ui.selectedId`, or null when nothing is selected, the character is
 * not in the snapshot or not in the active project, or it is ended while hidden.
 */
export function cardModel(snapshot: Snapshot | null, ui: UiState, now: number): CardModel | null {
  if (snapshot === null || ui.selectedId === null) return null;
  const c = snapshot.characters.find((x) => x.id === ui.selectedId);
  if (c === undefined) return null;
  const project = selectProject(snapshot, ui.activeProjectId);
  if (project === null || c.projectId !== project.id) return null;
  if (ui.hideEnded && c.status === 'ended') return null;

  const seen = lastSeen(c);
  const activities = snapshot.activities
    .filter((a) => a.characterId === c.id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, CARD_ACTIVITIES)
    .map((a) => ({ kind: a.kind, tool: a.tool, target: a.target, clock: clock(a.at), at: a.at }));

  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    role: c.role,
    project: project.name,
    lane: laneText(c.lane),
    status: c.status,
    tokens: c.tokens,
    verdict: c.verdict,
    barPct: Math.min(100, Math.round((c.tokens / barMax(c.role)) * 100)),
    age: seen === null ? NONE : ageText(now - Date.parse(seen)),
    ageIso: seen,
    where: c.where === '' ? NONE : c.where,
    branch: c.gitBranch ?? NONE,
    agentType: c.agentType,
    activities,
  };
}

/** Age re-render interval in ms. */
export const AGE_TICK_MS = 15_000;

/** CSS class of a verdict (`verdict-ok`, ...): sets `--verdict` in ui/shell.css. */
export function verdictClass(v: Verdict): string {
  return `verdict-${v.toLowerCase()}`;
}

export interface InspectorOptions {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearTimer?: (id: ReturnType<typeof setInterval>) => void;
}

function paint(canvas: HTMLCanvasElement, r: Raster): void {
  canvas.width = r.w;
  canvas.height = r.h;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
}

/** One 8x8 data URL per activity kind, made once (R10). */
const iconUrls = new Map<ActivityKind, string>();
function iconUrl(doc: Document, kind: ActivityKind): string {
  let url = iconUrls.get(kind);
  if (url === undefined) {
    const def = spriteById(iconId(kind));
    const canvas = doc.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    if (def) paint(canvas, rasterizeSprite(def));
    url = canvas.toDataURL();
    iconUrls.set(kind, url);
  }
  return url;
}

/** Portrait pixels per character id (looks never change for an id). */
const portraits = new Map<string, Raster>();
function portraitOf(id: string, kind: CharacterKind): Raster {
  let r = portraits.get(id);
  if (r === undefined) {
    const intern = kind === 'agent';
    r = portraitFor(lookFor(id, intern), intern);
    portraits.set(id, r);
  }
  return r;
}

export function mountInspector(el: HTMLElement, store: Store, options: InspectorOptions = {}): () => void {
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
  const clearTimer = options.clearTimer ?? ((id: ReturnType<typeof setInterval>) => clearInterval(id));
  const doc = el.ownerDocument;

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (className !== undefined) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const field = (dl: HTMLDListElement, label: string, name: string, value: string): HTMLElement => {
    const dd = make('dd', undefined, value);
    dd.dataset['field'] = name;
    dl.append(make('dt', undefined, label), dd);
    return dd;
  };

  const card = (m: CardModel, at: number): HTMLElement => {
    const article = make('article', 'card');
    article.setAttribute('aria-labelledby', 'inspector-name');
    article.dataset['characterId'] = m.id;

    const head = make('header', 'card-head');
    const portrait = make('canvas', 'portrait');
    portrait.setAttribute('role', 'img');
    portrait.setAttribute('aria-label', `Portrait of ${m.name}`);
    paint(portrait, portraitOf(m.id, m.kind));
    const title = make('div', 'card-title');
    const name = make('h2', undefined, m.name);
    name.id = 'inspector-name';
    name.dataset['field'] = 'name';
    const roleLine = make('p', 'card-role');
    const kind = make('span', undefined, m.kind);
    kind.dataset['field'] = 'kind';
    const role = make('span', undefined, m.role);
    role.dataset['field'] = 'role';
    roleLine.append(kind, ' · ', role);
    title.append(name, roleLine);
    head.append(portrait, title);

    const dl = make('dl', 'fields');
    field(dl, 'Project', 'project', m.project);
    field(dl, 'Lane', 'lane', m.lane);
    field(dl, 'Status', 'status', m.status);
    field(dl, 'Tokens', 'tokens', m.tokens.toLocaleString('en-US'));
    field(dl, 'Verdict', 'verdict', m.verdict).classList.add('verdict', verdictClass(m.verdict));
    const age = field(dl, 'Age', 'age', m.age);
    if (m.ageIso !== null) age.title = m.ageIso;
    field(dl, 'Where', 'where', m.where);
    field(dl, 'Branch', 'branch', m.branch);
    if (m.agentType !== null) field(dl, 'Agent type', 'agentType', m.agentType);

    const bar = make('div', `bar ${verdictClass(m.verdict)}`);
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', 'Context used');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(m.barPct));
    const fill = make('div', 'bar-fill');
    fill.style.width = `${String(m.barPct)}%`;
    bar.append(fill);

    const heading = make('h3', undefined, 'Recent activity');
    const list = make('ol', 'activities');
    for (const a of m.activities) {
      const li = make('li');
      const icon = make('img', 'icon');
      icon.src = iconUrl(doc, a.kind);
      icon.alt = a.kind;
      icon.width = ICON_SIZE;
      icon.height = ICON_SIZE;
      const time = make('time', undefined, a.clock);
      time.dateTime = a.at;
      time.title = ageText(at - Date.parse(a.at));
      li.append(icon, make('span', 'tool', a.tool), make('span', 'target', a.target), time);
      list.append(li);
    }
    if (m.activities.length === 0) list.append(make('li', 'hint', 'No activity yet'));

    article.append(head, dl, bar, heading, list);
    return article;
  };

  let key = '';
  const render = (state: AppState): void => {
    const at = now();
    const model = cardModel(state.snapshot, state.ui, at);
    if (model === null && state.ui.selectedId !== null) {
      // The character left the snapshot, the room or was hidden (R9).
      store.setUi({ selectedId: null });
      return;
    }
    const ages = model?.activities.map((a) => ageText(at - Date.parse(a.at))) ?? [];
    const next = JSON.stringify({ model, ages });
    if (next === key) return;
    key = next;
    el.replaceChildren(model === null ? make('p', 'hint', 'Click a character') : card(model, at));
  };

  const close = (): string | null => {
    const id = store.getState().ui.selectedId;
    if (id !== null) store.setUi({ selectedId: null });
    return id;
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const id = close();
    if (id === null) return;
    for (const spot of doc.querySelectorAll<HTMLElement>('.hotspot')) {
      if (spot.dataset['characterId'] === id) spot.focus();
    }
  };

  const onPointer = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && el.contains(target)) return;
    if (target instanceof Element && target.closest('.hotspot') !== null) return;
    close();
  };

  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onPointer);
  const timer = setTimer(() => {
    render(store.getState());
  }, AGE_TICK_MS);
  // Subscribe first: a stale selection cleared on the first render re-renders.
  const unsubscribe = store.subscribe(render);
  render(store.getState());
  return () => {
    unsubscribe();
    clearTimer(timer);
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('pointerdown', onPointer);
  };
}
