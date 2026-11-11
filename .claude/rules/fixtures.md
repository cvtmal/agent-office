---
paths:
  - "fixtures/**"
---

# fixtures rules

- Fixtures are synthetic: no real paths (nothing under a real home dir), real session ids, real prompts, or anything copied from a Claude config dir. The repo is public.
- Ids come from `syntheticUuid()` in `gen/sample.ts`; timestamps are fixed, never `Date.now()`.
- `snapshots/sample.json` is generated: change `gen/sample.ts`, run `make fixtures`, commit both. `test/sample.test.ts` checks the file equals the generator output.
- `sample.json` is a #0 hotspot: add characters or fields for your own case, never change existing ones.
- The sample must stay valid under `validateSnapshot` and keep its coverage (every activity kind, every verdict).
- Generators import only from `src/shared/` and Node built-ins, and write only their own fixture files.
- `transcripts/` (unit cases) and `replay/` (replay sets) belong to #1; keep each case small and named after what it covers.
