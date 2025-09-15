import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './AppError.js';

/**
 * Centralized error handling middleware for Fastify
 */
export async function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const logger = request.server.log;
  const requestId = request.id;
  const method = request.method;
  const url = request.url;
  const userAgent = request.headers['user-agent'];
  const ip = request.ip;

  // Build error response structure
  const errorResponse = {
    error: true,
    statusCode: 500,
    message: 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: url,
    requestId,
    method
  };

  // Handle operational application errors
  if (error instanceof AppError) {
    errorResponse.statusCode = error.statusCode;
    errorResponse.message = error.message;

    // Log based on severity
    if (error.statusCode >= 500) {
      logger.error({
        err: error,
        req: { method, url, userAgent, ip },
        requestId,
        context: error.context
      }, `Server error: ${error.message}`);
    } else if (error.statusCode >= 400) {
      logger.warn({
        err: error,
        req: { method, url, userAgent, ip },
        requestId,
        context: error.context
      }, `Client error: ${error.message}`);
    }

    // Add context for debugging (only in development)
    if (process.env['NODE_ENV'] === 'development' && error.context) {
      (errorResponse as any).context = error.context;
    }

    return reply.status(error.statusCode).send(errorResponse);
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    errorResponse.statusCode = 400;
    errorResponse.message = 'Validation failed';
    (errorResponse as any).validation = error.validation;

    logger.warn({
      err: error,
      req: { method, url, userAgent, ip },
      requestId,
      validation: error.validation
    }, 'Validation error');

    return reply.status(400).send(errorResponse);
  }

  // Handle Fastify errors
  if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
    errorResponse.statusCode = error.statusCode;
    errorResponse.message = error.message;

    logger.warn({
      err: error,
      req: { method, url, userAgent, ip },
      requestId
    }, `Fastify error: ${error.message}`);

    return reply.status(error.statusCode).send(errorResponse);
  }

  // Handle programming errors (unhandled exceptions)
  logger.error({
    err: error,
    req: { method, url, userAgent, ip },
    requestId,
    stack: error.stack
  }, `Unhandled error: ${error.message}`);

  // Don't expose internal error details in production
  if (process.env['NODE_ENV'] === 'production') {
    errorResponse.message = 'Internal Server Error';
  } else {
    errorResponse.message = error.message;
    (errorResponse as any).stack = error.stack;
  }

  // Ensure the process doesn't crash on unhandled errors
  if (!reply.sent) {
    return reply.status(500).send(errorResponse);
  }
}

/**
 * Handler for uncaught exceptions and unhandled rejections
 */
export function setupGlobalErrorHandling(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

/**
 * Async wrapper for route handlers to catch errors
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const [request, reply] = args;
    return Promise.resolve(fn(...args)).catch((error) => {
      return errorHandler(error, request, reply);
    });
  }) as T;
}

/**
 * Error boundary for async operations
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap unexpected errors
    throw new AppError(
      500,
      error instanceof Error ? error.message : 'Unknown error occurred',
      false,
      { ...context, originalError: error }
    );
  }
}