# fixtures

Synthetic test data, written from code: `gen/sample.ts` (`make fixtures`) writes `snapshots/sample.json` (14 characters, 2 projects). Later: `transcripts/` (unit cases) and `replay/` (replay sets).

- **May import:** `src/shared/` and Node built-ins (generators only).
- **May not contain:** real paths, real session ids, real prompts, or anything copied from a Claude config dir. Ids come from `syntheticUuid()`.
- **Owner:** cycle #0 (`sample.json` is a hotspot: add characters or fields for your case, never change existing ones); #1 transcripts and replay sets.
