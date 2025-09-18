/**
 * Auto-Indexation Worker
 * 
 * This worker automatically indexes contracts for search when artifacts are populated.
 * It integrates with the enhanced search indexation service to provide comprehensive
 * search capabilities across all contract artifacts.
 */

import db from 'clients-db';

// Try to import enhanced search service, fallback if not available
let EnhancedSearchIndexationService: any;
let DatabaseManager: any;

try {
  const searchModule = require('../../packages/clients/db/src/services/enhanced-search-indexation.service');
  EnhancedSearchIndexationService = searchModule.EnhancedSearchIndexationService;
  
  const dbModule = require('../../packages/clients/db/src/database-manager');
  DatabaseManager = dbModule.DatabaseManager;
} catch (error) {
  console.warn('Enhanced search indexation service not available, using fallback');
  // Fallback implementation
  EnhancedSearchIndexationService = class {
    constructor() {}
    async indexContract(contractId: string) {
      return {
        contractId,
        indexed: false,
        searchableFields: 0,
        processingTime: 0,
        confidence: 0,
        errors: ['Enhanced search service not available']
      };
    }
    async getIndexationStats() {
      return {
        totalIndexed: 0,
        averageConfidence: 0,
        lastIndexed: null,
        indexedByType: {}
      };
    }
  };
  
  DatabaseManager = class {
    constructor() {}
  };
}

// Initialize services
const databaseManager = new DatabaseManager();
const searchIndexationService = new EnhancedSearchIndexationService(databaseManager);

export interface AutoIndexationJobData {
  contractId: string;
  tenantId?: string;
  priority?: number;
  triggerType?: 'artifact_created' | 'artifact_updated' | 'contract_created' | 'manual';
  artifactTypes?: string[];
}

export interface AutoIndexationResult {
  contractId: string;
  indexed: boolean;
  searchableFields: number;
  processingTime: number;
  confidence: number;
  triggerType: string;
  errors?: string[];
}

/**
 * Main auto-indexation worker function
 */
