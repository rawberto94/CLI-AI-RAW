/**
 * Structured Logger with Correlation IDs
 * Provides consistent logging across the application with request tracing
 */

import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Async local storage for correlation ID
const asyncLocalStorage = new AsyncLocalStorage<{
  correlationId: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
}>();

export interface LogContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  service?: string;
  environment?: string;
}

// Create base logger with custom serializers and formatters
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    }),
  },
  mixin() {
    const store = asyncLocalStorage.getStore();
    return {
      correlationId: store?.correlationId || 'no-correlation-id',
      tenantId: store?.tenantId,
      userId: store?.userId,
      requestId: store?.requestId,
    };
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.apiKey',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Run a function with correlation context
 */
export function withCorrelationId<T>(
  correlationId: string,
  fn: () => T | Promise<T>,
  context?: Partial<LogContext>
): T | Promise<T> {
  return asyncLocalStorage.run(
    {
      correlationId,
      ...context,
    },
    fn
  );
}

/**
 * Get the current correlation context
 */
export function getCorrelationContext(): LogContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Set additional context for the current correlation
 */
export function setCorrelationContext(context: Partial<LogContext>): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    Object.assign(store, context);
  }
}

/**
 * Create a child logger with additional context
 */
export function createLogger(context: {
  service?: string;
  module?: string;
  [key: string]: any;
}) {
  return baseLogger.child(context);
}

/**
 * Request logger middleware for Next.js API routes
 */
export function logRequest(
  req: {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
  },
  res: {
    statusCode: number;
  },
  duration: number
) {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    generateCorrelationId();

  const tenantId = req.headers['x-tenant-id'] as string;
  const userId = req.headers['x-user-id'] as string;

  baseLogger.info({
    correlationId,
    tenantId,
    userId,
    type: 'http_request',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration,
    userAgent: req.headers['user-agent'],
  });
}

/**
 * Log an error with full context
 */
export function logError(
  error: Error,
  context?: Record<string, any>
): void {
  baseLogger.error({
    ...context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    type: 'error',
  });
}

/**
 * Log a performance metric
 */
export function logMetric(
  name: string,
  value: number,
  unit: string = 'ms',
  tags?: Record<string, string>
): void {
  baseLogger.info({
    type: 'metric',
    metric: {
      name,
      value,
      unit,
      tags,
    },
  });
}

/**
 * Log a business event
 */
export function logBusinessEvent(
  event: string,
  data?: Record<string, any>
): void {
  baseLogger.info({
    type: 'business_event',
    event,
    data,
  });
}

/**
 * Log job processing
 */
export function logJobEvent(
  jobId: string,
  queue: string,
  event: 'started' | 'completed' | 'failed' | 'retrying',
  details?: Record<string, any>
): void {
  const logFn = event === 'failed' ? baseLogger.error : baseLogger.info;
  
  logFn.call(baseLogger, {
    type: 'job_event',
    jobId,
    queue,
    event,
    ...details,
  });
}

/**
 * Log database query (for slow query tracking)
 */
export function logQuery(
  query: string,
  duration: number,
  params?: any[]
): void {
  const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000');
  
  if (duration > threshold) {
    baseLogger.warn({
      type: 'slow_query',
      query: query.substring(0, 500), // Truncate long queries
      duration,
      params: params?.length ? `${params.length} params` : undefined,
    });
  }
}

/**
 * Log external API call
 */
export function logExternalCall(
  service: string,
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  error?: string
): void {
  const logFn = error ? baseLogger.error : baseLogger.info;
  
  logFn.call(baseLogger, {
    type: 'external_api',
    service,
    endpoint,
    method,
    statusCode,
    duration,
    error,
  });
}

// Export default logger for simple use cases
export const logger = baseLogger;

// Named loggers for different services
export const contractLogger = createLogger({ service: 'contract-processing' });
export const artifactLogger = createLogger({ service: 'artifact-generation' });
export const storageLogger = createLogger({ service: 'storage' });
export const queueLogger = createLogger({ service: 'queue' });
export const apiLogger = createLogger({ service: 'api' });
export const authLogger = createLogger({ service: 'auth' });
