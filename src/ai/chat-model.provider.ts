import type { Provider } from '@nestjs/common';
import type { LanguageModel } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { AI_MODULE_OPTIONS, type AiModuleOptions } from './ai.module-definition.js';
import { CHAT_MODEL } from './ai.tokens.js';

// Factory provider. With think: true Ollama returns reasoning in its own field, so it arrives as
// reasoning parts and never leaks into the answer text (springboot-rag lesson with qwen3).
// Swapping to OpenAI or Claude later means changing only this factory.
export const chatModelProvider: Provider = {
  provide: CHAT_MODEL,
  inject: [AI_MODULE_OPTIONS],
  useFactory: (options: AiModuleOptions): LanguageModel =>
    createOllama({ baseURL: options.ollamaBaseUrl })(options.chatModel, { think: options.chatThink }),
};