export async function runAutoIndexation(job: { data: AutoIndexationJobData }): Promise<AutoIndexationResult> {
  const { contractId, tenantId, priority = 5, triggerType = 'manual', artifactTypes = [] } = job.data;
  
  console.log(`🔄 [worker:auto-indexation] Starting auto-indexation for contract ${contractId}`);
  console.log(`📋 Trigger: ${triggerType}, Priority: ${priority}, Artifacts: [${artifactTypes.join(', ')}]`);
  
  const startTime = Date.now();
  
  try {
    // Verify contract exists and get tenant info
    const contract = await db.contract.findUnique({ 
      where: { id: contractId }
    });
    
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    
    const contractTenantId = tenantId || contract.tenantId;
    
    // Check if contract has sufficient artifacts for indexation
    const artifactCount = await db.artifact.count({
      where: { contractId }
    });
    
    if (artifactCount === 0) {
      console.log(`⚠️ Contract ${contractId} has no artifacts, skipping indexation`);
      return {
        contractId,
        indexed: false,
        searchableFields: 0,
        processingTime: Date.now() - startTime,
        confidence: 0,
        triggerType,
        errors: ['No artifacts available for indexation']
      };
    }
    
    // Perform comprehensive indexation
    console.log(`🔍 Indexing contract ${contractId} with ${artifactCount} artifacts...`);
    const indexationResult = await searchIndexationService.indexContract(contractId);
    
    // Update indexation queue status if this was triggered by queue
    if (triggerType !== 'manual') {
      await updateIndexationQueueStatus(contractId, indexationResult.indexed ? 'completed' : 'failed', indexationResult.errors?.[0]);
    }
    
    // Log indexation metrics
    await logIndexationMetrics(contractId, contractTenantId, indexationResult, triggerType, artifactTypes);
    
    // Trigger post-indexation hooks
    await triggerPostIndexationHooks(contractId, indexationResult);
    
    const processingTime = Date.now() - startTime;
    
    if (indexationResult.indexed) {
      console.log(`✅ Successfully auto-indexed contract ${contractId} in ${processingTime}ms`);
      console.log(`📊 Indexed ${indexationResult.searchableFields} searchable fields with ${Math.round(indexationResult.confidence * 100)}% confidence`);
    } else {
      console.log(`❌ Failed to auto-index contract ${contractId}: ${indexationResult.errors?.join(', ')}`);
    }
    
    return {
      contractId,
      indexed: indexationResult.indexed,
      searchableFields: indexationResult.searchableFields,
      processingTime,
      confidence: indexationResult.confidence,
      triggerType,
      errors: indexationResult.errors
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ Auto-indexation failed for contract ${contractId}:`, error);
    
    // Update queue status on failure
    if (triggerType !== 'manual') {
      await updateIndexationQueueStatus(contractId, 'failed', errorMessage);
    }
    
    return {
      contractId,
      indexed: false,
      searchableFields: 0,
      processingTime,
      confidence: 0,
      triggerType,
      errors: [errorMessage]
    };
  }
}

/**
 * Batch auto-indexation for multiple contracts
 */
export async function runBatchAutoIndexation(job: { data: { contractIds: string[]; tenantId?: string } }): Promise<AutoIndexationResult[]> {
  const { contractIds, tenantId } = job.data;
  
  console.log(`🔄 [worker:auto-indexation] Starting batch auto-indexation for ${contractIds.length} contracts`);
  const startTime = Date.now();
  
  const results: AutoIndexationResult[] = [];
  
  // Process contracts in parallel with concurrency limit
  const concurrencyLimit = 5;
  const chunks = chunkArray(contractIds, concurrencyLimit);
  
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(contractId => 
      runAutoIndexation({ 
        data: { 
          contractId, 
          tenantId, 
          triggerType: 'manual' 
        } 
      })
    );
    
    const chunkResults = await Promise.allSettled(chunkPromises);
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          contractId: chunk[index],
          indexed: false,
          searchableFields: 0,
          processingTime: 0,
          confidence: 0,
          triggerType: 'manual',
          errors: [result.reason?.message || 'Unknown error']
        });
      }
    });
  }
  
  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.indexed).length;
  
  console.log(`✅ Batch auto-indexation complete: ${successCount}/${contractIds.length} contracts indexed in ${totalTime}ms`);
  
  return results;
}

/**
 * Process indexation queue
 */
export async function processIndexationQueue(job: { data: { limit?: number; tenantId?: string } }): Promise<{
  processed: number;
  successful: number;
  failed: number;
  processingTime: number;
}> {
  const { limit = 50, tenantId } = job.data;
  
  console.log(`🔄 [worker:auto-indexation] Processing indexation queue (limit: ${limit})`);
  const startTime = Date.now();
  
  try {
    // Get pending indexation jobs from queue
    const queueItems = await db.$queryRaw`
      SELECT contract_id, tenant_id, priority, retry_count, max_retries
      FROM contract_indexation_queue
      WHERE status = 'pending'
        AND scheduled_at <= NOW()
        ${tenantId ? `AND tenant_id = ${tenantId}` : ''}
      ORDER BY priority ASC, scheduled_at ASC
      LIMIT ${limit}
    ` as any[];
    
    if (queueItems.length === 0) {
      console.log('📭 No pending indexation jobs in queue');
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        processingTime: Date.now() - startTime
      };
    }
    
    console.log(`📋 Processing ${queueItems.length} indexation jobs from queue`);
    
    let successful = 0;
    let failed = 0;
    
    // Process queue items
    for (const item of queueItems) {
      try {
        // Mark as processing
        await db.$executeRaw`
          UPDATE contract_indexation_queue 
          SET status = 'processing', started_at = NOW(), updated_at = NOW()
          WHERE contract_id = ${item.contract_id}
        `;
        
        // Run indexation
        const result = await runAutoIndexation({
          data: {
            contractId: item.contract_id,
            tenantId: item.tenant_id,
            triggerType: 'artifact_created'
          }
        });
        
        if (result.indexed) {
          successful++;
        } else {
          failed++;
          
          // Handle retry logic
          if (item.retry_count < item.max_retries) {
            await db.$executeRaw`
              UPDATE contract_indexation_queue 
              SET status = 'pending', 
                  retry_count = retry_count + 1,
                  scheduled_at = NOW() + INTERVAL '5 minutes',
                  error_message = ${result.errors?.[0] || 'Unknown error'},
                  updated_at = NOW()
              WHERE contract_id = ${item.contract_id}
            `;
          } else {
            await db.$executeRaw`
              UPDATE contract_indexation_queue 
              SET status = 'failed',
                  error_message = ${result.errors?.[0] || 'Max retries exceeded'},
                  completed_at = NOW(),
                  updated_at = NOW()
              WHERE contract_id = ${item.contract_id}
            `;
          }
        }
        
      } catch (error) {
        console.error(`Failed to process queue item for contract ${item.contract_id}:`, error);
        failed++;
        
        // Mark as failed
        await db.$executeRaw`
          UPDATE contract_indexation_queue 
          SET status = 'failed',
              error_message = ${error instanceof Error ? error.message : 'Unknown error'},
              completed_at = NOW(),
              updated_at = NOW()
          WHERE contract_id = ${item.contract_id}
        `;
      }
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Queue processing complete: ${successful} successful, ${failed} failed in ${processingTime}ms`);
    
    return {
      processed: queueItems.length,
      successful,
      failed,
      processingTime
    };
    
  } catch (error) {
    console.error('Failed to process indexation queue:', error);
    throw error;
  }
}

/**
 * Update indexation queue status
 */
async function updateIndexationQueueStatus(contractId: string, status: string, errorMessage?: string): Promise<void> {
  try {
    if (status === 'completed') {
      await db.$executeRaw`
        UPDATE contract_indexation_queue 
        SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE contract_id = ${contractId}
      `;
    } else if (status === 'failed') {
      await db.$executeRaw`
        UPDATE contract_indexation_queue 
        SET status = 'failed', 
            error_message = ${errorMessage || 'Unknown error'},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE contract_id = ${contractId}
      `;
    }
  } catch (error) {
    console.warn('Failed to update indexation queue status:', error);
  }
}

