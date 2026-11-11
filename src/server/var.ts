// The one place the server may write files: everything goes under <repo>/var/
// (scope P-1). ESLint bans fs write functions in every other server file.
// Not used by the app yet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { REPO_ROOT } from './paths.js';

export function varDir(root: string = REPO_ROOT): string {
  return join(root, 'var');
}

/**
 * Writes `data` to `<root>/var/<rel>`, creating parent directories. Refuses
 * absolute paths and any path that resolves outside `<root>/var/`.
 */
export function writeVarFile(rel: string, data: string | Uint8Array, root: string = REPO_ROOT): string {
  if (isAbsolute(rel)) throw new Error(`var path must be relative: ${rel}`);
  const base = resolve(varDir(root));
  const target = resolve(base, rel);
  const inside = relative(base, target);
  if (inside === '' || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) {
    throw new Error(`var path escapes var/: ${rel}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return target;
}
