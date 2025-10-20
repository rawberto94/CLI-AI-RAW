/**
 * Enhanced Contracts API
 * GET /api/contracts/enhanced - Advanced contract listing with intelligence features
 * 
 * ✅ Uses data-orchestration with intelligence integration
 * - Real-time analytics and insights
 * - Smart filtering and recommendations
 * - Performance metrics and trends
 * - Predictive intelligence features
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  contractService, 
  intelligenceService, 
  analyticsService,
  ContractQuerySchema 
} from "@/lib/data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Enhanced query parameters
    const queryData = {
      tenantId: searchParams.get("tenantId") || "demo",
      search: searchParams.get("search") || undefined,
      status: searchParams.getAll("status").length > 0 
        ? searchParams.getAll("status") 
        : undefined,
      clientName: searchParams.getAll("clientName").length > 0 
        ? searchParams.getAll("clientName") 
        : undefined,
      supplierName: searchParams.getAll("supplierName").length > 0 
        ? searchParams.getAll("supplierName") 
        : undefined,
      category: searchParams.getAll("category").length > 0 
        ? searchParams.getAll("category") 
        : undefined,
      minValue: searchParams.get("minValue") 
        ? Number(searchParams.get("minValue")) 
        : undefined,
      maxValue: searchParams.get("maxValue") 
        ? Number(searchParams.get("maxValue")) 
        : undefined,
      startDateFrom: searchParams.get("startDateFrom") 
        ? new Date(searchParams.get("startDateFrom")!) 
        : undefined,
      startDateTo: searchParams.get("startDateTo") 
        ? new Date(searchParams.get("startDateTo")!) 
        : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
      sortBy: (searchParams.get("sortBy") as any) || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    // Enhanced features flags
    const includeIntelligence = searchParams.get("includeIntelligence") !== "false";
    const includeAnalytics = searchParams.get("includeAnalytics") !== "false";
    const includeRecommendations = searchParams.get("includeRecommendations") !== "false";

    // Validate and execute query
    const query = ContractQuerySchema.parse(queryData);

    // Parallel execution for performance
    const [
      contractsResult,
      intelligenceResult,
      analyticsResult
    ] = await Promise.all([
      contractService.queryContracts(query),
      includeIntelligence ? intelligenceService.runIntelligenceAnalysis(query.tenantId) : null,
      includeAnalytics ? analyticsService.getRealTimeMetrics(query.tenantId) : null,
    ]);

    if (!contractsResult.success) {
      return NextResponse.json({
        success: false,
        error: contractsResult.error?.message || "Failed to query contracts",
        code: contractsResult.error?.code,
      }, { status: 500 });
    }

    // Enhanced contract data with intelligence
    const enhancedContracts = await Promise.all(
      contractsResult.data.contracts.map(async (contract) => {
        const baseContract = {
          id: contract.id,
          filename: contract.fileName,
          originalName: contract.originalName || contract.fileName,
          status: contract.status,
          processingStatus: contract.status,
          uploadedAt: contract.uploadedAt,
          fileSize: Number(contract.fileSize),
          mimeType: contract.mimeType,
          contractType: contract.contractType || "UNKNOWN",
          contractTitle: contract.contractTitle,
          description: contract.description,
          category: contract.category,
          totalValue: contract.totalValue ? Number(contract.totalValue) : null,
          currency: contract.currency,
          startDate: contract.startDate,
          endDate: contract.endDate,
          clientName: contract.clientName,
          supplierName: contract.supplierName,
          viewCount: contract.viewCount,
          lastViewedAt: contract.lastViewedAt,
          createdAt: contract.createdAt,
          updatedAt: contract.updatedAt,
        };

        // Add intelligence enhancements
        if (includeIntelligence && intelligenceResult?.success) {
          const contractPatterns = intelligenceResult.data.patterns.filter(
            p => p.affectedContracts.includes(contract.id)
          );
          const contractInsights = intelligenceResult.data.insights.filter(
            i => i.metadata.relatedPatterns?.some(rp => 
              intelligenceResult.data.patterns.find(p => p.id === rp)?.affectedContracts.includes(contract.id)
            )
          );

          return {
            ...baseContract,
            intelligence: {
              patterns: contractPatterns.length,
              insights: contractInsights.length,
              riskScore: calculateRiskScore(contractPatterns),
              opportunityScore: calculateOpportunityScore(contractInsights),
              lastAnalyzed: new Date(),
              flags: generateContractFlags(contractPatterns, contractInsights),
            },
          };
        }

        return baseContract;
      })
    );

    // Generate smart recommendations
    const recommendations = includeRecommendations && intelligenceResult?.success
      ? generateSmartRecommendations(enhancedContracts, intelligenceResult.data)
      : [];

    // Calculate portfolio insights
    const portfolioInsights = includeAnalytics && analyticsResult?.success
      ? generatePortfolioInsights(enhancedContracts, analyticsResult.data)
      : null;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        contracts: enhancedContracts,
        pagination: {
          total: contractsResult.data.total,
          limit: contractsResult.data.limit,
          page: contractsResult.data.page,
          totalPages: contractsResult.data.totalPages,
          hasMore: contractsResult.data.page < contractsResult.data.totalPages,
          hasPrevious: contractsResult.data.page > 1,
        },
        
        // Enhanced features
        intelligence: includeIntelligence && intelligenceResult?.success ? {
          totalPatterns: intelligenceResult.data.patterns.length,
          totalInsights: intelligenceResult.data.insights.length,
          criticalIssues: intelligenceResult.data.patterns.filter(p => p.impact === 'critical').length,
          opportunities: intelligenceResult.data.insights.filter(i => i.potentialSavings > 0).length,
        } : null,

        analytics: portfolioInsights,

        recommendations,

        // Smart filters based on data
        smartFilters: generateSmartFilters(enhancedContracts),

        // Performance metadata
        metadata: {
          responseTime: `${responseTime}ms`,
          cached: responseTime < 100,
          dataSource: "enhanced-orchestration",
          intelligenceEnabled: includeIntelligence,
          analyticsEnabled: includeAnalytics,
          enhancementsApplied: [
            includeIntelligence && "intelligence",
            includeAnalytics && "analytics", 
            includeRecommendations && "recommendations"
          ].filter(Boolean),
        },
      },
    }, {
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Intelligence-Enabled': includeIntelligence.toString(),
        'X-Analytics-Enabled': includeAnalytics.toString(),
        'Cache-Control': 'public, max-age=60', // 1 minute cache for enhanced data
      }
    });

  } catch (error) {
    console.error("Enhanced contracts query error:", error);

    return NextResponse.json({
      success: false,
      error: "Failed to query enhanced contracts",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * Calculate risk score based on patterns
 */
