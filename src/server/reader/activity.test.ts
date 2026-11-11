import { describe, expect, it } from 'vitest';
import type { Activity } from '../../shared/types.js';
import { activitiesOf, lastActivities } from './activity.js';
import { normalise, type Rec } from './records.js';

const BASE = Date.parse('2026-01-01T00:00:00Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

function call(seconds: number, name: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}): Rec {
  return normalise({
    type: 'assistant',
    timestamp: at(seconds),
    ...extra,
    message: { content: [{ type: 'tool_use', id: `t${seconds}`, name, input }], stop_reason: 'tool_use' },
  });
}

describe('activitiesOf', () => {
  it('yields one activity per tool_use block with kind and target', () => {
    const records = [
      call(1, 'Read', { file_path: '/home/dev/project/a.ts' }),
      call(2, 'Edit', { file_path: '/home/dev/project/b.ts' }),
      call(3, 'Bash', { command: 'npm test' }),
      call(4, 'mcp__claude-in-chrome__navigate', { url: 'https://example.com/x' }),
      call(5, 'Agent', { subagent_type: 'Explore' }),
      call(6, 'TodoWrite', { todos: [] }),
      call(7, 'ToolSearch', { query: 'x' }),
    ];
    expect(activitiesOf(records, 'session', 'char-1')).toEqual([
      { characterId: 'char-1', at: at(1), tool: 'Read', kind: 'read', target: 'a.ts' },
      { characterId: 'char-1', at: at(2), tool: 'Edit', kind: 'write', target: 'b.ts' },
      { characterId: 'char-1', at: at(3), tool: 'Bash', kind: 'shell', target: 'npm' },
      { characterId: 'char-1', at: at(4), tool: 'mcp__claude-in-chrome__navigate', kind: 'web', target: 'example.com' },
      { characterId: 'char-1', at: at(5), tool: 'Agent', kind: 'delegate', target: 'Explore' },
      { characterId: 'char-1', at: at(6), tool: 'TodoWrite', kind: 'plan', target: '' },
      { characterId: 'char-1', at: at(7), tool: 'ToolSearch', kind: 'other', target: '' },
    ]);
  });

  it('ignores api-request-blob records that copy tool_use blocks', () => {
    const blob = normalise({
      type: 'api-request-blob',
      timestamp: at(1),
      message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/home/dev/a.ts' } }] },
    });
    expect(activitiesOf([blob], 'session', 'c')).toEqual([]);
  });

  it('ignores user records and non-tool blocks', () => {
    const records = [
      normalise({ type: 'user', timestamp: at(1), message: { content: [{ type: 'tool_result' }] } }),
      normalise({ type: 'assistant', timestamp: at(2), message: { content: [{ type: 'text', text: 'hi' }] } }),
    ];
    expect(activitiesOf(records, 'session', 'c')).toEqual([]);
  });

  it('skips records without a timestamp', () => {
    const rec = normalise({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] },
    });
    expect(activitiesOf([rec], 'agent', 'c')).toEqual([]);
  });

  it('ignores sidechain records in a session file and keeps them in an agent file', () => {
    const records = [call(1, 'Read', { file_path: '/home/dev/a.ts' }, { isSidechain: true })];
    expect(activitiesOf(records, 'session', 'c')).toEqual([]);
    expect(activitiesOf(records, 'agent', 'c')).toHaveLength(1);
  });

  it('detail mode adds the raw input as detail; off leaves no detail key at all', () => {
    const records = [call(1, 'Edit', { file_path: '/home/dev/project/b.ts', old_string: 'x', new_string: 'y' })];
    expect(activitiesOf(records, 'session', 'c', { detail: true })).toEqual([
      {
        characterId: 'c',
        at: at(1),
        tool: 'Edit',
        kind: 'write',
        target: 'b.ts',
        detail: '{"file_path":"/home/dev/project/b.ts","old_string":"x","new_string":"y"}',
      },
    ]);
    for (const off of [activitiesOf(records, 'session', 'c'), activitiesOf(records, 'session', 'c', { detail: false })]) {
      expect(off).toHaveLength(1);
      expect(Object.keys(off[0] ?? {})).not.toContain('detail');
    }
  });
});

describe('lastActivities', () => {
  it('keeps the last 10 of 12 calls by default', () => {
    const records = Array.from({ length: 12 }, (_, i) => call(i, 'Read', { file_path: `/home/dev/f${i}.ts` }));
    const last = lastActivities(activitiesOf(records, 'session', 'c'));
    expect(last).toHaveLength(10);
    expect(last.map((a: Activity) => a.target)).toEqual(Array.from({ length: 10 }, (_, i) => `f${i + 2}.ts`));
  });

  it('takes an explicit n', () => {
    const records = [call(1, 'Read', {}), call(2, 'Edit', {}), call(3, 'Bash', {})];
    expect(lastActivities(activitiesOf(records, 'session', 'c'), 2).map((a) => a.tool)).toEqual(['Edit', 'Bash']);
  });
});
