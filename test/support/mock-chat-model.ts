import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

type StreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>;
/** One provider stream part (LanguageModelV4StreamPart), derived so @ai-sdk/provider is not imported directly. */
export type StreamPart = StreamResult['stream'] extends ReadableStream<infer P> ? P : never;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 3, text: 3, reasoning: 0 },
};

/** One model step that streams text (optionally after some reasoning) and stops. */
export function textParts(texts: string[], reasoning?: string): StreamPart[] {
  const thinking: StreamPart[] = reasoning
    ? [
        { type: 'reasoning-start', id: 'r1' },
        { type: 'reasoning-delta', id: 'r1', delta: reasoning },
        { type: 'reasoning-end', id: 'r1' },
      ]
    : [];
  return [
    { type: 'stream-start', warnings: [] },
    ...thinking,
    { type: 'text-start', id: 't1' },
    ...texts.map((delta): StreamPart => ({ type: 'text-delta', id: 't1', delta })),
    { type: 'text-end', id: 't1' },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
  ];
}

let toolCallCounter = 0;

/** One model step that asks for a single tool call and stops with finishReason tool-calls. */
export function toolCallParts(toolName: string, input: unknown): StreamPart[] {
  toolCallCounter += 1;
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId: `call-${toolCallCounter}`, toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
  ];
}

/** A model whose call fails before streaming, like Ollama being down or the model not being pulled. */
export function failingChatModel(error: Error, modelId = 'qwen3:8b'): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    modelId,
    doStream: async () => {
      throw error;
    },
  });
}

/** Streams `steps` in order, one per model call; the last step repeats. */
export function mockChatModel(steps: StreamPart[][], chunkDelayInMs: number | null = null): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const parts = steps[Math.min(call, steps.length - 1)];
      call += 1;
      return { stream: simulateReadableStream({ chunks: parts, initialDelayInMs: null, chunkDelayInMs }) };
    },
  });
}
