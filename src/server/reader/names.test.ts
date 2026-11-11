import { describe, expect, it } from 'vitest';
import type { AgentMeta } from '../discovery/types.js';
import { agentDisplayName, sessionName } from './names.js';
import { normalise, type Rec } from './records.js';

const SID = 'aaaaaaaa-1111-4222-8333-444444444444';
const rec = (value: Record<string, unknown>): Rec => normalise(value);

const customTitle = (title: string): Rec => rec({ type: 'custom-title', customTitle: title });
const agentNameRec = (name: string): Rec => rec({ type: 'agent-name', agentName: name });
const withAgentName = (name: string): Rec => rec({ type: 'user', agentName: name });
const aiTitle = (title: string): Rec => rec({ type: 'ai-title', aiTitle: title });

function meta(over: Partial<AgentMeta> = {}): AgentMeta {
  return { agentType: null, description: null, name: null, finished: false, stoppedByUser: false, ...over };
}

describe('sessionName', () => {
  const all = [aiTitle('ai'), withAgentName('field'), agentNameRec('agent-name'), customTitle('custom')];

  it('1: registry name', () => {
    expect(sessionName(SID, 'registry', 'file', all)).toBe('registry');
  });

  it('2: custom-title.json', () => {
    expect(sessionName(SID, null, 'file', all)).toBe('file');
  });

  it('3: newest custom-title record', () => {
    expect(sessionName(SID, null, null, [customTitle('old'), ...all, customTitle('new')])).toBe('new');
  });

  it('4: newest agent-name record', () => {
    const records = [agentNameRec('old'), aiTitle('ai'), withAgentName('field'), agentNameRec('new')];
    expect(sessionName(SID, null, null, records)).toBe('new');
  });

  it('5: newest record agentName field', () => {
    expect(sessionName(SID, null, null, [aiTitle('ai'), withAgentName('old'), withAgentName('new')])).toBe('new');
  });

  it('6: newest ai-title record', () => {
    expect(sessionName(SID, null, null, [aiTitle('old'), aiTitle('new')])).toBe('new');
  });

  it('7: first 8 characters of the session id', () => {
    expect(sessionName(SID, null, null, [])).toBe('aaaaaaaa');
  });

  it('skips empty candidates', () => {
    expect(sessionName(SID, '', '  ', [aiTitle('ai'), customTitle('')])).toBe('ai');
  });

  it('searches the whole file (P3)', () => {
    const filler = Array.from({ length: 5000 }, () => rec({ type: 'user', message: { content: 'x'.repeat(100) } }));
    expect(sessionName(SID, null, null, [customTitle('early'), ...filler])).toBe('early');
  });

  it('cleans the result to one line of at most 40 characters', () => {
    expect(sessionName(SID, ' a   b  c ', null, [])).toBe('a b c');
    expect(sessionName(SID, 'a\nb', null, [])).toBe('a b');
    expect(sessionName(SID, 'x'.repeat(60), null, [])).toBe('x'.repeat(40));
  });
});

describe('agentDisplayName', () => {
  const records = [withAgentName('field')];
  const full = meta({ name: 'meta-name', description: 'a description', agentType: 'Explore' });

  it('1: meta name', () => {
    expect(agentDisplayName('agent1', full, records)).toBe('meta-name');
  });

  it('2: newest record agentName', () => {
    const older = [withAgentName('old'), withAgentName('new')];
    expect(agentDisplayName('agent1', meta({ description: 'd', agentType: 'Explore' }), older)).toBe('new');
  });

  it('3: meta description (cut to 40 characters)', () => {
    expect(agentDisplayName('agent1', meta({ description: 'Find the thing', agentType: 'Explore' }), [])).toBe(
      'Find the thing',
    );
    expect(agentDisplayName('agent1', meta({ description: 'y'.repeat(50) }), [])).toBe('y'.repeat(40));
  });

  it('4: meta agentType', () => {
    expect(agentDisplayName('agent1', meta({ agentType: 'Explore' }), [])).toBe('Explore');
  });

  it('5: agent id', () => {
    expect(agentDisplayName('agent1', null, [])).toBe('agent1');
    expect(agentDisplayName('agent1', meta({ name: '' }), [])).toBe('agent1');
  });
});
