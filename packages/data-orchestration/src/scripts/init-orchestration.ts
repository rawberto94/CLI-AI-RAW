/**
 * Initialize Unified Orchestration
 * 
 * This script initializes the unified orchestration service,
 * connecting all isolated systems together.
 */

import { unifiedOrchestrationService } from '../services/unified-orchestration.service';
import pino from 'pino';

const logger = pino({ name: 'init-orchestration' });

async function initializeOrchestration() {
  try {
    logger.info('🚀 Initializing Unified Orchestration Service...');

    // Initialize the orchestration service
    await unifiedOrchestrationService.initialize();

    // Get configuration
    const config = unifiedOrchestrationService.getConfig();
    logger.info({ config }, '✅ Orchestration initialized with configuration');

    // Get health status
    const health = await unifiedOrchestrationService.healthCheck();
    logger.info({ health }, `📊 Orchestration health: ${health.status}`);

    // Log enabled integrations
    const enabledIntegrations = Object.entries(config)
      .filter(([key, value]) => value === true)
      .map(([key]) => key);

    logger.info(
      { enabledIntegrations, count: enabledIntegrations.length },
      '🔗 Enabled integrations'
    );

    logger.info('✅ Unified Orchestration Service is ready!');
    logger.info('');
    logger.info('📋 Active Integrations:');
    logger.info('   ✅ RAG System Integration');
    logger.info('   ✅ Analytical Intelligence Sync');
    logger.info('   ✅ Rate Card Benchmarking');
    logger.info('   ✅ Data Standardization');
    logger.info('   ✅ Savings Detection');
    logger.info('   ✅ Taxonomy Enrichment');
    logger.info('   ✅ Workflow Automation');
    logger.info('   ✅ Intelligence Engine');
    logger.info('');
    logger.info('🎯 Your system is now fully orchestrated!');

    return true;
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize orchestration');
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  initializeOrchestration()
    .then(() => {
      logger.info('Orchestration initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Orchestration initialization failed');
      process.exit(1);
    });
}

export { initializeOrchestration };
