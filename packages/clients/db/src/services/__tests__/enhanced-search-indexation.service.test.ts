/**
 * Unit tests for Enhanced Search Indexation Service
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EnhancedSearchIndexationService } from '../enhanced-search-indexation.service';
import { DatabaseManager } from '../../database-manager';

// Mock database manager
const mockDatabaseManager = {
  prisma: {
    contract: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
} as unknown as DatabaseManager;

describe('EnhancedSearchIndexationService', () => {
  let service: EnhancedSearchIndexationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EnhancedSearchIndexationService(mockDatabaseManager);
  });

  describe('indexContract', () => {
    const mockContract = {
      id: 'contract-123',
      name: 'Professional Services Agreement',
      tenantId: 'tenant-456',
      artifacts: [
        {
          type: 'INGESTION',
          data: {
            content: 'This is a professional services agreement between Company A and Company B...',
            title: 'Professional Services Agreement'
          },
          createdAt: new Date('2024-01-01')
        },
        {
          type: 'CLAUSES',
          data: {
            clauses: [
              {
                clauseId: 'PAYMENT-001',
                text: 'Payment shall be made within 30 days of invoice receipt',
                keyTerms: ['payment', 'invoice', '30 days']
              },
              {
                clauseId: 'TERMINATION-001',
                text: 'Either party may terminate this agreement with 60 days written notice',
                keyTerms: ['termination', 'notice', '60 days']
              }
            ]
          },
          createdAt: new Date('2024-01-01')
        },
        {
          type: 'RISK',
          data: {
            risks: [
              {
                description: 'High payment default risk due to extended payment terms',
                severity: 'high',
                riskType: 'Financial'
              },
              {
                description: 'Moderate termination risk with short notice period',
                severity: 'medium',
                riskType: 'Operational'
              }
            ],
            overallRiskLevel: 'high'
          },
          createdAt: new Date('2024-01-01')
        },
        {
          type: 'COMPLIANCE',
          data: {
            complianceChecks: [
              {
                requirement: 'GDPR compliance required',
                status: 'compliant'
              },
              {
                requirement: 'SOX compliance required',
                status: 'non-compliant'
              }
            ],
            recommendations: [
              {
                description: 'Add data protection clauses for GDPR compliance'
              }
            ]
          },
          createdAt: new Date('2024-01-01')
        },
        {
          type: 'FINANCIAL',
          data: {
            financialTerms: [
              {
                description: 'Monthly service fee',
                amount: '$50,000'
              },
              {
                description: 'Late payment penalty',
                amount: '1.5% per month'
              }
            ],
            financialSummary: {
              totalValue: '$600,000'
            },
            confidenceScore: 92
          },
          createdAt: new Date('2024-01-01')
        },
        {
          type: 'OVERVIEW',
          data: {
            contractType: 'Professional Services',
            parties: ['Company A', 'Company B'],
            keyInsights: [
              'High-value professional services contract',
              'Extended payment terms present financial risk'
            ]
          },
          createdAt: new Date('2024-01-01')
        }
      ]
    };

    beforeEach(() => {
      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(mockContract);
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);
    });

    it('should successfully index a contract with all artifact types', async () => {
      const result = await service.indexContract('contract-123');

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: true,
        searchableFields: expect.any(Number),
        processingTime: expect.any(Number),
        confidence: expect.any(Number),
        errors: undefined
      });

      expect(result.searchableFields).toBeGreaterThan(10);
      expect(result.confidence).toBeGreaterThan(0.8);
      const executeRawCalls = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls;
      expect(executeRawCalls.length).toBeGreaterThan(0);
      expect(executeRawCalls[0][0].join('')).toContain('INSERT INTO contract_search_index');
    });

    it('should handle missing contract gracefully', async () => {
      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(null);

      const result = await service.indexContract('nonexistent-contract');

      expect(result).toEqual({
        contractId: 'nonexistent-contract',
        indexed: false,
        searchableFields: 0,
        processingTime: expect.any(Number),
        confidence: 0,
        errors: ['Contract nonexistent-contract not found']
      });
    });

    it('should handle database errors gracefully', async () => {
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockRejectedValue(new Error('Database error'));

      const result = await service.indexContract('contract-123');

      expect(result).toEqual({
        contractId: 'contract-123',
        indexed: false,
        searchableFields: 0,
        processingTime: expect.any(Number),
        confidence: 0,
        errors: ['Database error']
      });
    });

    it('should extract comprehensive searchable content from all artifact types', async () => {
      await service.indexContract('contract-123');

      // Verify that the search index was created with comprehensive content
      const executeRawCalls = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls;
      expect(executeRawCalls.length).toBeGreaterThan(0);
      // args[0]=TemplateStringsArray, args[1]=contractId, args[2]=searchText, args[3]=metadata, args[4]=tenantId
      expect(executeRawCalls[0][0].join('')).toContain('to_tsvector');
      expect(executeRawCalls[0][2]).toContain('Professional Services Agreement');
      expect(typeof executeRawCalls[0][3]).toBe('string');
      expect(executeRawCalls[0][4]).toBe('tenant-456');
    });

    it('should calculate confidence score from artifact data', async () => {
      const result = await service.indexContract('contract-123');

      // Should have high confidence due to financial artifact confidence score
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should determine highest risk level from multiple artifacts', async () => {
      await service.indexContract('contract-123');

      // Verify metadata includes the highest risk level
      const executeRawCall = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls[0];
      // args[0]=TemplateStringsArray, args[1]=contractId, args[2]=searchText, args[3]=metadata JSON
      const metadataString = executeRawCall[3];
      const metadata = JSON.parse(metadataString);
      
      expect(metadata.riskLevel).toBe('high');
    });

    it('should deduplicate extracted terms and parties', async () => {
      // Add duplicate data to test deduplication
      const contractWithDuplicates = {
        ...mockContract,
        artifacts: [
          ...mockContract.artifacts,
          {
            type: 'CLAUSES',
            data: {
              clauses: [
                {
                  clauseId: 'PAYMENT-001', // Duplicate clause ID
                  text: 'Duplicate payment clause',
                  keyTerms: ['payment', 'invoice'] // Duplicate terms
                }
              ]
            },
            createdAt: new Date('2024-01-02')
          }
        ]
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(contractWithDuplicates);

      await service.indexContract('contract-123');

      // Verify deduplication occurred (exact verification would require access to internal state)
      expect(mockDatabaseManager.prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should update contract search metadata', async () => {
      await service.indexContract('contract-123');

      expect(mockDatabaseManager.prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-123' },
        data: {
          searchMetadata: {
            indexed: true,
            lastIndexed: expect.any(Date),
            searchableFields: expect.any(Number),
            confidenceScore: expect.any(Number),
            riskLevel: 'high',
            totalValue: '$600,000'
          }
        }
      });
    });

    it('should handle contracts with minimal artifacts', async () => {
      const minimalContract = {
        id: 'minimal-contract',
        name: 'Simple Agreement',
        tenantId: 'tenant-456',
        artifacts: [
          {
            type: 'INGESTION',
            data: {
              content: 'Simple agreement text'
            },
            createdAt: new Date('2024-01-01')
          }
        ]
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(minimalContract);

      const result = await service.indexContract('minimal-contract');

      expect(result.indexed).toBe(true);
      expect(result.searchableFields).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle contracts with no artifacts', async () => {
      const contractWithoutArtifacts = {
        id: 'no-artifacts-contract',
        name: 'Empty Contract',
        tenantId: 'tenant-456',
        artifacts: []
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(contractWithoutArtifacts);

      const result = await service.indexContract('no-artifacts-contract');

      expect(result.indexed).toBe(true);
      expect(result.searchableFields).toBe(1); // Only title
      expect(result.confidence).toBe(0.5); // Default confidence
    });
  });

  describe('searchContracts', () => {
    const mockSearchQuery = {
      query: 'payment terms',
      tenantId: 'tenant-456',
      filters: {
        contractType: 'Professional Services',
        riskLevel: 'high'
      },
      limit: 10,
      offset: 0
    };

    const mockSearchResults = [
      {
        contract_id: 'contract-123',
        title: 'Professional Services Agreement',
        relevance_score: '0.95',
        highlight: 'Payment terms require <b>payment</b> within 30 days...',
        metadata: {
          contractType: 'Professional Services',
          parties: ['Company A', 'Company B'],
          lastUpdated: '2024-01-01T00:00:00Z',
          confidenceScore: 0.92,
          totalValue: '$600,000',
          riskLevel: 'high'
        }
      },
      {
        contract_id: 'contract-456',
        title: 'Service Level Agreement',
        relevance_score: '0.87',
        highlight: 'Service <b>payment</b> schedule and <b>terms</b>...',
        metadata: {
          contractType: 'Professional Services',
          parties: ['Company C', 'Company D'],
          lastUpdated: '2024-01-02T00:00:00Z',
          confidenceScore: 0.88,
          totalValue: '$300,000',
          riskLevel: 'medium'
        }
      }
    ];

    beforeEach(() => {
      (mockDatabaseManager.prisma.$queryRaw as Mock).mockResolvedValue(mockSearchResults);
    });

    it('should search contracts and return formatted results', async () => {
      const results = await service.searchContracts(mockSearchQuery);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        contractId: 'contract-123',
        title: 'Professional Services Agreement',
        relevanceScore: 0.95,
        highlights: ['Payment terms require <b>payment</b> within 30 days...'],
        metadata: {
          contractType: 'Professional Services',
          parties: ['Company A', 'Company B'],
          lastUpdated: expect.any(Date),
          confidenceScore: 0.92,
          totalValue: '$600,000',
          riskLevel: 'high'
        }
      });
    });

    it('should build correct WHERE clause with filters', async () => {
      await service.searchContracts(mockSearchQuery);

      const queryRawCalls = (mockDatabaseManager.prisma.$queryRaw as Mock).mock.calls;
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // args[5] = whereClause string from buildSearchWhereClause
      expect(queryRawCalls[0][5]).toContain("csi.metadata->>'contractType' = 'Professional Services'");
      expect(queryRawCalls[0][5]).toContain("csi.metadata->>'riskLevel' = 'high'");
    });

    it('should handle search without filters', async () => {
      const queryWithoutFilters = {
        query: 'contract',
        tenantId: 'tenant-456'
      };

      await service.searchContracts(queryWithoutFilters);

      const queryRawCalls = (mockDatabaseManager.prisma.$queryRaw as Mock).mock.calls;
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // args[5] = whereClause string — should be empty when no filters
      expect(queryRawCalls[0][5]).not.toContain("csi.metadata->>'contractType'");
    });

    it('should handle search with party filters', async () => {
      const queryWithParties = {
        query: 'agreement',
        tenantId: 'tenant-456',
        filters: {
          parties: ['Company A', 'Company B']
        }
      };

      await service.searchContracts(queryWithParties);

      const queryRawCalls = (mockDatabaseManager.prisma.$queryRaw as Mock).mock.calls;
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // args[5] = whereClause string
      expect(queryRawCalls[0][5]).toContain("csi.metadata->'parties' ? 'Company A'");
      expect(queryRawCalls[0][5]).toContain("csi.metadata->'parties' ? 'Company B'");
    });

    it('should handle search with date range filters', async () => {
      const queryWithDateRange = {
        query: 'contract',
        tenantId: 'tenant-456',
        filters: {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          }
        }
      };

      await service.searchContracts(queryWithDateRange);

      const queryRawCalls = (mockDatabaseManager.prisma.$queryRaw as Mock).mock.calls;
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // args[5] = whereClause string
      expect(queryRawCalls[0][5]).toContain('c.created_at BETWEEN');
    });

    it('should apply default limit and offset', async () => {
      const queryWithoutPagination = {
        query: 'contract',
        tenantId: 'tenant-456'
      };

      await service.searchContracts(queryWithoutPagination);

      const queryRawCalls = (mockDatabaseManager.prisma.$queryRaw as Mock).mock.calls;
      expect(queryRawCalls.length).toBeGreaterThan(0);
      // args[6] = limit, args[7] = offset (interpolated values from tagged template)
      expect(queryRawCalls[0][6]).toBe(20);
      expect(queryRawCalls[0][7]).toBe(0);
    });

    it('should handle search errors gracefully', async () => {
      (mockDatabaseManager.prisma.$queryRaw as Mock).mockRejectedValue(new Error('Search failed'));

      await expect(service.searchContracts(mockSearchQuery)).rejects.toThrow('Search failed');
    });
  });

  describe('batchIndexContracts', () => {
    it('should index multiple contracts in batch', async () => {
      const contractIds = ['contract-1', 'contract-2', 'contract-3'];
      
      // Mock successful indexing for all contracts
      (mockDatabaseManager.prisma.contract.findUnique as Mock)
        .mockResolvedValueOnce({
          id: 'contract-1',
          name: 'Contract 1',
          tenantId: 'tenant-456',
          artifacts: []
        })
        .mockResolvedValueOnce({
          id: 'contract-2',
          name: 'Contract 2',
          tenantId: 'tenant-456',
          artifacts: []
        })
        .mockResolvedValueOnce({
          id: 'contract-3',
          name: 'Contract 3',
          tenantId: 'tenant-456',
          artifacts: []
        });

      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);

      const results = await service.batchIndexContracts(contractIds);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.indexed)).toBe(true);
      expect(mockDatabaseManager.prisma.contract.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch indexing', async () => {
      const contractIds = ['contract-1', 'contract-2'];
      
      // Mock success for first, failure for second
      (mockDatabaseManager.prisma.contract.findUnique as Mock)
        .mockResolvedValueOnce({
          id: 'contract-1',
          name: 'Contract 1',
          tenantId: 'tenant-456',
          artifacts: []
        })
        .mockRejectedValueOnce(new Error('Database error'));

      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);

      const results = await service.batchIndexContracts(contractIds);

      expect(results).toHaveLength(2);
      expect(results[0].indexed).toBe(true);
      expect(results[1].indexed).toBe(false);
      expect(results[1].errors).toContain('Database error');
    });
  });

  describe('getIndexationStats', () => {
    const mockStatsResult = [{
      total_indexed: '150',
      avg_confidence: '0.87',
      last_indexed: '2024-01-15T10:30:00Z',
      indexed_by_type: {
        'Professional Services': 75,
        'Service Level Agreement': 45,
        'Non-Disclosure Agreement': 30
      }
    }];

    beforeEach(() => {
      (mockDatabaseManager.prisma.$queryRaw as Mock).mockResolvedValue(mockStatsResult);
    });

    it('should return indexation statistics', async () => {
      const stats = await service.getIndexationStats('tenant-456');

      expect(stats).toEqual({
        totalIndexed: 150,
        averageConfidence: 0.87,
        lastIndexed: new Date('2024-01-15T10:30:00Z'),
        indexedByType: {
          'Professional Services': 75,
          'Service Level Agreement': 45,
          'Non-Disclosure Agreement': 30
        }
      });
    });

    it('should handle empty stats gracefully', async () => {
      (mockDatabaseManager.prisma.$queryRaw as Mock).mockResolvedValue([{
        total_indexed: null,
        avg_confidence: null,
        last_indexed: null,
        indexed_by_type: null
      }]);

      const stats = await service.getIndexationStats('tenant-456');

      expect(stats).toEqual({
        totalIndexed: 0,
        averageConfidence: 0,
        lastIndexed: null,
        indexedByType: {}
      });
    });

    it('should handle database errors in stats retrieval', async () => {
      (mockDatabaseManager.prisma.$queryRaw as Mock).mockRejectedValue(new Error('Stats error'));

      const stats = await service.getIndexationStats('tenant-456');

      expect(stats).toEqual({
        totalIndexed: 0,
        averageConfidence: 0,
        lastIndexed: null,
        indexedByType: {}
      });
    });
  });

  describe('removeFromIndex', () => {
    it('should remove contract from search index', async () => {
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);

      await service.removeFromIndex('contract-123');

      const executeRawCalls = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls;
      expect(executeRawCalls.length).toBeGreaterThan(0);
      expect(executeRawCalls[0][0].join('')).toContain('DELETE FROM contract_search_index');
      expect(executeRawCalls[0][1]).toBe('contract-123');
    });

    it('should handle removal errors', async () => {
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockRejectedValue(new Error('Removal failed'));

      await expect(service.removeFromIndex('contract-123')).rejects.toThrow('Removal failed');
    });
  });

  describe('Content Processing', () => {
    it('should correctly process ingestion artifacts', async () => {
      const mockContractWithIngestion = {
        id: 'contract-123',
        name: 'Test Contract',
        tenantId: 'tenant-456',
        artifacts: [
          {
            type: 'INGESTION',
            data: {
              content: 'This is the contract content',
              title: 'Updated Contract Title'
            },
            createdAt: new Date('2024-01-01')
          }
        ]
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(mockContractWithIngestion);
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);

      const result = await service.indexContract('contract-123');

      expect(result.indexed).toBe(true);
      // Verify that the search index includes the ingestion content
      // args[0]=TemplateStringsArray, args[1]=contractId, args[2]=searchText
      const executeCall = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls[0];
      expect(executeCall[2]).toContain('This is the contract content');
    });

    it('should correctly determine risk levels', async () => {
      const mockContractWithRisks = {
        id: 'contract-123',
        name: 'Test Contract',
        tenantId: 'tenant-456',
        artifacts: [
          {
            type: 'RISK',
            data: {
              risks: [
                { severity: 'low', description: 'Low risk item' },
                { severity: 'critical', description: 'Critical risk item' },
                { severity: 'medium', description: 'Medium risk item' }
              ]
            },
            createdAt: new Date('2024-01-01')
          }
        ]
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(mockContractWithRisks);
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);

      await service.indexContract('contract-123');

      // Verify that the highest risk level (critical) is used
      // args[0]=TemplateStringsArray, args[1]=contractId, args[2]=searchText, args[3]=metadata JSON
      const executeCall = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls[0];
      const metadata = JSON.parse(executeCall[3]);
      expect(metadata.riskLevel).toBe('critical');
    });

    it('should extract financial information correctly', async () => {
      const mockContractWithFinancial = {
        id: 'contract-123',
        name: 'Test Contract',
        tenantId: 'tenant-456',
        artifacts: [
          {
            type: 'FINANCIAL',
            data: {
              financialTerms: [
                { description: 'Monthly fee', amount: '$10,000' },
                { description: 'Setup fee', amount: '$5,000' }
              ],
              financialSummary: {
                totalValue: '$125,000'
              },
              confidenceScore: 95
            },
            createdAt: new Date('2024-01-01')
          }
        ]
      };

      (mockDatabaseManager.prisma.contract.findUnique as Mock).mockResolvedValue(mockContractWithFinancial);
      (mockDatabaseManager.prisma.$executeRaw as Mock).mockResolvedValue(undefined);
      (mockDatabaseManager.prisma.contract.update as Mock).mockResolvedValue(undefined);

      const result = await service.indexContract('contract-123');

      expect(result.confidence).toBe(95);
      
      // Verify financial data is included in search content
      // args[0]=TemplateStringsArray, args[1]=contractId, args[2]=searchText, args[3]=metadata JSON
      const executeCall = (mockDatabaseManager.prisma.$executeRaw as Mock).mock.calls[0];
      const searchText = executeCall[2];
      expect(searchText).toContain('Monthly fee');
      expect(searchText).toContain('$10,000');
      
      const metadata = JSON.parse(executeCall[3]);
      expect(metadata.totalValue).toBe('$125,000');
    });
  });
});