function calculateRiskScore(patterns: any[]): number {
  if (patterns.length === 0) return 0;
  
  const riskPatterns = patterns.filter(p => p.type === 'risk');
  const totalSeverity = riskPatterns.reduce((sum, p) => sum + (p.severity || 5), 0);
  const avgSeverity = riskPatterns.length > 0 ? totalSeverity / riskPatterns.length : 0;
  
  return Math.min(Math.round(avgSeverity * 10), 100);
}

/**
 * Calculate opportunity score based on insights
 */
function calculateOpportunityScore(insights: any[]): number {
  if (insights.length === 0) return 0;
  
  const opportunities = insights.filter(i => 
    i.type === 'cost_optimization' && i.potentialSavings > 0
  );
  
  const totalSavings = opportunities.reduce((sum, i) => sum + (i.potentialSavings || 0), 0);
  
  // Score based on potential savings (logarithmic scale)
  return Math.min(Math.round(Math.log10(totalSavings + 1) * 20), 100);
}

/**
 * Generate contract flags for quick identification
 */
function generateContractFlags(patterns: any[], insights: any[]): string[] {
  const flags = [];
  
  // Risk flags
  const criticalPatterns = patterns.filter(p => p.impact === 'critical');
  if (criticalPatterns.length > 0) flags.push('critical-risk');
  
  const highRiskPatterns = patterns.filter(p => p.impact === 'high');
  if (highRiskPatterns.length > 0) flags.push('high-risk');
  
  // Opportunity flags
  const costOptimization = insights.filter(i => 
    i.type === 'cost_optimization' && i.potentialSavings > 10000
  );
  if (costOptimization.length > 0) flags.push('cost-opportunity');
  
  // Compliance flags
  const complianceIssues = patterns.filter(p => p.type === 'compliance');
  if (complianceIssues.length > 0) flags.push('compliance-issue');
  
  // Performance flags
  const performanceIssues = patterns.filter(p => p.type === 'performance');
  if (performanceIssues.length > 0) flags.push('performance-issue');
  
  return flags;
}

