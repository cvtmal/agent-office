import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { initialState } from '../app/store.js';
import { statusText } from './status.js';

const sample = sampleJson as unknown as Snapshot;

describe('statusText', () => {
  it('shows loading before the first snapshot', () => {
    expect(statusText(initialState())).toBe('Agent Office · loading');
  });

  it('counts characters', () => {
    expect(statusText({ ...initialState(), snapshot: sample, connection: 'ready' })).toBe(
      'Agent Office · 14 characters',
    );
  });

  it('shows the error', () => {
    expect(statusText({ ...initialState(), connection: 'error', error: 'offline' })).toBe('Agent Office · offline');
  });
});
