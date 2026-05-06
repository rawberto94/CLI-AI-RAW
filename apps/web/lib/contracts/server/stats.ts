import {
  createErrorResponse,
  createSuccessResponse,
  type ContractApiContext,
} from '@/lib/api-middleware';
import { CacheTTL, createTimer, makeCacheKey } from '@/lib/api-performance';
import { getCached, setCached } from '@/lib/cache';
import { prisma } from '@/lib/prisma';

interface ContractStats {
  overview: {
    total: number;
    byStatus: Record<string, number>;
    processed: number;
    pending: number;
    failed: number;
  };
  financial: {
    totalValue: number;
    averageValue: number;
    currency: Record<string, { count: number; total: number }>;
    valueRanges: {
      under10k: number;
      from10kTo50k: number;
      from50kTo100k: number;
      from100kTo500k: number;
      over500k: number;
    };
  };
  timeline: {
    expiringThisMonth: number;
    expiringNext30Days: number;
    expiringNext90Days: number;
    expired: number;
    noExpirationDate: number;
    recentlyUploaded: number;
  };
  categories: {
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  };
  parties: {
    topClients: Array<{ name: string; count: number; totalValue: number }>;
    topSuppliers: Array<{ name: string; count: number; totalValue: number }>;
    uniqueClients: number;
    uniqueSuppliers: number;
  };
  dataQuality: {
    withClientName: number;
    withSupplierName: number;
    withValue: number;
    withDates: number;
    withDescription: number;
    averageCompleteness: number;
  };
}

