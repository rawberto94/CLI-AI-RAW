/**
 * Contracts Statistics API
 * GET /api/contracts/stats - Get contract statistics and aggregations
 *
 * Provides:
 * - Total counts by status
 * - Total value aggregations
 * - Expiration timeline analysis
 * - Category distribution
 * - Party statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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
    recentlyUploaded: number; // Last 7 days
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const tenantId = request.headers.get("x-tenant-id") || 
                     request.nextUrl.searchParams.get("tenantId") || 
                     "demo";

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all stats in parallel for performance
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
      // Total count
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" } },
      }),

      // Status distribution
      prisma.contract.groupBy({
        by: ["status"],
        where: { tenantId, status: { not: "DELETED" } },
        _count: { id: true },
      }),

      // Expiration timeline
      Promise.all([
        // Expiring this month
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            expirationDate: { gte: now, lte: endOfMonth },
          },
        }),
        // Expiring next 30 days
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            expirationDate: { gte: now, lte: thirtyDaysFromNow },
          },
        }),
        // Expiring next 90 days
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            expirationDate: { gte: now, lte: ninetyDaysFromNow },
          },
        }),
        // Already expired
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            expirationDate: { lt: now },
          },
        }),
        // No expiration date
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            expirationDate: null,
          },
        }),
        // Recently uploaded
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            uploadedAt: { gte: sevenDaysAgo },
          },
        }),
      ]),

      // Contract types
      prisma.contract.groupBy({
        by: ["contractType"],
        where: { tenantId, status: { not: "DELETED" }, contractType: { not: null } },
        _count: { id: true },
      }),

      // Categories
      prisma.contract.groupBy({
        by: ["category"],
        where: { tenantId, status: { not: "DELETED" }, category: { not: null } },
        _count: { id: true },
      }),

      // Top clients
      prisma.contract.groupBy({
        by: ["clientName"],
        where: { tenantId, status: { not: "DELETED" }, clientName: { not: null } },
        _count: { id: true },
        _sum: { totalValue: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      // Top suppliers
      prisma.contract.groupBy({
        by: ["supplierName"],
        where: { tenantId, status: { not: "DELETED" }, supplierName: { not: null } },
        _count: { id: true },
        _sum: { totalValue: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      // Unique parties count
      Promise.all([
        prisma.contract.findMany({
          where: { tenantId, status: { not: "DELETED" }, clientName: { not: null } },
          select: { clientName: true },
          distinct: ["clientName"],
        }),
        prisma.contract.findMany({
          where: { tenantId, status: { not: "DELETED" }, supplierName: { not: null } },
          select: { supplierName: true },
          distinct: ["supplierName"],
        }),
      ]),

      // Value statistics
      prisma.contract.aggregate({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { not: null } },
        _sum: { totalValue: true },
        _avg: { totalValue: true },
        _count: { id: true },
      }),

      // Data quality stats
      Promise.all([
        prisma.contract.count({
          where: { tenantId, status: { not: "DELETED" }, clientName: { not: null } },
        }),
        prisma.contract.count({
          where: { tenantId, status: { not: "DELETED" }, supplierName: { not: null } },
        }),
        prisma.contract.count({
          where: { tenantId, status: { not: "DELETED" }, totalValue: { not: null } },
        }),
        prisma.contract.count({
          where: {
            tenantId,
            status: { not: "DELETED" },
            OR: [
              { effectiveDate: { not: null } },
              { expirationDate: { not: null } },
            ],
          },
        }),
        prisma.contract.count({
          where: { tenantId, status: { not: "DELETED" }, description: { not: null } },
        }),
      ]),
    ]);

    // Value range counts (separate queries for clarity)
    const valueRanges = await Promise.all([
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { lt: 10000 } },
      }),
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { gte: 10000, lt: 50000 } },
      }),
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { gte: 50000, lt: 100000 } },
      }),
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { gte: 100000, lt: 500000 } },
      }),
      prisma.contract.count({
        where: { tenantId, status: { not: "DELETED" }, totalValue: { gte: 500000 } },
      }),
    ]);

    // Build status counts map
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => {
      statusMap[s.status.toLowerCase()] = s._count.id;
    });

    // Build contract types map
    const typeMap: Record<string, number> = {};
    contractTypes.forEach((t) => {
      if (t.contractType) {
        typeMap[t.contractType] = t._count.id;
      }
    });

    // Build categories map
    const categoryMap: Record<string, number> = {};
    categories.forEach((c) => {
      if (c.category) {
        categoryMap[c.category] = c._count.id;
      }
    });

    // Calculate data quality completeness
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
      (completenessFactors.reduce((a, b) => a + b, 0) / completenessFactors.length) * 100
    );

    const stats: ContractStats = {
      overview: {
        total: contracts,
        byStatus: statusMap,
        processed: statusMap["completed"] || 0,
        pending: (statusMap["processing"] || 0) + (statusMap["uploaded"] || 0),
        failed: statusMap["failed"] || 0,
      },
      financial: {
        totalValue: Number(valueStats._sum.totalValue) || 0,
        averageValue: Number(valueStats._avg.totalValue) || 0,
        currency: {}, // Would need additional query for currency breakdown
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
        topClients: topClients.map((c) => ({
          name: c.clientName!,
          count: c._count.id,
          totalValue: Number(c._sum.totalValue) || 0,
        })),
        topSuppliers: topSuppliers.map((s) => ({
          name: s.supplierName!,
          count: s._count.id,
          totalValue: Number(s._sum.totalValue) || 0,
        })),
        uniqueClients: uniqueParties[0].length,
        uniqueSuppliers: uniqueParties[1].length,
      },
      dataQuality: {
        withClientName: withClient,
        withSupplierName: withSupplier,
        withValue: withValue,
        withDates: withDates,
        withDescription: withDescription,
        averageCompleteness,
      },
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: stats,
        meta: {
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          tenantId,
        },
      },
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "Cache-Control": "private, max-age=60", // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error("Error fetching contract stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch contract statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
