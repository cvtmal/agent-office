// A small path glob matcher for the config file's `exclude` (research R10: `path.matchesGlob` is
// unverified on Node 22). Pure. `~/` is expanded by the caller.

const cache = new Map<string, RegExp>();

/** Escapes one character for a regular expression (`/` needs none in `new RegExp`). */
function escape(ch: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(ch) ? `\\${ch}` : ch;
}

/**
 * The anchored, case-sensitive regular expression for `pattern`: `*` is any run without `/`,
 * `?` one character other than `/`, `**` any run including `/`. A whole `**` segment also
 * matches no segment: `a/**` matches `a`, and a leading `**` followed by `/b` matches `b`.
 */
export function globToRegExp(pattern: string): RegExp {
  const hit = cache.get(pattern);
  if (hit) return hit;
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern.charAt(i);
    if (ch === '*' && pattern.charAt(i + 1) === '*') {
      const segmentStart = i === 0 || pattern.charAt(i - 1) === '/';
      const next = pattern.charAt(i + 2);
      if (segmentStart && next === '/') {
        out += '(?:.*/)?';
        i += 3;
      } else if (segmentStart && next === '' && i > 0) {
        // `a/**`: replace the `/` already emitted, so `a` and `a/...` both match.
        out = out.slice(0, -1) + '(?:/.*)?';
        i += 2;
      } else {
        out += '.*';
        i += 2;
      }
    } else if (ch === '*') {
      out += '[^/]*';
      i += 1;
    } else if (ch === '?') {
      out += '[^/]';
      i += 1;
    } else {
      out += escape(ch);
      i += 1;
    }
  }
  const re = new RegExp(`^${out}$`);
  cache.set(pattern, re);
  return re;
}

/** Whether all of `path` matches `pattern` (see `globToRegExp`). */
export function globMatch(pattern: string, path: string): boolean {
  return globToRegExp(pattern).test(path);
}
