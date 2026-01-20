/**
 * Storage Cleanup Worker
 * 
 * Automatically removes expired documents based on retention policy.
 * Keeps thumbnails and metadata for preview functionality.
 * 
 * Run via: pnpm storage:cleanup or as scheduled job
 */

import { prisma } from '@/lib/prisma';
import { deleteFromStorage } from '@/lib/storage';
import { getStorageConfig, getDocumentsForCleanup } from './retention-config';

interface CleanupResult {
  processed: number;
  deleted: number;
  errors: number;
  freedSpaceMB: number;
}

/**
 * Run storage cleanup based on retention policy
 */
export async function runStorageCleanup(
  options: {
    dryRun?: boolean;
    batchSize?: number;
    tenantId?: string;
  } = {}
): Promise<CleanupResult> {
  const { dryRun = false, batchSize = 100, tenantId } = options;
  const config = getStorageConfig();
  
  console.log(`[Storage Cleanup] Starting with config:`, {
    mode: config.mode,
    retentionDays: config.retentionDays,
    dryRun,
  });
  
  if (config.mode === 'full') {
    console.log('[Storage Cleanup] Mode is "full" - no cleanup needed');
    return { processed: 0, deleted: 0, errors: 0, freedSpaceMB: 0 };
  }
  
  const result: CleanupResult = {
    processed: 0,
    deleted: 0,
    errors: 0,
    freedSpaceMB: 0,
  };
  
  // Get contracts with storage paths
  const whereClause: any = {
    storagePath: { not: null },
  };
  
  if (tenantId) {
    whereClause.tenantId = tenantId;
  }
  
  let hasMore = true;
  let cursor: string | undefined;
  
  while (hasMore) {
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        uploadedAt: true,
        storagePath: true,
        fileSize: true,
      },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });
    
    if (contracts.length === 0) {
      hasMore = false;
      break;
    }
    
    cursor = contracts[contracts.length - 1].id;
    result.processed += contracts.length;
    
    // Get IDs of documents that should be deleted
    const toDelete = getDocumentsForCleanup(
      contracts.map(c => ({
        id: c.id,
        uploadedAt: c.uploadedAt,
        storagePath: c.storagePath,
      })),
      config
    );
    
    for (const contractId of toDelete) {
      const contract = contracts.find(c => c.id === contractId);
      if (!contract?.storagePath) continue;
      
      try {
        if (!dryRun) {
          // Delete from storage
          await deleteFromStorage(contract.storagePath);
          
          // Clear storage path in database (keep metadata)
          await prisma.contract.update({
            where: { id: contractId },
            data: {
              storagePath: null,
              // Keep these for preview/search:
              // - rawText
              // - metadata
              // - thumbnails (if stored separately)
            },
          });
        }
        
        result.deleted++;
        result.freedSpaceMB += Number(contract.fileSize || 0) / 1024 / 1024;
        
        console.log(`[Storage Cleanup] ${dryRun ? '[DRY RUN] Would delete' : 'Deleted'}: ${contract.storagePath}`);
      } catch (error) {
        console.error(`[Storage Cleanup] Error deleting ${contractId}:`, error);
        result.errors++;
      }
    }
    
    hasMore = contracts.length === batchSize;
  }
  
  console.log(`[Storage Cleanup] Complete:`, result);
  return result;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(tenantId?: string): Promise<{
  totalContracts: number;
  contractsWithFiles: number;
  contractsExpired: number;
  estimatedStorageMB: number;
}> {
  const config = getStorageConfig();
  
  const whereClause: any = {};
  if (tenantId) {
    whereClause.tenantId = tenantId;
  }
  
  const [totalContracts, contractsWithFiles, contracts] = await Promise.all([
    prisma.contract.count({ where: whereClause }),
    prisma.contract.count({ 
      where: { ...whereClause, storagePath: { not: null } } 
    }),
    prisma.contract.findMany({
      where: { ...whereClause, storagePath: { not: null } },
      select: { id: true, uploadedAt: true, storagePath: true, fileSize: true },
    }),
  ]);
  
  const expiredIds = getDocumentsForCleanup(
    contracts.map(c => ({
      id: c.id,
      uploadedAt: c.uploadedAt,
      storagePath: c.storagePath,
    })),
    config
  );
  
  const estimatedStorageMB = contracts.reduce(
    (sum, c) => sum + Number(c.fileSize || 0),
    0
  ) / 1024 / 1024;
  
  return {
    totalContracts,
    contractsWithFiles,
    contractsExpired: expiredIds.length,
    estimatedStorageMB: Math.round(estimatedStorageMB * 100) / 100,
  };
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  runStorageCleanup({ dryRun })
    .then(result => {
      console.log('Cleanup complete:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
