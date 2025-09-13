import { z } from 'zod';
// Load environment variables from .env if present
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // optional
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v == null ? 3001 : typeof v === 'string' ? parseInt(v, 10) : v)),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini').optional(),
  ANALYSIS_USE_LLM: z.string().optional(),
  ANALYSIS_USE_LLM_OVERVIEW: z.string().optional(),
  ANALYSIS_USE_LLM_RATES: z.string().optional(),
  // RAG feature flags and knobs
  RAG_ENABLED: z.string().optional(),
  RAG_EMBED_MODEL: z.string().default('text-embedding-3-small').optional(),
  RAG_CHUNK_SIZE: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v == null ? 1200 : typeof v === 'string' ? parseInt(v, 10) : v)),
  RAG_CHUNK_OVERLAP: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v == null ? 150 : typeof v === 'string' ? parseInt(v, 10) : v)),
  RAG_TOP_K: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v == null ? 6 : typeof v === 'string' ? parseInt(v, 10) : v)),
  // Multi-tenancy enforcement and vector index tuning
  RAG_EMBED_ON_UPLOAD: z.string().optional(),
  TENANT_ENFORCE: z.string().optional(),
  RAG_IVFFLAT_LISTS: z
    .union([z.string().regex(/^\d+$/), z.number()])
    .optional()
    .transform((v) => (v == null ? 100 : typeof v === 'string' ? parseInt(v, 10) : v)),
  RATE_LIMIT_MAX: z.string().optional(),
  RATE_LIMIT_WINDOW: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1').optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('contracts').optional(),
  DATA_DIR: z.string().optional(),
});

// Normalize process.env into a strongly-typed object
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Do not throw to avoid breaking demo; instead log a compact warning
  // eslint-disable-next-line no-console
  console.warn('[env] Invalid environment variables:', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
}

// Coerce to a plain object with defaults applied when possible
export const env = {
  ...process.env,
  ...(parsed.success ? parsed.data : {}),
} as Record<string, any> & {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANALYSIS_USE_LLM?: string;
  ANALYSIS_USE_LLM_OVERVIEW?: string;
  ANALYSIS_USE_LLM_RATES?: string;
  RAG_ENABLED?: string;
  RAG_EMBED_MODEL?: string;
  RAG_CHUNK_SIZE?: number;
  RAG_CHUNK_OVERLAP?: number;
  RAG_TOP_K?: number;
  RAG_EMBED_ON_UPLOAD?: string;
  TENANT_ENFORCE?: string;
  RAG_IVFFLAT_LISTS?: number;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET?: string;
  DATA_DIR?: string;
};
