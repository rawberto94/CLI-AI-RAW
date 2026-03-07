/**
 * Environment Configuration
 * 
 * Centralized environment variable access with type safety and validation.
 * All environment variables should be accessed through this module.
 * 
 * Coverage: ~270 env vars across 20 categories.
 */

import { z } from 'zod';

// ============================================================================
// Helper Schemas
// ============================================================================

const boolString = z.enum(['true', 'false']).default('false');
const optionalUrl = z.string().url().optional();
const optionalString = z.string().optional();
const optionalNumber = z.coerce.number().optional();

// ============================================================================
// Environment Schema
// ============================================================================

const envSchema = z.object({
  // ── Core / Runtime ─────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('ConTigo'),
  HOSTNAME: optionalString,
  CORS_ALLOWED_ORIGINS: optionalString,
  SERVICE_NAME: z.string().default('contigo-web'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_URL: optionalUrl,
  APP_VERSION: optionalString,
  API_HOST: optionalString,
  API_PORT: z.coerce.number().default(3000),
  HEALTH_PORT: z.coerce.number().optional(),
  UPLOAD_DIR: optionalString,
  CONTACT_EMAIL: optionalString,

  // ── URLs ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_API_URL: optionalUrl,
  NEXT_PUBLIC_URL: optionalUrl,
  NEXTAUTH_URL: optionalUrl,

  // ── Database ───────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).default(10),
  DATABASE_REPLICA_URLS: optionalString,
  DATABASE_ENCRYPTION_KEY: optionalString,
  DATABASE_SEARCH_SALT: optionalString,

  // ── Redis / Cache ──────────────────────────────────────────────────────
  REDIS_URL: optionalString,
  REDIS_HOST: optionalString,
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: optionalString,
  REDIS_TOKEN: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  // ── Authentication / Session ───────────────────────────────────────────
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  AUTH_SECRET: optionalString,
  JWT_SECRET: optionalString,
  SESSION_SECRET: optionalString,
  CSRF_SECRET: optionalString,
  CRON_SECRET: optionalString,
  ADMIN_API_TOKEN: optionalString,
  ADMIN_EMAIL: optionalString,
  INTERNAL_API_SECRET: optionalString,
  INTERNAL_API_TOKEN: optionalString,
  VERCEL_CRON_SECRET: optionalString,
  REQUIRE_AUTH: boolString,
  SSO_AUTO_PROVISION: boolString,
  SSO_DEFAULT_TENANT_ID: optionalString,

  // ── SSO Providers ──────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  AZURE_AD_CLIENT_ID: optionalString,
  AZURE_AD_CLIENT_SECRET: optionalString,
  AZURE_AD_TENANT_ID: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  MICROSOFT_CLIENT_ID: optionalString,

  // ── Encryption / Security ──────────────────────────────────────────────
  ENCRYPTION_KEY: optionalString,
  MASTER_ENCRYPTION_KEY: optionalString,
  CREDENTIAL_ENCRYPTION_KEY: optionalString,
  API_KEY_ENCRYPTION_KEY: optionalString,
  API_KEY_ENCRYPTION_SALT: optionalString,
  API_KEY_HASH_SALT: optionalString,

  // ── AI / LLM ──────────────────────────────────────────────────────────
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_BASE_URL: optionalUrl,
  ANTHROPIC_API_KEY: optionalString,
  MISTRAL_API_KEY: optionalString,
  MISTRAL_API_URL: optionalUrl,
  AZURE_OPENAI_API_KEY: optionalString,
  AZURE_OPENAI_DEPLOYMENT: optionalString,
  AZURE_OPENAI_ENDPOINT: optionalUrl,
  RAG_EMBED_MODEL: optionalString,
  RAG_INTEGRATION_ENABLED: boolString,
  ENABLE_AI_FEATURES: z.enum(['true', 'false']).default('true'),
  CRITIQUE_MODEL: optionalString,
  OPENAI_VISION_MODEL: optionalString,
  OPENAI_BREAKER_COOLDOWN_MS: z.coerce.number().default(30000),
  OPENAI_BREAKER_FAILURE_THRESHOLD: z.coerce.number().default(5),

  // ── OCR / Vision ───────────────────────────────────────────────────────
  OCR_DEFAULT_PROVIDER: z.enum(['azure', 'google', 'aws', 'tesseract']).default('azure'),
  OCR_FALLBACK_CHAIN: optionalString,
  OCR_AUTO_SELECT: boolString,
  OCR_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  OCR_MAX_RETRIES: z.coerce.number().default(3),
  OCR_PREPROCESSING: boolString,
  OCR_CACHING: boolString,
  AZURE_VISION_ENDPOINT: optionalUrl,
  AZURE_VISION_KEY: optionalString,
  AZURE_VISION_ENDPOINT_CH: optionalUrl,
  AZURE_VISION_KEY_CH: optionalString,
  AZURE_VISION_ENDPOINT_EU: optionalUrl,
  AZURE_VISION_KEY_EU: optionalString,
  GOOGLE_VISION_CREDENTIALS_EU: optionalString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalString,
  GOOGLE_CLOUD_REGION: optionalString,
  OCR_MAX_JOBS_PER_MINUTE: z.coerce.number().default(60),
  OCR_PREPROCESSING_PRESET: optionalString,
  OCR_WORKER_CONCURRENCY: z.coerce.number().default(3),

  // ── Object Storage (MinIO / S3 / Azure Blob) ──────────────────────────
  STORAGE_PROVIDER: z.enum(['minio', 's3', 'azure', 'local']).default('minio'),
  STORAGE_MODE: z.enum(['local', 'cloud']).default('local'),
  MINIO_ENDPOINT: optionalString,
  MINIO_ACCESS_KEY: optionalString,
  MINIO_SECRET_KEY: optionalString,
  MINIO_BUCKET: z.string().default('contracts'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: boolString,
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET: optionalString,
  S3_UPLOAD_BUCKET: optionalString,
  S3_REGION: z.string().default('eu-central-1'),
  AZURE_STORAGE_ACCOUNT_NAME: optionalString,
  AZURE_STORAGE_ACCOUNT_KEY: optionalString,
  AZURE_STORAGE_CONNECTION_STRING: optionalString,
  AZURE_STORAGE_CONTAINER: optionalString,
  UPLOADS_DIR: z.string().default('./uploads'),
  S3_PORT: z.coerce.number().optional(),
  S3_USE_SSL: boolString,
  AZURE_STORAGE_REGION: optionalString,
  STORAGE_KEEP_TEXT: boolString,
  STORAGE_KEEP_THUMBNAILS: boolString,
  STORAGE_RETENTION_DAYS: z.coerce.number().default(365),

  // ── CDN ────────────────────────────────────────────────────────────────
  CDN_BASE_URL: optionalUrl,
  CDN_PROVIDER: z.enum(['cloudflare', 'cloudfront', 'none']).default('none'),
  CDN_DEFAULT_TTL: z.coerce.number().default(86400),
  CDN_SIGNING_KEY: optionalString,
  CDN_SIGNING_KEY_ID: optionalString,
  CLOUDFLARE_API_TOKEN: optionalString,
  CLOUDFLARE_ZONE_ID: optionalString,
  CLOUDFRONT_DISTRIBUTION_ID: optionalString,

  // ── Email / SMTP ───────────────────────────────────────────────────────
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: boolString,
  EMAIL_FROM: optionalString,
  EMAIL_FROM_NAME: z.string().default('ConTigo'),
  EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'sendgrid', 'ses']).default('smtp'),
  RESEND_API_KEY: optionalString,
  SENDGRID_API_KEY: optionalString,
  EMAIL_REPLY_TO: optionalString,
  CONTACT_FROM_EMAIL: optionalString,
  NOTIFICATION_EMAIL: optionalString,
  ALERT_FROM_EMAIL: optionalString,

  // ── Monitoring / Observability ─────────────────────────────────────────
  SENTRY_DSN: optionalUrl,
  DD_API_KEY: optionalString,
  OTEL_ENABLED: boolString,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  OTEL_SERVICE_NAME: z.string().default('contigo'),
  TRACING_ENABLED: boolString,
  OTEL_AUTH_HEADER: optionalString,
  OTEL_DEBUG: boolString,

  // ── Alerting / Webhooks ────────────────────────────────────────────────
  ALERTING_ENABLED: boolString,
  ALERT_WEBHOOK_URL: optionalUrl,
  SLACK_WEBHOOK_URL: optionalUrl,
  NOTIFICATION_WEBHOOK_URL: optionalUrl,
  GDPR_WEBHOOK_SECRET: optionalString,
  AGENT_WEBHOOK_SECRET: optionalString,
  SYNC_WEBHOOK_SECRET: optionalString,
  ALERT_COOLDOWN_MS: z.coerce.number().default(300000),
  ALERT_MIN_SEVERITY: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  SYNC_WEBHOOK_URL: optionalUrl,
  GDPR_WEBHOOK_URL: optionalUrl,
  AGENT_WEBHOOK_URL: optionalUrl,
  WORKER_HEALTH_URL: optionalUrl,

  // ── E-Signature Integrations ───────────────────────────────────────────
  DOCUSIGN_CLIENT_ID: optionalString,
  DOCUSIGN_CLIENT_SECRET: optionalString,
  DOCUSIGN_ENV: z.enum(['demo', 'production']).default('demo'),
  ADOBE_SIGN_CLIENT_ID: optionalString,
  ADOBE_SIGN_CLIENT_SECRET: optionalString,
  HELLOSIGN_CLIENT_ID: optionalString,
  HELLOSIGN_CLIENT_SECRET: optionalString,

  // ── Procurement Integrations ───────────────────────────────────────────
  SAP_ARIBA_CLIENT_ID: optionalString,
  SAP_ARIBA_CLIENT_SECRET: optionalString,
  SAP_ARIBA_REALM: optionalString,
  COUPA_CLIENT_ID: optionalString,
  COUPA_CLIENT_SECRET: optionalString,
  COUPA_INSTANCE_URL: optionalUrl,
  COUPA_INSTANCE: optionalString,
  SAP_ARIBA_REGION: optionalString,
  SIEVO_API_ENDPOINT: optionalUrl,
  SIEVO_API_KEY: optionalString,

  // ── Cloud Storage Integrations ─────────────────────────────────────────
  GOOGLE_DRIVE_CLIENT_ID: optionalString,
  GOOGLE_DRIVE_CLIENT_SECRET: optionalString,
  DROPBOX_APP_KEY: optionalString,
  DROPBOX_APP_SECRET: optionalString,
  BOX_CLIENT_ID: optionalString,
  BOX_CLIENT_SECRET: optionalString,
  DROPBOX_CLIENT_ID: optionalString,
  INFOMANIAK_ACCOUNT_ID: optionalString,
  INFOMANIAK_API_TOKEN: optionalString,
  OVH_APPLICATION_KEY: optionalString,
  OVH_APPLICATION_SECRET: optionalString,
  OVH_CONSUMER_KEY: optionalString,

  // ── Push Notifications ─────────────────────────────────────────────────
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,

  // ── Feature Flags ──────────────────────────────────────────────────────
  ENABLE_MOCK_DATA: boolString,
  ENABLE_DEBUG_LOGS: z.enum(['true', 'false']).default('false'),
  ENABLE_DUPLICATE_DETECTION: boolString,
  MOCK_FEATURES: optionalString,
  ENABLE_MOCK_MODE: boolString,
  ALWAYS_RUN_GAP_FILLING: boolString,
  AUTO_CATEGORIZATION: boolString,
  AUTO_METADATA_EXTRACTION: boolString,
  AUTO_RAG_ARTIFACT_REINDEX: boolString,
  AUTO_RAG_INDEXING: boolString,
  GAP_FILLING_COMPLETENESS_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  NEXT_PUBLIC_ENABLE_AI_CHAT: boolString,
  NEXT_PUBLIC_ENABLE_APPROVALS: boolString,
  NEXT_PUBLIC_ENABLE_BATCH_OPS: boolString,
  NEXT_PUBLIC_ENABLE_BETA: boolString,
  NEXT_PUBLIC_ENABLE_COLLABORATION: boolString,
  NEXT_PUBLIC_ENABLE_EXPORT: boolString,
  NEXT_PUBLIC_ENABLE_FILE_UPLOAD: boolString,
  NEXT_PUBLIC_ENABLE_REDLINING: boolString,
  NEXT_PUBLIC_ENABLE_SIGNATURES: boolString,
  NEXT_PUBLIC_TENANT_ID: optionalString,

  // ── Rate Limiting ──────────────────────────────────────────────────────
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // ── Worker / Agent Config ──────────────────────────────────────────────
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_RATE_LIMIT: z.coerce.number().default(100),
  MAX_CONCURRENT_USERS: z.coerce.number().default(100),
  MAX_SSE_CONNECTIONS: z.coerce.number().default(1000),
  AGENT_MAX_ACTIONS_PER_TICK: z.coerce.number().default(10),
  AGENT_MAX_ITERATIONS: z.coerce.number().default(50),
  AGENT_TICK_DELAY_MS: z.coerce.number().default(100),

  // ── AWS ────────────────────────────────────────────────────────────────
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_REGION: optionalString,
  AWS_SES_REGION: optionalString,
  AWS_TEXTRACT_ENDPOINT: optionalUrl,
  AWS_TEXTRACT_REGION: optionalString,
  AWS_TEXTRACT_ROLE_ARN: optionalString,

  // ── GDPR / Compliance ──────────────────────────────────────────────────
  GDPR_EXPORT_BUCKET: optionalString,
});