export async function getContractStats(context: ContractApiContext) {
  const timer = createTimer();
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const cacheKey = makeCacheKey('contracts:stats', tenantId);
  const cached = await getCached<ContractStats>(cacheKey);

  if (cached) {
    return createSuccessResponse(context, cached, {
      cached: true,
      headers: {
        'X-Response-Time': timer.format(),
        'X-Cache': 'HIT',
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    });
  }

  const stats = await fetchContractStats(tenantId);
  setCached(cacheKey, stats, { ttl: CacheTTL.short }).catch(() => undefined);

  return createSuccessResponse(context, stats, {
    cached: false,
    headers: {
      'X-Response-Time': timer.format(),
      'X-Cache': 'MISS',
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  });
}

async function fetchContractStats(tenantId: string): Promise<ContractStats> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    contracts,
    statusCounts,
    expirationStats,
    contractTypes,
    categories,
    topClients,
    topSuppliers,
    uniqueParties,
    valueStats,
    dataQualityStats,
  ] = await Promise.all([
    prisma.contract.count({
      where: { tenantId, isDeleted: false },
    }),
    prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId, isDeleted: false },
      _count: { id: true },
    }),
    Promise.all([
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          expirationDate: { gte: now, lte: endOfMonth },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          expirationDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          expirationDate: { gte: now, lte: ninetyDaysFromNow },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          expirationDate: { lt: now },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          expirationDate: null,
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          uploadedAt: { gte: sevenDaysAgo },
        },
      }),
    ]),
    prisma.contract.groupBy({
      by: ['contractType'],
      where: { tenantId, isDeleted: false, contractType: { not: null } },
      _count: { id: true },
    }),
    prisma.contract.groupBy({
      by: ['category'],
      where: { tenantId, isDeleted: false, category: { not: null } },
      _count: { id: true },
    }),
    prisma.contract.groupBy({
      by: ['clientName'],
      where: { tenantId, isDeleted: false, clientName: { not: null } },
      _count: { id: true },
      _sum: { totalValue: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.contract.groupBy({
      by: ['supplierName'],
      where: { tenantId, isDeleted: false, supplierName: { not: null } },
      _count: { id: true },
      _sum: { totalValue: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    Promise.all([
      prisma.contract.findMany({
        where: { tenantId, isDeleted: false, clientName: { not: null } },
        select: { clientName: true },
        distinct: ['clientName'],
      }),
      prisma.contract.findMany({
        where: { tenantId, isDeleted: false, supplierName: { not: null } },
        select: { supplierName: true },
        distinct: ['supplierName'],
      }),
    ]),
    prisma.contract.aggregate({
      where: { tenantId, isDeleted: false, totalValue: { not: null } },
      _sum: { totalValue: true },
      _avg: { totalValue: true },
      _count: { id: true },
    }),
    Promise.all([
      prisma.contract.count({
        where: { tenantId, isDeleted: false, clientName: { not: null } },
      }),
      prisma.contract.count({
        where: { tenantId, isDeleted: false, supplierName: { not: null } },
      }),
      prisma.contract.count({
        where: { tenantId, isDeleted: false, totalValue: { not: null } },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          isDeleted: false,
          OR: [{ effectiveDate: { not: null } }, { expirationDate: { not: null } }],
        },
      }),
      prisma.contract.count({
        where: { tenantId, isDeleted: false, description: { not: null } },
      }),
    ]),
  ]);

  const valueRanges = await Promise.all([
    prisma.contract.count({ where: { tenantId, isDeleted: false, totalValue: { lt: 10000 } } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, totalValue: { gte: 10000, lt: 50000 } } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, totalValue: { gte: 50000, lt: 100000 } } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, totalValue: { gte: 100000, lt: 500000 } } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, totalValue: { gte: 500000 } } }),
  ]);

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((statusCount) => {
    statusMap[String(statusCount.status).toLowerCase()] = statusCount._count.id;
  });

  const typeMap: Record<string, number> = {};
  contractTypes.forEach((contractType) => {
    if (contractType.contractType) {
      typeMap[contractType.contractType] = contractType._count.id;
    }
  });

  const categoryMap: Record<string, number> = {};
  categories.forEach((category) => {
    if (category.category) {
      categoryMap[category.category] = category._count.id;
    }
  });

  const [withClient, withSupplier, withValue, withDates, withDescription] = dataQualityStats;
  const totalContracts = contracts || 1;
  const completenessFactors = [
    withClient / totalContracts,
    withSupplier / totalContracts,
    withValue / totalContracts,
    withDates / totalContracts,
    withDescription / totalContracts,
  ];
  const averageCompleteness = Math.round(
    (completenessFactors.reduce((accumulator, factor) => accumulator + factor, 0) /
      completenessFactors.length) * 100,
  );

  return {
    overview: {
      total: contracts,
      byStatus: statusMap,
      processed: statusMap.completed || 0,
      pending: (statusMap.processing || 0) + (statusMap.uploaded || 0),
      failed: statusMap.failed || 0,
    },
    financial: {
      totalValue: Number(valueStats._sum.totalValue) || 0,
      averageValue: Number(valueStats._avg.totalValue) || 0,
      currency: {},
      valueRanges: {
        under10k: valueRanges[0],
        from10kTo50k: valueRanges[1],
        from50kTo100k: valueRanges[2],
        from100kTo500k: valueRanges[3],
        over500k: valueRanges[4],
      },
    },
    timeline: {
      expiringThisMonth: expirationStats[0],
      expiringNext30Days: expirationStats[1],
      expiringNext90Days: expirationStats[2],
      expired: expirationStats[3],
      noExpirationDate: expirationStats[4],
      recentlyUploaded: expirationStats[5],
    },
    categories: {
      byType: typeMap,
      byCategory: categoryMap,
    },
    parties: {
      topClients: topClients.map((client) => ({
        name: client.clientName!,
        count: client._count.id,
        totalValue: Number(client._sum.totalValue) || 0,
      })),
      topSuppliers: topSuppliers.map((supplier) => ({
        name: supplier.supplierName!,
        count: supplier._count.id,
        totalValue: Number(supplier._sum.totalValue) || 0,
      })),
      uniqueClients: uniqueParties[0].length,
      uniqueSuppliers: uniqueParties[1].length,
    },
    dataQuality: {
      withClientName: withClient,
      withSupplierName: withSupplier,
      withValue,
      withDates,
      withDescription,
      averageCompleteness,
    },
  };
}