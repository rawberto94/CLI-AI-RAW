/**
 * Enhanced Contract Search Utilities
 * Provides comprehensive search capabilities across contracts
 */

import { prisma } from "./prisma";
import type { Contract, Prisma } from "@prisma/client";

export interface SearchFilters {
  tenantId: string;
  query?: string; // Full-text search query
  status?: string[];
  contractType?: string[];
  clientName?: string[];
  supplierName?: string[];
  category?: string[];
  minValue?: number;
  maxValue?: number;
  currency?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  uploadedBy?: string;
  uploadedFrom?: Date;
  uploadedTo?: Date;
  hasExpiration?: boolean;
  expiringWithinDays?: number;
  sortBy?:
    | "createdAt"
    | "uploadedAt"
    | "totalValue"
    | "expirationDate"
    | "contractTitle";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface SearchResult {
  contracts: Contract[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: {
    status: Record<string, number>;
    contractType: Record<string, number>;
    category: Record<string, number>;
    currency: Record<string, number>;
  };
}

/**
 * Build Prisma where clause from search filters
 */
function buildWhereClause(filters: SearchFilters): Prisma.ContractWhereInput {
  const where: Prisma.ContractWhereInput = {
    tenantId: filters.tenantId,
  };

  // Full-text search
  if (filters.query) {
    const searchTerms = filters.query
      .trim()
      .split(/\s+/)
      .map((term) => `${term}:*`)
      .join(" & ");

    where.OR = [
      {
        contractTitle: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
      {
        fileName: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
      {
        clientName: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
      {
        supplierName: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
      {
        category: {
          contains: filters.query,
          mode: "insensitive",
        },
      },
    ];
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status as any };
  }

  // Contract type filter
  if (filters.contractType && filters.contractType.length > 0) {
    where.contractType = { in: filters.contractType };
  }

  // Client name filter
  if (filters.clientName && filters.clientName.length > 0) {
    where.clientName = { in: filters.clientName };
  }

  // Supplier name filter
  if (filters.supplierName && filters.supplierName.length > 0) {
    where.supplierName = { in: filters.supplierName };
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    where.category = { in: filters.category };
  }

  // Value range filter
  if (filters.minValue !== undefined || filters.maxValue !== undefined) {
    where.totalValue = {};
    if (filters.minValue !== undefined) {
      where.totalValue.gte = filters.minValue;
    }
    if (filters.maxValue !== undefined) {
      where.totalValue.lte = filters.maxValue;
    }
  }

  // Currency filter
  if (filters.currency) {
    where.currency = filters.currency;
  }

  // Start date range
  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {};
    if (filters.startDateFrom) {
      where.startDate.gte = filters.startDateFrom;
    }
    if (filters.startDateTo) {
      where.startDate.lte = filters.startDateTo;
    }
  }

  // End date range
  if (filters.endDateFrom || filters.endDateTo) {
    where.endDate = {};
    if (filters.endDateFrom) {
      where.endDate.gte = filters.endDateFrom;
    }
    if (filters.endDateTo) {
      where.endDate.lte = filters.endDateTo;
    }
  }

  // Uploaded by filter
  if (filters.uploadedBy) {
    where.uploadedBy = filters.uploadedBy;
  }

  // Upload date range
  if (filters.uploadedFrom || filters.uploadedTo) {
    where.uploadedAt = {};
    if (filters.uploadedFrom) {
      where.uploadedAt.gte = filters.uploadedFrom;
    }
    if (filters.uploadedTo) {
      where.uploadedAt.lte = filters.uploadedTo;
    }
  }

  // Has expiration filter
  if (filters.hasExpiration !== undefined) {
    if (filters.hasExpiration) {
      where.expirationDate = { not: null };
    } else {
      where.expirationDate = null;
    }
  }

  // Expiring within days filter
  if (filters.expiringWithinDays !== undefined) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
    where.expirationDate = {
      gte: new Date(),
      lte: futureDate,
    };
  }

  return where;
}

/**
 * Search contracts with advanced filtering
 */
export async function searchContracts(
  filters: SearchFilters
): Promise<SearchResult> {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;
  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";

  const where = buildWhereClause(filters);

  // Get total count
  const total = await prisma.contract.count({ where });

  // Get contracts
  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: limit,
  });

  // Get facets for filtering
  const [statusFacets, typeFacets, categoryFacets, currencyFacets] =
    await Promise.all([
      prisma.contract.groupBy({
        by: ["status"],
        where: { tenantId: filters.tenantId },
        _count: true,
      }),
      prisma.contract.groupBy({
        by: ["contractType"],
        where: { tenantId: filters.tenantId, contractType: { not: null } },
        _count: true,
      }),
      prisma.contract.groupBy({
        by: ["category"],
        where: { tenantId: filters.tenantId, category: { not: null } },
        _count: true,
      }),
      prisma.contract.groupBy({
        by: ["currency"],
        where: { tenantId: filters.tenantId, currency: { not: null } },
        _count: true,
      }),
    ]);

  return {
    contracts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    facets: {
      status: Object.fromEntries(statusFacets.map((f) => [f.status, f._count])),
      contractType: Object.fromEntries(
        typeFacets.map((f) => [f.contractType || "unknown", f._count])
      ),
      category: Object.fromEntries(
        categoryFacets.map((f) => [f.category || "unknown", f._count])
      ),
      currency: Object.fromEntries(
        currencyFacets.map((f) => [f.currency || "unknown", f._count])
      ),
    },
  };
}

/**
 * Quick search by text (fast lookup)
 */
export async function quickSearch(tenantId: string, query: string, limit = 10) {
  return prisma.contract.findMany({
    where: {
      tenantId,
      OR: [
        { contractTitle: { contains: query, mode: "insensitive" } },
        { fileName: { contains: query, mode: "insensitive" } },
        { clientName: { contains: query, mode: "insensitive" } },
        { supplierName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      clientName: true,
      supplierName: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Find contracts expiring soon
 */
export async function findExpiringContracts(tenantId: string, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return prisma.contract.findMany({
    where: {
      tenantId,
      expirationDate: {
        gte: new Date(),
        lte: futureDate,
      },
      status: "COMPLETED",
    },
    orderBy: { expirationDate: "asc" },
  });
}

/**
 * Get contracts by client
 */
export async function getContractsByClient(
  tenantId: string,
  clientName: string
) {
  return prisma.contract.findMany({
    where: {
      tenantId,
      clientName,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get contracts by supplier
 */
export async function getContractsBySupplier(
  tenantId: string,
  supplierName: string
) {
  return prisma.contract.findMany({
    where: {
      tenantId,
      supplierName,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get high-value contracts
 */
export async function getHighValueContracts(
  tenantId: string,
  minValue: number
) {
  return prisma.contract.findMany({
    where: {
      tenantId,
      totalValue: { gte: minValue },
      status: "COMPLETED",
    },
    orderBy: { totalValue: "desc" },
  });
}

/**
 * Get contract statistics
 */
export async function getContractStats(tenantId: string) {
  const [
    totalContracts,
    completedContracts,
    processingContracts,
    failedContracts,
    totalValue,
    avgValue,
    expiringCount,
  ] = await Promise.all([
    prisma.contract.count({ where: { tenantId } }),
    prisma.contract.count({ where: { tenantId, status: "COMPLETED" } }),
    prisma.contract.count({ where: { tenantId, status: "PROCESSING" } }),
    prisma.contract.count({ where: { tenantId, status: "FAILED" } }),
    prisma.contract.aggregate({
      where: { tenantId, totalValue: { not: null } },
      _sum: { totalValue: true },
    }),
    prisma.contract.aggregate({
      where: { tenantId, totalValue: { not: null } },
      _avg: { totalValue: true },
    }),
    prisma.contract.count({
      where: {
        tenantId,
        expirationDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    totalContracts,
    completedContracts,
    processingContracts,
    failedContracts,
    totalValue: totalValue._sum.totalValue || 0,
    avgValue: avgValue._avg.totalValue || 0,
    expiringIn30Days: expiringCount,
  };
}
