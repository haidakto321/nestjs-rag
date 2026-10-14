import { registerAs } from '@nestjs/config';
import { validateEnv } from './env.schema.js';

// Each namespace reads the validated env, so defaults live only in env.schema.ts.
export const appConfig = registerAs('app', () => ({ port: validateEnv(process.env).PORT }));

export const dbConfig = registerAs('db', () => {
  const env = validateEnv(process.env);
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
});

export const authConfig = registerAs('auth', () => {
  const env = validateEnv(process.env);
  return {
    jwtSecret: env.JWT_SECRET,
    jwtTtlSeconds: env.JWT_TTL_SECONDS,
    adminEmail: env.ADMIN_EMAIL,
    adminPassword: env.ADMIN_PASSWORD,
  };
});

export const aiConfig = registerAs('ai', () => {
  const env = validateEnv(process.env);
  return {
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    embeddingModel: env.EMBEDDING_MODEL,
    embeddingDim: env.EMBEDDING_DIM,
    chatModel: env.CHAT_MODEL,
    chatThink: env.CHAT_THINK,
  };
});

export const uploadConfig = registerAs('upload', () => ({
  maxBytes: validateEnv(process.env).UPLOAD_MAX_BYTES,
}));
