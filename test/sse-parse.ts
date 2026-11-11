// A small SSE parser for tests (sse.test.ts, api-contract.test.ts): splits a stream into events,
// keeps `event:`/`data:` and the `retry:` value, skips `:` comments.

export interface ParsedEvent {
  type: string;
  data: unknown;
}

export interface ParsedStream {
  events: ParsedEvent[];
  retry: number | null;
  comments: number;
  /** The unterminated tail (an event still arriving). */
  rest: string;
}

export function parseSse(text: string): ParsedStream {
  const out: ParsedStream = { events: [], retry: null, comments: 0, rest: '' };
  const blocks = text.split('\n\n');
  out.rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let type = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) out.comments++;
      else if (line.startsWith('event: ')) type = line.slice(7);
      else if (line.startsWith('data: ')) data.push(line.slice(6));
      else if (line.startsWith('retry: ')) out.retry = Number(line.slice(7));
    }
    if (data.length > 0) out.events.push({ type, data: JSON.parse(data.join('\n')) as unknown });
  }
  return out;
}

/** Reads `res`'s body until `done(parsed)` is true; then cancels the stream. */
export async function readSseUntil(res: Response, done: (parsed: ParsedStream) => boolean): Promise<ParsedStream> {
  if (!res.body) throw new Error('no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const parsed = parseSse(text);
      if (done(parsed)) return parsed;
      const { value, done: ended } = await reader.read();
      if (ended) return parseSse(text);
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}
