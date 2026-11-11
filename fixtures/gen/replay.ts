// Builds fixtures/replay/{solo,harness}/: two replay sets (DATA-9 fixtures; the player is #3).
// Each set is a fake Claude config dir (config/), an optional repo tree (repo/) and manifest.json
// with liveness windows and files that appear mid-run (planning decision P8). Timestamps are
// BASE + offset; deterministic: no clock, no randomness. Run with `make fixtures`.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BASE, Transcript, at, jsonl, type Json, type Line } from './records.js';
import { syntheticUuid } from './sample.js';
import { agentId, slug } from './transcripts.js';

export type ReplaySetName = 'solo' | 'harness';
export const REPLAY_SETS: readonly ReplaySetName[] = ['solo', 'harness'];

const HOME = '/home/dev';

export interface LiveWindow {
  sessionId: string;
  fromMs: number;
  toMs: number;
  status?: string;
}
export interface Manifest {
  name: ReplaySetName;
  base: string;
  durationMs: number;
  home: string;
  /** Repositories of the set; `dir` is the set-relative folder holding its files, or null. */
  repos: { root: string; dir: string | null }[];
  /** When each session counts as live (replaces registry files and pids). */
  live: LiveWindow[];
  /**
   * Repo files that appear mid-run; a file not listed is present from the start. With `as`, the
   * file replaces the file at `as` when it appears (D-020) and is never present under `path`.
   */
  files: { path: string; appearsAtMs: number; as?: string }[];
}

/** A tool call: name, input and the result text. */
type Call = [name: string, input: Json, result?: string];

/** `n` evenly spaced token counts from `from` to `to`. */
function ramp(n: number, from: number, to: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / n));
}

/** Tool calls (tool_use + tool_result each) with usage rising from `from` to `to`. */
function calls(t: Transcript, list: Call[], from: number, to: number): Line[] {
  const tokens = ramp(list.length, from, to);
  return list.flatMap(([name, input, result], i) => {
    const use = t.toolUse(name, input, tokens[i] ?? to);
    return [use.rec, t.toolResult(use.call, result ?? 'ok')];
  });
}

/** Moves the transcript clock forward to `ms` (never back). */
function until(t: Transcript, ms: number): void {
  t.clockMs = Math.max(t.clockMs, ms);
}

/** An ended turn: assistant text with `end_turn`, then the `turn_duration` system record. */
function endTurn(t: Transcript, tokens: number, text: string): Line[] {
  return [t.assistantText('end_turn', tokens, text), t.systemTurnEnd('turn_duration')];
}

function writeConfig(out: Map<string, string>, t: Transcript, lines: Line[]): void {
  out.set(`config/projects/${slug(t.cwd)}/${t.sessionId}.jsonl`, jsonl(lines));
}

function manifestText(m: Manifest): string {
  return JSON.stringify(m, null, 2) + '\n';
}

// ---------------------------------------------------------------- solo

const NOTES = `${HOME}/code/notes`;

