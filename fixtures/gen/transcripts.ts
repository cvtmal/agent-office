// Builds fixtures/transcripts/: unit transcript cases (cases/*.jsonl), a fake Claude config
// dir (config/) with the inventory of plan Step 5.2, and a fake `ps` table (ps.txt).
// Deterministic: no clock, no randomness. Run with `make fixtures`.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  BASE_MS,
  Transcript,
  VERSION_NEW,
  VERSION_OLD,
  fakeSecret as s,
  garbled,
  jsonl,
  type Json,
  type Line,
  type ToolCall,
  type UsageArg,
} from './records.js';
import { syntheticUuid } from './sample.js';

const CASES_CWD = '/home/dev/code/cases';
const ALPHA = '/home/dev/code/alpha';
const BETA = '/home/dev/code/beta';
const CLAUDE_BIN = '/home/dev/.local/bin/claude';

/** Claude Code's project dir name for a cwd: `/` and `.` become `-`. */
export function slug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-');
}

/** A real-shaped agent id (`a` + 16 hex digits) derived from a label. */
export function agentId(label: string): string {
  return `a${syntheticUuid(label).replace(/-/g, '').slice(0, 16)}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `ps -o lstart` text (C locale, UTC) for an epoch-ms time, e.g. `Thu Jan  1 00:00:00 2026`. */
function lstart(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${time} ${d.getUTCFullYear()}`;
}

type Ending = 'end_turn' | 'tool_use' | 'tool_result' | 'prompt';

/** A short working turn whose last assistant usage totals `tokens`, ending as `ending`. */
function work(t: Transcript, tokens: UsageArg, ending: Ending): Line[] {
  const earlier = (d: number): UsageArg => (typeof tokens === 'number' && tokens > d ? tokens - d : tokens);
  const out: Line[] = [t.prompt('Please look at the build.')];
  const read = t.toolUse('Read', { file_path: `${t.cwd}/package.json` }, earlier(2000));
  out.push(read.rec, t.toolResult(read.call, '{ "name": "demo" }'));
  const bash = t.toolUse('Bash', { command: 'npm test', description: 'Run the tests' }, ending === 'tool_use' || ending === 'tool_result' ? tokens : earlier(1000));
  out.push(bash.rec);
  if (ending === 'tool_use') return out;
  out.push(t.toolResult(bash.call, 'all tests passed'));
  if (ending === 'tool_result') return out;
  out.push(t.assistantText('end_turn', tokens, 'The build is green.'));
  if (ending === 'prompt') out.push(t.prompt('Now update the docs.'));
  return out;
}

/** Exactly `n` good lines: alternating Read tool_use and tool_result records. */
function filler(t: Transcript, n: number): Line[] {
  const out: Line[] = [];
  let call: ToolCall | null = null;
  for (let i = 0; i < n; i++) {
    if (call === null) {
      const u = t.toolUse('Read', { file_path: `${t.cwd}/src/f${i}.ts` }, 1000 + i);
      out.push(u.rec);
      call = u.call;
    } else {
      out.push(t.toolResult(call, 'x'));
      call = null;
    }
  }
  return out;
}

/** `good` with garbled lines placed so the last 500 lines hold exactly `bad` of them. */
function withGarbage(good: Line[], bad: number, every: number): Line[] {
  const windowGood = 500 - bad;
  const head = good.slice(0, good.length - windowGood);
  const tail = good.slice(good.length - windowGood);
  const junk = garbled(bad);
  const out: Line[] = [...head];
  let g = 0;
  let j = 0;
  for (let i = 0; i < 500; i++) {
    if (i % every === every / 2 && j < bad) out.push(junk[j++] ?? 'x');
    else out.push(tail[g++] ?? 'x');
  }
  return out;
}

