#!/usr/bin/env node

/**
 * Database Initialization Script for Analytical Intelligence Layer
 * This script creates all necessary tables and indexes for the analytical intelligence features
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { dbAdaptor } from '../dal/database.adaptor';
import pino from 'pino';

const logger = pino({ name: 'analytical-db-init' });

async function initializeAnalyticalDatabase(): Promise<void> {
  try {
    logger.info('Starting analytical intelligence database initialization...');

    // Read the migration SQL file
    const migrationPath = join(__dirname, '../../prisma/migrations/001_analytical_intelligence_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    logger.info(`Executing ${statements.length} database statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await dbAdaptor.prisma.$executeRawUnsafe(statement);
        logger.debug(`Executed statement ${i + 1}/${statements.length}`);
      } catch (error) {
        logger.error({ error, statement }, `Failed to execute statement ${i + 1}`);
        throw error;
      }
    }

    logger.info('Analytical intelligence database initialization completed successfully');

    // Verify tables were created
    await verifyTables();

  } catch (error) {
    logger.error({ error }, 'Failed to initialize analytical intelligence database');
    throw error;
  }
}

async function verifyTables(): Promise<void> {
  const expectedTables = [
    'rate_cards',
    'rates', 
    'benchmarks',
    'renewal_alerts',
    'compliance_policies',
    'compliance_scores',
    'supplier_intelligence',
    'spend_data',
    'spend_analysis',
    'query_history'
  ];

  logger.info('Verifying analytical intelligence tables...');

  for (const tableName of expectedTables) {
    try {
      // Check if table exists by querying its structure
      const result = await dbAdaptor.prisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
      );
      
      if (Array.isArray(result) && result.length > 0) {
        logger.info(`✓ Table '${tableName}' exists`);
      } else {
        logger.warn(`✗ Table '${tableName}' not found`);
      }
    } catch (error) {
      logger.error({ error, tableName }, `Failed to verify table '${tableName}'`);
    }
  }

  logger.info('Table verification completed');
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeAnalyticalDatabase()
    .then(() => {
      logger.info('Database initialization script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Database initialization script failed');
      process.exit(1);
    });
}

export { initializeAnalyticalDatabase, verifyTables };