const SOLO_FIRST: Call[] = [
  ['TodoWrite', { todos: [{ content: 'Sort the notes by topic', status: 'in_progress', activeForm: 'Sorting the notes' }] }],
  ['Glob', { pattern: '**/*.md', path: NOTES }, 'README.md\ntopics/cooking.md\ntopics/garden.md'],
  ['Read', { file_path: `${NOTES}/README.md` }, '# Notes'],
  ['Grep', { pattern: 'TODO', path: `${NOTES}/topics` }, 'topics/garden.md:3: TODO'],
  ['Read', { file_path: `${NOTES}/topics/cooking.md` }, '# Cooking'],
  ['Read', { file_path: `${NOTES}/topics/garden.md` }, '# Garden'],
  ['LSP', { operation: 'documentSymbol', filePath: `${NOTES}/scripts/toc.ts` }, 'function buildToc'],
  ['Bash', { command: 'git status --short', description: 'Show changed files' }, ''],
  ['Edit', { file_path: `${NOTES}/topics/cooking.md`, old_string: 'Soup', new_string: 'Soups' }],
  ['Write', { file_path: `${NOTES}/topics/index.md`, content: '# Topics\n' }],
  ['WebSearch', { query: 'markdown table of contents generator' }, 'Results'],
  ['WebFetch', { url: 'https://example.org/markdown/toc', prompt: 'How is a table of contents built?' }, 'An answer'],
  ['Skill', { skill: 'markdown-lint' }],
  ['Bash', { command: 'npm run toc', description: 'Build the table of contents' }, 'toc written'],
  ['Read', { file_path: `${NOTES}/topics/index.md` }, '# Topics'],
  ['Edit', { file_path: `${NOTES}/topics/index.md`, old_string: '# Topics', new_string: '# Topics\n\n- Cooking' }],
  ['Agent', { subagent_type: 'Explore', description: 'Find broken links', prompt: 'List links that point nowhere.' }, 'No broken links.'],
  ['mcp__claude-in-chrome__navigate', { url: 'http://localhost:4000/notes', tabId: 1 }, 'navigated'],
  ['mcp__claude-in-chrome__computer', { action: 'screenshot', tabId: 1 }, 'screenshot taken'],
  ['NotebookEdit', { notebook_path: `${NOTES}/analysis/words.ipynb`, new_source: 'len(words)' }],
  ['Monitor', { command: 'tail -f build.log', description: 'Watch the build' }, 'build done'],
  ['Read', { file_path: `${NOTES}/scripts/toc.ts` }, 'export function buildToc() {}'],
  ['Edit', { file_path: `${NOTES}/scripts/toc.ts`, old_string: 'buildToc()', new_string: 'buildToc(depth = 2)' }],
  ['Bash', { command: 'npm test', description: 'Run the tests' }, 'all tests passed'],
  ['Grep', { pattern: 'buildToc', path: `${NOTES}/scripts` }, 'scripts/toc.ts:1'],
  ['Write', { file_path: `${NOTES}/topics/travel.md`, content: '# Travel\n' }],
  ['AskUserQuestion', { questions: [{ question: 'Keep the old index?', options: ['Yes', 'No'] }] }, 'No'],
  ['Bash', { command: 'git add topics', description: 'Stage the topics' }, ''],
  ['Glob', { pattern: 'topics/*.md', path: NOTES }, 'topics/cooking.md\ntopics/garden.md\ntopics/index.md\ntopics/travel.md'],
  ['TodoWrite', { todos: [{ content: 'Sort the notes by topic', status: 'completed', activeForm: 'Sorting the notes' }] }],
];

const SOLO_SECOND: Call[] = [
  ['Read', { file_path: `${NOTES}/topics/travel.md` }, '# Travel'],
  ['Edit', { file_path: `${NOTES}/topics/travel.md`, old_string: '# Travel', new_string: '# Travel\n\n## Trains' }],
  ['Grep', { pattern: 'train', path: `${NOTES}/topics` }, 'topics/travel.md:3'],
  ['WebFetch', { url: 'https://example.org/trains', prompt: 'List night trains.' }, 'A list'],
  ['Edit', { file_path: `${NOTES}/topics/travel.md`, old_string: '## Trains', new_string: '## Night trains' }],
  ['Bash', { command: 'npm run toc', description: 'Rebuild the table of contents' }, 'toc written'],
  ['Read', { file_path: `${NOTES}/topics/index.md` }, '# Topics'],
  ['Bash', { command: 'npm test', description: 'Run the tests' }, 'all tests passed'],
  ['Bash', { command: 'git add topics', description: 'Stage the topics' }, ''],
  ['Skill', { skill: 'commit' }],
];

