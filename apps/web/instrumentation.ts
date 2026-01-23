/**
 * Next.js Instrumentation
 * 
 * This file is automatically loaded by Next.js at startup.
 * Used to validate environment and initialize services.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run validation on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    let isShuttingDown = false;

    /**
     * Graceful shutdown handler
     * Ensures database connections are closed cleanly
     */
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
        return;
      }
      
      isShuttingDown = true;
      console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);
      
      const shutdownTimeout = setTimeout(() => {
        console.error('[Shutdown] Timeout exceeded, forcing exit');
        // Use dynamic require to avoid Edge Runtime issues
        if (typeof process !== 'undefined' && process.exit) {
          process.exit(1);
        }
      }, 30000); // 30 second timeout
      
      try {
        // Close Prisma connections using direct @prisma/client to avoid bundling issues
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        console.log('[Shutdown] Disconnecting database...');
        await prisma.$disconnect();
        console.log('[Shutdown] Database disconnected');
        
        // Close Redis connections if available
        // Note: Redis shutdown is handled separately to avoid bundling issues
        if (process.env.REDIS_URL) {
          console.log('[Shutdown] Redis will be closed by connection timeout');
        }
        
        clearTimeout(shutdownTimeout);
        console.log('[Shutdown] Graceful shutdown complete');
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
      console.log('✅ Environment validation passed');
      
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
    
    console.log('\n📊 Service Status:');
    console.log(`   Database: ${services.database ? '✅' : '❌'}`);
    console.log(`   Redis: ${services.redis ? '✅' : '⚠️ (optional)'}`);
    console.log(`   AI (OpenAI): ${services.openai ? '✅' : '⚠️ (optional)'}`);
    console.log(`   Storage: ${services.storage ? '✅' : '⚠️ (optional)'}`);
    console.log(`   Email: ${services.email ? '✅' : '⚠️ (optional)'}`);
    console.log('');
  }
}
