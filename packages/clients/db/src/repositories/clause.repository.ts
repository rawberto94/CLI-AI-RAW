import { Clause, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type ClauseCreateInput = Prisma.ClauseCreateInput;
export type ClauseUpdateInput = Prisma.ClauseUpdateInput;
export type ClauseWhereInput = Prisma.ClauseWhereInput;

export class ClauseRepository extends AbstractRepository<
  Clause,
  ClauseCreateInput,
  ClauseUpdateInput,
  ClauseWhereInput
> {
  protected modelName = 'clause';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find clauses by contract ID
   */
  async findByContractId(contractId: string): Promise<Clause[]> {
    return await this.prisma.clause.findMany({
      where: { contractId },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Find clauses by category
   */
  async findByCategory(
    contractId: string,
    category: string
  ): Promise<Clause[]> {
    return await this.prisma.clause.findMany({
      where: {
        contractId,
        category,
      },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Find clauses by risk level
   */
  async findByRiskLevel(
    contractId: string,
    riskLevel: string
  ): Promise<Clause[]> {
    return await this.prisma.clause.findMany({
      where: {
        contractId,
        riskLevel,
      },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Search clauses by text
   */
  async searchByText(
    query: string,
    options?: {
      contractId?: string;
      category?: string;
      limit?: number;
    }
  ): Promise<Clause[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`to_tsvector('english', "text") @@ plainto_tsquery('english', ${query})`,
    ];

    if (options?.contractId) {
      conditions.push(Prisma.sql`"contractId" = ${options.contractId}`);
    }
    if (options?.category) {
      conditions.push(Prisma.sql`"category" = ${options.category}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const limit = options?.limit || 10;

    const results = await this.prisma.$queryRaw<Clause[]>`
      SELECT *
      FROM "Clause"
      WHERE ${whereClause}
      ORDER BY ts_rank(to_tsvector('english', "text"), plainto_tsquery('english', ${query})) DESC
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Batch create clauses
   */
  async batchCreate(
    clauses: Omit<ClauseCreateInput, 'contract'>[]
  ): Promise<number> {
    const result = await this.prisma.clause.createMany({
      data: clauses as any,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Get clause statistics for a contract
   */
  async getStatistics(contractId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byRiskLevel: Record<string, number>;
  }> {
    const [total, byCategory, byRiskLevel] = await Promise.all([
      this.prisma.clause.count({ where: { contractId } }),
      this.prisma.clause.groupBy({
        by: ['category'],
        where: { contractId },
        _count: { category: true },
      }),
      this.prisma.clause.groupBy({
        by: ['riskLevel'],
        where: { contractId, riskLevel: { not: null } },
        _count: { riskLevel: true },
      }),
    ]);

    return {
      total,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count.category;
        return acc;
      }, {} as Record<string, number>),
      byRiskLevel: byRiskLevel.reduce((acc, item) => {
        if (item.riskLevel) {
          acc[item.riskLevel] = item._count.riskLevel;
        }
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Find similar clauses across contracts
   */
  async findSimilar(
    text: string,
    options?: {
      category?: string;
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<Array<Clause & { similarity: number }>> {
    const minSimilarity = options?.minSimilarity || 0.5;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`similarity("text", ${text}) > ${minSimilarity}`,
    ];

    if (options?.category) {
      conditions.push(Prisma.sql`"category" = ${options.category}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const limit = options?.limit || 10;

    const results = await this.prisma.$queryRaw<Array<Clause & { similarity: number }>>`
      SELECT *,
             similarity("text", ${text}) as similarity
      FROM "Clause"
      WHERE ${whereClause}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Link clause to library clause
   */
  async linkToLibrary(
    id: string,
    libraryClauseId: string,
    similarity: number
  ): Promise<Clause> {
    return await this.prisma.clause.update({
      where: { id },
      data: {
        libraryClauseId,
        similarity,
        updatedAt: new Date(),
      },
    });
  }
}
