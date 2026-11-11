# reader: pure functions from transcript records to status, activities, tokens and health; cycle #1.

Pure: no file, process or clock access; everything comes in as arguments. Records are normalised once (`records.ts`) and never keep prompt, text, thinking or result content.

- `buildModel(discovered, { now, home, thresholds, rootOf })` → `{ snapshot, liveBy }` (`model.ts`); `buildSnapshot` returns only the snapshot. `../snapshot.ts` `scanSnapshot()` wires discovery and reader together.
- `parseTranscript(text)`, `normalise(value)`, `mainRecords(records, kind)` — `records.ts`.
- `shapeTarget(tool, input)`, `clean(s)` — `target.ts`: the only place a tool input becomes text for the API (D9 + P1).
- `activitiesOf`, `lastActivities` — `activity.ts`; `transcriptStatus`, `registryStatus`, `sessionStatus`, `agentStatus` — `status.ts`.
- `lastUsage`, `thresholdsFromEnv` (throws `ThresholdEnvError`) — `tokens.ts`; `transcriptHealth`, `mergeHealth` — `health.ts`; `sessionName`, `agentDisplayName` — `names.ts`.
