// The sample snapshot the server answers with until the live model exists.
// Replaced by the live model in cycle #3.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from '../shared/types.js';
import { validateSnapshot } from '../shared/validate.js';
import { REPO_ROOT } from './paths.js';

export function loadSampleSnapshot(root: string = REPO_ROOT): Snapshot {
  const data: unknown = JSON.parse(readFileSync(join(root, 'fixtures', 'snapshots', 'sample.json'), 'utf8'));
  const errors = validateSnapshot(data);
  if (errors.length > 0) throw new Error('sample.json is invalid:\n' + errors.join('\n'));
  return data as Snapshot;
}
