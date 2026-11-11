// Where the repository is on disk. Works when the server runs from src/server
// (tsx) and from dist/node/server (compiled). Read only.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'agent-office';

function isRepoRoot(dir: string): boolean {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) return false;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown };
    return pkg.name === PACKAGE_NAME;
  } catch {
    return false;
  }
}

/** Walks up from `startDir` to the first directory whose package.json is ours. */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`no ${PACKAGE_NAME} package.json above ${startDir}`);
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
