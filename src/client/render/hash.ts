// Stable 32-bit FNV-1a hash over UTF-8 (plan P-5): looks, themes and idle phases
// derive from ids with it, so the same id always gets the same result. DOM-free.

const OFFSET = 0x811c9dc5;
const PRIME = 0x01000193;

/** 32-bit FNV-1a of the UTF-8 bytes of `s`, as an unsigned integer. */
export function fnv1a(s: string): number {
  let h = OFFSET;
  const byte = (b: number): void => {
    h = Math.imul(h ^ b, PRIME);
  };
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) {
      byte(cp);
    } else if (cp < 0x800) {
      byte(0xc0 | (cp >> 6));
      byte(0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      byte(0xe0 | (cp >> 12));
      byte(0x80 | ((cp >> 6) & 0x3f));
      byte(0x80 | (cp & 0x3f));
    } else {
      byte(0xf0 | (cp >> 18));
      byte(0x80 | ((cp >> 12) & 0x3f));
      byte(0x80 | ((cp >> 6) & 0x3f));
      byte(0x80 | (cp & 0x3f));
    }
  }
  return h >>> 0;
}
