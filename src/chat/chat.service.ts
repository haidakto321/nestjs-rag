import { Inject, Injectable, Logger } from '@nestjs/common';
import { isStepCount, streamText, type LanguageModel, type TextStreamPart, type ToolSet } from 'ai';
import { CHAT_MODEL } from '../ai/ai.tokens.js';
import type { AuthUser } from '../auth/auth-user.js';
import { SearchService } from '../search/search.service.js';
import { buildAgentTools } from './agent-tools.js';
import type { ChatEvent, ChatMode, ChatTurn } from './chat-events.js';
import { AGENT_INSTRUCTIONS, buildAgentMessages, buildMessages, INSTRUCTIONS, toSources } from './prompt.js';

export const CONTEXT_CHUNKS = 5;
export const MAX_AGENT_STEPS = 3;
export const NO_MATCH_ANSWER =
  'No document you can read matches this question, so I cannot answer it from your documents.';

export interface AskInput {
  user: AuthUser;
  question: string;
  history: ChatTurn[];
  mode: ChatMode;
  signal: AbortSignal;
}

// Transport-agnostic: yields events and knows nothing about sockets. ChatGateway turns them into
// emits; an SSE controller could reuse this unchanged.
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly search: SearchService,
    @Inject(CHAT_MODEL) private readonly model: LanguageModel,
  ) {}

  async *ask(input: AskInput): AsyncGenerator<ChatEvent> {
    if (input.mode === 'agent') {
      yield* this.askAgent(input);
      return;
    }
    const matches = await this.search.retrieve(input.user, input.question, CONTEXT_CHUNKS);
    yield { type: 'sources', items: toSources(matches) };
    if (matches.length === 0) {
      // Nothing to ground an answer on: skip the model instead of letting it guess.
      yield { type: 'token', text: NO_MATCH_ANSWER };
      yield { type: 'done', finishReason: 'no-context' };
      return;
    }
    const result = streamText({
      model: this.model,
      instructions: INSTRUCTIONS,
      messages: buildMessages(input.history, input.question, matches),
      abortSignal: input.signal,
    });
    yield* this.relay(result.fullStream, input.signal);
  }

  // The model decides when (and how often) to search. Sources found by the tool are queued and
  // flushed when the stream reports the tool result, so numbering stays unique across calls.
  private async *askAgent(input: AskInput): AsyncGenerator<ChatEvent> {
    const queued: ChatEvent[] = [];
    let nextNumber = 1;
    const tools = buildAgentTools(this.search, input.user, (matches) => {
      const first = nextNumber;
      queued.push({ type: 'sources', items: toSources(matches, first) });
      nextNumber += matches.length;
      return first;
    });
    const result = streamText({
      model: this.model,
      instructions: AGENT_INSTRUCTIONS,
      messages: buildAgentMessages(input.history, input.question),
      tools,
      stopWhen: isStepCount(MAX_AGENT_STEPS),
      abortSignal: input.signal,
    });
    yield* this.relay(result.fullStream, input.signal, () => queued.splice(0));
  }

  /** Maps AI SDK stream parts to ChatEvents. Reasoning is counted and dropped on purpose. */
  private async *relay<TOOLS extends ToolSet>(
    stream: AsyncIterable<TextStreamPart<TOOLS>>,
    signal: AbortSignal,
    drain: () => ChatEvent[] = () => [],
  ): AsyncGenerator<ChatEvent> {
    let reasoningChars = 0;
    try {
      for await (const part of stream) {
        switch (part.type) {
          case 'text-delta':
            yield { type: 'token', text: part.text };
            break;
          case 'reasoning-delta':
            reasoningChars += part.text.length;
            break;
          case 'tool-call':
            yield { type: 'toolCall', name: part.toolName, input: part.input };
            break;
          case 'tool-result':
            yield* drain();
            break;
          case 'abort':
            yield { type: 'done', finishReason: 'aborted' };
            return;
          case 'error':
            throw part.error;
          case 'finish':
            yield {
              type: 'done',
              finishReason: part.finishReason,
              usage: { inputTokens: part.totalUsage.inputTokens, outputTokens: part.totalUsage.outputTokens },
            };
            return;
          default:
            break;
        }
      }
    } catch (error) {
      // An abort can also surface as a thrown error; that is a normal ending, not a failure.
      if (!signal.aborted) throw error;
    } finally {
      if (reasoningChars > 0) this.logger.debug(`Dropped ${reasoningChars} reasoning characters`);
    }
    yield { type: 'done', finishReason: signal.aborted ? 'aborted' : 'unknown' };
  }
}
