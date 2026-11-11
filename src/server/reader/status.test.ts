import { describe, expect, it } from 'vitest';
import type { AgentMeta, RegistryEntry } from '../discovery/types.js';
import { normalise, type Rec } from './records.js';
import { agentStatus, registryStatus, sessionStatus, transcriptStatus } from './status.js';

const rec = (value: Record<string, unknown>): Rec => normalise(value);
const user = (extra: Record<string, unknown> = {}): Rec => rec({ type: 'user', message: { content: 'hi' }, ...extra });
const assistant = (message: Record<string, unknown>, extra: Record<string, unknown> = {}): Rec =>
  rec({ type: 'assistant', message, ...extra });
const endTurn = (extra: Record<string, unknown> = {}): Rec =>
  assistant({ content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' }, extra);
const toolUse = (): Rec =>
  assistant({ content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }], stop_reason: 'tool_use' });

function entry(status: string | null): RegistryEntry {
  return { pid: 1, sessionId: 'sid', procStart: null, status, updatedAt: 0, cwd: null, name: null };
}

function meta(over: Partial<AgentMeta> = {}): AgentMeta {
  return { agentType: null, description: null, name: null, finished: false, stoppedByUser: false, ...over };
}

describe('transcriptStatus', () => {
  it('is idle after an assistant end_turn', () => {
    expect(transcriptStatus([user(), endTurn()], 'session')).toBe('idle');
  });

  it('is idle after a stop_hook_summary or turn_duration system record', () => {
    expect(transcriptStatus([user(), rec({ type: 'system', subtype: 'stop_hook_summary' })], 'session')).toBe('idle');
    expect(transcriptStatus([user(), rec({ type: 'system', subtype: 'turn_duration' })], 'session')).toBe('idle');
  });

  it('is busy after an assistant tool_use block', () => {
    const block = assistant({ content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }] });
    expect(transcriptStatus([user(), block], 'session')).toBe('busy');
  });

  it('is busy after an assistant with stop_reason tool_use', () => {
    expect(transcriptStatus([user(), assistant({ content: [], stop_reason: 'tool_use' })], 'session')).toBe('busy');
    expect(transcriptStatus([user(), toolUse()], 'session')).toBe('busy');
  });

  it('is busy after a user record (prompt or tool_result)', () => {
    expect(transcriptStatus([endTurn(), user()], 'session')).toBe('busy');
    const result = rec({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } });
    expect(transcriptStatus([toolUse(), result], 'session')).toBe('busy');
  });

  it('is idle with no relevant record', () => {
    expect(transcriptStatus([], 'session')).toBe('idle');
    expect(transcriptStatus([rec({ type: 'custom-title', customTitle: 'x' })], 'session')).toBe('idle');
  });

  it('is busy after an assistant text block without stop reason (P2)', () => {
    expect(transcriptStatus([user(), assistant({ content: [{ type: 'text', text: 'x' }] })], 'session')).toBe('busy');
  });

  it('ignores other records and other system subtypes', () => {
    const records = [user(), endTurn(), rec({ type: 'system', subtype: 'compact_boundary' }), rec({ type: 'ai-title' })];
    expect(transcriptStatus(records, 'session')).toBe('idle');
    expect(transcriptStatus([endTurn(), rec({ type: 'system', subtype: 'informational' }), user()], 'session')).toBe(
      'busy',
    );
  });

  it('skips sidechain records in a session file but not in an agent file', () => {
    const records = [endTurn(), user({ isSidechain: true })];
    expect(transcriptStatus(records, 'session')).toBe('idle');
    expect(transcriptStatus(records, 'agent')).toBe('busy');
  });
});

describe('registryStatus', () => {
  it('maps the registry enum', () => {
    expect(registryStatus('busy')).toBe('busy');
    expect(registryStatus('shell')).toBe('busy');
    expect(registryStatus('waiting')).toBe('waiting');
    expect(registryStatus('idle')).toBe('idle');
  });

  it('is null for absent or unknown values', () => {
    expect(registryStatus(null)).toBeNull();
    expect(registryStatus('live')).toBeNull();
    expect(registryStatus('')).toBeNull();
  });
});

describe('sessionStatus', () => {
  it('row 1: a registered session takes the registry status', () => {
    expect(sessionStatus('registry', entry('waiting'), [endTurn()])).toBe('waiting');
    expect(sessionStatus('registry', entry('shell'), [endTurn()])).toBe('busy');
    expect(sessionStatus('registry', entry('idle'), [user()])).toBe('idle');
  });

  it('row 1: a registered session without a known status uses the transcript rule', () => {
    expect(sessionStatus('registry', entry(null), [user()])).toBe('busy');
    expect(sessionStatus('registry', entry('live'), [endTurn()])).toBe('idle');
  });

  it('row 2: a live teammate uses the transcript rule and never waits', () => {
    expect(sessionStatus('teammate', null, [user()])).toBe('busy');
    expect(sessionStatus('teammate', entry('waiting'), [endTurn()])).toBe('idle');
  });

  it('row 3: a session that is not live is ended', () => {
    expect(sessionStatus(null, null, [user()])).toBe('ended');
    expect(sessionStatus(null, entry('busy'), [user()])).toBe('ended');
  });
});

describe('agentStatus', () => {
  it('row 4: parent not live → ended', () => {
    expect(agentStatus(false, meta({ stoppedByUser: true, finished: true }))).toBe('ended');
  });

  it('row 5: stopped by user → stopped', () => {
    expect(agentStatus(true, meta({ stoppedByUser: true, finished: true }))).toBe('stopped');
  });

  it('row 6: finished → idle', () => {
    expect(agentStatus(true, meta({ finished: true }))).toBe('idle');
  });

  it('row 7: else busy (also without meta)', () => {
    expect(agentStatus(true, meta())).toBe('busy');
    expect(agentStatus(true, null)).toBe('busy');
  });
});
