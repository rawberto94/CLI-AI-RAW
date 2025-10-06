import { 
  Contract, 
  ContractStatus, 
  ProcessingStatus, 
  Prisma,
  ContractArtifact,
  ContractEmbedding,
  Clause,
  ProcessingJob,
  JobStatus,
  Party,
  PartyType,
  ContractVersion
} from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type ContractCreateInput = Prisma.ContractCreateInput;
export type ContractUpdateInput = Prisma.ContractUpdateInput;
export type ContractWhereInput = Prisma.ContractWhereInput;

export interface ContractWithRelations extends Contract {
  artifacts?: any[];
  runs?: any[];
  embeddings?: any[];
  templateAnalysis?: any[];
  financialAnalysis?: any[];
  overviewAnalysis?: any[];
  contractArtifacts?: ContractArtifact[];
  contractEmbeddings?: ContractEmbedding[];
  clauses?: Clause[];
  processingJobs?: ProcessingJob[];
  client?: Party | null;
  supplier?: Party | null;
  versions?: ContractVersion[];
}

export interface ContractWithOptimizedRelations extends Contract {
  contractArtifacts?: ContractArtifact[];
  contractEmbeddings?: ContractEmbedding[];
  clauses?: Clause[];
  processingJobs?: ProcessingJob[];
  client?: Party | null;
  supplier?: Party | null;
  versions?: ContractVersion[];
}

export interface ContractSearchFilters {
  tenantId: string;
  status?: ContractStatus[];
  contractType?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  search?: string;
}

export class ContractRepository extends AbstractRepository<
  Contract,
  ContractCreateInput,
  ContractUpdateInput,
  ContractWhereInput
