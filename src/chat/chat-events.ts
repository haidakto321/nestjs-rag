export const CHAT_MODES = ['rag'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SourceItem {
  n: number;
  chunkId: string;
  documentId: string;
  title: string;
  headingPath: string;
}

export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** Everything chat can tell a client. The gateway emits `type` as the socket event name. */
export type ChatEvent =
  | { type: 'sources'; items: SourceItem[] }
  | { type: 'token'; text: string }
  | { type: 'toolCall'; name: string; input: unknown }
  | { type: 'done'; finishReason: string; usage?: ChatUsage };
