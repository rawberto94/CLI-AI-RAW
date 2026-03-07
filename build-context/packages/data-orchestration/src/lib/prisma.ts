/**
 * Prisma client for data-orchestration package
 * Uses @prisma/client directly since the package has its own dependency
 */

import { PrismaClient } from '@prisma/client';

// Global singleton to avoid multiple instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

export type { PrismaClient };
