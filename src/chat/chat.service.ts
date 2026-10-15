import { HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

/** Marks an error thrown by the agent's search tool, so it is not mistaken for a chat model failure. */
class SearchFailure extends Error {
  constructor(cause: unknown) {
    super('Search tool failed', { cause });
  }
}

// relay() logs model errors once, through Nest's Logger; without this the SDK also console.errors them.
const skipSdkErrorLog = (): void => undefined;

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
      onError: skipSdkErrorLog,
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
      // The last step gets no tools, so a model that keeps searching still has to write an answer.
      prepareStep: ({ stepNumber }) => (stepNumber === MAX_AGENT_STEPS - 1 ? { activeTools: [] } : undefined),
      abortSignal: input.signal,
      onError: skipSdkErrorLog,
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
    // An invalid call (bad JSON, input outside the schema) never runs: the SDK sends the error back
    // to the model so it can try again. The client does not need to see it.
    const invalidCalls = new Set<string>();
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
            if ('invalid' in part && part.invalid) {
              invalidCalls.add(part.toolCallId);
              break;
            }
            yield { type: 'toolCall', name: part.toolName, input: part.input };
            break;
          case 'tool-result':
            yield* drain();
            break;
          case 'tool-error':
            if (invalidCalls.has(part.toolCallId)) break;
            // The search itself failed. End the turn like rag mode does, instead of letting the
            // model answer "I do not know" without passages (or read internal error text).
            throw new SearchFailure(part.error);
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
      if (!signal.aborted) throw this.toClientError(error);
    } finally {
      if (reasoningChars > 0) this.logger.debug(`Dropped ${reasoningChars} reasoning characters`);
    }
    yield { type: 'done', finishReason: signal.aborted ? 'aborted' : 'unknown' };
  }

  // A search failure keeps its own error (503 "Embedding service unavailable", or an internal one).
  // Anything else came from the chat model (Ollama down, model not pulled, crash mid-answer): it
  // becomes a 503 the client can read, like embedding failures do. Details stay in the log.
  private toClientError(error: unknown): unknown {
    if (error instanceof SearchFailure) return error.cause;
    if (error instanceof HttpException) return error;
    const name = typeof this.model === 'string' ? this.model : this.model.modelId;
    this.logger.error(`Chat model ${name} failed`, error instanceof Error ? error.stack : String(error));
    return new ServiceUnavailableException(`Chat model ${name} unavailable`);
  }
}