> {
  protected modelName = 'contract';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  async findByTenant(
    tenantId: string,
    options?: {
      status?: ContractStatus[];
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'updatedAt' | 'filename';
      order?: 'asc' | 'desc';
    }
  ): Promise<Contract[]> {
    const where: Prisma.ContractWhereInput = { tenantId };
    
    if (options?.status) {
      where.status = { in: options.status };
    }

    return await this.prisma.contract.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: options?.orderBy ? { [options.orderBy]: options?.order || 'desc' } : { createdAt: 'desc' },
    });
  }

  async findWithArtifacts(id: string): Promise<ContractWithRelations | null> {
    return await this.prisma.contract.findUnique({
      where: { id },
      include: {
        artifacts: {
          orderBy: { createdAt: 'desc' },
        },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
        templateAnalysis: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        financialAnalysis: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        overviewAnalysis: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async updateStatus(id: string, status: ContractStatus): Promise<Contract> {
    return await this.prisma.contract.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date(),
      },
    });
  }

  async updateProcessingStatus(id: string, processingStatus: ProcessingStatus): Promise<Contract> {
    return await this.prisma.contract.update({
      where: { id },
      data: { 
        processingStatus,
        updatedAt: new Date(),
      },
    });
  }

  async searchContracts(filters: ContractSearchFilters): Promise<Contract[]> {
    const where: Prisma.ContractWhereInput = {
      tenantId: filters.tenantId,
    };

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.contractType && filters.contractType.length > 0) {
      where.contractType = { in: filters.contractType };
    }

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.from,
        lte: filters.dateRange.to,
      };
    }

    if (filters.search) {
      where.OR = [
        { filename: { contains: filters.search, mode: 'insensitive' } },
        { originalName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return await this.prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContractsByStatus(tenantId: string): Promise<Record<ContractStatus, number>> {
    const statusCounts = await this.prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { status: true },
    });

    const result: Record<string, number> = {};
    statusCounts.forEach(item => {
      result[item.status] = item._count.status;
    });

    return result as Record<ContractStatus, number>;
  }

  async getRecentContracts(tenantId: string, limit = 10): Promise<Contract[]> {
    return await this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getContractsRequiringProcessing(limit = 50): Promise<Contract[]> {
    return await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.UPLOADED,
        processingStatus: ProcessingStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string): Promise<Contract> {
    return await this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractStatus.COMPLETED,
        processingStatus: ProcessingStatus.COMPLETED,
        processedAt: new Date(),
        lastAnalyzedAt: new Date(),
      },
    });
  }

  async getContractMetrics(tenantId: string, dateRange?: { from: Date; to: Date }) {
    const where: Prisma.ContractWhereInput = { tenantId };
    
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const [total, byStatus, byType, avgProcessingTime] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.contract.groupBy({
        by: ['contractType'],
        where: { ...where, contractType: { not: null } },
        _count: { contractType: true },
      }),
      this.prisma.contract.aggregate({
        where: {
          ...where,
          processedAt: { not: null },
          createdAt: { not: undefined },
        },
        _avg: {
          // This would need a computed field for processing time
          // For now, we'll calculate it differently
        },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        if (item.contractType) {
          acc[item.contractType] = item._count.contractType;
        }
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async findExpiring(tenantId: string, daysAhead = 30): Promise<Contract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.prisma.contract.findMany({
      where: {
        tenantId,
        expirationDate: {
          lte: futureDate,
          gte: new Date(),
        },
        status: { not: ContractStatus.ARCHIVED },
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  // ============================================================================
  // CONTRACT REPOSITORY OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Find contract with all optimized relations (artifacts, embeddings, clauses, etc.)
   */
  async findByIdWithOptimizedRelations(id: string): Promise<ContractWithOptimizedRelations | null> {
    return await this.prisma.contract.findUnique({
      where: { id },
      include: {
        contractArtifacts: {
          orderBy: { createdAt: 'desc' },
        },
        contractEmbeddings: {
          orderBy: { chunkIndex: 'asc' },
        },
        clauses: {
          orderBy: { position: 'asc' },
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        client: true,
        supplier: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  }

  /**
   * Create contract with transaction support
   */
  async createWithTransaction(
    data: ContractCreateInput,
    options?: {
      createProcessingJob?: boolean;
      initialArtifacts?: Omit<Prisma.ContractArtifactCreateInput, 'contract'>[];
    }
  ): Promise<Contract> {
    return await this.prisma.$transaction(async (tx) => {
      // Create contract
      const contract = await tx.contract.create({ data });

      // Create initial processing job if requested
      if (options?.createProcessingJob) {
        await tx.processingJob.create({
          data: {
            contractId: contract.id,
            status: JobStatus.PENDING,
            progress: 0,
          },
        });
      }

      // Create initial artifacts if provided
      if (options?.initialArtifacts && options.initialArtifacts.length > 0) {
        await tx.contractArtifact.createMany({
          data: options.initialArtifacts.map(artifact => ({
            ...artifact,
            contractId: contract.id,
          })),
        });
      }

      return contract;
    });
  }

  /**
   * Update contract with raw text and trigger full-text indexing
   */
  async updateRawText(id: string, rawText: string): Promise<Contract> {
    return await this.prisma.contract.update({
      where: { id },
      data: {
        rawText,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Full-text search using PostgreSQL tsvector
   */
  async fullTextSearch(
    query: string,
    options?: {
      tenantId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Contract[]> {
    const whereClause = options?.tenantId ? `AND "tenantId" = '${options.tenantId}'` : '';
    
    const results = await this.prisma.$queryRawUnsafe<Contract[]>(`
      SELECT *
      FROM "Contract"
      WHERE "textVector" @@ plainto_tsquery('english', $1)
      ${whereClause}
      ORDER BY ts_rank("textVector", plainto_tsquery('english', $1)) DESC
      LIMIT ${options?.limit || 10}
      OFFSET ${options?.offset || 0}
    `, query);

    return results;
  }

  /**
   * Vector similarity search using pgvector
   */
  async vectorSearch(
    embedding: number[],
    options?: {
      tenantId?: string;
      limit?: number;
      threshold?: number;
    }
  ): Promise<Array<Contract & { similarity: number }>> {
    const whereClause = options?.tenantId ? `AND c."tenantId" = '${options.tenantId}'` : '';
    const threshold = options?.threshold || 0.7;
    
    const results = await this.prisma.$queryRawUnsafe<Array<Contract & { similarity: number }>>(`
      SELECT DISTINCT ON (c.id) c.*, 
             1 - (ce.embedding <=> $1::vector) as similarity
      FROM "Contract" c
      INNER JOIN "ContractEmbedding" ce ON ce."contractId" = c.id
      WHERE 1 - (ce.embedding <=> $1::vector) > $2
      ${whereClause}
      ORDER BY c.id, similarity DESC
      LIMIT ${options?.limit || 10}
    `, `[${embedding.join(',')}]`, threshold);

    return results;
  }

  /**
   * Hybrid search combining full-text and vector search
   */
  async hybridSearch(
    query: string,
    embedding?: number[],
    options?: {
      tenantId?: string;
      limit?: number;
    }
  ): Promise<Array<Contract & { relevance_score: number; snippet: string }>> {
    if (!embedding) {
      // Fall back to full-text search only
      const results = await this.fullTextSearch(query, options);
      return results.map(r => ({ ...r, relevance_score: 1.0, snippet: '' }));
    }

    const results = await this.prisma.$queryRawUnsafe<Array<Contract & { relevance_score: number; snippet: string }>>(`
      SELECT * FROM search_contracts($1, $2::vector, $3)
    `, query, `[${embedding.join(',')}]`, options?.limit || 10);

    return results;
  }

  /**
   * Find contracts with specific artifacts
   */
  async findByArtifactType(
    type: string,
    options?: {
      tenantId?: string;
      minConfidence?: number;
    }
  ): Promise<Contract[]> {
    return await this.prisma.contract.findMany({
      where: {
        tenantId: options?.tenantId,
        contractArtifacts: {
          some: {
            type,
            confidence: {
              gte: options?.minConfidence || 0,
            },
          },
        },
      },
      include: {
        contractArtifacts: {
          where: { type },
        },
      },
    });
  }

  /**
   * Find contracts by clause category
   */
  async findByClauseCategory(
    category: string,
    options?: {
      tenantId?: string;
      riskLevel?: string;
    }
  ): Promise<Contract[]> {
    return await this.prisma.contract.findMany({
      where: {
        tenantId: options?.tenantId,
        clauses: {
          some: {
            category,
            riskLevel: options?.riskLevel,
          },
        },
      },
      include: {
        clauses: {
          where: {
            category,
            riskLevel: options?.riskLevel,
          },
        },
      },
    });
  }

  /**
   * Get contracts with failed processing jobs
   */
  async findWithFailedProcessing(tenantId?: string): Promise<Contract[]> {
    return await this.prisma.contract.findMany({
      where: {
        tenantId,
        processingJobs: {
          some: {
            status: JobStatus.FAILED,
          },
        },
      },
      include: {
        processingJobs: {
          where: {
            status: JobStatus.FAILED,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Delete contract with all related data (transaction)
   */
  async deleteWithRelations(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete in order due to foreign key constraints
      await tx.contractVersion.deleteMany({ where: { contractId: id } });
      await tx.processingJob.deleteMany({ where: { contractId: id } });
      await tx.clause.deleteMany({ where: { contractId: id } });
      await tx.contractEmbedding.deleteMany({ where: { contractId: id } });
      await tx.contractArtifact.deleteMany({ where: { contractId: id } });
      
      // Delete legacy relations
      await tx.embedding.deleteMany({ where: { contractId: id } });
      await tx.artifact.deleteMany({ where: { contractId: id } });
      await tx.run.deleteMany({ where: { contractId: id } });
      await tx.templateAnalysis.deleteMany({ where: { contractId: id } });
      await tx.financialAnalysis.deleteMany({ where: { contractId: id } });
      await tx.overviewAnalysis.deleteMany({ where: { contractId: id } });
      
      // Finally delete the contract
      await tx.contract.delete({ where: { id } });
    });
  }

  /**
   * Batch create contracts with transaction support
   */
  async batchCreate(
    contracts: ContractCreateInput[],
    options?: {
      createProcessingJobs?: boolean;
    }
  ): Promise<Contract[]> {
    return await this.prisma.$transaction(async (tx) => {
      const created: Contract[] = [];

      for (const contractData of contracts) {
        const contract = await tx.contract.create({ data: contractData });
        created.push(contract);

        if (options?.createProcessingJobs) {
          await tx.processingJob.create({
            data: {
              contractId: contract.id,
              status: JobStatus.PENDING,
              progress: 0,
            },
          });
        }
      }

      return created;
    });
  }

  /**
   * Update contract metadata with transaction
   */
  async updateMetadata(
    id: string,
    metadata: {
      contractType?: string;
      clientId?: string;
      supplierId?: string;
      totalValue?: number;
      currency?: string;
      startDate?: Date;
      endDate?: Date;
      jurisdiction?: string;
    }
  ): Promise<Contract> {
    return await this.prisma.contract.update({
      where: { id },
      data: {
        ...metadata,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate data quality score for a contract
   */
  async calculateQualityScore(id: string): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ quality_score: number }>>(`
      SELECT calculate_contract_quality($1) as quality_score
    `, id);

    return result[0]?.quality_score || 0;
  }

  /**
   * Find contracts requiring review (low quality or failed processing)
   */
  async findRequiringReview(tenantId?: string): Promise<Contract[]> {
    const contracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          {
            processingJobs: {
              some: {
                status: JobStatus.FAILED,
              },
            },
          },
          {
            contractArtifacts: {
              some: {
                confidence: {
                  lt: 0.8,
                },
              },
            },
          },
        ],
      },
      include: {
        processingJobs: {
          where: {
            status: JobStatus.FAILED,
          },
          take: 1,
        },
        contractArtifacts: {
          where: {
            confidence: {
              lt: 0.8,
            },
          },
        },
      },
    });

    return contracts;
  }

  /**
   * Get contract versions
   */
  async getVersions(contractId: string): Promise<ContractVersion[]> {
    return await this.prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Create new version of contract
   */
  async createVersion(
    contractId: string,
    data: {
      changes?: any;
      uploadedBy?: string;
    }
  ): Promise<ContractVersion> {
    return await this.prisma.$transaction(async (tx) => {
      // Get the latest version number
      const latestVersion = await tx.contractVersion.findFirst({
        where: { contractId },
        orderBy: { versionNumber: 'desc' },
      });

      const versionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Mark previous versions as inactive
      await tx.contractVersion.updateMany({
        where: {
          contractId,
          isActive: true,
        },
        data: {
          isActive: false,
          supersededAt: new Date(),
        },
      });

      // Create new version
      return await tx.contractVersion.create({
        data: {
          contractId,
          versionNumber,
          changes: data.changes,
          uploadedBy: data.uploadedBy,
          isActive: true,
        },
      });
    });
  }
}