/**
 * Environment Configuration
 * 
 * Centralized environment variable access with type safety and validation.
 * All environment variables should be accessed through this module.
 */

import { z } from 'zod';

// ============================================================================
// Environment Schema
// ============================================================================

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  
  // Database
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).default(10),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // Authentication
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  
  // AI/ML Services
  OPENAI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Storage
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('contracts'),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  
  // Feature Flags
  ENABLE_MOCK_DATA: z.enum(['true', 'false']).default('false'),
  ENABLE_DEBUG_LOGS: z.enum(['true', 'false']).default('false'),
  ENABLE_AI_FEATURES: z.enum(['true', 'false']).default('true'),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// Environment Validation
// ============================================================================

function getEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    console.warn('[Environment] Validation warnings:', errors.join(', '));
    
    // Return with defaults for missing optional values
    return envSchema.parse({
      ...process.env,
      // Ensure required defaults
      NODE_ENV: process.env.NODE_ENV || 'development',
    });
  }
  
  return result.data;
}

// Cache the config
let cachedConfig: EnvConfig | null = null;

function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = getEnvConfig();
  }
  return cachedConfig;
}

// ============================================================================
// Typed Configuration Access
// ============================================================================

export const env = {
  // Environment
  get isDevelopment() { return getConfig().NODE_ENV === 'development'; },
  get isProduction() { return getConfig().NODE_ENV === 'production'; },
  get isTest() { return getConfig().NODE_ENV === 'test'; },
  get nodeEnv() { return getConfig().NODE_ENV; },
  
  // URLs
  get appUrl() { return getConfig().NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; },
  get apiUrl() { return getConfig().NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'; },
  
  // Database
  get databaseUrl() { return getConfig().DATABASE_URL; },
  get databasePoolSize() { return getConfig().DATABASE_POOL_SIZE; },
  get hasDatabase() { return Boolean(getConfig().DATABASE_URL); },
  
  // Redis
  get redisUrl() { return getConfig().REDIS_URL || 'redis://localhost:6379'; },
  get redisPassword() { return getConfig().REDIS_PASSWORD; },
  get hasRedis() { return Boolean(getConfig().REDIS_URL); },
  
  // Authentication
  get nextAuthUrl() { return getConfig().NEXTAUTH_URL; },
  get nextAuthSecret() { return getConfig().NEXTAUTH_SECRET; },
  get hasAuth() { return Boolean(getConfig().NEXTAUTH_SECRET); },
  
  // AI Services
  get openaiApiKey() { return getConfig().OPENAI_API_KEY; },
  get mistralApiKey() { return getConfig().MISTRAL_API_KEY; },
  get anthropicApiKey() { return getConfig().ANTHROPIC_API_KEY; },
  get hasOpenAI() { return Boolean(getConfig().OPENAI_API_KEY); },
  get hasMistral() { return Boolean(getConfig().MISTRAL_API_KEY); },
  get hasAnthropic() { return Boolean(getConfig().ANTHROPIC_API_KEY); },
  get hasAnyAI() { 
    return Boolean(getConfig().OPENAI_API_KEY || getConfig().MISTRAL_API_KEY || getConfig().ANTHROPIC_API_KEY); 
  },
  
  // Storage
  get minioEndpoint() { return getConfig().MINIO_ENDPOINT; },
  get minioAccessKey() { return getConfig().MINIO_ACCESS_KEY; },
  get minioSecretKey() { return getConfig().MINIO_SECRET_KEY; },
  get minioBucket() { return getConfig().MINIO_BUCKET; },
  get hasStorage() { 
    return Boolean(getConfig().MINIO_ENDPOINT && getConfig().MINIO_ACCESS_KEY); 
  },
  
  // Email
  get smtpHost() { return getConfig().SMTP_HOST; },
  get smtpPort() { return getConfig().SMTP_PORT; },
  get smtpUser() { return getConfig().SMTP_USER; },
  get smtpPassword() { return getConfig().SMTP_PASSWORD; },
  get smtpFrom() { return getConfig().SMTP_FROM; },
  get hasEmail() { return Boolean(getConfig().SMTP_HOST); },
  
  // Monitoring
  get sentryDsn() { return getConfig().SENTRY_DSN; },
  get datadogApiKey() { return getConfig().DATADOG_API_KEY; },
  get hasMonitoring() { 
    return Boolean(getConfig().SENTRY_DSN || getConfig().DATADOG_API_KEY); 
  },
  
  // Feature Flags
  get mockDataEnabled() { 
    return getConfig().ENABLE_MOCK_DATA === 'true' && !this.isProduction; 
  },
  get debugLogsEnabled() { return getConfig().ENABLE_DEBUG_LOGS === 'true'; },
  get aiEnabled() { return getConfig().ENABLE_AI_FEATURES === 'true' && this.hasAnyAI; },
  
  // Rate Limiting
  get rateLimitEnabled() { return getConfig().RATE_LIMIT_ENABLED === 'true'; },
  get rateLimitWindow() { return getConfig().RATE_LIMIT_WINDOW; },
  get rateLimitMaxRequests() { return getConfig().RATE_LIMIT_MAX_REQUESTS; },
};

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Get a required environment variable or throw
 */
export function requireEnv(key: keyof EnvConfig): string {
  const value = getConfig()[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return String(value);
}

/**
 * Get an optional environment variable with a default
 */
export function getEnv<T extends string | number | boolean>(
  key: keyof EnvConfig, 
  defaultValue: T
): T {
  const value = getConfig()[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value as T;
}

/**
 * Check if all required services are configured
 */
export function checkRequiredServices(): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  if (!env.hasDatabase) missing.push('DATABASE_URL');
  if (!env.hasAuth) missing.push('NEXTAUTH_SECRET');
  
  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Get service availability status
 */
export function getServiceStatus(): Record<string, boolean> {
  return {
    database: env.hasDatabase,
    redis: env.hasRedis,
    auth: env.hasAuth,
    storage: env.hasStorage,
    email: env.hasEmail,
    openai: env.hasOpenAI,
    mistral: env.hasMistral,
    anthropic: env.hasAnthropic,
    monitoring: env.hasMonitoring,
  };
}

// ============================================================================
// Application Constants (derived from environment)
// ============================================================================

export const config = {
  // Pagination
  defaultPageSize: 20,
  maxPageSize: 100,
  
  // File uploads
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedFileTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  
  // Session
  sessionMaxAge: 24 * 60 * 60, // 24 hours
  
  // Cache TTL (seconds)
  cacheTTL: {
    short: 60,        // 1 minute
    medium: 300,      // 5 minutes
    long: 3600,       // 1 hour
    veryLong: 86400,  // 24 hours
  },
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  },
  
  // AI processing
  ai: {
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 30000, // 30 seconds
  },
};

// ============================================================================
// Export
// ============================================================================

export default env;
