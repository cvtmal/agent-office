import { describe, expect, it } from 'vitest';
import { mainRecords, normalise, parseTranscript } from './records.js';

const line = (value: unknown): string => JSON.stringify(value);

describe('parseTranscript', () => {
  it('marks a garbled line as failed without throwing', () => {
    const text = [line({ type: 'user' }), '{"type": "assist', line({ type: 'system' })].join('\n');
    const parsed = parseTranscript(text);
    expect(parsed.lineOk).toEqual([true, false, true]);
    expect(parsed.records.map((rec) => rec.type)).toEqual(['user', 'system']);
  });

  it('marks array, null and number lines as failed', () => {
    const parsed = parseTranscript(['[1,2]', 'null', '42', '"text"'].join('\n'));
    expect(parsed.lineOk).toEqual([false, false, false, false]);
    expect(parsed.records).toEqual([]);
  });

  it('ignores empty and whitespace-only lines', () => {
    const parsed = parseTranscript(`\n${line({ type: 'user' })}\n   \n\t\n${line({ type: 'user' })}\n`);
    expect(parsed.lineOk).toEqual([true, true]);
    expect(parsed.records).toHaveLength(2);
  });

  it('keeps a record of an unknown type', () => {
    const parsed = parseTranscript(line({ type: 'brand-new-type', foo: 1 }));
    expect(parsed.lineOk).toEqual([true]);
    expect(parsed.records[0]?.type).toBe('brand-new-type');
  });
});

describe('normalise', () => {
  it('keeps the contract fields', () => {
    const rec = normalise({
      type: 'assistant',
      timestamp: '2026-01-01T00:00:05Z',
      sessionId: 'sid',
      cwd: '/home/dev/project',
      gitBranch: 'main',
      agentName: 'c01-impl',
      teamName: 'session-abcd1234',
      version: '2.1.0',
      subtype: 'turn_duration',
      customTitle: 'Night shift',
      aiTitle: 'Fix the reader',
      isSidechain: true,
      message: {
        content: [{ type: 'tool_use', id: 'x', name: 'Read', input: { file_path: '/home/dev/a.ts' } }],
        usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 },
        stop_reason: 'tool_use',
      },
    });
    expect(rec).toEqual({
      type: 'assistant',
      timestamp: '2026-01-01T00:00:05.000Z',
      sessionId: 'sid',
      cwd: '/home/dev/project',
      gitBranch: 'main',
      agentName: 'c01-impl',
      teamName: 'session-abcd1234',
      version: '2.1.0',
      subtype: 'turn_duration',
      customTitle: 'Night shift',
      aiTitle: 'Fix the reader',
      isSidechain: true,
      content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/home/dev/a.ts' } }],
      usage: { input: 1, cacheCreation: 2, cacheRead: 3, output: 4 },
      stopReason: 'tool_use',
    });
  });

  it('defaults missing or mistyped fields', () => {
    const rec = normalise({ type: 7, sessionId: 5, isSidechain: 'true', message: { content: { a: 1 } } });
    expect(rec.type).toBe('');
    expect(rec.sessionId).toBeNull();
    expect(rec.isSidechain).toBe(false);
    expect(rec.content).toEqual([]);
    expect(rec.usage).toBeNull();
    expect(rec.stopReason).toBeNull();
  });

  it('never throws on non-objects', () => {
    for (const value of [null, undefined, 42, 'x', [1]]) {
      expect(normalise(value).type).toBe('');
    }
  });

  it('turns a bad timestamp into null', () => {
    expect(normalise({ timestamp: 'not a date' }).timestamp).toBeNull();
    expect(normalise({ timestamp: 12 }).timestamp).toBeNull();
    expect(normalise({}).timestamp).toBeNull();
  });

  it('counts string and boolean usage values as 0', () => {
    const rec = normalise({
      message: { usage: { input_tokens: '100', cache_creation_input_tokens: true, cache_read_input_tokens: 7 } },
    });
    expect(rec.usage).toEqual({ input: 0, cacheCreation: 0, cacheRead: 7, output: 0 });
  });

  it('turns string content into one text block', () => {
    expect(normalise({ message: { content: 'hello' } }).content).toEqual([{ type: 'text' }]);
  });

  it('defaults a tool_use name and input', () => {
    const rec = normalise({ message: { content: [{ type: 'tool_use', name: 3, input: [1] }, 'stray'] } });
    expect(rec.content).toEqual([{ type: 'tool_use', name: '', input: {} }, { type: 'other' }]);
  });

  it('never keeps prompt, text, thinking or tool-result content', () => {
    const secrets = ['PROMPT-SECRET', 'TEXT-SECRET', 'THINKING-SECRET', 'RESULT-SECRET', 'SIGNATURE-SECRET'];
    const records = [
      normalise({ type: 'user', message: { content: 'PROMPT-SECRET' } }),
      normalise({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'TEXT-SECRET' },
            { type: 'thinking', thinking: 'THINKING-SECRET', signature: 'SIGNATURE-SECRET' },
          ],
        },
      }),
      normalise({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'RESULT-SECRET', is_error: false }] },
      }),
      normalise({ type: 'user', message: { content: [{ type: 'image', source: { data: 'TEXT-SECRET' } }] } }),
    ];
    const json = JSON.stringify(records);
    for (const secret of secrets) {
      expect(json).not.toContain(secret);
    }
    expect(records.map((rec) => rec.content)).toEqual([
      [{ type: 'text' }],
      [{ type: 'text' }, { type: 'thinking' }],
      [{ type: 'tool_result' }],
      [{ type: 'other' }],
    ]);
  });
});

describe('mainRecords', () => {
  const records = [normalise({ type: 'a' }), normalise({ type: 'b', isSidechain: true })];

  it('drops sidechain records in a session file', () => {
    expect(mainRecords(records, 'session').map((rec) => rec.type)).toEqual(['a']);
  });

  it('keeps all records in an agent file', () => {
    expect(mainRecords(records, 'agent').map((rec) => rec.type)).toEqual(['a', 'b']);
  });
});