/** A turn that puts every fake secret where a reader might leak it (plan Step 5.2). */
function secretLines(t: Transcript, tokens: number): Line[] {
  const out: Line[] = [t.prompt(`Deploy with the key ${s(1)} please.`)];
  const call = (name: string, input: Json, result = 'ok') => {
    const u = t.toolUse(name, input, tokens - 5000);
    out.push(u.rec, t.toolResult(u.call, result));
  };
  call(
    'Bash',
    { command: `TOKEN=${s(2)} curl -H "Authorization: Bearer ${s(3)}" https://api.example.test/v1`, description: 'Call the API' },
    `token=${s(16)}`,
  );
  call('WebFetch', { url: `https://dev:${s(4)}@docs.example.test/page?token=${s(5)}`, prompt: 'Summarise the page' });
  call('Grep', { pattern: s(6), path: `${t.cwd}/src` });
  call('Write', { file_path: `${t.cwd}/.env`, content: `API_KEY=${s(7)}\n` });
  call('Edit', { file_path: `${t.cwd}/src/config.ts`, old_string: "key = ''", new_string: `key = '${s(8)}'`, replace_all: false });
  call('Agent', { description: `Rotate ${s(10)}`, prompt: `Use the key ${s(9)} to rotate.`, subagent_type: 'general-purpose' });
  call('SendMessage', { to: 'c01-plan', message: `The key is ${s(11)}.` });
  call('Skill', { skill: 'deploy', args: `--token ${s(12)}` });
  call('WebSearch', { query: `${s(13)} leaked` });
  out.push(t.thinking(`I must not repeat ${s(15)}.`, tokens - 1000));
  out.push(t.assistantText('end_turn', tokens, `Done; used ${s(14)}.`));
  return out;
}

function caseTranscript(name: string, opts: { sidechain?: boolean } = {}): Transcript {
  return new Transcript({
    seed: `case:${name}`,
    sessionId: syntheticUuid(`case:${name}`),
    cwd: CASES_CWD,
    version: VERSION_OLD,
    sidechain: opts.sidechain ?? false,
  });
}

function buildCases(): Map<string, Line[]> {
  const cases = new Map<string, Line[]>();
  const add = (name: string, build: (t: Transcript) => Line[]) => cases.set(name, build(caseTranscript(name)));

  add('status-idle-end-turn', (t) => work(t, 40_000, 'end_turn'));
  add('status-idle-stop-hook', (t) => {
    const out = work(t, 40_000, 'tool_result');
    out.push(t.assistantText(null, 40_000, 'Wrapping up.'), t.systemTurnEnd('stop_hook_summary'));
    return out;
  });
  add('status-busy-prompt', (t) => work(t, 40_000, 'prompt'));
  add('status-busy-tool-use', (t) => work(t, 40_000, 'tool_use'));
  add('status-busy-tool-result', (t) => work(t, 40_000, 'tool_result'));
  add('status-sidechain-last', (t) => {
    const out = work(t, 40_000, 'end_turn');
    t.sidechain = true;
    const side = t.toolUse('Read', { file_path: `${t.cwd}/README.md` }, 90_000);
    out.push(side.rec, t.toolResult(side.call, 'readme'));
    return out;
  });
  add('activity-kinds', (t) => {
    const out: Line[] = [t.prompt('Do one of everything.')];
    const calls: [string, Json][] = [
      ['Read', { file_path: `${t.cwd}/src/main.ts` }],
      ['Edit', { file_path: `${t.cwd}/src/main.ts`, old_string: 'a', new_string: 'b', replace_all: false }],
      ['Bash', { command: 'git status', description: 'Show status' }],
      ['WebFetch', { url: 'https://docs.example.test/guide', prompt: 'Summarise' }],
      ['Agent', { description: 'Explore the code', prompt: 'Find the entry point.', subagent_type: 'Explore' }],
      ['TodoWrite', { todos: [] }],
      ['ToolSearch', { query: 'select:Read' }],
      ['mcp__claude-in-chrome__navigate', { url: 'https://app.example.test/home', tabId: 1 }],
      ['FrobnicateWidget', { level: 3 }],
    ];
    let tokens = 20_000;
    for (const [name, input] of calls) {
      const u = t.toolUse(name, input, (tokens += 1000));
      out.push(u.rec, t.toolResult(u.call, 'ok'));
      if (name === 'Edit') out.push(t.blob(u.call));
    }
    out.push(t.assistantText('end_turn', tokens + 1000, 'All done.'));
    return out;
  });
  for (const n of [149_999, 150_000, 180_000, 220_000, 250_000]) add(`tokens-${n}`, (t) => work(t, n, 'end_turn'));
  add('tokens-zero-last', (t) => {
    const out = work(t, 120_000, 'tool_result');
    out.push(t.assistantText('end_turn', 0, 'API error.'));
    return out;
  });
  add('tokens-bad-values', (t) => {
    const out = work(t, 50_000, 'tool_result');
    const bad = { input_tokens: '9000', cache_creation_input_tokens: true, cache_read_input_tokens: 90_000, output_tokens: null };
    out.push(t.assistantText('end_turn', bad, 'Done.'));
    return out;
  });
  add('health-drift', (t) => withGarbage(filler(t, 570), 30, 16));
  add('health-ok', (t) => withGarbage(filler(t, 475), 25, 20));
  add('health-old-garbage', (t) => [...garbled(200), ...filler(t, 500)]);
  add('names-titles', (t) => {
    const out: Line[] = [t.title('custom-title', 'Old title'), t.title('ai-title', 'Fix the build')];
    out.push(...work(t, 40_000, 'tool_result'));
    out.push(t.title('agent-name', 'helper'), t.title('custom-title', 'Release prep'));
    out.push(t.assistantText('end_turn', 41_000, 'Done.'));
    return out;
  });
  add('secrets', (t) => secretLines(t, 60_000));
  return cases;
}

