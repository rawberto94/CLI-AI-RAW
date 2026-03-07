import { Prisma, RateCard, RateCardStatus, SupplierTier } from '@prisma/client';
import { AbstractRepository, QueryOptions } from './base.repository';
import { DatabaseManager } from '../../index';

export type RateCardCreateInput = Prisma.RateCardCreateInput;
export type RateCardUpdateInput = Prisma.RateCardUpdateInput;
export type RateCardWhereInput = Prisma.RateCardWhereInput;

export interface RateCardFilters {
  supplierId?: string;
  supplierTier?: SupplierTier | SupplierTier[];
  status?: RateCardStatus | RateCardStatus[];
  effectiveDateFrom?: Date;
  effectiveDateTo?: Date;
  currency?: string;
}

export class RateCardRepository extends AbstractRepository<
  RateCard,
  RateCardCreateInput,
  RateCardUpdateInput,
  RateCardWhereInput
> {
  protected modelName = 'rateCard';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find rate cards by tenant with filters
   */
  async findByTenant(
    tenantId: string,
    filters?: RateCardFilters,
    options?: QueryOptions
  ): Promise<RateCard[]> {
    const where: RateCardWhereInput = {
      tenantId,
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      ...(filters?.supplierTier && {
        supplierTier: Array.isArray(filters.supplierTier)
          ? { in: filters.supplierTier }
          : filters.supplierTier
      }),
      ...(filters?.status && {
        status: Array.isArray(filters.status)
          ? { in: filters.status }
          : filters.status
      }),
      ...(filters?.effectiveDateFrom || filters?.effectiveDateTo ? {
        effectiveDate: {
          ...(filters.effectiveDateFrom && { gte: filters.effectiveDateFrom }),
          ...(filters.effectiveDateTo && { lte: filters.effectiveDateTo }),
        }
      } : {}),
      ...(filters?.currency && { originalCurrency: filters.currency }),
    };

    return this.findMany(where, {
      ...options,
      include: {
        roles: true,
        importJob: true,
        ...options?.include,
      },
    });
  }

  /**
   * Find rate cards by supplier
   */
  async findBySupplier(
    tenantId: string,
    supplierId: string,
    options?: QueryOptions
  ): Promise<RateCard[]> {
    return this.findMany(
      {
        tenantId,
        supplierId,
      },
      {
        ...options,
        include: {
          roles: true,
          ...options?.include,
        },
        orderBy: { effectiveDate: 'desc' },
      }
    );
  }

  /**
   * Find active rate card for supplier
   */
  async findActiveForSupplier(
    tenantId: string,
    supplierId: string,
    asOfDate?: Date
  ): Promise<RateCard | null> {
    const date = asOfDate || new Date();

    return this.findFirst(
      {
        tenantId,
        supplierId,
        status: 'APPROVED',
        effectiveDate: { lte: date },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: date } },
        ],
      },
      {
        include: { roles: true },
        orderBy: { effectiveDate: 'desc' },
      }
    );
  }

  /**
   * Update rate card status
   */
  async updateStatus(
    id: string,
    status: RateCardStatus,
    updatedBy?: string
  ): Promise<RateCard> {
    return this.update(id, {
      status,
      ...(updatedBy && { importedBy: updatedBy }),
    });
  }

  /**
   * Get rate card with roles
   */
  async findByIdWithRoles(id: string): Promise<RateCard | null> {
    return this.prisma.rateCard.findUnique({
      where: { id },
      include: {
        roles: true,
        importJob: true,
      },
    });
  }

  /**
   * Find rate cards expiring soon
   */
  async findExpiringSoon(
    tenantId: string,
    daysAhead: number = 30
  ): Promise<RateCard[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.findMany(
      {
        tenantId,
        status: 'APPROVED',
        expiryDate: {
          gte: new Date(),
          lte: futureDate,
        },
      },
      {
        include: { roles: true },
        orderBy: { expiryDate: 'asc' },
      }
    );
  }

  /**
   * Get rate card statistics
   */
  async getStatistics(tenantId: string) {
    const [total, byStatus, byTier, bySupplier] = await Promise.all([
      this.count({ tenantId }),
      this.prisma.rateCard.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.rateCard.groupBy({
        by: ['supplierTier'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.rateCard.groupBy({
        by: ['supplierId'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byTier: byTier.reduce((acc, item) => {
        acc[item.supplierTier] = item._count;
        return acc;
      }, {} as Record<string, number>),
      supplierCount: bySupplier.length,
    };
  }

  /**
   * Archive old rate cards
   */
  async archiveExpired(tenantId: string): Promise<number> {
    const result = await this.updateMany(
      {
        tenantId,
        status: 'APPROVED',
        expiryDate: { lt: new Date() },
      },
      { status: 'ARCHIVED' }
    );

    return result.count;
  }

  /**
   * Find duplicate rate cards
   */
  async findDuplicates(
    tenantId: string,
    supplierId: string,
    effectiveDate: Date
  ): Promise<RateCard[]> {
    return this.findMany({
      tenantId,
      supplierId,
      effectiveDate,
      status: { not: 'ARCHIVED' },
    });
  }
}
