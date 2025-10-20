/**
 * Intelligence Dashboard API
 * GET /api/intelligence/dashboard - Get comprehensive intelligence insights
 * 
 * ✅ Uses data-orchestration intelligence system
 * - Real-time pattern detection
 * - Portfolio-level insights
 * - Cost optimization recommendations
 * - Risk analysis and trends
 */

import { NextRequest, NextResponse } from "next/server";
import { intelligenceProcessor, contractService, eventBus } from "@/lib/data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo"; // TODO: Get from auth session
    const timeRange = searchParams.get("timeRange") || "30d"; // 7d, 30d, 90d, 1y

    // Get intelligence insights and patterns
    const [patterns, insights, portfolioStats] = await Promise.all([
      intelligenceProcessor.getPatterns(tenantId),
      intelligenceProcessor.getInsights(tenantId),
      getPortfolioStatistics(tenantId, timeRange),
    ]);

    // Calculate key metrics
    const metrics = calculateIntelligenceMetrics(patterns, insights, portfolioStats);

    // Get recent activity and trends
    const [recentActivity, trends] = await Promise.all([
      getRecentIntelligenceActivity(tenantId),
      calculateTrends(tenantId, timeRange),
    ]);

    // Prepare dashboard data
    const dashboardData = {
      overview: {
        totalContracts: portfolioStats.totalContracts,
        totalValue: portfolioStats.totalValue,
        activePatterns: patterns.length,
        pendingInsights: insights.filter(i => i.priority <= 2).length,
        potentialSavings: insights.reduce((sum, i) => sum + (i.potentialSavings || 0), 0),
        riskReduction: insights.reduce((sum, i) => sum + (i.riskReduction || 0), 0),
      },
      
      patterns: {
        total: patterns.length,
        byType: groupByType(patterns, 'type'),
        byImpact: groupByType(patterns, 'impact'),
        recent: patterns
          .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
          .slice(0, 10),
      },
      
      insights: {
        total: insights.length,
        byType: groupByType(insights, 'type'),
        byPriority: groupByPriority(insights),
        highPriority: insights
          .filter(i => i.priority <= 2)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 10),
      },
      
      trends: {
        contractVolume: trends.contractVolume,
        financialTrends: trends.financial,
        riskTrends: trends.risk,
        processingEfficiency: trends.processing,
      },
      
      recommendations: {
        immediate: insights
          .filter(i => i.priority === 1 && i.impact === 'high')
          .slice(0, 5),
        shortTerm: insights
          .filter(i => i.priority <= 2 && i.impact !== 'low')
          .slice(0, 10),
        longTerm: insights
          .filter(i => i.priority > 2)
          .slice(0, 5),
      },
      
      recentActivity,
      
      metadata: {
        lastUpdated: new Date(),
        dataFreshness: calculateDataFreshness(patterns, insights),
        responseTime: Date.now() - startTime,
        eventBusStats: eventBus.getStats(),
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    }, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Data-Source': 'intelligence-processor',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      }
    });

  } catch (error) {
    console.error("Intelligence dashboard error:", error);

    return NextResponse.json({
      success: false,
      error: "Failed to load intelligence dashboard",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * Get portfolio statistics for the dashboard
 */
async function getPortfolioStatistics(tenantId: string, timeRange: string) {
  const dateFilter = getDateFilter(timeRange);
  
  const result = await contractService.queryContracts({
    tenantId,
    page: 1,
    limit: 1000, // Get all for statistics
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  if (!result.success) {
    throw new Error("Failed to get portfolio statistics");
  }

  const contracts = result.data.contracts;
  const filteredContracts = contracts.filter(c => 
    new Date(c.createdAt) >= dateFilter
  );

  return {
    totalContracts: filteredContracts.length,
    totalValue: filteredContracts.reduce((sum, c) => sum + (c.totalValue || 0), 0),
    averageValue: filteredContracts.length > 0 
      ? filteredContracts.reduce((sum, c) => sum + (c.totalValue || 0), 0) / filteredContracts.length 
      : 0,
    byStatus: groupByField(filteredContracts, 'status'),
    bySupplier: groupByField(filteredContracts, 'supplierName'),
    byCategory: groupByField(filteredContracts, 'category'),
  };
}

/**
 * Calculate intelligence metrics
 */
function calculateIntelligenceMetrics(patterns: any[], insights: any[], portfolioStats: any) {
  return {
    intelligenceScore: calculateIntelligenceScore(patterns, insights),
    patternDensity: patterns.length / Math.max(portfolioStats.totalContracts, 1),
    insightEfficiency: insights.filter(i => i.confidence > 0.8).length / Math.max(insights.length, 1),
    actionableInsights: insights.filter(i => i.priority <= 2).length,
    potentialROI: insights.reduce((sum, i) => sum + (i.potentialSavings || 0), 0),
  };
}

/**
 * Get recent intelligence activity
 */
async function getRecentIntelligenceActivity(tenantId: string) {
  // This would typically come from an activity log or event store
  // For now, we'll return a mock structure
  return {
    events: [
      {
        type: "pattern_detected",
        title: "New supplier relationship pattern detected",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        impact: "medium",
      },
      {
        type: "insight_generated",
        title: "Cost optimization opportunity identified",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        impact: "high",
      },
      {
        type: "anomaly_detected",
        title: "Unusual contract value detected",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        impact: "low",
      },
    ],
    summary: {
      last24Hours: 5,
      lastWeek: 23,
      lastMonth: 87,
    },
  };
}

/**
 * Calculate trends over time
 */
async function calculateTrends(tenantId: string, timeRange: string) {
  // This would typically analyze historical data
  // For now, we'll return mock trend data
  return {
    contractVolume: {
      trend: "increasing",
      changePercent: 15,
      data: generateMockTrendData(timeRange),
    },
    financial: {
      averageValue: {
        trend: "stable",
        changePercent: 3,
        current: 125000,
      },
      totalValue: {
        trend: "increasing",
        changePercent: 18,
        current: 2500000,
      },
    },
    risk: {
      averageRiskScore: {
        trend: "decreasing",
        changePercent: -8,
        current: 65,
      },
      highRiskContracts: {
        trend: "decreasing",
        changePercent: -12,
        current: 8,
      },
    },
    processing: {
      averageTime: {
        trend: "decreasing",
        changePercent: -25,
        current: 45, // seconds
      },
      successRate: {
        trend: "increasing",
        changePercent: 5,
        current: 98.5,
      },
    },
  };
}

/**
 * Helper functions
 */
function getDateFilter(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function groupByType<T extends { type: string }>(items: T[], field: keyof T): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = String(item[field]);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupByPriority(insights: any[]): Record<string, number> {
  return insights.reduce((acc, insight) => {
    const priority = insight.priority <= 1 ? "high" : insight.priority <= 2 ? "medium" : "low";
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupByField<T>(items: T[], field: keyof T): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = String(item[field] || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function calculateIntelligenceScore(patterns: any[], insights: any[]): number {
  // Simple scoring algorithm - can be made more sophisticated
  const patternScore = Math.min(patterns.length * 10, 50);
  const insightScore = Math.min(insights.length * 5, 30);
  const qualityScore = insights.filter(i => i.confidence > 0.8).length * 2;
  
  return Math.min(patternScore + insightScore + qualityScore, 100);
}

function calculateDataFreshness(patterns: any[], insights: any[]): string {
  const allItems = [...patterns, ...insights];
  if (allItems.length === 0) return "no-data";
  
  const mostRecent = Math.max(
    ...allItems.map(item => 
      new Date(item.detectedAt || item.generatedAt).getTime()
    )
  );
  
  const ageMinutes = (Date.now() - mostRecent) / (1000 * 60);
  
  if (ageMinutes < 5) return "fresh";
  if (ageMinutes < 30) return "recent";
  if (ageMinutes < 120) return "moderate";
  return "stale";
}

function generateMockTrendData(timeRange: string): Array<{ date: string; value: number }> {
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 10) + 5, // Random value between 5-15
    });
  }
  
  return data;
}