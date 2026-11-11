// The Claude config dir: $CLAUDE_CONFIG_DIR, else ~/.claude (ctx:510). Read-only.
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Expands a leading `~` or `~/` with `home`. */
function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/')) return join(home, path.slice(2));
  return path;
}

/**
 * `CLAUDE_CONFIG_DIR` when set and non-empty (`~` expanded), else `<home>/.claude`;
 * the real path when it exists, else the resolved path.
 */
export function configDir(env: Readonly<Record<string, string | undefined>>, home: string): string {
  const raw = env['CLAUDE_CONFIG_DIR'];
  const dir = resolve(raw ? expandHome(raw, home) : join(home, '.claude'));
  if (!existsSync(dir)) return dir;
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}
