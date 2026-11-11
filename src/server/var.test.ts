import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { varDir, writeVarFile } from './var.js';

const root = mkdtempSync(join(tmpdir(), 'agent-office-var-'));

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('writeVarFile', () => {
  it('writes a nested file under <root>/var/', () => {
    const path = writeVarFile('a/b.json', '{"ok":true}', root);
    expect(path).toBe(join(varDir(root), 'a', 'b.json'));
    expect(readFileSync(path, 'utf8')).toBe('{"ok":true}');
  });

  it.each(['../x', '/etc/x', 'a/../../x', '.'])('refuses %s', (rel) => {
    expect(() => writeVarFile(rel, 'x', root)).toThrow();
  });
});
