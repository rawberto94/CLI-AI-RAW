/**
 * Production-Ready Logging Utility
 * Provides structured logging with environment-aware behavior and request tracing
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  contractId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  service: string;
  environment: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;
  private isTest: boolean;
  private baseContext: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isTest = process.env.NODE_ENV === 'test';
    this.baseContext = context;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isProduction ? 'info' : 'debug');
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger({ ...this.baseContext, ...context });
    return childLogger;
  }

  /**
   * Create a logger with a request ID for tracing
   */
  withRequestId(requestId: string): Logger {
    return this.child({ requestId });
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isTest && !process.env.ENABLE_TEST_LOGS) {
      return false;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: process.env.SERVICE_NAME || 'contract-intelligence',
      environment: process.env.NODE_ENV || 'development',
    };

    const mergedContext = { ...this.baseContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      };
    }

    return entry;
  }

  private output(entry: StructuredLogEntry): void {
    if (this.isProduction) {
      // JSON output for production log aggregation
      console.log(JSON.stringify(entry));
    } else {
      // Pretty print for development
      const colors: Record<LogLevel, string> = {
        trace: '\x1b[90m',
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      };
      const reset = '\x1b[0m';
      const color = colors[entry.level];
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const level = entry.level.toUpperCase().padEnd(5);
      const reqId = entry.context?.requestId ? `[${String(entry.context.requestId).slice(0, 8)}] ` : '';
      
      let output = `${color}${time} ${level}${reset} ${reqId}${entry.message}`;
      
      const ctx = { ...entry.context };
      delete ctx.requestId;
      if (Object.keys(ctx).length > 0) {
        output += ` ${JSON.stringify(ctx)}`;
      }
      
      console.log(output);
      if (entry.error?.stack) {
        console.log(`${colors.error}${entry.error.stack}${reset}`);
      }
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;
    const entry = this.formatEntry(level, message, context, error);
    this.output(entry);
  }

  trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (error instanceof Error) {
      this.log('error', message, context, error);
    } else {
      this.log('error', message, { ...context, errorData: error });
    }
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    if (error instanceof Error) {
      this.log('fatal', message, context, error);
    } else {
      this.log('fatal', message, { ...context, errorData: error });
    }
  }

  /**
   * Time an async operation
   */
  async time<T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.info(`${label} completed`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`${label} failed`, error as Error, { ...context, duration });
      throw error;
    }
  }

  // Specialized logging for performance metrics
  performance(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      durationMs,
      operation,
    });
  }

  // Specialized logging for user actions
  userAction(action: string, userId?: string, context?: LogContext): void {
    this.info(`User Action: ${action}`, {
      ...context,
      action,
      userId,
    });
  }

  // API request logging
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, { ...context, method, path });
  }

  apiResponse(method: string, path: string, status: number, duration: number, context?: LogContext): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `API ${method} ${path} ${status}`, { ...context, method, path, status, duration });
  }
}

// Export singleton instance
export const logger = new Logger();

// Create request-scoped logger
export function createRequestLogger(requestId: string): Logger {
  return logger.withRequestId(requestId);
}

// Convenience exports
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logPerformance = logger.performance.bind(logger);
export const logUserAction = logger.userAction.bind(logger);

export default logger;