function buildSolo(out: Map<string, string>): Manifest {
  const sessionId = syntheticUuid('replay:solo:notes');
  const t = new Transcript({ seed: 'replay:solo', sessionId, cwd: NOTES, stepMs: 5000 });
  const lines: Line[] = [t.prompt('Sort my notes by topic and build an index.')];
  lines.push(...calls(t, SOLO_FIRST, 18_000, 66_000), ...endTurn(t, 67_000, 'The notes are sorted.'));
  until(t, t.clockMs + 120_000); // two minutes idle
  lines.push(t.prompt('Add a section on night trains.'));
  lines.push(...calls(t, SOLO_SECOND, 70_000, 89_000), ...endTurn(t, 90_000, 'Added the section.'));
  writeConfig(out, t, lines);
  const durationMs = 600_000;
  return {
    name: 'solo',
    base: BASE,
    durationMs,
    home: HOME,
    repos: [{ root: NOTES, dir: null }],
    live: [{ sessionId, fromMs: 0, toMs: durationMs }],
    files: [],
  };
}

// ---------------------------------------------------------------- harness

const HARBOR = `${HOME}/code/harbor`;
const CTO_ID = syntheticUuid('replay:harness:cto-1');
const TEAM = `session-${CTO_ID.slice(0, 8)}`;
const OUTCOME = 'docs/outcomes/01-session-store.md';
const OUTCOME_AT = 540_000;
const STATE = 'repo/docs/harness/STATE.md';
/** Replaces STATE.md at the CTO's land step (D-020, `files[].as`). */
const STATE_LANDED = 'repo/docs/harness/STATE.landed.md';
const DURATION = 720_000;

interface Lane {
  letter: 'A' | 'B' | 'C';
  slug: string;
  agentName: string;
  phase: string;
  port: number;
  fromMs: number;
}

const LANES: Lane[] = [
  { letter: 'A', slug: 'session-store', agentName: 'c01-review', phase: 'review', port: 8001, fromMs: 30_000 },
  { letter: 'B', slug: 'theme-tokens', agentName: 'c02-impl', phase: 'implement', port: 8002, fromMs: 40_000 },
  { letter: 'C', slug: 'replay-player', agentName: 'c03-research', phase: 'research', port: 8003, fromMs: 50_000 },
];

function worktree(lane: Lane): string {
  return `${HARBOR}/.claude/worktrees/${lane.slug}`;
}

function teammateTranscript(lane: Lane): Transcript {
  return new Transcript({
    seed: `replay:harness:${lane.agentName}`,
    sessionId: syntheticUuid(`replay:harness:${lane.agentName}`),
    cwd: worktree(lane),
    gitBranch: lane.slug,
    startMs: lane.fromMs,
    stepMs: 6000,
    extra: { agentName: lane.agentName, teamName: TEAM },
  });
}

function spawnPrompt(lane: Lane): string {
  return `You are teammate ${lane.agentName}. Cycle ${lane.slug}, phase ${lane.phase}, lane ${lane.letter}, port ${lane.port}.`;
}

/** Offset (ms after BASE) of the first assistant record whose tool_use matches `pick`. */
function toolUseAt(lines: Line[], pick: (name: string, input: Json) => boolean): number {
  for (const line of lines) {
    if (typeof line === 'string') continue;
    const content = (line.message as { content?: unknown } | undefined)?.content;
    const block = Array.isArray(content) ? (content[0] as Json | undefined) : undefined;
    if (block?.type === 'tool_use' && pick(String(block.name), block.input as Json)) {
      return Date.parse(String(line.timestamp)) - Date.parse(BASE);
    }
  }
  throw new Error('tool_use not found');
}

