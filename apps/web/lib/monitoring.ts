/**
 * Production Monitoring & Observability
 * Centralized error tracking, performance monitoring, and logging
 */

// ============================================
// Error Tracking (Sentry Integration)
// ============================================

interface ErrorContext {
  userId?: string;
  tenantId?: string;
  route?: string;
  method?: string;
  [key: string]: unknown;
}

interface PerformanceSpan {
  name: string;
  startTime: number;
  end: () => void;
}

class MonitoringService {
  private static instance: MonitoringService;
  private initialized = false;
  private sentryDsn: string | undefined;

  private constructor() {
    this.sentryDsn = process.env.SENTRY_DSN;
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Initialize monitoring services
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (this.sentryDsn) {
      try {
        // Dynamic import for Sentry
        const Sentry = await import("@sentry/nextjs");
        Sentry.init({
          dsn: this.sentryDsn,
          environment: process.env.NODE_ENV,
          tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
          debug: process.env.NODE_ENV === "development",
          beforeSend(event) {
            // Scrub sensitive data
            if (event.request?.headers) {
              delete event.request.headers["authorization"];
              delete event.request.headers["cookie"];
            }
            return event;
          },
        });
      } catch {
        // Sentry not available
      }
    }

    this.initialized = true;
  }

  /**
   * Capture an error with context
   */
  async captureError(error: Error, context?: ErrorContext): Promise<void> {

    if (this.sentryDsn) {
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.withScope((scope) => {
          if (context) {
            scope.setTags({
              route: context.route,
              method: context.method,
            });
            scope.setUser({
              id: context.userId,
            });
            scope.setContext("request", context);
          }
          Sentry.captureException(error);
        });
      } catch {
        // Sentry not available, already logged to console
      }
    }
  }

  /**
   * Capture a message/warning
   */
  async captureMessage(message: string, level: "info" | "warning" | "error" = "info"): Promise<void> {
    if (this.sentryDsn) {
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureMessage(message, level);
      } catch {
        // Sentry not available
      }
    }
  }

  /**
   * Start a performance span
   */
  startSpan(name: string): PerformanceSpan {
    const startTime = performance.now();
    return {
      name,
      startTime,
      end: () => {
        const duration = performance.now() - startTime;
        // Log slow operations (>1s) for profiling
        if (duration > 1000) {
          console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
        }
        // Send to Sentry if configured
        if (this.sentryDsn) {
          this.captureMessage(
            `span:${name}:${Math.round(duration)}ms`,
            duration > 1000 ? 'warning' : 'info'
          ).catch(() => {});
        }
      },
    };
  }

  /**
   * Track API request metrics
   */
  trackRequest(route: string, method: string, statusCode: number, duration: number): void {
    // Log slow requests (>2s) for profiling
    if (duration > 2000) {
      console.warn(`[Performance] Slow request: ${method} ${route} ${statusCode} took ${duration.toFixed(2)}ms`);
    }
    // Send to Sentry if configured
    if (this.sentryDsn) {
      this.captureMessage(
        `request:${method}:${route}:${statusCode}:${Math.round(duration)}ms`,
        duration > 2000 || statusCode >= 500 ? 'warning' : 'info'
      ).catch(() => {});
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();

// Convenience exports
export const captureError = (error: Error, context?: ErrorContext) => 
  monitoring.captureError(error, context);

export const captureMessage = (message: string, level?: "info" | "warning" | "error") => 
  monitoring.captureMessage(message, level);

export const startSpan = (name: string) => 
  monitoring.startSpan(name);

export const trackRequest = (route: string, method: string, statusCode: number, duration: number) => 
  monitoring.trackRequest(route, method, statusCode, duration);

// Initialize on module load (in production)
if (process.env.NODE_ENV === "production") {
  monitoring.init().catch(() => {
    // Silent initialization failure
  });
}
