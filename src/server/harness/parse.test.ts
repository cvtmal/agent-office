import { describe, expect, it } from 'vitest';
import type { HarnessExtras } from '../../shared/types.js';
import {
  laneOf,
  laneSlugOf,
  parseGitLog,
  parseLanes,
  parseOutcomeNames,
  parseStateNow,
} from './parse.js';

const HEADER = '#slug\tlane\tport\tcreated';
const T = '2026-01-01T00:00:00.000Z';

describe('parseLanes', () => {
  it('gives [] for empty text and a header only', () => {
    expect(parseLanes('')).toEqual([]);
    expect(parseLanes(`${HEADER}\n`)).toEqual([]);
  });

  it('reads the replay fixture rows as lanes A–C', () => {
    const text = `${HEADER}\nsession-store\tA\t8001\t${T}\ntheme-tokens\tB\t8002\t${T}\nreplay-player\tC\t8003\t${T}\n`;
    expect(parseLanes(text)).toEqual([
      { slug: 'session-store', letter: 'A', port: 8001, worktree: '.claude/worktrees/session-store' },
      { slug: 'theme-tokens', letter: 'B', port: 8002, worktree: '.claude/worktrees/theme-tokens' },
      { slug: 'replay-player', letter: 'C', port: 8003, worktree: '.claude/worktrees/replay-player' },
    ]);
  });

  it('sorts by letter, keeps the first row per slug, tolerates CRLF and blank lines', () => {
    const text = `c\tC\t8003\r\n\r\na\tA\t8001\r\n  \na\tD\t8004\nb\tB\t8002`;
    expect(parseLanes(text).map((l) => `${l.letter}${l.slug}${l.port}`)).toEqual([
      'Aa8001',
      'Bb8002',
      'Cc8003',
    ]);
  });

  it.each([
    ['two columns', 'x\tA'],
    ['letter E', 'x\tE\t8001'],
    ['port 0', 'x\tA\t0'],
    ['port 70000', 'x\tA\t70000'],
    ['port 80x', 'x\tA\t80x'],
    ['slug with /', 'x/y\tA\t8001'],
    ['slug with a space', 'x y\tA\t8001'],
  ])('skips a malformed row (%s)', (_name, row) => {
    expect(parseLanes(`${HEADER}\n${row}\nok\tB\t8002\n`).map((l) => l.slug)).toEqual(['ok']);
  });
});

describe('parseStateNow', () => {
  it('reads bold labels (this repo)', () => {
    const text = [
      '# State',
      '## Now',
      '- **CTO generation:** 1',
      '- **Phase of the project:** W1 in `implement`, **#1** in review',
      '- **Wave in progress:** W1',
      '## Board',
    ].join('\n');
    expect(parseStateNow(text)).toEqual({
      ctoGeneration: 1,
      phase: 'W1 in implement, #1 in review',
      wave: 'W1',
    });
  });

  it('reads plain labels without a phase line (replay fixture)', () => {
    const text = '## Now\n\n- CTO generation: 1\n- Wave: W1\n- Lane A: #01 x (review), c01\n\n## Next\n';
    expect(parseStateNow(text)).toEqual({ ctoGeneration: 1, phase: null, wave: 'W1' });
  });

  it('gives wave null when no W<n> token leads (no wave in progress)', () => {
    const text = '## Now\n- **Wave in progress:** none; no teammate running\n';
    expect(parseStateNow(text).wave).toBeNull();
  });

  it('cleans a long phase to 80 characters without markdown', () => {
    const text = `## Now\n- **Phase:** **${'word '.repeat(40)}** \`x\`\n`;
    const { phase } = parseStateNow(text);
    expect(phase).not.toBeNull();
    expect(Array.from(phase ?? '')).toHaveLength(80);
    expect(phase).not.toMatch(/[*`]/);
  });

  it('gives all null without § Now, and ignores labels outside it', () => {
    expect(parseStateNow('')).toEqual({ ctoGeneration: null, phase: null, wave: null });
    const text = '## Board\n- **CTO generation:** 3\n- Wave: W2\n## Now\n- Lane A: x\n';
    expect(parseStateNow(text)).toEqual({ ctoGeneration: null, phase: null, wave: null });
  });

  it('gives generation null without a digit', () => {
    expect(parseStateNow('## Now\n- CTO generation: first\n').ctoGeneration).toBeNull();
  });
});

describe('parseOutcomeNames', () => {
  it('keeps <nn>-<slug>.md, sorted by nn then slug', () => {
    expect(
      parseOutcomeNames(['01-b.md', '00-a.md', 'README.md', 'x.md', '02-c.txt', '10-z.md']),
    ).toEqual([
      { nn: 0, slug: 'a' },
      { nn: 1, slug: 'b' },
      { nn: 10, slug: 'z' },
    ]);
    expect(parseOutcomeNames(['03-b.md', '03-a.md'])).toEqual([
      { nn: 3, slug: 'a' },
      { nn: 3, slug: 'b' },
    ]);
  });
});

describe('parseGitLog', () => {
  const sha = 'a'.repeat(40);

  it('parses sha, subject and an ISO UTC time', () => {
    expect(parseGitLog(`${sha}\0feat: one\0${1767225600}\n`)).toEqual({
      sha,
      subject: 'feat: one',
      at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('cleans the subject and cuts it to 120 characters', () => {
    const c = parseGitLog(`${sha}\0a\u0007b\t${'x'.repeat(200)}\0${0}`);
    expect(c?.subject.startsWith('ab ')).toBe(true);
    expect(Array.from(c?.subject ?? '')).toHaveLength(120);
  });

  it.each([
    ['empty', ''],
    ['bad sha', `abc\0s\0${1}`],
    ['missing fields', `${sha}\0s`],
    ['non-numeric time', `${sha}\0s\0soon`],
    ['extra fields', `${sha}\0s\0${1}\0x`],
  ])('gives null (%s)', (_name, out) => {
    expect(parseGitLog(out)).toBeNull();
  });
});

describe('laneSlugOf and laneOf', () => {
  const harness: HarnessExtras = {
    lanes: [{ slug: 'x', letter: 'B', port: 8002, worktree: '.claude/worktrees/x' }],
    ctoGeneration: null,
    phase: null,
    wave: null,
    outcomes: [],
    lastCommit: null,
  };

  it('takes the segment after .claude/worktrees/', () => {
    expect(laneSlugOf('.')).toBeNull();
    expect(laneSlugOf('src')).toBeNull();
    expect(laneSlugOf('.claude/worktrees/')).toBeNull();
    expect(laneSlugOf('.claude/worktrees/x')).toBe('x');
    expect(laneSlugOf('.claude/worktrees/x/src')).toBe('x');
  });

  it('gives the matching lane without its worktree, else null', () => {
    expect(laneOf('.claude/worktrees/x/src', harness)).toEqual({ slug: 'x', letter: 'B', port: 8002 });
    expect(laneOf('.claude/worktrees/y', harness)).toBeNull();
    expect(laneOf('.', harness)).toBeNull();
    expect(laneOf('.claude/worktrees/x', null)).toBeNull();
  });
});