/** Builds the CTO transcript; returns the offset of its land step (the `Edit` of STATE.md, D-020). */
function buildCto(out: Map<string, string>): number {
  const t = new Transcript({ seed: 'replay:harness:cto-1', sessionId: CTO_ID, cwd: HARBOR, stepMs: 2000 });
  const lines: Line[] = [t.title('custom-title', 'cto-1'), t.prompt('Run wave W1.')];
  lines.push(
    ...calls(
      t,
      [
        ['Read', { file_path: `${HARBOR}/docs/harness/STATE.md` }, '## Now'],
        ...LANES.map((lane): Call => ['Bash', { command: `bin/harness/lane open ${lane.slug}`, description: `Open lane ${lane.letter}` }, `lane ${lane.letter}`]),
        ...LANES.map((lane): Call => [
          'Agent',
          { name: lane.agentName, team_name: TEAM, description: `${lane.slug} ${lane.phase}`, prompt: spawnPrompt(lane) },
          'spawned',
        ]),
        ['Bash', { command: 'bin/harness/status', description: 'Show the board' }, 'three lanes busy'],
      ],
      30_000,
      42_000,
    ),
    ...endTurn(t, 43_000, 'Wave W1 is running.'),
  );
  until(t, 485_000);
  lines.push(t.prompt('<teammate-message teammate_id="c01-review">REPORT c01-review: DONE</teammate-message>'));
  lines.push(...calls(t, [['Bash', { command: 'git log --oneline -1', description: 'Show the landed commit' }, 'abc1234 session-store']], 50_000, 50_000));
  lines.push(...endTurn(t, 51_000, 'Waiting for the outcome file.'));
  until(t, OUTCOME_AT + 5000);
  lines.push(t.prompt('<teammate-message teammate_id="c01-review">Outcome file written.</teammate-message>'));
  lines.push(
    ...calls(
      t,
      [
        ['Read', { file_path: `${HARBOR}/${OUTCOME}` }, '# #01 session-store'],
        ['Edit', { file_path: `${HARBOR}/docs/harness/STATE.md`, old_string: 'A session-store (review)', new_string: 'A session-store (landed)' }],
        ['Bash', { command: 'git commit -m state', description: 'Record the landing' }, '1 file changed'],
      ],
      54_000,
      60_000,
    ),
    ...endTurn(t, 61_000, 'Cycle 01 recorded.'),
  );
  until(t, 690_000);
  lines.push(t.prompt('Status?'));
  lines.push(...calls(t, [['Bash', { command: 'bin/harness/status', description: 'Show the board' }, 'two lanes busy']], 63_000, 63_000));
  lines.push(...endTurn(t, 64_000, 'Lanes B and C are still working.'));
  writeConfig(out, t, lines);
  return toolUseAt(lines, (name, input) => name === 'Edit' && String(input.file_path).endsWith('/docs/harness/STATE.md'));
}

/** `docs/harness/STATE.md` of the harness set: W1 `building`, or `landing` with lane A landed (D-020). */
function stateFile(landed: boolean): string {
  return [
    '# Harness state',
    '',
    '## Now',
    '',
    '- CTO generation: 1',
    '- Wave: W1',
    `- Phase: W1 ${landed ? 'landing' : 'building'}`,
    ...LANES.map(
      (lane) => `- Lane ${lane.letter}: #0${LANES.indexOf(lane) + 1} ${lane.slug} (${landed && lane.letter === 'A' ? 'landed' : lane.phase}), ${lane.agentName}`,
    ),
    '',
    '## Next',
    '',
    '- W2 after W1 lands',
    '',
  ].join('\n');
}

