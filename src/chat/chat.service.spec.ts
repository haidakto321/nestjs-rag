import { ServiceUnavailableException } from '@nestjs/common';
import { mockChatModel, textParts } from '../../test/support/mock-chat-model.js';
import type { AuthUser } from '../auth/auth-user.js';
import type { SearchService } from '../search/search.service.js';
import type { ChunkMatch } from '../search/search.types.js';
import type { ChatEvent } from './chat-events.js';
import { ChatService, NO_MATCH_ANSWER } from './chat.service.js';

const user: AuthUser = { id: 'u1', email: 'a@test.io', role: 'user' };
const matches: ChunkMatch[] = [
  { chunkId: 'c1', documentId: 'd1', title: 'Guide', headingPath: 'Setup', content: 'Run compose.', score: 0.9 },
  { chunkId: 'c2', documentId: 'd2', title: 'FAQ', headingPath: '', content: 'Yes.', score: 0.5 },
];

function fakeSearch(result: ChunkMatch[] | Error) {
  const retrieve = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { search: { retrieve } as unknown as SearchService, retrieve };
}

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const ask = (service: ChatService, signal = new AbortController().signal) =>
  service.ask({ user, question: 'How do I start it?', history: [], mode: 'rag', signal });

describe('ChatService (rag mode)', () => {
  it('emits sources, then tokens, then done, and drops reasoning', async () => {
    const model = mockChatModel([textParts(['Run ', 'compose [1].'], 'thinking out loud')]);
    const events = await collect(ask(new ChatService(fakeSearch(matches).search, model)));
    expect(events).toEqual([
      {
        type: 'sources',
        items: [
          { n: 1, chunkId: 'c1', documentId: 'd1', title: 'Guide', headingPath: 'Setup' },
          { n: 2, chunkId: 'c2', documentId: 'd2', title: 'FAQ', headingPath: '' },
        ],
      },
      { type: 'token', text: 'Run ' },
      { type: 'token', text: 'compose [1].' },
      { type: 'done', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 3 } },
    ]);
  });

  it('searches as the caller and sends instructions plus the fenced context', async () => {
    const { search, retrieve } = fakeSearch(matches);
    const model = mockChatModel([textParts(['ok'])]);
    await collect(ask(new ChatService(search, model)));
    expect(retrieve).toHaveBeenCalledWith(user, 'How do I start it?', 5);
    const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(prompt).toContain('Cite every claim');
    expect(prompt).toContain('<context>');
  });

  it('answers without calling the model when nothing visible matches', async () => {
    const model = mockChatModel([textParts(['never'])]);
    const events = await collect(ask(new ChatService(fakeSearch([]).search, model)));
    expect(events).toEqual([
      { type: 'sources', items: [] },
      { type: 'token', text: NO_MATCH_ANSWER },
      { type: 'done', finishReason: 'no-context' },
    ]);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('ends with done(aborted) when the caller aborts mid-stream', async () => {
    const model = mockChatModel([textParts(['a', 'b', 'c', 'd', 'e'])], 30);
    const controller = new AbortController();
    const events: ChatEvent[] = [];
    for await (const event of ask(new ChatService(fakeSearch(matches).search, model), controller.signal)) {
      events.push(event);
      if (event.type === 'token') controller.abort();
    }
    expect(events.at(-1)).toEqual({ type: 'done', finishReason: 'aborted' });
    expect(events.filter((e) => e.type === 'token').length).toBeLessThan(5);
  });

  it('lets a search failure reach the caller', async () => {
    const failing = fakeSearch(new ServiceUnavailableException('Embedding service unavailable')).search;
    await expect(collect(ask(new ChatService(failing, mockChatModel([textParts(['x'])]))))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
