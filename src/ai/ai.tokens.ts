// TS interfaces vanish at runtime, so the DI container needs a real value as the key.
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
export const CHAT_MODEL = Symbol('CHAT_MODEL');