interface SessionSpec {
  label: string;
  cwd: string;
  build: (t: Transcript) => Line[];
  version?: string;
  extra?: Json;
  gitBranch?: string;
}

const CTO8 = syntheticUuid('cto').slice(0, 8);
const TEAM = `session-${CTO8}`;
const TEAMMATE_CWD = `${ALPHA}/.claude/worktrees/lane-a`;

const SESSIONS: SessionSpec[] = [
  { label: 'cto', cwd: ALPHA, build: (t) => work(t, 230_000, 'end_turn') },
  { label: 'busy', cwd: ALPHA, build: (t) => work(t, 60_000, 'tool_use') },
  { label: 'waiting', cwd: ALPHA, build: (t) => work(t, 45_000, 'tool_use') },
  { label: 'shell', cwd: ALPHA, build: (t) => work(t, 52_000, 'tool_result') },
  { label: 'nostatus', cwd: `${ALPHA}/src`, build: (t) => work(t, 30_000, 'end_turn') },
  { label: 'reused', cwd: ALPHA, build: (t) => work(t, 70_000, 'tool_result') },
  { label: 'ended', cwd: BETA, version: VERSION_OLD, build: (t) => work(t, 90_000, 'end_turn') },
  {
    label: 'nousage',
    cwd: BETA,
    build: (t) => [t.prompt('Hello?'), t.assistantText('end_turn', 0, 'API error.')],
  },
  {
    label: 'teammate',
    cwd: TEAMMATE_CWD,
    gitBranch: 'lane-a',
    extra: { agentName: 'c01-plan', teamName: TEAM },
    build: (t) => work(t, 40_000, 'tool_use'),
  },
  {
    label: 'titled',
    cwd: BETA,
    build: (t) => [t.title('ai-title', 'Untitled draft'), ...work(t, 20_000, 'end_turn')],
  },
  { label: 'drift', cwd: BETA, build: (t) => [...work(t, 25_000, 'end_turn'), ...withDrift(t)] },
  { label: 'secrets', cwd: BETA, build: (t) => secretLines(t, 60_000) },
];

