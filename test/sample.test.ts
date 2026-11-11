import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSample } from '../fixtures/gen/sample.js';
import { ACTIVITY_KINDS, LANE_LETTERS, STATUSES, VERDICTS } from '../src/shared/constants.js';
import { toolKind } from '../src/shared/tools.js';
import type { Snapshot } from '../src/shared/types.js';
import { validateSnapshot } from '../src/shared/validate.js';
import { verdictFor } from '../src/shared/verdict.js';

const text = readFileSync(new URL('../fixtures/snapshots/sample.json', import.meta.url), 'utf8');
const sample = JSON.parse(text) as Snapshot;

describe('fixtures/snapshots/sample.json', () => {
  it('is a valid snapshot', () => {
    expect(validateSnapshot(sample)).toEqual([]);
  });

  it('equals what fixtures/gen/sample.ts builds (run `make fixtures` after changing it)', () => {
    expect(sample).toEqual(buildSample());
  });

  it('has 14 characters', () => {
    expect(sample.characters).toHaveLength(14);
  });

  it('covers every status, activity kind and verdict', () => {
    expect(new Set(sample.characters.map((c) => c.status))).toEqual(new Set(STATUSES));
    expect(new Set(sample.activities.map((a) => a.kind))).toEqual(new Set(ACTIVITY_KINDS));
    expect(new Set(sample.characters.map((c) => c.verdict))).toEqual(new Set(VERDICTS));
  });

  it('derives each verdict from tokens and role', () => {
    for (const c of sample.characters) expect(c.verdict, c.name).toBe(verdictFor(c.tokens, c.role));
  });

  it('derives each activity kind from its tool', () => {
    for (const a of sample.activities) expect(a.kind, a.tool).toBe(toolKind(a.tool));
  });

  it('has a harness project with outcomes and a wave', () => {
    const harness = sample.projects.filter((p) => p.harness !== null);
    expect(harness.some((p) => (p.harness?.outcomes.length ?? 0) > 0 && p.harness?.wave !== null)).toBe(true);
  });

  it('has a non-harness project with an agent', () => {
    const plain = new Set(sample.projects.filter((p) => p.harness === null).map((p) => p.id));
    expect(sample.characters.some((c) => c.kind === 'agent' && plain.has(c.projectId))).toBe(true);
  });

  it('has four lane sessions, one per letter', () => {
    const letters = sample.characters.filter((c) => c.kind === 'session' && c.lane !== null).map((c) => c.lane?.letter);
    expect(letters.sort()).toEqual([...LANE_LETTERS]);
  });

  it('contains no real home paths or Claude config paths', () => {
    expect(text).not.toContain('/Users/');
    expect(text).not.toContain('~/.claude');
  });
});
