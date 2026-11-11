import { describe, expect, it } from 'vitest';
import { basename, clean, hostOf, shapeTarget } from './target.js';

describe('shapeTarget (research D9 table)', () => {
  it.each([
    ['Read', { file_path: '/home/dev/project/src/main.ts', offset: 1 }, 'main.ts'],
    ['Write', { file_path: '/home/dev/project/notes.md', content: 'WRITE-SECRET' }, 'notes.md'],
    ['Edit', { file_path: '/home/dev/project/a.ts', old_string: 'x', new_string: 'y' }, 'a.ts'],
    ['NotebookEdit', { notebook_path: '/home/dev/project/nb.ipynb' }, 'nb.ipynb'],
    ['LSP', { filePath: '/home/dev/project/lsp.ts' }, 'lsp.ts'],
    ['LSP', { file_path: '/home/dev/project/other.ts' }, 'other.ts'],
    ['Grep', { pattern: 'secret', path: '/home/dev/project/src' }, 'src'],
    ['Grep', { pattern: 'secret' }, ''],
    ['Glob', { pattern: 'src/**/*.ts' }, '*.ts'],
    ['Glob', {}, ''],
    ['Bash', { command: 'git status --short', description: 'Show status' }, 'git'],
    ['Bash', { command: '/usr/bin/git log' }, 'git'],
    ['Monitor', { command: 'tail -f /home/dev/log.txt' }, 'tail'],
    ['WebFetch', { url: 'https://example.com/docs?q=1', prompt: 'PROMPT-SECRET' }, 'example.com'],
    ['WebSearch', { query: 'QUERY-SECRET' }, ''],
    ['mcp__claude-in-chrome__navigate', { url: 'https://example.org/path', tabId: 1 }, 'example.org'],
    ['mcp__claude-in-chrome__computer', { action: 'left_click', tabId: 1 }, 'left_click'],
    ['mcp__playwright__browser_type', { action: 'Type Secret Here', text: 'TEXT-SECRET' }, ''],
    ['mcp__playwright__browser_snapshot', {}, ''],
    ['Agent', { subagent_type: 'Explore', name: 'scout', description: 'DESC-SECRET', prompt: 'P' }, 'Explore'],
    ['Agent', { name: 'scout', description: 'DESC-SECRET' }, 'scout'],
    ['Agent', { description: 'DESC-SECRET', prompt: 'PROMPT-SECRET' }, ''],
    ['SendMessage', { to: 'team-lead', message: 'MESSAGE-SECRET' }, 'team-lead'],
    ['Skill', { skill: 'rpi:rpi-plan', args: 'ARGS-SECRET' }, 'rpi:rpi-plan'],
    ['Workflow', { name: 'nightly', input: 'x' }, 'nightly'],
    ['TodoWrite', { todos: [{ content: 'TODO-SECRET' }] }, ''],
    ['EnterPlanMode', {}, ''],
    ['ToolSearch', { query: 'select:Read' }, ''],
  ] as const)('%s %j → %j', (tool, input, target) => {
    expect(shapeTarget(tool, input)).toBe(target);
  });

  it('skips leading VAR=value tokens and takes the basename', () => {
    expect(shapeTarget('Bash', { command: 'API_KEY=x FOO=y /usr/bin/curl -H "Authorization: t"' })).toBe('curl');
  });

  it('strips quotes around the first word', () => {
    expect(shapeTarget('Bash', { command: '"/usr/local/bin/node" script.js' })).toBe('node');
  });

  it('drops a shell word outside the safe character class (P1)', () => {
    expect(shapeTarget('Bash', { command: 'sk$live$123 --flag' })).toBe('');
    expect(shapeTarget('Bash', { command: '' })).toBe('');
  });

  it('drops an identifier outside the safe character class (P1)', () => {
    expect(shapeTarget('SendMessage', { to: 'the token is abc' })).toBe('');
    expect(shapeTarget('Skill', { skill: 'x'.repeat(41) })).toBe('');
  });

  it('keeps the port and drops user-info, path and query of a URL', () => {
    expect(shapeTarget('WebFetch', { url: 'https://user:pw@host:8080/p?q=1' })).toBe('host:8080');
  });

  it('returns empty for a non-http URL or an invalid URL', () => {
    expect(shapeTarget('WebFetch', { url: 'ftp://x' })).toBe('');
    expect(shapeTarget('WebFetch', { url: 'not a url' })).toBe('');
  });

  it('returns empty for missing or non-string fields', () => {
    expect(shapeTarget('Read', {})).toBe('');
    expect(shapeTarget('Read', { file_path: 42 })).toBe('');
    expect(shapeTarget('Bash', { command: ['git'] })).toBe('');
  });

  it('returns empty for an unknown tool', () => {
    expect(shapeTarget('mcp__github__create_issue', { title: 'TITLE-SECRET' })).toBe('');
  });

  it('cuts a 60-char basename to 40 chars', () => {
    const name = 'a'.repeat(60);
    expect(shapeTarget('Read', { file_path: `/home/dev/${name}` })).toBe('a'.repeat(40));
  });

  it('removes control characters', () => {
    expect(shapeTarget('Read', { file_path: '/home/dev/ma\u0007in\u001b.ts' })).toBe('main.ts');
  });
});

describe('clean', () => {
  it('strips control chars, collapses whitespace, trims and cuts to 40', () => {
    expect(clean('  a\u0000b   c\u007f  ')).toBe('ab c');
    expect(clean('x'.repeat(50))).toHaveLength(40);
  });

  it('turns newlines and other control whitespace into one space, so words do not merge', () => {
    expect(clean('a\nb')).toBe('a b');
    expect(clean('one\r\ntwo\tthree\u000bfour\ffive')).toBe('one two three four five');
    expect(clean('a \u0000\n b')).toBe('a b');
  });
});

describe('basename', () => {
  it('takes the last non-empty segment after / or \\', () => {
    expect(basename('/home/dev/project/')).toBe('project');
    expect(basename('C:\\dev\\file.txt')).toBe('file.txt');
    expect(basename('plain')).toBe('plain');
    expect(basename('')).toBe('');
  });
});

describe('hostOf', () => {
  it('returns the host of http and https URLs only', () => {
    expect(hostOf('http://localhost:4477/api')).toBe('localhost:4477');
    expect(hostOf('https://example.com')).toBe('example.com');
    expect(hostOf('file:///home/dev/a')).toBe('');
    expect(hostOf('')).toBe('');
  });
});