/** 40 good lines with 20 garbled ones interleaved: enough to tip beta's health into drift. */
function withDrift(t: Transcript): Line[] {
  const good = filler(t, 40);
  const junk = garbled(20, 'drift');
  return good.flatMap((line, i) => (i % 2 === 1 ? [line, junk[(i - 1) / 2] ?? 'x'] : [line]));
}

interface AgentSpec {
  label: string;
  parent: string;
  cwd: string;
  sub?: string;
  meta: Json;
  build: (t: Transcript) => Line[];
}

const AGENTS: AgentSpec[] = [
  {
    label: 'busy/finished',
    parent: 'busy',
    cwd: ALPHA,
    meta: { agentType: 'general-purpose', description: 'Summarise the changes', finished: true },
    build: (t) => work(t, 25_000, 'end_turn'),
  },
  {
    label: 'busy/stopped',
    parent: 'busy',
    cwd: ALPHA,
    meta: { agentType: 'Explore', description: 'Search the code', stoppedByUser: true },
    build: (t) => work(t, 18_000, 'tool_use'),
  },
  {
    label: 'busy/plain',
    parent: 'busy',
    cwd: ALPHA,
    meta: { agentType: 'general-purpose', description: 'Write the tests' },
    build: (t) => work(t, 33_000, 'tool_use'),
  },
  {
    label: 'busy/nousage',
    parent: 'busy',
    cwd: ALPHA,
    meta: { agentType: 'general-purpose', description: 'Never answered' },
    build: (t) => [t.prompt('Start the job.')],
  },
  {
    label: 'busy/nested',
    parent: 'busy',
    cwd: ALPHA,
    sub: 'sub/',
    meta: { agentType: 'Plan', description: 'Plan the phase' },
    build: (t) => work(t, 12_000, 'tool_result'),
  },
  {
    label: 'ended/plain',
    parent: 'ended',
    cwd: BETA,
    meta: { agentType: 'general-purpose', description: 'Check the build' },
    build: (t) => work(t, 15_000, 'end_turn'),
  },
  {
    label: 'orphan/plain',
    parent: 'orphan',
    cwd: BETA,
    meta: { agentType: 'general-purpose', description: 'Lost helper' },
    build: (t) => work(t, 10_000, 'tool_result'),
  },
];

interface RegistrySpec {
  pid: number;
  label: string;
  cwd: string;
  status?: string;
  name?: string;
  updatedMin: number;
  /** ps start differs from the registry's procStart (pid reused by another process). */
  reused?: boolean;
}

const REGISTRY: RegistrySpec[] = [
  { pid: 4101, label: 'cto', cwd: ALPHA, status: 'idle', name: 'cto-1', updatedMin: 30 },
  { pid: 4102, label: 'busy', cwd: ALPHA, status: 'busy', updatedMin: 40 },
  { pid: 4103, label: 'waiting', cwd: ALPHA, status: 'waiting', updatedMin: 50 },
  { pid: 4104, label: 'shell', cwd: ALPHA, status: 'shell', updatedMin: 60 },
  { pid: 4105, label: 'nostatus', cwd: `${ALPHA}/src`, updatedMin: 70 },
  { pid: 4106, label: 'reused', cwd: ALPHA, status: 'busy', updatedMin: 80, reused: true },
  { pid: 4107, label: 'secrets', cwd: BETA, status: 'idle', updatedMin: 90 },
  // a duplicate, older entry for `busy`: the newest updatedAt (4102) must win
  { pid: 4108, label: 'busy', cwd: ALPHA, status: 'idle', updatedMin: 10 },
];

const TEAMMATE_PID = 4120;
const UNRELATED: [number, string][] = [
  [4190, '/usr/sbin/cron -f'],
  [4191, '/bin/zsh -l'],
];

/** Process start: an hour before BASE plus a minute per pid. */
function procStartMs(pid: number): number {
  return BASE_MS - 3_600_000 + (pid - 4100) * 60_000;
}

