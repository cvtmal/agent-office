// The launcher starts the built server with V8's young generation capped (RUN-3, fix-memory).
// Without `--max-semi-space-size` RSS with 20 watched transcripts goes over 150 MB; the flag only
// works on the node command line, so it lives in bin/agent-office and this test keeps it there.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const launcher = readFileSync(new URL('../bin/agent-office', import.meta.url), 'utf8');

describe('bin/agent-office', () => {
  it('starts the built server with --max-semi-space-size of at most 4 MB', () => {
    const line = launcher.split('\n').find((l) => /^\s*exec\b.*dist\/node\/server\/cli\.js/.test(l));
    expect(line, 'the exec line of dist/node/server/cli.js').toBeDefined();
    const size = /\s--max-semi-space-size=(\d+)\s/.exec(line ?? '')?.[1];
    expect(size, 'the flag on that line').toBeDefined();
    expect(Number(size)).toBeLessThanOrEqual(4);
  });
});
