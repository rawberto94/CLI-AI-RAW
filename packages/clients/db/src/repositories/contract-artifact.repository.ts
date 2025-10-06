import { ContractArtifact, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type ContractArtifactCreateInput = Prisma.ContractArtifactCreateInput;
export type ContractArtifactUpdateInput = Prisma.ContractArtifactUpdateInput;
export type ContractArtifactWhereInput = Prisma.ContractArtifactWhereInput;

export class ContractArtifactRepository extends AbstractRepository<
  ContractArtifact,
  ContractArtifactCreateInput,
  ContractArtifactUpdateInput,
  ContractArtifactWhereInput
> {
  protected modelName = 'contractArtifact';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find artifacts by contract ID
   */
  async findByContractId(contractId: string): Promise<ContractArtifact[]> {
    return await this.prisma.contractArtifact.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find artifacts by type
   */
  async findByType(contractId: string, type: string): Promise<ContractArtifact[]> {
    return await this.prisma.contractArtifact.findMany({
      where: {
        contractId,
        type,
      },
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Find artifacts with low confidence
   */
  async findLowConfidence(
    contractId: string,
    threshold = 0.8
  ): Promise<ContractArtifact[]> {
    return await this.prisma.contractArtifact.findMany({
      where: {
        contractId,
        confidence: {
          lt: threshold,
        },
      },
      orderBy: { confidence: 'asc' },
    });
  }

  /**
   * Batch create artifacts
   */
  async batchCreate(
    artifacts: Omit<ContractArtifactCreateInput, 'contract'>[]
  ): Promise<number> {
    const result = await this.prisma.contractArtifact.createMany({
      data: artifacts as any,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Update artifact confidence
   */
  async updateConfidence(id: string, confidence: number): Promise<ContractArtifact> {
    return await this.prisma.contractArtifact.update({
      where: { id },
      data: {
        confidence,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get artifact statistics for a contract
   */
  async getStatistics(contractId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
    lowConfidenceCount: number;
  }> {
    const [total, byType, avgConfidence, lowConfidence] = await Promise.all([
      this.prisma.contractArtifact.count({ where: { contractId } }),
      this.prisma.contractArtifact.groupBy({
        by: ['type'],
        where: { contractId },
        _count: { type: true },
      }),
      this.prisma.contractArtifact.aggregate({
        where: { contractId },
        _avg: { confidence: true },
      }),
      this.prisma.contractArtifact.count({
        where: {
          contractId,
          confidence: { lt: 0.8 },
        },
      }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>),
      avgConfidence: avgConfidence._avg.confidence || 0,
      lowConfidenceCount: lowConfidence,
    };
  }
}
