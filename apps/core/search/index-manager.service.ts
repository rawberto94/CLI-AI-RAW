/**
 * Index Manager Service
 * Manages incremental updates to search indexes without full reindexing
 */

import { fullTextSearchService } from './full-text-search.service';
import { vectorSearchService } from './vector-search.service';
import { prisma } from 'clients-db';

export interface IndexUpdateResult {
  contractId: string;
  success: boolean;
  updatedIndexes: string[];
  error?: string;
  duration: number;
}

export interface BulkIndexResult {
  total: number;
  successful: number;
  failed: number;
  results: IndexUpdateResult[];
  totalDuration: number;
}

export class IndexManagerService {
  /**
   * Update all indexes for a contract
   */
  async updateContractIndexes(
    contractId: string,
    text: string
  ): Promise<IndexUpdateResult> {
    const startTime = Date.now();
    const updatedIndexes: string[] = [];

    try {
      // Update full-text search index
      await fullTextSearchService.updateTextVector(contractId, text);
      updatedIndexes.push('full-text');

      // Update vector embeddings
      const chunks = vectorSearchService.chunkText(text);
      await vectorSearchService.updateEmbeddings(contractId, chunks);
      updatedIndexes.push('vector');

      const duration = Date.now() - startTime;

      return {
        contractId,
        success: true,
        updatedIndexes,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        contractId,
        success: false,
        updatedIndexes,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Update only full-text index for a contract
   */
  async updateFullTextIndex(
    contractId: string,
    text: string
  ): Promise<IndexUpdateResult> {
    const startTime = Date.now();

    try {
      await fullTextSearchService.updateTextVector(contractId, text);

      const duration = Date.now() - startTime;

      return {
        contractId,
        success: true,
        updatedIndexes: ['full-text'],
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        contractId,
        success: false,
        updatedIndexes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Update only vector embeddings for a contract
   */
  async updateVectorIndex(
    contractId: string,
    text: string
  ): Promise<IndexUpdateResult> {
    const startTime = Date.now();

    try {
      const chunks = vectorSearchService.chunkText(text);
      await vectorSearchService.updateEmbeddings(contractId, chunks);

      const duration = Date.now() - startTime;

      return {
        contractId,
        success: true,
        updatedIndexes: ['vector'],
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        contractId,
        success: false,
        updatedIndexes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Bulk update indexes for multiple contracts
   */
  async bulkUpdateIndexes(
    contracts: Array<{ id: string; text: string }>,
    options?: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<BulkIndexResult> {
    const startTime = Date.now();
    const concurrency = options?.concurrency || 5;
    const results: IndexUpdateResult[] = [];

    // Process in batches
    for (let i = 0; i < contracts.length; i += concurrency) {
      const batch = contracts.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map((contract) =>
          this.updateContractIndexes(contract.id, contract.text)
        )
      );

      results.push(...batchResults);

      // Report progress
      if (options?.onProgress) {
        options.onProgress(results.length, contracts.length);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: contracts.length,
      successful,
      failed,
      results,
      totalDuration,
    };
  }

  /**
   * Rebuild indexes for contracts missing indexes
   */
  async rebuildMissingIndexes(): Promise<BulkIndexResult> {
    // Find contracts without text vectors
    const contractsWithoutFTS = await prisma.$queryRaw<Array<{ id: string; rawText: string }>>`
      SELECT id, "rawText"
      FROM "Contract"
      WHERE "textVector" IS NULL
        AND "rawText" IS NOT NULL
        AND "rawText" != ''
    `;

    // Find contracts without embeddings
    const contractsWithoutEmbeddings = await prisma.$queryRaw<
      Array<{ id: string; rawText: string }>
    >`
      SELECT c.id, c."rawText"
      FROM "Contract" c
      LEFT JOIN "ContractEmbedding" ce ON c.id = ce."contractId"
      WHERE ce.id IS NULL
        AND c."rawText" IS NOT NULL
        AND c."rawText" != ''
    `;

    // Combine and deduplicate
    const contractIds = new Set([
      ...contractsWithoutFTS.map((c) => c.id),
      ...contractsWithoutEmbeddings.map((c) => c.id),
    ]);

    const contracts = Array.from(contractIds).map((id) => {
      const contract =
        contractsWithoutFTS.find((c) => c.id === id) ||
        contractsWithoutEmbeddings.find((c) => c.id === id);
      return {
        id,
        text: contract?.rawText || '',
      };
    });

    console.log(`Rebuilding indexes for ${contracts.length} contracts`);

    return this.bulkUpdateIndexes(contracts, {
      concurrency: 3,
      onProgress: (completed, total) => {
        console.log(`Progress: ${completed}/${total} contracts indexed`);
      },
    });
  }

  /**
   * Delete all indexes for a contract
   */
  async deleteContractIndexes(contractId: string): Promise<{
    success: boolean;
    deletedIndexes: string[];
    error?: string;
  }> {
    const deletedIndexes: string[] = [];

    try {
      // Delete vector embeddings
      await vectorSearchService.deleteEmbeddings(contractId);
      deletedIndexes.push('vector');

      // Note: Full-text index is automatically removed when contract is deleted
      // due to the textVector column being part of the Contract table

      return {
        success: true,
        deletedIndexes,
      };
    } catch (error) {
      return {
        success: false,
        deletedIndexes,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<{
    totalContracts: number;
    indexedContracts: number;
    missingFullText: number;
    missingEmbeddings: number;
    avgEmbeddingsPerContract: number;
  }> {
    const [
      totalContracts,
      contractsWithFTS,
      contractsWithEmbeddings,
      embeddingStats,
    ] = await Promise.all([
      prisma.contract.count(),
      prisma.contract.count({
        where: {
          textVector: { not: null },
        },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "contractId") as count
        FROM "ContractEmbedding"
      `,
      prisma.$queryRaw<[{ avg: number }]>`
        SELECT AVG(chunk_count) as avg
        FROM (
          SELECT "contractId", COUNT(*) as chunk_count
          FROM "ContractEmbedding"
          GROUP BY "contractId"
        ) as counts
      `,
    ]);

    const contractsWithEmbeddingsCount = Number(
      contractsWithEmbeddings[0]?.count || 0
    );
    const avgEmbeddings = embeddingStats[0]?.avg || 0;

    return {
      totalContracts,
      indexedContracts: Math.min(contractsWithFTS, contractsWithEmbeddingsCount),
      missingFullText: totalContracts - contractsWithFTS,
      missingEmbeddings: totalContracts - contractsWithEmbeddingsCount,
      avgEmbeddingsPerContract: Math.round(avgEmbeddings),
    };
  }

  /**
   * Verify index integrity for a contract
   */
  async verifyContractIndexes(contractId: string): Promise<{
    hasFullTextIndex: boolean;
    hasVectorEmbeddings: boolean;
    embeddingCount: number;
    isComplete: boolean;
  }> {
    const [contract, embeddingStats] = await Promise.all([
      prisma.contract.findUnique({
        where: { id: contractId },
        select: { textVector: true },
      }),
      vectorSearchService.getEmbeddingStats(contractId),
    ]);

    const hasFullTextIndex = contract?.textVector !== null;
    const hasVectorEmbeddings = embeddingStats.hasEmbeddings;

    return {
      hasFullTextIndex,
      hasVectorEmbeddings,
      embeddingCount: embeddingStats.totalChunks,
      isComplete: hasFullTextIndex && hasVectorEmbeddings,
    };
  }

  /**
   * Schedule incremental index update
   */
  async scheduleIndexUpdate(
    contractId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    // In a production system, this would add to a job queue
    // For now, we'll execute immediately for high priority
    if (priority === 'high') {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { rawText: true },
      });

      if (contract?.rawText) {
        await this.updateContractIndexes(contractId, contract.rawText);
      }
    }

    // For normal/low priority, log for background processing
    console.log(
      `Scheduled index update for contract ${contractId} with priority ${priority}`
    );
  }

  /**
   * Get health status of search indexes
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    indexes: {
      fullText: {
        status: 'healthy' | 'degraded' | 'unhealthy'
        coverage: number
        message: string
      }
      vector: {
        status: 'healthy' | 'degraded' | 'unhealthy'
        coverage: number
        message: string
      }
    }
    overall: {
      totalContracts: number
      fullyIndexed: number
      partiallyIndexed: number
      notIndexed: number
      coveragePercentage: number
    }
    lastCheck: Date
    recommendations: string[]
  }> {
    try {
      const stats = await this.getIndexingStats()
      const lastCheck = new Date()

      // Calculate coverage percentages
      const ftsCoverage = stats.totalContracts > 0 
        ? ((stats.totalContracts - stats.missingFullText) / stats.totalContracts) * 100 
        : 100

      const vectorCoverage = stats.totalContracts > 0
        ? ((stats.totalContracts - stats.missingEmbeddings) / stats.totalContracts) * 100
        : 100

      const overallCoverage = (ftsCoverage + vectorCoverage) / 2

      // Determine full-text index health
      let ftsStatus: 'healthy' | 'degraded' | 'unhealthy'
      let ftsMessage: string

      if (ftsCoverage >= 95) {
        ftsStatus = 'healthy'
        ftsMessage = 'Full-text indexes are healthy'
      } else if (ftsCoverage >= 80) {
        ftsStatus = 'degraded'
        ftsMessage = `${stats.missingFullText} contracts missing full-text indexes`
      } else {
        ftsStatus = 'unhealthy'
        ftsMessage = `${stats.missingFullText} contracts missing full-text indexes - immediate action required`
      }

      // Determine vector index health
      let vectorStatus: 'healthy' | 'degraded' | 'unhealthy'
      let vectorMessage: string

      if (vectorCoverage >= 95) {
        vectorStatus = 'healthy'
        vectorMessage = 'Vector embeddings are healthy'
      } else if (vectorCoverage >= 80) {
        vectorStatus = 'degraded'
        vectorMessage = `${stats.missingEmbeddings} contracts missing vector embeddings`
      } else {
        vectorStatus = 'unhealthy'
        vectorMessage = `${stats.missingEmbeddings} contracts missing vector embeddings - immediate action required`
      }

      // Determine overall status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
      if (ftsStatus === 'healthy' && vectorStatus === 'healthy') {
        overallStatus = 'healthy'
      } else if (ftsStatus === 'unhealthy' || vectorStatus === 'unhealthy') {
        overallStatus = 'unhealthy'
      } else {
        overallStatus = 'degraded'
      }

      // Calculate indexing breakdown
      const fullyIndexed = stats.indexedContracts
      const partiallyIndexed = Math.max(
        stats.totalContracts - stats.missingFullText - fullyIndexed,
        stats.totalContracts - stats.missingEmbeddings - fullyIndexed
      )
      const notIndexed = stats.totalContracts - fullyIndexed - partiallyIndexed

      // Generate recommendations
      const recommendations: string[] = []

      if (stats.missingFullText > 0) {
        recommendations.push(
          `Run rebuildMissingIndexes() to index ${stats.missingFullText} contracts missing full-text search`
        )
      }

      if (stats.missingEmbeddings > 0) {
        recommendations.push(
          `Generate embeddings for ${stats.missingEmbeddings} contracts missing vector embeddings`
        )
      }

      if (overallCoverage < 90) {
        recommendations.push(
          'Consider running a full reindex to improve search quality'
        )
      }

      if (stats.avgEmbeddingsPerContract < 3) {
        recommendations.push(
          'Average embeddings per contract is low - consider adjusting chunk size'
        )
      }

      if (recommendations.length === 0) {
        recommendations.push('All indexes are healthy - no action required')
      }

      return {
        status: overallStatus,
        indexes: {
          fullText: {
            status: ftsStatus,
            coverage: Math.round(ftsCoverage * 10) / 10,
            message: ftsMessage,
          },
          vector: {
            status: vectorStatus,
            coverage: Math.round(vectorCoverage * 10) / 10,
            message: vectorMessage,
          },
        },
        overall: {
          totalContracts: stats.totalContracts,
          fullyIndexed,
          partiallyIndexed,
          notIndexed,
          coveragePercentage: Math.round(overallCoverage * 10) / 10,
        },
        lastCheck,
        recommendations,
      }
    } catch (error) {
      console.error('Health check error:', error)
      
      // Return unhealthy status on error
      return {
        status: 'unhealthy',
        indexes: {
          fullText: {
            status: 'unhealthy',
            coverage: 0,
            message: 'Unable to check full-text index health',
          },
          vector: {
            status: 'unhealthy',
            coverage: 0,
            message: 'Unable to check vector index health',
          },
        },
        overall: {
          totalContracts: 0,
          fullyIndexed: 0,
          partiallyIndexed: 0,
          notIndexed: 0,
          coveragePercentage: 0,
        },
        lastCheck: new Date(),
        recommendations: [
          'Health check failed - check database connectivity',
          error instanceof Error ? `Error: ${error.message}` : 'Unknown error occurred',
        ],
      }
    }
  }

  /**
   * Check if indexes are healthy (quick check)
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getHealthStatus()
      return health.status === 'healthy'
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const indexManagerService = new IndexManagerService();
