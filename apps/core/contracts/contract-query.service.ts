/**
 * Contract Query Service
 * Handles contract retrieval with filtering, sorting, and pagination
 */

import { ContractRepository } from 'clients-db';
import { Prisma } from '@prisma/client';

export interface ContractFilter {
  status?: string;
  contractType?: string;
  clientId?: string;
  supplierId?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  search?: string;
}

export interface ContractSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ContractQueryOptions {
  filter?: ContractFilter;
  sort?: ContractSort;
  pagination?: {
    limit: number;
    offset: number;
  };
  include?: {
    clauses?: boolean;
    artifacts?: boolean;
    embeddings?: boolean;
    client?: boolean;
    supplier?: boolean;
    versions?: boolean;
  };
}

export interface PaginatedContracts {
  contracts: any[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class ContractQueryService {
  constructor(private repository: ContractRepository) {}

  /**
   * Get contract by ID with optional relationships
   */
  async getById(id: string, options?: ContractQueryOptions) {
    return this.repository.findById(id, {
      include: options?.include,
    });
  }

  /**
   * Query contracts with filtering, sorting, and pagination
   */
  async query(options: ContractQueryOptions): Promise<PaginatedContracts> {
    const { filter, sort, pagination, include } = options;

    // Build where clause
    const where = this.buildWhereClause(filter);

    // Build order by clause
    const orderBy = sort
      ? { [sort.field]: sort.direction }
      : { uploadedAt: 'desc' as const };

    // Pagination
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;

    // Execute query
    const [contracts, total] = await Promise.all([
      this.repository.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include,
      }),
      this.repository.count({ where }),
    ]);

    return {
      contracts,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get contracts by status
   */
  async getByStatus(status: string, options?: ContractQueryOptions) {
    return this.query({
      ...options,
      filter: { ...options?.filter, status },
    });
  }

  /**
   * Get contracts by type
   */
  async getByType(contractType: string, options?: ContractQueryOptions) {
    return this.query({
      ...options,
      filter: { ...options?.filter, contractType },
    });
  }

  /**
   * Get contracts by client
   */
  async getByClient(clientId: string, options?: ContractQueryOptions) {
    return this.query({
      ...options,
      filter: { ...options?.filter, clientId },
    });
  }

  /**
   * Get contracts by supplier
   */
  async getBySupplier(supplierId: string, options?: ContractQueryOptions) {
    return this.query({
      ...options,
      filter: { ...options?.filter, supplierId },
    });
  }

  /**
   * Get contracts expiring soon
   */
  async getExpiringSoon(days: number = 30, options?: ContractQueryOptions) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.query({
      ...options,
      filter: {
        ...options?.filter,
        endDateFrom: now,
        endDateTo: futureDate,
      },
    });
  }

  /**
   * Get recently uploaded contracts
   */
  async getRecent(limit: number = 10, options?: ContractQueryOptions) {
    return this.query({
      ...options,
      pagination: { limit, offset: 0 },
      sort: { field: 'uploadedAt', direction: 'desc' },
    });
  }

  /**
   * Get contract statistics
   */
  async getStatistics() {
    const [
      total,
      byStatus,
      byType,
      avgProcessingTime,
    ] = await Promise.all([
      this.repository.count({}),
      this.repository.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.repository.groupBy({
        by: ['contractType'],
        _count: true,
      }),
      this.repository.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _avg: {
          // Would need to add processingDuration field to schema
        },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        if (item.contractType) {
          acc[item.contractType] = item._count;
        }
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Build Prisma where clause from filter
   */
  private buildWhereClause(filter?: ContractFilter): Prisma.ContractWhereInput {
    if (!filter) return {};

    const where: Prisma.ContractWhereInput = {};

    if (filter.status) {
      where.status = filter.status as any;
    }

    if (filter.contractType) {
      where.contractType = filter.contractType;
    }

    if (filter.clientId) {
      where.clientId = filter.clientId;
    }

    if (filter.supplierId) {
      where.supplierId = filter.supplierId;
    }

    if (filter.startDateFrom || filter.startDateTo) {
      where.startDate = {};
      if (filter.startDateFrom) {
        where.startDate.gte = filter.startDateFrom;
      }
      if (filter.startDateTo) {
        where.startDate.lte = filter.startDateTo;
      }
    }

    if (filter.endDateFrom || filter.endDateTo) {
      where.endDate = {};
      if (filter.endDateFrom) {
        where.endDate.gte = filter.endDateFrom;
      }
      if (filter.endDateTo) {
        where.endDate.lte = filter.endDateTo;
      }
    }

    if (filter.search) {
      where.OR = [
        { fileName: { contains: filter.search, mode: 'insensitive' } },
        { contractType: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
