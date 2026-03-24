/**
 * Next.js Instrumentation
 * 
 * This file is automatically loaded by Next.js at startup.
 * Used to validate environment and initialize services.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Use console.warn for informational messages to satisfy ESLint rules
const logInfo = (message: string) => console.warn(`[INFO] ${message}`);

export async function register() {
  // Only run validation on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize OpenTelemetry (skips in dev unless OTEL_ENABLED=true)
    const { initTelemetry } = await import('./lib/telemetry/opentelemetry');
    const otelSdk = await initTelemetry();

    let isShuttingDown = false;

    /**
     * Graceful shutdown handler
     * Ensures database connections are closed cleanly
     */
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logInfo(`[Shutdown] Already shutting down, ignoring ${signal}`);
        return;
      }
      
      isShuttingDown = true;
      logInfo(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
      
      const shutdownTimeout = setTimeout(() => {
        console.error('[Shutdown] Timeout exceeded, forcing exit');
        // Use dynamic require to avoid Edge Runtime issues
        if (typeof process !== 'undefined' && process.exit) {
          process.exit(1);
        }
      }, 30000); // 30 second timeout
      
      try {
        // Shutdown OpenTelemetry SDK first (flush pending spans/metrics)
        if (otelSdk) {
          logInfo('[Shutdown] Shutting down OpenTelemetry...');
          await otelSdk.shutdown();
          logInfo('[Shutdown] OpenTelemetry shut down');
        }

        // Close the app's actual Prisma singleton (imported from @repo/db via lib/prisma)
        const { prisma } = await import('./lib/prisma');
        logInfo('[Shutdown] Disconnecting database...');
        await prisma.$disconnect();
        logInfo('[Shutdown] Database disconnected');
        
        // Close Redis connections if available
        // Note: Redis shutdown is handled separately to avoid bundling issues
        if (process.env.REDIS_URL) {
          logInfo('[Shutdown] Redis will be closed by connection timeout');
        }
        
        clearTimeout(shutdownTimeout);
        logInfo('[Shutdown] Graceful shutdown complete');
        if (typeof process !== 'undefined' && process.exit) {
          process.exit(0);
        }
      } catch (error) {
        console.error('[Shutdown] Error during graceful shutdown:', error);
        clearTimeout(shutdownTimeout);
        if (typeof process !== 'undefined' && process.exit) {
          process.exit(1);
        }
      }
    };

    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[Fatal] Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Fatal] Unhandled rejection at:', promise, 'reason:', reason);
      // Don't exit on unhandled rejection in development
      if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('unhandledRejection');
      }
    });
    
    const { validateEnvironment } = await import('./lib/env-validation');
    
    // Initialize DB-backed audit storage so auth/API audit events persist to AuditLog table
    try {
      const { prisma } = await import('./lib/prisma');
      const { PrismaAuditStorage, setAuditStorage } = await import('./lib/security/audit');
      setAuditStorage(new PrismaAuditStorage(prisma as Parameters<InstanceType<typeof PrismaAuditStorage>['constructor']>[0]));
      logInfo('✅ Audit storage wired to database');
    } catch (err) {
      console.warn('[Instrumentation] Failed to initialize DB audit storage, falling back to in-memory:', err);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    
    // Validate environment variables at startup
    const result = validateEnvironment({
      throwOnError: isProduction, // Throw on missing required vars in production
      logResults: true,
    });
    
    if (!result.valid) {
      console.error('='.repeat(60));
      console.error('ENVIRONMENT VALIDATION FAILED');
      console.error('='.repeat(60));
      
      for (const error of result.errors) {
        console.error(`❌ ${error}`);
      }
      
      if (result.warnings.length > 0) {
        console.warn('\nWarnings:');
        for (const warning of result.warnings) {
          console.warn(`⚠️  ${warning}`);
        }
      }
      
      console.error('='.repeat(60));
      
      // In production, exit the process if critical vars are missing
      if (isProduction && typeof process !== 'undefined' && process.exit) {
        console.error('Exiting due to invalid environment configuration.');
        process.exit(1);
      }
    } else {
      logInfo('✅ Environment validation passed');
      
      if (result.warnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of result.warnings) {
          console.warn(`⚠️  ${warning}`);
        }
      }
    }
    
    // Log service status
    const { getServiceStatus } = await import('./lib/env');
    const services = getServiceStatus();
    
    logInfo('📊 Service Status:');
    logInfo(`   Database: ${services.database ? '✅' : '❌'}`);
    logInfo(`   Redis: ${services.redis ? '✅' : '⚠️ (optional)'}`);
    logInfo(`   AI (OpenAI): ${services.openai ? '✅' : '⚠️ (optional)'}`);
    logInfo(`   Storage: ${services.storage ? '✅' : '⚠️ (optional)'}`);
    logInfo(`   Email: ${services.email ? '✅' : '⚠️ (optional)'}`);
  }
}
