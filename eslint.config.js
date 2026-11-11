// ESLint flat config: TypeScript strict rules plus the module boundaries of
// docs/rpi-cycles.md S2 and the server write ban of scope P-1.
import { builtinModules } from 'node:module';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Every Node built-in by its bare name (`fs`, `fs/promises`, ...). */
const BUILTINS = builtinModules.filter((name) => !name.startsWith('_'));

/** Import patterns that reach into another module folder. */
const toServer = ['**/server', '**/server/**'];
const toClient = ['**/client', '**/client/**'];

/** File-system functions that write; only src/server/var.ts may use them. */
const WRITE_FNS = [
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'mkdir',
  'mkdirSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'unlink',
  'unlinkSync',
  'rename',
  'renameSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'truncate',
  'truncateSync',
  'symlink',
  'symlinkSync',
  'chmod',
  'chmodSync',
  'utimes',
  'utimesSync',
];

const WRITE_MESSAGE = 'Writes go through src/server/var.ts (scope P-1)';

const writeBanPaths = ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({
  name,
  importNames: WRITE_FNS,
  message: WRITE_MESSAGE,
}));

const writeBanSyntax = {
  selector: `CallExpression[callee.type='MemberExpression'][callee.property.name=/^(${WRITE_FNS.join('|')})$/]`,
  message: WRITE_MESSAGE,
};

export default defineConfig([
  {
    ignores: [
      'dist/',
      'node_modules/',
      'var/',
      '.claude/',
      '.rpi-tracking/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: ['src/client/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/client/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: BUILTINS, patterns: ['node:*', ...toServer, ...toClient] },
      ],
    },
  },
  {
    files: ['src/client/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: BUILTINS, patterns: ['node:*', ...toServer] }],
    },
  },
  {
    files: ['src/server/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: writeBanPaths, patterns: toClient }],
      'no-restricted-syntax': ['error', writeBanSyntax],
    },
  },
  {
    // The rule values below replace the ones above, so the boundary is restated.
    files: ['src/server/var.ts', 'src/server/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: toClient }],
      'no-restricted-syntax': 'off',
    },
  },
]);
