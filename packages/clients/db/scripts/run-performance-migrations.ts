/**
 * Performance Migrations Runner
 * 
 * Runs critical performance migrations:
 * - 009_performance_indexes_critical.sql
 * - 010_fulltext_search.sql
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ name: 'performance-migrations' });
const prisma = new PrismaClient();

async function runMigration(name: string, sqlFile: string): Promise<void> {
  try {
    logger.info({ migration: name }, 'Starting migration');
    
    const sql = readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let executed = 0;
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
        executed++;
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          logger.debug({ statement: statement.substring(0, 50) }, 'Skipping existing object');
        } else {
          logger.warn({ error: error.message, statement: statement.substring(0, 100) }, 'Statement failed');
        }
      }
    }
    
    logger.info({ migration: name, executed }, 'Migration completed');
  } catch (error) {
    logger.error({ error, migration: name }, 'Migration failed');
    throw error;
  }
}

async function main() {
  try {
    logger.info('Starting performance migrations');
    
    const migrationsDir = join(__dirname, '..', 'migrations');
    
    // Run migrations in order
    await runMigration(
      '009_performance_indexes_critical',
      join(migrationsDir, '009_performance_indexes_critical.sql')
    );
    
    await runMigration(
      '010_fulltext_search',
      join(migrationsDir, '010_fulltext_search.sql')
    );
    
    logger.info('All performance migrations completed successfully');
    
    // Verify indexes
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (
        indexname LIKE 'idx_contracts_%'
        OR indexname LIKE 'idx_artifacts_%'
        OR indexname LIKE 'idx_processing_jobs_%'
      )
      ORDER BY indexname
    `;
    
    logger.info({ count: indexes.length }, 'Performance indexes created');
    
    // Verify full-text search
    const ftsCheck = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Contract"
      WHERE "textVector" IS NOT NULL
    `;
    
    logger.info(
      { indexed: Number(ftsCheck[0]?.count || 0) },
      'Contracts indexed for full-text search'
    );
    
  } catch (error) {
    logger.error({ error }, 'Migration runner failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
