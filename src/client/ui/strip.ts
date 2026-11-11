// The overview strip (UI-2): per project the busy / idle / ended counts, the
// highest verdict and the transcript-format drift sign (DATA-8; research R5).
// `stripModel` is pure; `mountStrip` appends its own <ul> to #overview.
import { STATUSES, VERDICTS, type Verdict } from '../../shared/constants.js';
import type { Snapshot } from '../../shared/types.js';
import type { AppState, Store } from '../app/store.js';
import { verdictClass } from './inspector.js';

export interface StripProject {
  id: string;
  name: string;
  /** `busy` characters. */
  busy: number;
  /** `idle` + `waiting` + `stopped` characters. */
  idle: number;
  /** `ended` characters. */
  ended: number;
  /** Highest verdict by `VERDICTS` order; null without characters. */
  verdict: Verdict | null;
  /** `health.drift` of the project. */
  drift: boolean;
  /** Failed lines in percent of lines read (rounded; 0 without lines). */
  failedPct: number;
  /** Full status breakdown, e.g. `busy 4 · idle 2 · waiting 1 · stopped 1 · ended 1`. */
  title: string;
}

export function stripModel(snapshot: Snapshot | null): StripProject[] {
  if (snapshot === null) return [];
  return snapshot.projects.map((p) => {
    const characters = snapshot.characters.filter((c) => c.projectId === p.id);
    const count = (status: string): number => characters.filter((c) => c.status === status).length;
    const top = characters.reduce((max, c) => Math.max(max, VERDICTS.indexOf(c.verdict)), -1);
    const { lines, failed, drift } = p.health;
    return {
      id: p.id,
      name: p.name,
      busy: count('busy'),
      idle: count('idle') + count('waiting') + count('stopped'),
      ended: count('ended'),
      verdict: VERDICTS[top] ?? null,
      drift,
      failedPct: lines > 0 ? Math.round((failed / lines) * 100) : 0,
      title: STATUSES.map((s) => `${s} ${String(count(s))}`).join(' · '),
    };
  });
}

/** `4 busy · 4 idle · 1 ended`. */
export function countsText(p: StripProject): string {
  return `${String(p.busy)} busy · ${String(p.idle)} idle · ${String(p.ended)} ended`;
}

export function mountStrip(el: HTMLElement, store: Store): () => void {
  const doc = el.ownerDocument;
  const list = doc.createElement('ul');
  list.className = 'strip';
  list.setAttribute('aria-label', 'Projects overview');
  el.append(list);

  const span = (className: string, text: string): HTMLSpanElement => {
    const node = doc.createElement('span');
    node.className = className;
    node.textContent = text;
    return node;
  };

  let key = '';
  const render = (state: AppState): void => {
    const model = stripModel(state.snapshot);
    const next = JSON.stringify(model);
    if (next === key) return;
    key = next;
    list.replaceChildren(
      ...model.map((p) => {
        const li = doc.createElement('li');
        li.dataset['projectId'] = p.id;
        li.dataset['drift'] = String(p.drift);
        li.title = p.title;
        li.append(span('strip-name', p.name), span('strip-counts', countsText(p)));
        if (p.verdict !== null) li.append(span(`chip ${verdictClass(p.verdict)}`, p.verdict));
        if (p.drift) li.append(span('drift', `format drift ${String(p.failedPct)} %`));
        return li;
      }),
    );
  };
  render(store.getState());
  return store.subscribe(render);
}
