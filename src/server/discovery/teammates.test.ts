import { describe, expect, it } from 'vitest';
import type { ProcessRow } from './processes.js';
import { teammateProcs } from './teammates.js';

function table(...commands: string[]): Map<number, ProcessRow> {
  return new Map(commands.map((command, i) => [i + 1, { pid: i + 1, startedAt: null, command }]));
}

describe('teammateProcs', () => {
  it('matches a teammate command', () => {
    expect(teammateProcs(table('node /home/dev/bin/claude --agent-name dev-1 --team-name core --model x'))).toEqual([
      { agentName: 'dev-1', teamName: 'core' },
    ]);
  });

  it('accepts --flag=value', () => {
    expect(teammateProcs(table('claude --team-name=core --agent-name=rev'))).toEqual([
      { agentName: 'rev', teamName: 'core' },
    ]);
  });

  it('ignores a plain claude command, a non-claude process and half-flagged commands', () => {
    expect(
      teammateProcs(
        table('claude', '/usr/bin/vim notes.txt', 'claude --agent-name dev', 'claude --agent-name --team-name core'),
      ),
    ).toEqual([]);
  });

  it('deduplicates', () => {
    const cmd = 'claude --agent-name dev --team-name core';
    expect(teammateProcs(table(cmd, cmd, 'claude --agent-name dev --team-name other'))).toEqual([
      { agentName: 'dev', teamName: 'core' },
      { agentName: 'dev', teamName: 'other' },
    ]);
  });
});
