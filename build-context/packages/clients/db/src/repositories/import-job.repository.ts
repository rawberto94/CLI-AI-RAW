import { Prisma, ImportJob, ImportStatus, ImportSource, ImportPriority } from '@prisma/client';
import { AbstractRepository, QueryOptions } from './base.repository';
import { DatabaseManager } from '../../index';

export type ImportJobCreateInput = Prisma.ImportJobCreateInput;
export type ImportJobUpdateInput = Prisma.ImportJobUpdateInput;
export type ImportJobWhereInput = Prisma.ImportJobWhereInput;

export interface ImportJobFilters {
  tenantId?: string;
  status?: ImportStatus | ImportStatus[];
  source?: ImportSource | ImportSource[];
  priority?: ImportPriority;
  dateFrom?: Date;
  dateTo?: Date;
  supplierId?: string;
}

export class ImportJobRepository extends AbstractRepository<
  ImportJob,
  ImportJobCreateInput,
  ImportJobUpdateInput,
  ImportJobWhereInput
> {
  protected modelName = 'importJob';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find import jobs by tenant with filters
   */
  async findByTenant(
    tenantId: string,
    filters?: ImportJobFilters,
    options?: QueryOptions
  ): Promise<ImportJob[]> {
    const where: ImportJobWhereInput = {
      tenantId,
      ...(filters?.status && {
        status: Array.isArray(filters.status) 
          ? { in: filters.status } 
          : filters.status
      }),
      ...(filters?.source && {
        source: Array.isArray(filters.source)
          ? { in: filters.source }
          : filters.source
      }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.dateFrom || filters?.dateTo ? {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        }
      } : {}),
    };

    return this.findMany(where, options);
  }

  /**
   * Find pending jobs for processing
   */
  async findPendingJobs(tenantId: string, limit: number = 10): Promise<ImportJob[]> {
    return this.findMany(
      {
        tenantId,
        status: 'PENDING',
      },
      {
        take: limit,
        orderBy: { priority: 'desc', createdAt: 'asc' },
      }
    );
  }

  /**
   * Update job status
   */
  async updateStatus(
    id: string,
    status: ImportStatus,
    metadata?: {
      startedAt?: Date;
      completedAt?: Date;
      errors?: any;
      warnings?: any;
    }
  ): Promise<ImportJob> {
    return this.update(id, {
      status,
      ...(metadata?.startedAt && { startedAt: metadata.startedAt }),
      ...(metadata?.completedAt && { completedAt: metadata.completedAt }),
      ...(metadata?.errors && { errors: metadata.errors }),
      ...(metadata?.warnings && { warnings: metadata.warnings }),
    });
  }

  /**
   * Update processing results
   */
  async updateResults(
    id: string,
    results: {
      rowsProcessed: number;
      rowsSucceeded: number;
      rowsFailed: number;
      errors?: any;
      warnings?: any;
    }
  ): Promise<ImportJob> {
    return this.update(id, results);
  }

  /**
   * Update column mappings
   */
  async updateMappings(
    id: string,
    mappings: {
      columnMappings: any;
      mappingConfidence: number;
      mappingTemplateId?: string;
    }
  ): Promise<ImportJob> {
    return this.update(id, mappings);
  }

  /**
   * Mark job for review
   */
  async markForReview(id: string, reason?: string): Promise<ImportJob> {
    return this.update(id, {
      requiresReview: true,
      status: 'REQUIRES_REVIEW',
      ...(reason && { reviewNotes: reason }),
    });
  }

  /**
   * Complete review
   */
  async completeReview(
    id: string,
    reviewedBy: string,
    approved: boolean,
    notes?: string
  ): Promise<ImportJob> {
    return this.update(id, {
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes,
      status: approved ? 'COMPLETED' : 'FAILED',
    });
  }

  /**
   * Get job statistics for a tenant
   */
  async getStatistics(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: ImportJobWhereInput = {
      tenantId,
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        }
      } : {}),
    };

    const [total, byStatus, bySource] = await Promise.all([
      this.count(where),
      this.prisma.importJob.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.importJob.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      bySource: bySource.reduce((acc, item) => {
        acc[item.source] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Find jobs by supplier
   */
  async findBySupplier(
    tenantId: string,
    supplierId: string,
    options?: QueryOptions
  ): Promise<ImportJob[]> {
    // Note: This requires querying through the normalized data JSON field
    // In a production system, you might want to denormalize this for better performance
    const jobs = await this.findByTenant(tenantId, {}, options);
    return jobs.filter(job => {
      const normalizedData = job.normalizedData as any;
      return normalizedData?.supplierId === supplierId;
    });
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(tenantId: string, daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.deleteMany({
      tenantId,
      status: { in: ['COMPLETED', 'FAILED'] },
      completedAt: { lt: cutoffDate },
    });

    return result.count;
  }
}
