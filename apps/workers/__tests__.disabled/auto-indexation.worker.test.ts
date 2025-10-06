/**
 * Unit tests for Auto-Indexation Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { 
  runAutoIndexation, 
  runBatchAutoIndexation, 
  processIndexationQueue,
  runIndexationHealthCheck 
} from '../auto-indexation.worker';

// Mock database modules
const mockDb = {
  contract: {
    findUnique: vi.fn(),
  },
  artifact: {
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

vi.mock('clients-db', () => ({
  default: mockDb
}));

// Mock enhanced search indexation service
const mockSearchIndexationService = {
  indexContract: vi.fn(),
  getIndexationStats: vi.fn(),
};

vi.mock('clients-db/src/services/enhanced-search-indexation.service', () => ({
  EnhancedSearchIndexationService: vi.fn(() => mockSearchIndexationService)
}));

// Mock database manager
vi.mock('clients-db/src/database-manager', () => ({
  DatabaseManager: vi.fn(() => ({}))
}));

describe('Auto-Indexation Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAutoIndexation', () => {
    const mockJob = {
      data: {
        contractId: 'contract-123',
        tenantId: 'tenant-456',
        priority: 3,
        triggerType: 'artifact_created' as const,
        artifactTypes: ['FINANCIAL', 'RISK']
      }
    };

    const mockContract = {
      id: 'contract-123',
      tenantId: 'tenant-456',
      name: 'Professional Services Agreement'
    };

    const mockIndexationResult = {
      contractId: 'contract-123',
      indexed: true,
      searchableFields: 25,
      processingTime: 1500,
      confidence: 0.92,
      errors: undefined
    };

    beforeEach(() => {
      mockDb.contract.findUnique.mockResolvedValue(mockContract);
      mockDb.artifact.count.mockResolvedValue(5);
      mockDb.$executeRaw.mockResolvedValue(undefined);
      mockSearchIndexationService.indexContract.mockResolvedValue(mockIndexationResult);
    });

    it('should successfully auto-index a contract', async () => {
      const result = await runAutoIndexation(mockJob);

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: true,
        searchableFields: 25,
        processingTime: expect.any(Number),
        confidence: 0.92,
        triggerType: 'artifact_created',
        errors: undefined
      });

      expect(mockDb.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-123' },
        select: { id: true, tenantId: true, name: true }
      });

      expect(mockDb.artifact.count).toHaveBeenCalledWith({
        where: { contractId: 'contract-123' }
      });

      expect(mockSearchIndexationService.indexContract).toHaveBeenCalledWith('contract-123');
    });

    it('should handle missing contract gracefully', async () => {
      mockDb.contract.findUnique.mockResolvedValue(null);

      const result = await runAutoIndexation(mockJob);

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: false,
        searchableFields: 0,
        processingTime: expect.any(Number),
        confidence: 0,
        triggerType: 'artifact_created',
        errors: ['Contract contract-123 not found']
      });

      expect(mockSearchIndexationService.indexContract).not.toHaveBeenCalled();
    });

    it('should skip indexation for contracts with no artifacts', async () => {
      mockDb.artifact.count.mockResolvedValue(0);

      const result = await runAutoIndexation(mockJob);

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: false,
        searchableFields: 0,
        processingTime: expect.any(Number),
        confidence: 0,
        triggerType: 'artifact_created',
        errors: ['No artifacts available for indexation']
      });

      expect(mockSearchIndexationService.indexContract).not.toHaveBeenCalled();
    });

    it('should handle indexation service failures', async () => {
      const indexationError = {
        contractId: 'contract-123',
        indexed: false,
        searchableFields: 0,
        processingTime: 1000,
        confidence: 0,
        errors: ['Database connection failed']
      };

      mockSearchIndexationService.indexContract.mockResolvedValue(indexationError);

      const result = await runAutoIndexation(mockJob);

      expect(result.indexed).toBe(false);
      expect(result.errors).toEqual(['Database connection failed']);
    });

    it('should update indexation queue status on completion', async () => {
      await runAutoIndexation(mockJob);

      expect(mockDb.$executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue'),
        expect.stringContaining('completed'),
        'contract-123'
      );
    });

    it('should update indexation queue status on failure', async () => {
      const failedIndexation = {
        ...mockIndexationResult,
        indexed: false,
        errors: ['Indexation failed']
      };

      mockSearchIndexationService.indexContract.mockResolvedValue(failedIndexation);

      await runAutoIndexation(mockJob);

      expect(mockDb.$executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue'),
        expect.stringContaining('failed'),
        'contract-123'
      );
    });

    it('should handle manual trigger type without queue updates', async () => {
      const manualJob = {
        data: {
          contractId: 'contract-123',
          triggerType: 'manual' as const
        }
      };

      await runAutoIndexation(manualJob);

      // Should not update queue for manual triggers
      expect(mockDb.$executeRaw).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue')
      );
    });

    it('should use contract tenant ID when not provided in job', async () => {
      const jobWithoutTenant = {
        data: {
          contractId: 'contract-123',
          triggerType: 'artifact_created' as const
        }
      };

      await runAutoIndexation(jobWithoutTenant);

      expect(mockSearchIndexationService.indexContract).toHaveBeenCalledWith('contract-123');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockDb.contract.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await runAutoIndexation(mockJob);

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: false,
        searchableFields: 0,
        processingTime: expect.any(Number),
        confidence: 0,
        triggerType: 'artifact_created',
        errors: ['Database error']
      });
    });
  });

  describe('runBatchAutoIndexation', () => {
    const mockBatchJob = {
      data: {
        contractIds: ['contract-1', 'contract-2', 'contract-3'],
        tenantId: 'tenant-456'
      }
    };

    beforeEach(() => {
      // Mock successful indexation for all contracts
      mockDb.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        tenantId: 'tenant-456',
        name: 'Contract 1'
      });
      mockDb.artifact.count.mockResolvedValue(3);
      mockDb.$executeRaw.mockResolvedValue(undefined);
      mockSearchIndexationService.indexContract.mockResolvedValue({
        contractId: 'contract-1',
        indexed: true,
        searchableFields: 15,
        processingTime: 1000,
        confidence: 0.85
      });
    });

    it('should process multiple contracts in batch', async () => {
      const results = await runBatchAutoIndexation(mockBatchJob);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.indexed)).toBe(true);
      expect(mockDb.contract.findUnique).toHaveBeenCalledTimes(3);
      expect(mockSearchIndexationService.indexContract).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch processing', async () => {
      // Mock failure for second contract
      mockDb.contract.findUnique
        .mockResolvedValueOnce({ id: 'contract-1', tenantId: 'tenant-456', name: 'Contract 1' })
        .mockRejectedValueOnce(new Error('Contract not found'))
        .mockResolvedValueOnce({ id: 'contract-3', tenantId: 'tenant-456', name: 'Contract 3' });

      const results = await runBatchAutoIndexation(mockBatchJob);

      expect(results).toHaveLength(3);
      expect(results[0].indexed).toBe(true);
      expect(results[1].indexed).toBe(false);
      expect(results[1].errors).toContain('Contract not found');
      expect(results[2].indexed).toBe(true);
    });

    it('should process contracts with concurrency limit', async () => {
      const largeBatchJob = {
        data: {
          contractIds: Array.from({ length: 12 }, (_, i) => `contract-${i + 1}`),
          tenantId: 'tenant-456'
        }
      };

      await runBatchAutoIndexation(largeBatchJob);

      // Should process all contracts despite concurrency limit
      expect(mockSearchIndexationService.indexContract).toHaveBeenCalledTimes(12);
    });
  });

  describe('processIndexationQueue', () => {
    const mockQueueJob = {
      data: {
        limit: 10,
        tenantId: 'tenant-456'
      }
    };

    const mockQueueItems = [
      {
        contract_id: 'contract-1',
        tenant_id: 'tenant-456',
        priority: 1,
        retry_count: 0,
        max_retries: 3
      },
      {
        contract_id: 'contract-2',
        tenant_id: 'tenant-456',
        priority: 2,
        retry_count: 1,
        max_retries: 3
      }
    ];

    beforeEach(() => {
      mockDb.$queryRaw.mockResolvedValue(mockQueueItems);
      mockDb.$executeRaw.mockResolvedValue(undefined);
      mockDb.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        tenantId: 'tenant-456',
        name: 'Contract 1'
      });
      mockDb.artifact.count.mockResolvedValue(2);
      mockSearchIndexationService.indexContract.mockResolvedValue({
        contractId: 'contract-1',
        indexed: true,
        searchableFields: 10,
        processingTime: 800,
        confidence: 0.88
      });
    });

    it('should process pending queue items', async () => {
      const result = await processIndexationQueue(mockQueueJob);

      expect(result).toEqual({
        processed: 2,
        successful: 2,
        failed: 0,
        processingTime: expect.any(Number)
      });

      expect(mockDb.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('SELECT contract_id, tenant_id, priority'),
        expect.stringContaining('WHERE status = \'pending\'')
      );
    });

    it('should handle empty queue gracefully', async () => {
      mockDb.$queryRaw.mockResolvedValue([]);

      const result = await processIndexationQueue(mockQueueJob);

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        processingTime: expect.any(Number)
      });
    });

    it('should handle queue processing failures with retry logic', async () => {
      mockSearchIndexationService.indexContract.mockResolvedValue({
        contractId: 'contract-1',
        indexed: false,
        searchableFields: 0,
        processingTime: 500,
        confidence: 0,
        errors: ['Processing failed']
      });

      const result = await processIndexationQueue(mockQueueJob);

      expect(result.failed).toBeGreaterThan(0);
      
      // Should update queue with retry logic
      expect(mockDb.$executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue'),
        expect.stringContaining('retry_count = retry_count + 1')
      );
    });

    it('should mark items as failed after max retries', async () => {
      const maxRetriesItem = {
        contract_id: 'contract-1',
        tenant_id: 'tenant-456',
        priority: 1,
        retry_count: 3,
        max_retries: 3
      };

      mockDb.$queryRaw.mockResolvedValue([maxRetriesItem]);
      mockSearchIndexationService.indexContract.mockResolvedValue({
        contractId: 'contract-1',
        indexed: false,
        searchableFields: 0,
        processingTime: 500,
        confidence: 0,
        errors: ['Max retries exceeded']
      });

      await processIndexationQueue(mockQueueJob);

      expect(mockDb.$executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue'),
        expect.stringContaining('status = \'failed\''),
        expect.stringContaining('Max retries exceeded')
      );
    });

    it('should mark items as processing before indexation', async () => {
      await processIndexationQueue(mockQueueJob);

      expect(mockDb.$executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_indexation_queue'),
        expect.stringContaining('status = \'processing\'')
      );
    });

    it('should handle queue processing without tenant filter', async () => {
      const globalQueueJob = {
        data: {
          limit: 10
        }
      };

      await processIndexationQueue(globalQueueJob);

      expect(mockDb.$queryRaw).toHaveBeenCalledWith(
        expect.not.stringContaining('AND tenant_id =')
      );
    });
  });

  describe('runIndexationHealthCheck', () => {
    const mockHealthCheckJob = {
      data: {
        tenantId: 'tenant-456'
      }
    };

    const mockIndexationStats = {
      totalIndexed: 150,
      averageConfidence: 0.85,
      lastIndexed: new Date('2024-01-15T10:30:00Z'),
      indexedByType: {
        'Professional Services': 75,
        'Service Level Agreement': 45,
        'Non-Disclosure Agreement': 30
      }
    };

    const mockQueueStats = [{
      pending_count: '25',
      failed_count: '5',
      stuck_count: '0'
    }];

    const mockContractStats = [{
      total_contracts: '180'
    }];

    beforeEach(() => {
      mockSearchIndexationService.getIndexationStats.mockResolvedValue(mockIndexationStats);
      mockDb.$queryRaw
        .mockResolvedValueOnce(mockQueueStats)
        .mockResolvedValueOnce(mockContractStats);
    });

    it('should return healthy status when all metrics are good', async () => {
      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(true);
      expect(result.stats).toEqual({
        totalContracts: 180,
        indexedContracts: 150,
        indexationPercentage: 83.33,
        pendingQueue: 25,
        failedQueue: 5,
        averageConfidence: 85
      });
      expect(result.issues).toHaveLength(0);
    });

    it('should detect low indexation coverage issues', async () => {
      const lowCoverageStats = {
        ...mockIndexationStats,
        totalIndexed: 100 // 100/180 = 55.6% < 80%
      };

      mockSearchIndexationService.getIndexationStats.mockResolvedValue(lowCoverageStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Low indexation coverage')
      );
    });

    it('should detect low confidence score issues', async () => {
      const lowConfidenceStats = {
        ...mockIndexationStats,
        averageConfidence: 0.65 // < 0.7
      };

      mockSearchIndexationService.getIndexationStats.mockResolvedValue(lowConfidenceStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Low average confidence score')
      );
    });

    it('should detect high pending queue issues', async () => {
      const highPendingStats = [{
        pending_count: '150', // > 100
        failed_count: '5',
        stuck_count: '0'
      }];

      mockDb.$queryRaw
        .mockResolvedValueOnce(highPendingStats)
        .mockResolvedValueOnce(mockContractStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('High pending queue')
      );
    });

    it('should detect high failure rate issues', async () => {
      const highFailureStats = [{
        pending_count: '25',
        failed_count: '75', // > 50
        stuck_count: '0'
      }];

      mockDb.$queryRaw
        .mockResolvedValueOnce(highFailureStats)
        .mockResolvedValueOnce(mockContractStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('High failure rate')
      );
    });

    it('should detect stuck processing jobs', async () => {
      const stuckJobsStats = [{
        pending_count: '25',
        failed_count: '5',
        stuck_count: '3' // > 0
      }];

      mockDb.$queryRaw
        .mockResolvedValueOnce(stuckJobsStats)
        .mockResolvedValueOnce(mockContractStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Stuck processing jobs')
      );
    });

    it('should handle health check errors gracefully', async () => {
      mockSearchIndexationService.getIndexationStats.mockRejectedValue(new Error('Stats error'));

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.healthy).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Health check failed')
      );
      expect(result.stats.totalContracts).toBe(0);
    });

    it('should work without tenant filter', async () => {
      const globalHealthCheckJob = {
        data: {}
      };

      await runIndexationHealthCheck(globalHealthCheckJob);

      expect(mockSearchIndexationService.getIndexationStats).toHaveBeenCalledWith('all');
      expect(mockDb.$queryRaw).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE tenant_id =')
      );
    });

    it('should calculate indexation percentage correctly', async () => {
      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.stats.indexationPercentage).toBe(83.33); // 150/180 * 100
    });

    it('should handle zero contracts gracefully', async () => {
      const zeroContractStats = [{
        total_contracts: '0'
      }];

      mockDb.$queryRaw
        .mockResolvedValueOnce(mockQueueStats)
        .mockResolvedValueOnce(zeroContractStats);

      const result = await runIndexationHealthCheck(mockHealthCheckJob);

      expect(result.stats.indexationPercentage).toBe(0);
      expect(result.healthy).toBe(true); // No issues if no contracts
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      mockDb.contract.findUnique.mockRejectedValue(new Error('Connection failed'));

      const result = await runAutoIndexation({
        data: { contractId: 'contract-123' }
      });

      expect(result.indexed).toBe(false);
      expect(result.errors).toContain('Connection failed');
    });

    it('should handle indexation service unavailability', async () => {
      mockDb.contract.findUnique.mockResolvedValue({
        id: 'contract-123',
        tenantId: 'tenant-456',
        name: 'Test Contract'
      });
      mockDb.artifact.count.mockResolvedValue(3);
      mockSearchIndexationService.indexContract.mockRejectedValue(new Error('Service unavailable'));

      const result = await runAutoIndexation({
        data: { contractId: 'contract-123' }
      });

      expect(result.indexed).toBe(false);
      expect(result.errors).toContain('Service unavailable');
    });

    it('should handle queue update failures gracefully', async () => {
      mockDb.contract.findUnique.mockResolvedValue({
        id: 'contract-123',
        tenantId: 'tenant-456',
        name: 'Test Contract'
      });
      mockDb.artifact.count.mockResolvedValue(3);
      mockSearchIndexationService.indexContract.mockResolvedValue({
        contractId: 'contract-123',
        indexed: true,
        searchableFields: 10,
        processingTime: 1000,
        confidence: 0.8
      });
      mockDb.$executeRaw.mockRejectedValue(new Error('Queue update failed'));

      // Should still return success even if queue update fails
      const result = await runAutoIndexation({
        data: { 
          contractId: 'contract-123',
          triggerType: 'artifact_created' as const
        }
      });

      expect(result.indexed).toBe(true);
    });
  });
});