function buildReviewer(out: Map<string, string>, lane: Lane): void {
  const t = teammateTranscript(lane);
  const w = worktree(lane);
  const lines: Line[] = [t.prompt(spawnPrompt(lane))];
  lines.push(
    ...calls(
      t,
      [
        ['Read', { file_path: `${w}/docs/harness/TEAMMATE.md` }, '# Teammate guide'],
        ['Read', { file_path: `${w}/.rpi-tracking/plans/session-store-plan.md` }, '# Plan'],
        ['Skill', { skill: 'rpi-review' }],
        ['Agent', { subagent_type: 'Explore', description: 'Find the session store code', prompt: 'Where is the session store?' }, 'src/store.ts'],
        ['Agent', { subagent_type: 'Explore', description: 'Find the store tests', prompt: 'Which tests cover the store?' }, 'src/store.test.ts'],
      ],
      20_000,
      34_000,
    ),
  );
  until(t, 160_000);
  const review: Call[] = [];
  for (const file of ['store.ts', 'store.test.ts', 'routes.ts', 'session.ts']) {
    review.push(['Read', { file_path: `${w}/src/${file}` }, 'code']);
    review.push(['Grep', { pattern: 'expire', path: `${w}/src` }, `src/${file}:12`]);
  }
  review.push(
    ['Bash', { command: 'make lint', description: 'Run the linter' }, 'ok'],
    ['Bash', { command: 'make test', description: 'Run the tests' }, 'all tests passed'],
    ['Bash', { command: 'bin/harness/land -m "session-store: sessions survive a restart"', description: 'Land the cycle' }, 'landed'],
    ['SendMessage', { to: 'team-lead', message: 'REPORT c01-review: DONE' }, 'sent'],
  );
  t.stepMs = 12_500;
  lines.push(...calls(t, review, 40_000, 95_000), ...endTurn(t, 96_000, 'Review done; cycle landed.'));
  writeConfig(out, t, lines);

  [
    { label: 'explore-1', fromMs: 73_000, description: 'Find the session store code', result: 'src/store.ts' },
    { label: 'explore-2', fromMs: 85_000, description: 'Find the store tests', result: 'src/store.test.ts' },
  ].forEach((spec) => {
    const id = agentId(`replay:harness:${spec.label}`);
    const a = new Transcript({
      seed: `replay:harness:${spec.label}`,
      sessionId: t.sessionId,
      cwd: w,
      gitBranch: lane.slug,
      startMs: spec.fromMs,
      stepMs: 3000,
      sidechain: true,
      extra: { agentId: id },
    });
    const agentLines: Line[] = [a.prompt(spec.description)];
    agentLines.push(
      ...calls(
        a,
        [
          ['Glob', { pattern: 'src/**/*.ts', path: w }, 'src/store.ts'],
          ['Grep', { pattern: 'session', path: `${w}/src` }, 'src/store.ts:4'],
          ['Read', { file_path: `${w}/${spec.result}` }, 'code'],
          ['Grep', { pattern: 'expire', path: `${w}/src` }, 'src/store.ts:12'],
          ['Read', { file_path: `${w}/src/session.ts` }, 'code'],
        ],
        8000,
        16_000,
      ),
      a.assistantText('end_turn', 17_000, spec.result),
    );
    const base = `config/projects/${slug(w)}/${t.sessionId}/subagents/agent-${id}`;
    out.set(`${base}.jsonl`, jsonl(agentLines));
    out.set(`${base}.meta.json`, JSON.stringify({ agentType: 'Explore', description: spec.description, finished: true }) + '\n');
  });
}

function buildBuilder(out: Map<string, string>, lane: Lane): void {
  const t = teammateTranscript(lane);
  const w = worktree(lane);
  const list: Call[] = [['Read', { file_path: `${w}/docs/harness/TEAMMATE.md` }, '# Teammate guide'], ['Skill', { skill: 'rpi-implement' }]];
  for (const name of ['palette', 'spacing', 'type', 'radius', 'shadow', 'motion', 'theme', 'tokens']) {
    list.push(['Read', { file_path: `${w}/src/theme/${name}.ts` }, 'code']);
    list.push(['Edit', { file_path: `${w}/src/theme/${name}.ts`, old_string: 'a', new_string: 'b' }]);
    list.push(['Bash', { command: `npx vitest run src/theme/${name}.test.ts`, description: 'Run one test file' }, 'passed']);
  }
  list.push(['Write', { file_path: `${w}/src/theme/index.ts`, content: 'export {};\n' }], ['Bash', { command: 'make lint', description: 'Run the linter' }, 'ok']);
  t.stepMs = 11_500;
  const lines: Line[] = [t.prompt(spawnPrompt(lane)), ...calls(t, list, 15_000, 118_000)];
  const last = t.toolUse('Bash', { command: 'make test', description: 'Run the tests' }, 120_000);
  lines.push(last.rec); // still running at the end of the replay
  writeConfig(out, t, lines);
}

