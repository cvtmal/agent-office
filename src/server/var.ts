// The one place the server may write files: everything goes under <repo>/var/
// (scope P-1). ESLint bans fs write functions in every other server file.
// Used by the replay player (`replay/player.ts`) for its working copy under `var/replay/`.
import { appendFileSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { REPO_ROOT } from './paths.js';

export function varDir(root: string = REPO_ROOT): string {
  return join(root, 'var');
}

/**
 * The absolute path of `<root>/var/<rel>`. Refuses absolute paths, `var/` itself and any path
 * that resolves outside `<root>/var/`.
 */
function varPath(rel: string, root: string): string {
  if (isAbsolute(rel)) throw new Error(`var path must be relative: ${rel}`);
  const base = resolve(varDir(root));
  const target = resolve(base, rel);
  const inside = relative(base, target);
  if (inside === '' || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) {
    throw new Error(`var path escapes var/: ${rel}`);
  }
  return target;
}

/** Writes `data` to `<root>/var/<rel>`, creating parent directories. */
export function writeVarFile(rel: string, data: string | Uint8Array, root: string = REPO_ROOT): string {
  const target = varPath(rel, root);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return target;
}

/** Appends `data` to `<root>/var/<rel>` (created if missing), creating parent directories. */
export function appendVarFile(rel: string, data: string | Uint8Array, root: string = REPO_ROOT): string {
  const target = varPath(rel, root);
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(target, data);
  return target;
}

/** Copies the file `srcAbs` to `<root>/var/<rel>` (replacing it), creating parent directories. */
export function copyIntoVar(srcAbs: string, rel: string, root: string = REPO_ROOT): string {
  const target = varPath(rel, root);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(srcAbs, target);
  return target;
}

/** Removes `<root>/var/<rel>` recursively; a missing path is fine. Never `var/` itself. */
export function removeVarDir(rel: string, root: string = REPO_ROOT): void {
  rmSync(varPath(rel, root), { recursive: true, force: true });
}