type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// Environment Validation
// ============================================================================

function getEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
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
  // ── Environment ────────────────────────────────────────────────────────
  get isDevelopment() { return getConfig().NODE_ENV === 'development'; },
  get isProduction() { return getConfig().NODE_ENV === 'production'; },
  get isTest() { return getConfig().NODE_ENV === 'test'; },
  get nodeEnv() { return getConfig().NODE_ENV; },
  get logLevel() { return getConfig().LOG_LEVEL; },

  // ── URLs ───────────────────────────────────────────────────────────────
  get appUrl() { return getConfig().NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; },
  get apiUrl() { return getConfig().NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'; },

  // ── Database ───────────────────────────────────────────────────────────
  get databaseUrl() { return getConfig().DATABASE_URL; },
  get databasePoolSize() { return getConfig().DATABASE_POOL_SIZE; },
  get hasDatabase() { return Boolean(getConfig().DATABASE_URL); },
  get hasReplicas() { return Boolean(getConfig().DATABASE_REPLICA_URLS); },

  // ── Redis ──────────────────────────────────────────────────────────────
  get redisUrl() { return getConfig().REDIS_URL || `redis://${getConfig().REDIS_HOST || 'localhost'}:${getConfig().REDIS_PORT}`; },
  get redisPassword() { return getConfig().REDIS_PASSWORD; },
  get hasRedis() { return Boolean(getConfig().REDIS_URL || getConfig().REDIS_HOST); },
  get hasUpstash() { return Boolean(getConfig().UPSTASH_REDIS_REST_URL); },

  // ── Authentication ─────────────────────────────────────────────────────
  get nextAuthUrl() { return getConfig().NEXTAUTH_URL; },
  get nextAuthSecret() { return getConfig().NEXTAUTH_SECRET; },
  get cronSecret() { return getConfig().CRON_SECRET; },
  get csrfSecret() { return getConfig().CSRF_SECRET; },
  get hasAuth() { return Boolean(getConfig().NEXTAUTH_SECRET); },
  get hasCronSecret() { return Boolean(getConfig().CRON_SECRET); },

  // ── Encryption ─────────────────────────────────────────────────────────
  get encryptionKey() { return getConfig().ENCRYPTION_KEY || getConfig().MASTER_ENCRYPTION_KEY; },
  get hasEncryption() { return Boolean(getConfig().ENCRYPTION_KEY || getConfig().MASTER_ENCRYPTION_KEY); },

  // ── AI Services ────────────────────────────────────────────────────────
  get openaiApiKey() { return getConfig().OPENAI_API_KEY; },
  get openaiModel() { return getConfig().OPENAI_MODEL; },
  get mistralApiKey() { return getConfig().MISTRAL_API_KEY; },
  get anthropicApiKey() { return getConfig().ANTHROPIC_API_KEY; },
  get hasOpenAI() { return Boolean(getConfig().OPENAI_API_KEY); },
  get hasMistral() { return Boolean(getConfig().MISTRAL_API_KEY); },
  get hasAnthropic() { return Boolean(getConfig().ANTHROPIC_API_KEY); },
  get hasAzureOpenAI() { return Boolean(getConfig().AZURE_OPENAI_API_KEY); },
  get hasAnyAI() {
    return Boolean(getConfig().OPENAI_API_KEY || getConfig().MISTRAL_API_KEY || getConfig().ANTHROPIC_API_KEY || getConfig().AZURE_OPENAI_API_KEY);
  },

  // ── OCR / Vision ───────────────────────────────────────────────────────
  get ocrProvider() { return getConfig().OCR_DEFAULT_PROVIDER; },
  get ocrConfidence() { return getConfig().OCR_CONFIDENCE_THRESHOLD; },
  get hasAzureVision() { return Boolean(getConfig().AZURE_VISION_KEY); },

  // ── Storage ────────────────────────────────────────────────────────────
  get storageProvider() { return getConfig().STORAGE_PROVIDER; },
  get minioEndpoint() { return getConfig().MINIO_ENDPOINT; },
  get minioAccessKey() { return getConfig().MINIO_ACCESS_KEY; },
  get minioSecretKey() { return getConfig().MINIO_SECRET_KEY; },
  get minioBucket() { return getConfig().MINIO_BUCKET; },
  get hasStorage() {
    const c = getConfig();
    return Boolean(c.MINIO_ENDPOINT || c.S3_ENDPOINT || c.AZURE_STORAGE_CONNECTION_STRING);
  },
  get hasAzureStorage() { return Boolean(getConfig().AZURE_STORAGE_CONNECTION_STRING); },

  // ── CDN ────────────────────────────────────────────────────────────────
  get cdnBaseUrl() { return getConfig().CDN_BASE_URL; },
  get cdnProvider() { return getConfig().CDN_PROVIDER; },
  get hasCdn() { return getConfig().CDN_PROVIDER !== 'none' && Boolean(getConfig().CDN_BASE_URL); },

  // ── Email ──────────────────────────────────────────────────────────────
  get smtpHost() { return getConfig().SMTP_HOST; },
  get smtpPort() { return getConfig().SMTP_PORT; },
  get smtpUser() { return getConfig().SMTP_USER; },
  get smtpPassword() { return getConfig().SMTP_PASS || getConfig().SMTP_PASSWORD; },
  get emailFrom() { return getConfig().EMAIL_FROM; },
  get emailProvider() { return getConfig().EMAIL_PROVIDER; },
  get hasEmail() { return Boolean(getConfig().SMTP_HOST || getConfig().RESEND_API_KEY || getConfig().SENDGRID_API_KEY); },

  // ── Monitoring ─────────────────────────────────────────────────────────
  get sentryDsn() { return getConfig().SENTRY_DSN; },
  get hasMonitoring() { return Boolean(getConfig().SENTRY_DSN || getConfig().DD_API_KEY); },
  get hasTracing() { return getConfig().OTEL_ENABLED === 'true' || getConfig().TRACING_ENABLED === 'true'; },

  // ── E-Signature Integrations ───────────────────────────────────────────
  get hasDocuSign() { return Boolean(getConfig().DOCUSIGN_CLIENT_ID); },
  get hasAdobeSign() { return Boolean(getConfig().ADOBE_SIGN_CLIENT_ID); },
  get hasHelloSign() { return Boolean(getConfig().HELLOSIGN_CLIENT_ID); },
  get hasAnyESign() { return this.hasDocuSign || this.hasAdobeSign || this.hasHelloSign; },

  // ── Procurement Integrations ───────────────────────────────────────────
  get hasSapAriba() { return Boolean(getConfig().SAP_ARIBA_CLIENT_ID); },
  get hasCoupa() { return Boolean(getConfig().COUPA_CLIENT_ID); },

  // ── Feature Flags ──────────────────────────────────────────────────────
  get mockDataEnabled() { return getConfig().ENABLE_MOCK_DATA === 'true' && !this.isProduction; },
  get debugLogsEnabled() { return getConfig().ENABLE_DEBUG_LOGS === 'true'; },
  get aiEnabled() { return getConfig().ENABLE_AI_FEATURES === 'true' && this.hasAnyAI; },

  // ── Rate Limiting ──────────────────────────────────────────────────────
  get rateLimitEnabled() { return getConfig().RATE_LIMIT_ENABLED === 'true'; },
  get rateLimitWindow() { return getConfig().RATE_LIMIT_WINDOW; },
  get rateLimitMaxRequests() { return getConfig().RATE_LIMIT_MAX_REQUESTS; },

  // ── Workers ────────────────────────────────────────────────────────────
  get workerConcurrency() { return getConfig().WORKER_CONCURRENCY; },
  get maxSseConnections() { return getConfig().MAX_SSE_CONNECTIONS; },

  // ── Agent Config ───────────────────────────────────────────────────────
  get agentMaxIterations() { return getConfig().AGENT_MAX_ITERATIONS; },
  get agentTickDelay() { return getConfig().AGENT_TICK_DELAY_MS; },

  // ── AWS ────────────────────────────────────────────────────────────────
  get hasAWS() { return Boolean(getConfig().AWS_ACCESS_KEY_ID); },
  get hasTextract() { return Boolean(getConfig().AWS_TEXTRACT_ENDPOINT); },
  get hasSES() { return Boolean(getConfig().AWS_SES_REGION); },

  // ── GDPR / Compliance ─────────────────────────────────────────────────
  get hasGDPR() { return Boolean(getConfig().GDPR_EXPORT_BUCKET); },

  // ── Integrations ──────────────────────────────────────────────────────
  get hasSievo() { return Boolean(getConfig().SIEVO_API_KEY); },
  get hasDropbox() { return Boolean(getConfig().DROPBOX_CLIENT_ID) || Boolean(getConfig().DROPBOX_APP_KEY); },
  get hasInfomaniak() { return Boolean(getConfig().INFOMANIAK_API_TOKEN); },
  get hasOVH() { return Boolean(getConfig().OVH_APPLICATION_KEY); },
  get hasCloudflare() { return Boolean(getConfig().CLOUDFLARE_API_TOKEN); },
  get hasCloudfront() { return Boolean(getConfig().CLOUDFRONT_DISTRIBUTION_ID); },

  // ── Feature Flags (public) ────────────────────────────────────────────
  get aiChatEnabled() { return getConfig().NEXT_PUBLIC_ENABLE_AI_CHAT === 'true'; },
  get approvalsEnabled() { return getConfig().NEXT_PUBLIC_ENABLE_APPROVALS === 'true'; },
  get signaturesEnabled() { return getConfig().NEXT_PUBLIC_ENABLE_SIGNATURES === 'true'; },
  get betaEnabled() { return getConfig().NEXT_PUBLIC_ENABLE_BETA === 'true'; },
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
    replicas: env.hasReplicas,
    redis: env.hasRedis,
    auth: env.hasAuth,
    storage: env.hasStorage,
    email: env.hasEmail,
    openai: env.hasOpenAI,
    mistral: env.hasMistral,
    anthropic: env.hasAnthropic,
    azureOpenAI: env.hasAzureOpenAI,
    monitoring: env.hasMonitoring,
    tracing: env.hasTracing,
    cdn: env.hasCdn,
    docusign: env.hasDocuSign,
    adobeSign: env.hasAdobeSign,
    sapAriba: env.hasSapAriba,
    coupa: env.hasCoupa,
    azureVision: env.hasAzureVision,
    encryption: env.hasEncryption,
    aws: env.hasAWS,
    textract: env.hasTextract,
    ses: env.hasSES,
    gdpr: env.hasGDPR,
    sievo: env.hasSievo,
    cloudflare: env.hasCloudflare,
    cloudfront: env.hasCloudfront,
    dropbox: env.hasDropbox,
    infomaniak: env.hasInfomaniak,
    ovh: env.hasOVH,
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