/**
 * Log indexation metrics for analytics
 */
async function logIndexationMetrics(
  contractId: string,
  tenantId: string,
  result: any,
  triggerType: string,
  artifactTypes: string[]
): Promise<void> {
  try {
    await db.$executeRaw`
      INSERT INTO indexation_metrics (
        contract_id,
        tenant_id,
        trigger_type,
        artifact_types,
        searchable_fields,
        confidence_score,
        processing_time_ms,
        indexed_successfully,
        error_message,
        created_at
      ) VALUES (
        ${contractId},
        ${tenantId},
        ${triggerType},
        ${JSON.stringify(artifactTypes)},
        ${result.searchableFields},
        ${result.confidence},
        ${result.processingTime},
        ${result.indexed},
        ${result.errors?.[0] || null},
        NOW()
      )
    `;
  } catch (error) {
    console.warn('Failed to log indexation metrics:', error);
  }
}

/**
 * Trigger post-indexation hooks
 */
async function triggerPostIndexationHooks(contractId: string, result: any): Promise<void> {
  try {
    // Update search suggestions based on indexed content
    if (result.indexed && result.searchableFields > 0) {
      // This could trigger additional workers or services
      console.log(`🔗 Triggering post-indexation hooks for contract ${contractId}`);
      
      // Example: Update search suggestions, trigger analytics, etc.
      // These would be implemented as separate services or workers
    }
  } catch (error) {
    console.warn('Failed to trigger post-indexation hooks:', error);
  }
}

/**
 * Utility function to chunk array
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Health check for auto-indexation system
 */
export async function runIndexationHealthCheck(job: { data: { tenantId?: string } }): Promise<{
  healthy: boolean;
  stats: {
    totalContracts: number;
    indexedContracts: number;
    indexationPercentage: number;
    pendingQueue: number;
    failedQueue: number;
    averageConfidence: number;
  };
  issues: string[];
}> {
  const { tenantId } = job.data;
  
  console.log('🏥 [worker:auto-indexation] Running indexation health check');
  
  try {
    const issues: string[] = [];
    
    // Get indexation statistics
    const stats = await searchIndexationService.getIndexationStats(tenantId || 'all');
    
    // Get queue statistics
    const queueStats = await db.$queryRaw`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'processing' AND started_at < NOW() - INTERVAL '1 hour' THEN 1 END) as stuck_count
      FROM contract_indexation_queue
      ${tenantId ? `WHERE tenant_id = ${tenantId}` : ''}
    ` as any[];
    
    const queueData = queueStats[0];
    const pendingQueue = parseInt(queueData.pending_count) || 0;
    const failedQueue = parseInt(queueData.failed_count) || 0;
    const stuckQueue = parseInt(queueData.stuck_count) || 0;
    
    // Get total contracts
    const contractStats = await db.$queryRaw`
      SELECT COUNT(*) as total_contracts
      FROM contracts
      ${tenantId ? `WHERE tenant_id = ${tenantId}` : ''}
    ` as any[];
    
    const totalContracts = parseInt(contractStats[0].total_contracts) || 0;
    const indexationPercentage = totalContracts > 0 ? (stats.totalIndexed / totalContracts) * 100 : 0;
    
    // Check for issues
    if (indexationPercentage < 80) {
      issues.push(`Low indexation coverage: ${indexationPercentage.toFixed(1)}% of contracts indexed`);
    }
    
    if (stats.averageConfidence < 0.7) {
      issues.push(`Low average confidence score: ${(stats.averageConfidence * 100).toFixed(1)}%`);
    }
    
    if (pendingQueue > 100) {
      issues.push(`High pending queue: ${pendingQueue} contracts waiting for indexation`);
    }
    
    if (failedQueue > 50) {
      issues.push(`High failure rate: ${failedQueue} failed indexation attempts`);
    }
    
    if (stuckQueue > 0) {
      issues.push(`Stuck processing jobs: ${stuckQueue} jobs processing for over 1 hour`);
    }
    
    const healthy = issues.length === 0;
    
    console.log(`🏥 Health check complete: ${healthy ? 'HEALTHY' : 'ISSUES DETECTED'}`);
    if (!healthy) {
      console.log(`⚠️ Issues found: ${issues.join(', ')}`);
    }
    
    return {
      healthy,
      stats: {
        totalContracts,
        indexedContracts: stats.totalIndexed,
        indexationPercentage: Math.round(indexationPercentage * 100) / 100,
        pendingQueue,
        failedQueue,
        averageConfidence: Math.round(stats.averageConfidence * 100) / 100
      },
      issues
    };
    
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      healthy: false,
      stats: {
        totalContracts: 0,
        indexedContracts: 0,
        indexationPercentage: 0,
        pendingQueue: 0,
        failedQueue: 0,
        averageConfidence: 0
      },
      issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}