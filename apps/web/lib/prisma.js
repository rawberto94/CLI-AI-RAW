"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.checkDatabaseConnection = checkDatabaseConnection;
exports.getConnectionStats = getConnectionStats;
exports.getDb = getDb;
const client_1 = require("@prisma/client");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'prisma-client',
    ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});
// Production-optimized connection pool settings
// - connection_limit: Max connections (default 10, production 20-50)
// - pool_timeout: Wait time for connection (default 10s)
// - connect_timeout: Connection establishment (default 5s)
// - idle_in_transaction_session_timeout: Prevent stuck transactions
const isProduction = process.env.NODE_ENV === 'production';
// Create Prisma client with optimized configuration
exports.prisma = global.prisma ||
    new client_1.PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
        log: isProduction
            ? [{ emit: 'event', level: 'error' }] // Minimal logging in production
            : [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
    });
// Log slow queries (only in development)
if (process.env['NODE_ENV'] === 'development') {
    exports.prisma.$on('query', (e) => {
        if (e.duration > 1000) {
            logger.warn({
                query: e.query,
                duration: e.duration,
                params: e.params,
            }, 'Slow query detected');
        }
    });
    // Log errors
    exports.prisma.$on('error', (e) => {
        logger.error({ error: e }, 'Prisma error');
    });
    // Log warnings
    exports.prisma.$on('warn', (e) => {
        logger.warn({ warning: e }, 'Prisma warning');
    });
}
// Graceful shutdown
if (process.env['NODE_ENV'] !== 'production') {
    global.prisma = exports.prisma;
}
// Only disconnect on explicit process termination, not on every request
let disconnecting = false;
const gracefulShutdown = async () => {
    if (!disconnecting) {
        disconnecting = true;
        logger.info('Disconnecting Prisma client');
        await exports.prisma.$disconnect();
    }
};
process.once('SIGTERM', gracefulShutdown);
process.once('SIGINT', gracefulShutdown);
// Connection health check
async function checkDatabaseConnection() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        logger.error({ error }, 'Database connection check failed');
        return false;
    }
}
// Get connection pool stats
async function getConnectionStats() {
    try {
        const result = await exports.prisma.$queryRaw `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
        return result[0];
    }
    catch (error) {
        logger.error({ error }, 'Failed to get connection stats');
        return null;
    }
}
// Helper function to get db instance (for compatibility with routes using getDb)
async function getDb() {
    return exports.prisma;
}
// Default export - getDb for routes that import like `import getDb from '@/lib/prisma'`
exports.default = getDb;