function buildConfig(out: Map<string, string>): void {
  const indexOf = new Map(SESSIONS.map((spec, i) => [spec.label, i]));
  const cwdOf = new Map(SESSIONS.map((spec) => [spec.label, spec.cwd]));

  SESSIONS.forEach((spec, i) => {
    const sessionId = syntheticUuid(spec.label);
    const t = new Transcript({
      seed: `config:${spec.label}`,
      sessionId,
      cwd: spec.cwd,
      version: spec.version ?? VERSION_NEW,
      gitBranch: spec.gitBranch ?? 'main',
      startMs: i * 600_000,
      extra: spec.extra ?? {},
    });
    out.set(`config/projects/${slug(spec.cwd)}/${sessionId}.jsonl`, jsonl(spec.build(t)));
  });
  const titled = SESSIONS.find((spec) => spec.label === 'titled');
  if (titled) {
    out.set(
      `config/projects/${slug(titled.cwd)}/${syntheticUuid('titled')}/custom-title.json`,
      JSON.stringify({ customTitle: 'Night shift' }) + '\n',
    );
  }

  AGENTS.forEach((spec, i) => {
    const sessionId = syntheticUuid(spec.parent);
    const id = agentId(spec.label);
    const projectCwd = cwdOf.get(spec.parent) ?? spec.cwd;
    const t = new Transcript({
      seed: `agent:${spec.label}`,
      sessionId,
      cwd: spec.cwd,
      sidechain: true,
      startMs: ((indexOf.get(spec.parent) ?? SESSIONS.length) * 600_000) + 60_000 + i * 1000,
      extra: { agentId: id },
    });
    const base = `config/projects/${slug(projectCwd)}/${sessionId}/subagents/${spec.sub ?? ''}agent-${id}`;
    out.set(`${base}.jsonl`, jsonl(spec.build(t)));
    out.set(`${base}.meta.json`, JSON.stringify(spec.meta) + '\n');
  });

  const ps: [number, number, string][] = [];
  for (const r of REGISTRY) {
    const start = procStartMs(r.pid);
    const entry: Json = { pid: r.pid, sessionId: syntheticUuid(r.label), procStart: lstart(start) };
    if (r.status !== undefined) entry.status = r.status;
    entry.updatedAt = BASE_MS + r.updatedMin * 60_000;
    entry.cwd = r.cwd;
    if (r.name !== undefined) entry.name = r.name;
    out.set(`config/sessions/${r.pid}.json`, JSON.stringify(entry) + '\n');
    ps.push(r.reused ? [r.pid, start + 3_600_000, '/usr/bin/python3 -m http.server'] : [r.pid, start, CLAUDE_BIN]);
  }
  out.set('config/sessions/x.key', 'not a registry file\n');

  ps.push([
    TEAMMATE_PID,
    BASE_MS - 1_800_000,
    `${CLAUDE_BIN} --agent-id c01-plan@${TEAM} --agent-name c01-plan --team-name ${TEAM}`,
  ]);
  for (const [pid, command] of UNRELATED) ps.push([pid, procStartMs(pid), command]);
  ps.sort((a, b) => a[0] - b[0]);
  out.set('ps.txt', ps.map(([pid, start, command]) => `${String(pid).padStart(5, ' ')} ${lstart(start)}     ${command}\n`).join(''));
}

/** Every generated file: path relative to fixtures/transcripts/ → content, sorted by path. */
export function buildTranscriptFixtures(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, lines] of buildCases()) out.set(`cases/${name}.jsonl`, jsonl(lines));
  buildConfig(out);
  return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const root = fileURLToPath(new URL('../transcripts/', import.meta.url));
  for (const name of ['cases', 'config', 'ps.txt']) rmSync(`${root}${name}`, { recursive: true, force: true });
  const files = buildTranscriptFixtures();
  for (const [path, content] of files) {
    mkdirSync(dirname(`${root}${path}`), { recursive: true });
    writeFileSync(`${root}${path}`, content);
  }
  console.log(`wrote ${files.size} files under fixtures/transcripts/`);
}
