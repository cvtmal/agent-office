import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT } from '../../shared/constants.js';
import { parseLaneEnv, resolvePort } from './port.js';

describe('parseLaneEnv', () => {
  it('reads KEY=VALUE lines and skips comments and blanks', () => {
    const text = '# lane\nHARNESS_SLUG=demo\n\n  # indented comment\nHARNESS_PORT=8001\nnot a pair\n';
    expect(parseLaneEnv(text)).toEqual({ HARNESS_SLUG: 'demo', HARNESS_PORT: '8001' });
  });

  it('keeps = signs inside the value', () => {
    expect(parseLaneEnv('A=b=c')).toEqual({ A: 'b=c' });
  });
});

describe('resolvePort', () => {
  const laneEnv = { HARNESS_PORT: '8003' };

  it('--port wins over everything', () => {
    const env = { PORT: '9001', HARNESS_PORT: '9002' };
    expect(resolvePort({ flag: '9000', env, laneEnv })).toEqual({ port: 9000 });
  });

  it('PORT wins over HARNESS_PORT', () => {
    expect(resolvePort({ env: { PORT: '9001', HARNESS_PORT: '9002' }, laneEnv })).toEqual({ port: 9001 });
  });

  it('HARNESS_PORT from the environment wins over .lane.env', () => {
    expect(resolvePort({ env: { HARNESS_PORT: '9002' }, laneEnv })).toEqual({ port: 9002 });
  });

  it('HARNESS_PORT from .lane.env is used when the environment has none', () => {
    expect(resolvePort({ env: {}, laneEnv })).toEqual({ port: 8003 });
  });

  it('falls back to DEFAULT_PORT', () => {
    expect(resolvePort({ env: {}, laneEnv: {} })).toEqual({ port: DEFAULT_PORT });
  });

  it('accepts 0 (tests)', () => {
    expect(resolvePort({ flag: '0', env: {}, laneEnv: {} })).toEqual({ port: 0 });
  });

  it.each(['abc', '70000', '8.5', '-1', '65536'])('rejects %s', (value) => {
    const result = resolvePort({ flag: value, env: {}, laneEnv: {} });
    expect(result).toEqual({ error: expect.stringContaining('--port') as unknown });
  });

  it('names the source of an invalid value', () => {
    const result = resolvePort({ env: { PORT: 'abc' }, laneEnv: {} });
    expect(result).toEqual({ error: expect.stringContaining('PORT') as unknown });
  });
});