/**
 * Generate smart recommendations for the contract list
 */
function generateSmartRecommendations(contracts: any[], intelligence: any) {
  const recommendations = [];
  
  // High-value contract recommendations
  const highValueContracts = contracts.filter(c => c.totalValue > 100000);
  if (highValueContracts.length > 0) {
    recommendations.push({
      type: 'review',
      priority: 'medium',
      title: 'Review High-Value Contracts',
      description: `${highValueContracts.length} contracts over $100K may benefit from detailed review`,
      action: 'Filter by value > $100K',
      filter: { minValue: 100000 },
    });
  }
  
  // Expiring contracts
  const now = new Date();
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const expiringContracts = contracts.filter(c => 
    c.endDate && new Date(c.endDate) <= next90Days && new Date(c.endDate) > now
  );
  
  if (expiringContracts.length > 0) {
    recommendations.push({
      type: 'urgent',
      priority: 'high',
      title: 'Contracts Expiring Soon',
      description: `${expiringContracts.length} contracts expire within 90 days`,
      action: 'Review expiring contracts',
      filter: { status: ['COMPLETED'], expiringWithin: 90 },
    });
  }
  
  // Processing issues
  const failedContracts = contracts.filter(c => c.status === 'FAILED');
  if (failedContracts.length > 0) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Failed Processing',
      description: `${failedContracts.length} contracts failed processing and need attention`,
      action: 'Review failed contracts',
      filter: { status: ['FAILED'] },
    });
  }
  
  return recommendations;
}

/**
 * Generate portfolio insights from analytics
 */
function generatePortfolioInsights(contracts: any[], analytics: any) {
  const totalValue = contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;
  
  // Supplier analysis
  const supplierGroups = contracts.reduce((acc, c) => {
    if (c.supplierName) {
      if (!acc[c.supplierName]) acc[c.supplierName] = [];
      acc[c.supplierName].push(c);
    }
    return acc;
  }, {} as Record<string, any[]>);
  
  const topSuppliers = Object.entries(supplierGroups)
    .map(([name, contracts]) => ({
      name,
      contractCount: contracts.length,
      totalValue: contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
  
  return {
    portfolio: {
      totalContracts: contracts.length,
      totalValue,
      averageValue: avgValue,
      completionRate: contracts.filter(c => c.status === 'COMPLETED').length / contracts.length,
    },
    suppliers: {
      total: Object.keys(supplierGroups).length,
      top: topSuppliers,
      concentration: topSuppliers.length > 0 ? topSuppliers[0].totalValue / totalValue : 0,
    },
    trends: {
      processingEfficiency: analytics.processing.successRate,
      averageProcessingTime: analytics.processing.averageProcessingTime,
      recentActivity: analytics.trends.contractVelocity,
    },
  };
}

/**
 * Generate smart filters based on contract data
 */
function generateSmartFilters(contracts: any[]) {
  // Extract unique values for filter options
  const suppliers = [...new Set(contracts.map(c => c.supplierName).filter(Boolean))];
  const clients = [...new Set(contracts.map(c => c.clientName).filter(Boolean))];
  const categories = [...new Set(contracts.map(c => c.category).filter(Boolean))];
  const contractTypes = [...new Set(contracts.map(c => c.contractType).filter(Boolean))];
  
  // Value ranges
  const values = contracts.map(c => c.totalValue).filter(Boolean);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  
  return {
    suppliers: suppliers.slice(0, 20), // Limit for performance
    clients: clients.slice(0, 20),
    categories,
    contractTypes,
    valueRange: { min: minValue, max: maxValue },
    suggestedRanges: [
      { label: "Under $10K", max: 10000 },
      { label: "$10K - $50K", min: 10000, max: 50000 },
      { label: "$50K - $100K", min: 50000, max: 100000 },
      { label: "Over $100K", min: 100000 },
    ],
  };
}