import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appendVarFile, copyIntoVar, removeVarDir, varDir, writeVarFile } from './var.js';

const root = mkdtempSync(join(tmpdir(), 'agent-office-var-'));
const ESCAPES = ['../x', '/etc/x', 'a/../../x', '.'];

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('writeVarFile', () => {
  it('writes a nested file under <root>/var/', () => {
    const path = writeVarFile('a/b.json', '{"ok":true}', root);
    expect(path).toBe(join(varDir(root), 'a', 'b.json'));
    expect(readFileSync(path, 'utf8')).toBe('{"ok":true}');
  });

  it.each(ESCAPES)('refuses %s', (rel) => {
    expect(() => writeVarFile(rel, 'x', root)).toThrow();
  });
});

describe('appendVarFile', () => {
  it('creates the file and its parents, then appends', () => {
    const path = appendVarFile('log/deep/x.jsonl', 'one\n', root);
    appendVarFile('log/deep/x.jsonl', 'two\n', root);
    expect(path).toBe(join(varDir(root), 'log', 'deep', 'x.jsonl'));
    expect(readFileSync(path, 'utf8')).toBe('one\ntwo\n');
  });

  it.each(ESCAPES)('refuses %s', (rel) => {
    expect(() => appendVarFile(rel, 'x', root)).toThrow();
  });
});

describe('copyIntoVar', () => {
  const src = join(root, 'source.txt');
  writeFileSync(src, 'copied');

  it('copies a file into a new nested dir and replaces an existing one', () => {
    const path = copyIntoVar(src, 'copy/a/b.txt', root);
    expect(readFileSync(path, 'utf8')).toBe('copied');
    writeVarFile('copy/a/c.txt', 'old', root);
    expect(readFileSync(copyIntoVar(src, 'copy/a/c.txt', root), 'utf8')).toBe('copied');
  });

  it.each(ESCAPES)('refuses %s', (rel) => {
    expect(() => copyIntoVar(src, rel, root)).toThrow();
  });
});

describe('removeVarDir', () => {
  it('removes a directory tree under var/ and accepts a missing one', () => {
    writeVarFile('gone/a/b.txt', 'x', root);
    removeVarDir('gone', root);
    expect(existsSync(join(varDir(root), 'gone'))).toBe(false);
    expect(() => removeVarDir('gone', root)).not.toThrow();
    expect(existsSync(varDir(root))).toBe(true);
  });

  it.each(ESCAPES)('refuses %s', (rel) => {
    expect(() => removeVarDir(rel, root)).toThrow();
    expect(existsSync(root)).toBe(true);
  });
});
