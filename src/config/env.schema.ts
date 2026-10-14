import { z } from 'zod';

// Empty strings in .env mean "not set", so optional values must not fail on "".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5434),
  DB_USER: z.string().min(1).default('rag'),
  DB_PASSWORD: z.string().min(1).default('rag'),
  DB_NAME: z.string().min(1).default('nestrag'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
  EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(768),
  CHAT_MODEL: z.string().min(1).default('qwen3:8b'),
  CHAT_THINK: z.stringbool().default(true),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576),
  ADMIN_EMAIL: optional(z.email()),
  ADMIN_PASSWORD: optional(z.string().min(8)),
});

export type Env = z.infer<typeof envSchema>;

// Used by ConfigModule at boot and by every registerAs namespace: fail fast, one place for defaults.
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}