function buildResearcher(out: Map<string, string>, lane: Lane): void {
  const t = teammateTranscript(lane);
  const w = worktree(lane);
  const list: Call[] = [['Read', { file_path: `${w}/docs/harness/TEAMMATE.md` }, '# Teammate guide'], ['Skill', { skill: 'rpi-research' }]];
  for (const name of ['clock', 'player', 'manifest', 'reader', 'server']) {
    list.push(['Glob', { pattern: `src/**/${name}*.ts`, path: w }, `src/${name}.ts`]);
    list.push(['Read', { file_path: `${w}/src/${name}.ts` }, 'code']);
    list.push(['Grep', { pattern: 'replay', path: `${w}/src` }, `src/${name}.ts:3`]);
  }
  list.push(
    ['WebSearch', { query: 'server-sent events reconnect' }, 'Results'],
    ['WebFetch', { url: 'https://example.org/sse', prompt: 'How does a client reconnect?' }, 'An answer'],
    ['Write', { file_path: `${w}/.rpi-tracking/research/replay-player-research.md`, content: '# Research\n' }],
  );
  t.stepMs = 16_000;
  const lines: Line[] = [t.prompt(spawnPrompt(lane)), ...calls(t, list, 12_000, 68_000)];
  lines.push(t.thinking('Weighing two ways to pace the replay clock.', 70_000));
  writeConfig(out, t, lines);
}

function buildHarness(out: Map<string, string>): Manifest {
  const landMs = buildCto(out);
  if (landMs < OUTCOME_AT) throw new Error(`the land step (${String(landMs)} ms) comes before the outcome file`);
  const [a, b, c] = LANES as [Lane, Lane, Lane];
  buildReviewer(out, a);
  buildBuilder(out, b);
  buildResearcher(out, c);

  out.set(
    'repo/.claude/harness/lanes.tsv',
    '#slug\tlane\tport\tcreated\n' + LANES.map((lane, i) => `${lane.slug}\t${lane.letter}\t${lane.port}\t${at(8000 + i * 2000)}\n`).join(''),
  );
  out.set(STATE, stateFile(false));
  out.set(STATE_LANDED, stateFile(true));
  out.set('repo/docs/outcomes/00-bootstrap.md', '# #00 bootstrap — outcome\n\n## Delivered\n\nToolchain and skeleton.\n');
  out.set(`repo/${OUTCOME}`, '# #01 session-store — outcome\n\n## Delivered\n\nSessions survive a restart.\n');

  const teammateIds = LANES.map((lane) => syntheticUuid(`replay:harness:${lane.agentName}`));
  return {
    name: 'harness',
    base: BASE,
    durationMs: DURATION,
    home: HOME,
    repos: [{ root: HARBOR, dir: 'repo' }],
    live: [
      { sessionId: CTO_ID, fromMs: 0, toMs: DURATION },
      { sessionId: teammateIds[0] ?? '', fromMs: a.fromMs, toMs: 490_000 },
      { sessionId: teammateIds[1] ?? '', fromMs: b.fromMs, toMs: DURATION },
      { sessionId: teammateIds[2] ?? '', fromMs: c.fromMs, toMs: DURATION },
    ],
    files: [
      { path: `repo/${OUTCOME}`, appearsAtMs: OUTCOME_AT },
      { path: STATE_LANDED, appearsAtMs: landMs, as: STATE },
    ],
  };
}

/** Every file of one replay set: path relative to fixtures/replay/<name>/ → content, sorted by path. */
export function buildReplaySet(name: ReplaySetName): Map<string, string> {
  const out = new Map<string, string>();
  const manifest = name === 'solo' ? buildSolo(out) : buildHarness(out);
  out.set('manifest.json', manifestText(manifest));
  return new Map([...out.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const root = fileURLToPath(new URL('../replay/', import.meta.url));
  for (const name of REPLAY_SETS) {
    rmSync(`${root}${name}`, { recursive: true, force: true });
    const files = buildReplaySet(name);
    for (const [path, content] of files) {
      mkdirSync(dirname(`${root}${name}/${path}`), { recursive: true });
      writeFileSync(`${root}${name}/${path}`, content);
    }
    console.log(`wrote ${files.size} files under fixtures/replay/${name}/`);
  }
}
