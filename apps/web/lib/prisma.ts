import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'prisma-client' });

// Prevent multiple instances in development
declare global {
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with optimized configuration
export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

// Log slow queries (only in development)
if (process.env['NODE_ENV'] === 'development') {
  (prisma.$on as any)('query', (e: any) => {
    if (e.duration > 1000) {
      logger.warn(
        {
          query: e.query,
          duration: e.duration,
          params: e.params,
        },
        'Slow query detected'
      );
    }
  });

  // Log errors
  (prisma.$on as any)('error', (e: any) => {
    logger.error({ error: e }, 'Prisma error');
  });

  // Log warnings
  (prisma.$on as any)('warn', (e: any) => {
    logger.warn({ warning: e }, 'Prisma warning');
  });
}

// Graceful shutdown
if (process.env['NODE_ENV'] !== 'production') {
  global.prisma = prisma;
}

// Only disconnect on explicit process termination, not on every request
let disconnecting = false;

const gracefulShutdown = async () => {
  if (!disconnecting) {
    disconnecting = true;
    logger.info('Disconnecting Prisma client');
    await prisma.$disconnect();
  }
};

process.once('SIGTERM', gracefulShutdown);
process.once('SIGINT', gracefulShutdown);

// Connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection check failed');
    return false;
  }
}

// Get connection pool stats
export async function getConnectionStats() {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        total_connections: number;
        active_connections: number;
        idle_connections: number;
      }>
    >`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return result[0];
  } catch (error) {
    logger.error({ error }, 'Failed to get connection stats');
    return null;
  }
}

// Helper function to get db instance (for compatibility with routes using getDb)
export async function getDb(): Promise<PrismaClient> {
  return prisma;
}

// Default export - getDb for routes that import like `import getDb from '@/lib/prisma'`
export default getDb;
