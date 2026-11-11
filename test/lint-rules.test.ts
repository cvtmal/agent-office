// The S2 import boundaries and the server write ban (scope P-1) each have a
// failing case here, linted against the real eslint.config.js.
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/server/paths.js';

const eslint = new ESLint({ cwd: REPO_ROOT });

/** Rule ids reported for `code` linted as if it lived at `filePath` (virtual, need not exist). */
async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result).toBeDefined();
  const messages = result?.messages ?? [];
  expect(messages.filter((m) => m.fatal === true)).toEqual([]);
  return messages.map((m) => m.ruleId ?? '');
}

const IMPORT = 'no-restricted-imports';
const SYNTAX = 'no-restricted-syntax';

/** `[code, rule, banned]`: banned means the rule must report, otherwise it must not. */
type Case = [code: string, rule: string, banned: boolean];

const cases: Record<string, Case[]> = {
  'src/shared/x.ts': [
    ["export * from '../server/a.js';", IMPORT, true],
    ["export * from '../client/a.js';", IMPORT, true],
    ["export * from 'node:fs';", IMPORT, true],
    ["export * from 'path';", IMPORT, true],
    ["export * from './constants.js';", IMPORT, false],
  ],
  'src/client/x.ts': [
    ["export * from '../server/a.js';", IMPORT, true],
    ["export * from '../../server/b.js';", IMPORT, true],
    ["export * from 'node:path';", IMPORT, true],
    ["export * from '../shared/types.js';", IMPORT, false],
  ],
  'src/server/x.ts': [
    ["export * from '../client/a.js';", IMPORT, true],
    ["import { writeFileSync } from 'node:fs';\nwriteFileSync('a', 'b');", IMPORT, true],
    ["import fs from 'node:fs';\nfs.writeFileSync('a', 'b');", SYNTAX, true],
    ["import { writeFile } from 'node:fs/promises';\nawait writeFile('a', 'b');", IMPORT, true],
    ["import { readFileSync } from 'node:fs';\nreadFileSync('a');", IMPORT, false],
    ["export * from '../shared/types.js';", IMPORT, false],
  ],
  'src/server/var.ts': [
    ["import { writeFileSync } from 'node:fs';\nwriteFileSync('a', 'b');", IMPORT, false],
    ["import { writeFileSync } from 'node:fs';\nwriteFileSync('a', 'b');", SYNTAX, false],
    ["export * from '../client/a.js';", IMPORT, true],
  ],
};

describe('lint rules', () => {
  for (const [file, fileCases] of Object.entries(cases)) {
    describe(file, () => {
      for (const [code, rule, banned] of fileCases) {
        it(`${banned ? 'bans' : 'allows'} ${code.split('\n')[0] ?? code} (${rule})`, async () => {
          const ids = await ruleIds(code, `${REPO_ROOT}/${file}`);
          expect(ids.includes(rule)).toBe(banned);
        });
      }
    });
  }
});
