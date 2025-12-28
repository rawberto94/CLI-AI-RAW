/**
 * Contract Taxonomy Migration Utilities
 * 
 * Helpers for migrating existing contracts to use the new taxonomy system.
 */

import getClient from 'clients-db';
import { createLogger } from '../utils/logger';
import { mapLegacyContractType } from '../utils/contract-taxonomy.utils';
import { ContractCategoryId } from '../types/contract-taxonomy.types';

const logger = createLogger('taxonomy-migration');

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate a single contract from legacy contractType to new taxonomy
 */
export async function migrateContractToTaxonomy(
  contractId: string,
  options: {
    reclassify?: boolean; // If true, use AI to reclassify; if false, just map legacy type
  } = {}
): Promise<boolean> {
  const prisma = getClient();

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractType: true,
        contractCategoryId: true,
        rawText: true,
        fileName: true
      }
    });

    if (!contract) {
      logger.warn({ contractId }, 'Contract not found');
      return false;
    }

    // Skip if already migrated
    if (contract.contractCategoryId) {
      logger.info({ contractId }, 'Contract already migrated');
      return true;
    }

    let categoryId: ContractCategoryId | undefined;

    if (options.reclassify && contract.rawText) {
      // Use AI to reclassify
      logger.info({ contractId }, 'Reclassifying contract with AI');
      
      // TODO: Move classifier to data-orchestration package to avoid cross-package imports
      // For now, skip AI reclassification during migration
      logger.warn({ contractId }, 'AI reclassification not available during migration - using legacy category');
      categoryId = undefined; // Will use legacy mapping below
    } else if (contract.contractType) {
      // Map legacy type
      categoryId = mapLegacyContractType(contract.contractType);

      if (categoryId) {
        await prisma.contract.update({
          where: { id: contractId },
          data: {
            contractCategoryId: categoryId,
            classificationConf: 0.6, // Lower confidence for legacy mapping
            classifiedAt: new Date()
          }
        });

        logger.info(
          { contractId, legacyType: contract.contractType, categoryId },
          'Contract migrated from legacy type'
        );
      } else {
        logger.warn(
          { contractId, legacyType: contract.contractType },
          'Could not map legacy contract type'
        );
        return false;
      }
    } else {
      logger.warn({ contractId }, 'Contract has no type information');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error, contractId }, 'Failed to migrate contract');
    return false;
  }
}

/**
 * Migrate all contracts in a tenant to new taxonomy
 */
export async function migrateTenantContracts(
  tenantId: string,
  options: {
    batchSize?: number;
    reclassify?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<{
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
}> {
  const prisma = getClient();
  const batchSize = options.batchSize || 50;
  const stats = { total: 0, migrated: 0, failed: 0, skipped: 0 };

  try {
    // Get total count
    const total = await prisma.contract.count({
      where: { tenantId }
    });

    stats.total = total;
    logger.info({ tenantId, total }, 'Starting tenant contract migration');

    if (options.dryRun) {
      logger.info('DRY RUN MODE - No changes will be made');
    }

    // Process in batches
    let offset = 0;

    while (offset < total) {
      const contracts = await prisma.contract.findMany({
        where: { tenantId },
        select: { id: true },
        take: batchSize,
        skip: offset
      });

      logger.info(
        { tenantId, processed: offset, total },
        `Processing batch ${Math.floor(offset / batchSize) + 1}`
      );

      for (const contract of contracts) {
        if (options.dryRun) {
          // Just count what would be migrated
          const existing = await prisma.contract.findUnique({
            where: { id: contract.id },
            select: { contractCategoryId: true, contractType: true }
          });

          if (existing?.contractCategoryId) {
            stats.skipped++;
          } else if (existing?.contractType) {
            stats.migrated++;
          } else {
            stats.failed++;
          }
        } else {
          const success = await migrateContractToTaxonomy(contract.id, {
            reclassify: options.reclassify
          });

          if (success) {
            stats.migrated++;
          } else {
            stats.failed++;
          }
        }
      }

      offset += batchSize;

      // Add delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(
      { tenantId, stats },
      'Tenant contract migration completed'
    );

    return stats;
  } catch (error) {
    logger.error({ error, tenantId }, 'Tenant migration failed');
    throw error;
  }
}

/**
 * Generate migration report
 */
export async function generateMigrationReport(
  tenantId?: string
): Promise<{
  total: number;
  migrated: number;
  unmigrated: number;
  by_category: Record<string, number>;
  by_legacy_type: Record<string, number>;
  confidence_distribution: {
    high: number; // > 0.8
    medium: number; // 0.5 - 0.8
    low: number; // < 0.5
    unknown: number;
  };
}> {
  const prisma = getClient();

  const where = tenantId ? { tenantId } : {};

  const [total, migrated, unmigrated, categories, legacyTypes, confidence] =
    await Promise.all([
      // Total contracts
      prisma.contract.count({ where }),

      // Migrated (have contractCategoryId)
      prisma.contract.count({
        where: { ...where, contractCategoryId: { not: null } }
      }),

      // Unmigrated (no contractCategoryId)
      prisma.contract.count({
        where: { ...where, contractCategoryId: null }
      }),

      // Group by category
      prisma.contract.groupBy({
        by: ['contractCategoryId'],
        where: { ...where, contractCategoryId: { not: null } },
        _count: true
      }),

      // Group by legacy type
      prisma.contract.groupBy({
        by: ['contractType'],
        where: { ...where, contractType: { not: null } },
        _count: true
      }),

      // Group by confidence
      prisma.contract.groupBy({
        by: ['classificationConf'],
        where: { ...where, contractCategoryId: { not: null } },
        _count: true
      })
    ]);

  const by_category: Record<string, number> = {};
  for (const item of categories) {
    if (item.contractCategoryId) {
      by_category[item.contractCategoryId] = item._count;
    }
  }

  const by_legacy_type: Record<string, number> = {};
  for (const item of legacyTypes) {
    if (item.contractType) {
      by_legacy_type[item.contractType] = item._count;
    }
  }

  const confidence_distribution = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };

  for (const item of confidence) {
    const conf = item.classificationConf as number | null;
    if (conf === null) {
      confidence_distribution.unknown += item._count;
    } else if (conf > 0.8) {
      confidence_distribution.high += item._count;
    } else if (conf >= 0.5) {
      confidence_distribution.medium += item._count;
    } else {
      confidence_distribution.low += item._count;
    }
  }

  return {
    total,
    migrated,
    unmigrated,
    by_category,
    by_legacy_type,
    confidence_distribution
  };
}

/**
 * Rollback migration for a contract (restore legacy type only)
 */
export async function rollbackContractMigration(
  contractId: string
): Promise<boolean> {
  const prisma = getClient();

  try {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        contractCategoryId: null,
        contractSubtype: null,
        documentRole: null,
        classificationConf: null,
        classificationMeta: null,
        classifiedAt: null,
        pricingModels: [],
        deliveryModels: [],
        dataProfiles: [],
        riskFlags: []
      }
    });

    logger.info({ contractId }, 'Contract migration rolled back');
    return true;
  } catch (error) {
    logger.error({ error, contractId }, 'Failed to rollback contract migration');
    return false;
  }
}
