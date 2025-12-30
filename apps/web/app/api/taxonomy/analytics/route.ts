/**
 * Taxonomy Analytics API
 * GET /api/taxonomy/analytics - Get category distribution and insights
 * 
 * Provides analytics for contract categorization:
 * - Category distribution
 * - Uncategorized contracts count
 * - Top categories by value
 * - Categorization trends
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";

// ============================================================================
// GET - Category Analytics
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d, all

    // Calculate date range
    let dateFrom: Date | undefined;
    const now = new Date();
    
    switch (period) {
      case "7d":
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get all contracts with their categories (excluding DELETED)
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: { not: 'DELETED' },
        ...(dateFrom && { createdAt: { gte: dateFrom } }),
      },
      select: {
        id: true,
        category: true,
        categoryL1: true,
        categoryL2: true,
        totalValue: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    // Get taxonomy categories for color/icon info
    const taxonomyCategories: Array<{
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      path: string;
    }> = await prisma.taxonomyCategory.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        path: true,
      },
    });

    const categoryMap = new Map<string, (typeof taxonomyCategories)[number]>(
      taxonomyCategories.map((c) => [c.name, c])
    );

    // Calculate distribution
    const categoryDistribution: Record<
      string,
      { count: number; value: number; color: string; icon: string }
    > = {};

    let uncategorizedCount = 0;
    let uncategorizedValue = 0;
    let totalCategorized = 0;
    let totalValue = 0;

    for (const contract of contracts) {
      const value = contract.totalValue ? Number(contract.totalValue) : 0;
      totalValue += value;

      if (contract.category) {
        totalCategorized++;
        const catInfo = categoryMap.get(contract.category);

        if (!categoryDistribution[contract.category]) {
          categoryDistribution[contract.category] = {
            count: 0,
            value: 0,
            color: catInfo?.color || "#6B7280",
            icon: catInfo?.icon || "folder",
          };
        }

        const catDist = categoryDistribution[contract.category];
        if (catDist) {
          catDist.count++;
          catDist.value += value;
        }
      } else {
        uncategorizedCount++;
        uncategorizedValue += value;
      }
    }

    // Sort by count for top categories
    const sortedCategories = Object.entries(categoryDistribution)
      .map(([name, data]) => ({
        name,
        ...data,
        percentage: Math.round((data.count / contracts.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Top categories by value
    const topByValue = [...sortedCategories]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Calculate categorization rate
    const categorizationRate =
      contracts.length > 0
        ? Math.round((totalCategorized / contracts.length) * 100)
        : 0;

    // Trend data (last 7 days of categorizations)
    const trendData: { date: string; categorized: number; uncategorized: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0] ?? '';
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const dayContracts = contracts.filter((c) => {
        const created = new Date(c.createdAt);
        return created >= date && created < nextDate;
      });

      trendData.push({
        date: dateStr,
        categorized: dayContracts.filter((c) => c.category).length,
        uncategorized: dayContracts.filter((c) => !c.category).length,
      });
    }

    // Level distribution (L1 vs L2)
    const levelDistribution = {
      l1Only: contracts.filter((c) => c.categoryL1 && !c.categoryL2).length,
      l2: contracts.filter((c) => c.categoryL2).length,
      none: uncategorizedCount,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalContracts: contracts.length,
          categorizedCount: totalCategorized,
          uncategorizedCount,
          categorizationRate,
          totalValue,
          categorizedValue: totalValue - uncategorizedValue,
          uncategorizedValue,
        },
        distribution: sortedCategories,
        topByValue,
        levelDistribution,
        trend: trendData,
        period,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "GET, OPTIONS");
}
