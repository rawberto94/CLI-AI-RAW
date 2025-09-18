import { Contract, ContractStatus, ProcessingStatus, Prisma } from '@prisma/client';
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
}