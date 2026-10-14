import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { CHAT_MODEL } from '../../src/ai/ai.tokens.js';
import { ChatGateway } from '../../src/chat/chat.gateway.js';
import { NO_MATCH_ANSWER } from '../../src/chat/chat.service.js';
import { registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { uploadText } from '../support/document-helpers.js';
import { mockChatModel, textParts } from '../support/mock-chat-model.js';
import { resetDatabase } from '../support/reset-database.js';

type Received = Array<[event: string, payload: unknown]>;

function connect(url: string, token?: string): Socket {
  return io(`${url}/chat`, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
}

function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

/** Collects every event until `done` or `error`. */
function untilDone(
  socket: Socket,
  onEvent?: (event: string, payload: unknown) => void,
  timeoutMs = 5000,
): Promise<Received> {
  return new Promise((resolve, reject) => {
    const received: Received = [];
    const timer = setTimeout(() => reject(new Error(`timeout, got ${JSON.stringify(received)}`)), timeoutMs);
    socket.onAny((event: string, payload: unknown) => {
      received.push([event, payload]);
      onEvent?.(event, payload);
      if (event === 'done' || event === 'error') {
        clearTimeout(timer);
        socket.offAny();
        resolve(received);
      }
    });
  });
}

describe('chat gateway (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let alice: string;
  // Slow enough to cancel mid-stream, quick enough to keep the suite fast.
  const model = mockChatModel([textParts(['The ', 'answer ', 'is ', 'in ', '[1].'])], 40);
  const sockets: Socket[] = [];
  const open = (token?: string) => {
    const socket = connect(url, token);
    sockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp((b) => b.overrideProvider(CHAT_MODEL).useValue(model));
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    alice = await registerAndLogin(app, 'alice@test.io');
    const bob = await registerAndLogin(app, 'bob@test.io');
    await uploadText(app, alice, 'alice.md', '# Zebracorn care\nAlice feeds the zebracorn at noon.').expect(201);
    await uploadText(app, bob, 'bob.md', '# Bob secret\nThe zebracorn password is hunter2.').expect(201);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a connection without a token', async () => {
    await expect(connected(open())).rejects.toThrow('Unauthorized');
  });

  it('refuses a connection with a forged token', async () => {
    await expect(connected(open('not.a.jwt'))).rejects.toThrow('Unauthorized');
  });

  it('streams sources, tokens and done, with only sources the caller may read', async () => {
    const socket = open(alice);
    await connected(socket);
    const done = untilDone(socket);
    socket.emit('ask', { question: 'When is the zebracorn fed?' });
    const received = await done;
    expect(received.map(([event]) => event)).toEqual(['sources', 'token', 'token', 'token', 'token', 'token', 'done']);
    const sources = received[0][1] as { items: Array<{ title: string }> };
    expect(sources.items.map((item) => item.title)).toEqual(['Zebracorn care']);
    expect(received.at(-1)?.[1]).toMatchObject({ finishReason: 'stop' });
  });

  it('answers an empty question with an error event', async () => {
    const socket = open(alice);
    await connected(socket);
    const done = untilDone(socket);
    socket.emit('ask', { question: '   ' });
    const [[event, payload]] = await done;
    expect(event).toBe('error');
    expect((payload as { message: string }).message).toMatch(/question/);
  });

  it('answers busy to a second ask while one is running', async () => {
    const socket = open(alice);
    await connected(socket);
    const busy = new Promise<unknown>((resolve) => socket.once('error', resolve));
    const finished = new Promise<unknown>((resolve) => socket.once('done', resolve));
    socket.emit('ask', { question: 'zebracorn?' });
    socket.emit('ask', { question: 'zebracorn again?' });
    expect(await busy).toEqual({ message: 'busy' });
    expect(await finished).toMatchObject({ finishReason: 'stop' });
  });

  it('stops on cancel and reports done(aborted)', async () => {
    const socket = open(alice);
    await connected(socket);
    const done = untilDone(socket, (event) => {
      if (event === 'token') socket.emit('cancel');
    });
    socket.emit('ask', { question: 'zebracorn?' });
    const received = await done;
    expect(received.at(-1)).toEqual(['done', { finishReason: 'aborted' }]);
    expect(received.filter(([event]) => event === 'token').length).toBeLessThan(5);
  });

  it('aborts the generation when the client disconnects mid-answer', async () => {
    const socket = open(alice);
    await connected(socket);
    const firstToken = new Promise<void>((resolve) => socket.once('token', () => resolve()));
    socket.emit('ask', { question: 'zebracorn?' });
    await firstToken;
    socket.disconnect();
    const gateway = app.get(ChatGateway);
    await vi.waitFor(() => expect(gateway.activeGenerations).toBe(0));
    // The gauge alone would also reach 0 if the answer ran to its end; the signal proves the abort.
    expect(model.doStreamCalls.at(-1)?.abortSignal?.aborted).toBe(true);
  });

  it('says so, without calling the model, when no readable document matches', async () => {
    const carol = await registerAndLogin(app, 'carol@test.io');
    const socket = open(carol);
    await connected(socket);
    const done = untilDone(socket);
    socket.emit('ask', { question: 'zebracorn?' });
    expect(await done).toEqual([
      ['sources', { items: [] }],
      ['token', { text: NO_MATCH_ANSWER }],
      ['done', { finishReason: 'no-context' }],
    ]);
  });
});
