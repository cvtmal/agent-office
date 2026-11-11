import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { ManifestError, parseManifest, readManifest } from './manifest.js';

const SETS = fileURLToPath(new URL('../../../fixtures/replay/', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'agent-office-manifest-'));

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const shipped = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(SETS, name, 'manifest.json'), 'utf8')) as Record<string, unknown>;

describe('readManifest', () => {
  it('loads both shipped sets', () => {
    const solo = readManifest(join(SETS, 'solo'));
    expect(solo.name).toBe('solo');
    expect(solo.live).toHaveLength(1);
    const harness = readManifest(join(SETS, 'harness'));
    expect(harness.repos).toEqual([{ root: '/home/dev/code/harbor', dir: 'repo' }]);
    expect(harness.files.map((f) => f.as ?? null)).toEqual([null, 'repo/docs/harness/STATE.md']);
  });

  it('names the broken field of a manifest on disk', () => {
    const broken = { ...shipped('harness'), durationMs: 'long' };
    writeFileSync(join(tmp, 'manifest.json'), JSON.stringify(broken));
    expect(() => readManifest(tmp)).toThrow(ManifestError);
    expect(() => readManifest(tmp)).toThrow(/durationMs: expected a number greater than 0/);
  });

  it('reports a missing file and bad JSON', () => {
    expect(() => readManifest(join(tmp, 'missing'))).toThrow(/\(file\): cannot be read/);
    writeFileSync(join(tmp, 'manifest.json'), '{nope');
    expect(() => readManifest(tmp)).toThrow(/\(json\)/);
  });
});

describe('parseManifest', () => {
  const harness = shipped('harness');
  const files = harness.files as Record<string, unknown>[];
  const live = harness.live as Record<string, unknown>[];

  it.each([
    [{ ...harness, name: '' }, /name: expected a non-empty string/],
    [{ ...harness, base: 'yesterday' }, /base: expected an ISO time/],
    [{ ...harness, home: 'home' }, /home: expected an absolute path/],
    [{ ...harness, repos: [{ root: '/x', dir: '../up' }] }, /repos\[0\]\.dir:/],
    [{ ...harness, live: [{ ...live[0], toMs: -1 }] }, /live\[0\]\.toMs:/],
    [{ ...harness, files: [files[0], { ...files[1], as: '/abs' }] }, /files\[1\]\.as: expected a set-relative path/],
    [{ ...harness, files: [{ ...files[0], appearsAtMs: null }] }, /files\[0\]\.appearsAtMs:/],
    [[], /\(root\): expected an object/],
  ])('rejects %#', (value, message) => {
    expect(() => parseManifest(value)).toThrow(message);
  });
});
