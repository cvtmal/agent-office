---
paths:
  - "src/shared/**"
---

# src/shared rules

- Import only from other files in `src/shared/`. No Node built-ins (`node:*`, `fs`, `path`, ...), no DOM, no `src/server/` or `src/client/`; ESLint enforces it.
- Everything here is pure: no I/O, no globals, no clocks or randomness. Functions take what they need as arguments (e.g. `verdictFor(tokens, thresholds)`).
- `types.ts` is the API contract (DATA-7) and a #0 hotspot: add optional fields only, never rename, remove or retype; list every new field in your outcome file.
- New constants go in `constants.ts`; derive TypeScript types from them (`as const` arrays) rather than repeating string unions.
- Every new field of the contract gets a check in `validate.ts` and a test in `validate.test.ts`.
- Tests sit next to the code (`foo.test.ts`); they use no files and no network.
- Relative imports use the `.js` specifier.
