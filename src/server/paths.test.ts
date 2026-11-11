import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findRepoRoot, REPO_ROOT } from './paths.js';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('findRepoRoot', () => {
  it('finds the repo root from src/server', () => {
    const root = findRepoRoot(here);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string };
    expect(pkg.name).toBe('agent-office');
    expect(join(root, 'src', 'server')).toBe(resolve(here));
  });

  it('REPO_ROOT is the same directory', () => {
    expect(REPO_ROOT).toBe(findRepoRoot(here));
  });

  it('throws when there is no agent-office package.json above', () => {
    expect(() => findRepoRoot('/')).toThrow(/no agent-office package.json/);
  });
});
