// IMPORTANT:
// Use the shared Prisma client from the monorepo db package so that
// schema/models/types stay consistent across apps and workers.

import getClient, { PrismaClient } from '@repo/db';

export const prisma: PrismaClient = getClient();

export async function getDb(): Promise<PrismaClient> {
  return prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

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

    return result[0] ?? null;
  } catch {
    return null;
  }
}

// Default export - getDb for routes that import like `import getDb from '@/lib/prisma'`
export default getDb;
