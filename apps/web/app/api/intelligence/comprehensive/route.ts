/**
 * Comprehensive Intelligence API
 * GET /api/intelligence/comprehensive - Complete intelligence analysis and recommendations
 * 
 * ✅ Uses advanced data-orchestration services
 * - Real-time pattern detection with ML algorithms
 * - Portfolio analytics with trend analysis
 * - Actionable insights with priority scoring
 * - Workflow orchestration for complex operations
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  intelligenceService, 
  analyticsService, 
  workflowService,
  contractService 
} from "data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo";
    const includeRecommendations = searchParams.get("includeRecommendations") !== "false";
    const includeWorkflows = searchParams.get("includeWorkflows") !== "false";

    // Run comprehensive intelligence analysis
    const [
      intelligenceResult,
      analyticsResult,
      metricsResult,
      workflowsResult,
      contractsResult
    ] = await Promise.all([
      intelligenceService.runIntelligenceAnalysis(tenantId),
      analyticsService.getDashboard(tenantId),
      analyticsService.getRealTimeMetrics(tenantId),
      includeWorkflows ? workflowService.getTenantWorkflows(tenantId) : Promise.resolve({ success: true, data: [] }),
      contractService.queryContracts({ 
        tenantId, 
        page: 1, 
        limit: 5, 
        sortBy: "createdAt", 
        sortOrder: "desc" 
      })
    ]);

    // Check for any failures
    const results = [intelligenceResult, analyticsResult, metricsResult, workflowsResult, contractsResult];
    const failures = results.filter(r => !r.success);
    
    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Some intelligence services failed",
        details: failures.map(f => f.error),
      }, { status: 500 });
    }

    // Extract successful data
    const intelligence = intelligenceResult.data!;
    const dashboard = analyticsResult.data!;
    const metrics = metricsResult.data!;
    const workflows = workflowsResult.data!;
    const contracts = contractsResult.data!;

    // Generate executive summary
    const executiveSummary = generateExecutiveSummary(intelligence, metrics, dashboard);

    // Generate recommendations
    const recommendations = includeRecommendations 
      ? generateRecommendations(intelligence, metrics, dashboard)
      : [];

    // Calculate intelligence score
    const intelligenceScore = calculateIntelligenceScore(intelligence, metrics);

    // Prepare comprehensive response
    const comprehensiveIntelligence = {
      summary: executiveSummary,
      intelligenceScore,
      
      // Core Intelligence Data
      patterns: {
        total: intelligence.patterns.length,
        byType: groupByField(intelligence.patterns, 'type'),
        byImpact: groupByField(intelligence.patterns, 'impact'),
        recent: intelligence.patterns
          .sort((a, b) => new Date(b.metadata.detectedAt).getTime() - new Date(a.metadata.detectedAt).getTime())
          .slice(0, 10),
        critical: intelligence.patterns.filter(p => p.impact === 'critical'),
      },

      insights: {
        total: intelligence.insights.length,
        byType: groupByField(intelligence.insights, 'type'),
        byPriority: groupByPriority(intelligence.insights),
        highPriority: intelligence.insights
          .filter(i => i.priority <= 2)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 10),
        potentialSavings: intelligence.insights.reduce((sum, i) => sum + (i.potentialSavings || 0), 0),
        riskReduction: intelligence.insights.reduce((sum, i) => sum + (i.riskReduction || 0), 0),
      },

      // Portfolio Analytics
      portfolio: {
        overview: intelligence.analytics.overview,
        trends: intelligence.analytics.trends,
        risks: intelligence.analytics.risks,
        opportunities: intelligence.analytics.opportunities,
        performance: {
          processingEfficiency: metrics.processing.successRate * 100,
          averageProcessingTime: metrics.processing.averageProcessingTime,
          contractVelocity: metrics.trends.contractVelocity,
          valueVelocity: metrics.trends.valueVelocity,
        },
      },

      // Real-time Metrics
      realTime: {
        contracts: metrics.contracts,
        processing: metrics.processing,
        intelligence: metrics.intelligence,
        trends: metrics.trends,
        lastUpdated: metrics.timestamp,
      },

      // Dashboard Components
      dashboard: {
        kpis: dashboard.overview.kpis,
        alerts: dashboard.overview.alerts,
        charts: dashboard.charts.map(chart => ({
          ...chart,
          // Limit data points for performance
          data: chart.data.slice(-50),
        })),
        tables: dashboard.tables,
      },

      // Active Workflows
      workflows: includeWorkflows ? {
        active: workflows.filter(w => w.status === 'running'),
        recent: workflows.slice(0, 10),
        statistics: {
          total: workflows.length,
          running: workflows.filter(w => w.status === 'running').length,
          completed: workflows.filter(w => w.status === 'completed').length,
          failed: workflows.filter(w => w.status === 'failed').length,
        },
      } : undefined,

      // Recent Contracts
      recentContracts: contracts.contracts.map(contract => ({
        id: contract.id,
        filename: contract.fileName,
        status: contract.status,
        uploadedAt: contract.uploadedAt,
        totalValue: contract.totalValue,
        supplierName: contract.supplierName,
        processingProgress: getProcessingProgress(contract.status),
      })),

      // Actionable Recommendations
      recommendations,

      // System Health
      systemHealth: {
        overallScore: calculateSystemHealthScore(metrics, intelligence),
        components: {
          processing: metrics.processing.successRate > 0.9 ? 'healthy' : 'degraded',
          intelligence: intelligence.patterns.length > 0 ? 'active' : 'inactive',
          analytics: dashboard.charts.length > 0 ? 'operational' : 'limited',
        },
        alerts: dashboard.overview.alerts.filter(a => a.priority === 'high'),
      },

      // Metadata
      metadata: {
        generatedAt: new Date(),
        responseTime: Date.now() - startTime,
        dataFreshness: calculateDataFreshness(intelligence, metrics),
        coverage: {
          contractsAnalyzed: metrics.contracts.total,
          patternsDetected: intelligence.patterns.length,
          insightsGenerated: intelligence.insights.length,
          workflowsActive: workflows.filter(w => w.status === 'running').length,
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: comprehensiveIntelligence,
    }, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Intelligence-Score': intelligenceScore.toString(),
        'X-Data-Freshness': comprehensiveIntelligence.metadata.dataFreshness,
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      }
    });

  } catch (error) {
    console.error("Comprehensive intelligence error:", error);

    return NextResponse.json({
      success: false,
      error: "Failed to generate comprehensive intelligence",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * Generate executive summary from intelligence data
 */
function generateExecutiveSummary(intelligence: any, metrics: any, dashboard: any) {
  const totalContracts = metrics.contracts.total;
  const totalValue = metrics.contracts.totalValue;
  const patternsCount = intelligence.patterns.length;
  const insightsCount = intelligence.insights.length;
  const highPriorityInsights = intelligence.insights.filter((i: any) => i.priority <= 2).length;
  const potentialSavings = intelligence.insights.reduce((sum: number, i: any) => sum + (i.potentialSavings || 0), 0);

  return {
    overview: `Portfolio of ${totalContracts} contracts worth ${formatCurrency(totalValue)} with ${patternsCount} patterns detected and ${insightsCount} insights generated.`,
    
    keyFindings: [
      `${highPriorityInsights} high-priority insights requiring immediate attention`,
      `${formatCurrency(potentialSavings)} in potential cost optimization opportunities`,
      `${metrics.processing.successRate * 100}% processing success rate`,
      `${intelligence.patterns.filter((p: any) => p.impact === 'high' || p.impact === 'critical').length} high-impact patterns identified`,
    ],

    recommendations: intelligence.insights
      .filter((i: any) => i.priority === 1)
      .slice(0, 3)
      .map((i: any) => i.recommendation),

    riskFactors: intelligence.patterns
      .filter((p: any) => p.type === 'risk' && (p.impact === 'high' || p.impact === 'critical'))
      .slice(0, 3)
      .map((p: any) => p.description),

    opportunities: intelligence.insights
      .filter((i: any) => i.type === 'cost_optimization' && i.potentialSavings > 0)
      .slice(0, 3)
      .map((i: any) => `${i.title}: ${formatCurrency(i.potentialSavings)} potential savings`),
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(intelligence: any, metrics: any, dashboard: any) {
  const recommendations = [];

  // High-priority insights become immediate recommendations
  const urgentInsights = intelligence.insights.filter((i: any) => i.priority === 1);
  recommendations.push(...urgentInsights.map((insight: any) => ({
    id: `urgent-${insight.id}`,
    type: 'urgent_action',
    title: insight.title,
    description: insight.description,
    action: insight.recommendation,
    priority: 1,
    impact: insight.impact,
    effort: insight.effort,
    timeToImplement: insight.timeToImplement,
    potentialValue: insight.potentialSavings || insight.riskReduction || 0,
    category: insight.type,
  })));

  // System performance recommendations
  if (metrics.processing.successRate < 0.9) {
    recommendations.push({
      id: 'system-performance',
      type: 'system_improvement',
      title: 'Improve Processing Success Rate',
      description: `Current success rate is ${(metrics.processing.successRate * 100).toFixed(1)}%`,
      action: 'Investigate processing failures and optimize pipeline',
      priority: 2,
      impact: 'medium',
      effort: 'medium',
      timeToImplement: 14,
      category: 'system_optimization',
    });
  }

  // Data quality recommendations
  const incompleteDataPatterns = intelligence.patterns.filter((p: any) => 
    p.category === 'data_completeness'
  );
  if (incompleteDataPatterns.length > 0) {
    recommendations.push({
      id: 'data-quality',
      type: 'data_improvement',
      title: 'Enhance Data Quality',
      description: 'Incomplete contract data detected affecting analysis accuracy',
      action: 'Implement data validation and improve intake processes',
      priority: 2,
      impact: 'medium',
      effort: 'low',
      timeToImplement: 7,
      category: 'data_quality',
    });
  }

  // Portfolio optimization recommendations
  const supplierConcentrationPatterns = intelligence.patterns.filter((p: any) => 
    p.category === 'supplier_concentration'
  );
  if (supplierConcentrationPatterns.length > 0) {
    recommendations.push({
      id: 'supplier-diversification',
      type: 'risk_mitigation',
      title: 'Diversify Supplier Base',
      description: 'High supplier concentration detected in portfolio',
      action: 'Develop alternative suppliers and implement concentration limits',
      priority: 2,
      impact: 'high',
      effort: 'high',
      timeToImplement: 90,
      category: 'risk_management',
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Calculate overall intelligence score (0-100)
 */
function calculateIntelligenceScore(intelligence: any, metrics: any): number {
  let score = 0;

  // Pattern detection score (0-25 points)
  const patternScore = Math.min(intelligence.patterns.length * 2, 25);
  score += patternScore;

  // Insight generation score (0-25 points)
  const insightScore = Math.min(intelligence.insights.length * 1.5, 25);
  score += insightScore;

  // Processing efficiency score (0-25 points)
  const efficiencyScore = metrics.processing.successRate * 25;
  score += efficiencyScore;

  // Data coverage score (0-25 points)
  const coverageScore = Math.min((metrics.contracts.total / 10) * 25, 25);
  score += coverageScore;

  return Math.round(Math.min(score, 100));
}

/**
 * Calculate system health score
 */
function calculateSystemHealthScore(metrics: any, intelligence: any): number {
  let score = 0;

  // Processing health (40% weight)
  score += metrics.processing.successRate * 40;

  // Intelligence activity (30% weight)
  const intelligenceActivity = intelligence.patterns.length > 0 && intelligence.insights.length > 0 ? 1 : 0.5;
  score += intelligenceActivity * 30;

  // Data freshness (20% weight)
  const dataFreshness = Date.now() - new Date(metrics.timestamp).getTime() < 300000 ? 1 : 0.5; // 5 minutes
  score += dataFreshness * 20;

  // Error rate (10% weight)
  const errorRate = 1 - (metrics.trends.errorRate / 100);
  score += errorRate * 10;

  return Math.round(Math.min(score, 100));
}

/**
 * Helper functions
 */
function groupByField<T>(items: T[], field: keyof T): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = String(item[field]);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupByPriority(insights: any[]): Record<string, number> {
  return insights.reduce((acc, insight) => {
    const priority = insight.priority <= 1 ? "critical" : 
                    insight.priority <= 2 ? "high" : 
                    insight.priority <= 3 ? "medium" : "low";
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getProcessingProgress(status: string): number {
  switch (status) {
    case 'UPLOADED': return 10;
    case 'PROCESSING': return 50;
    case 'COMPLETED': return 100;
    case 'FAILED': return 0;
    default: return 0;
  }
}

function calculateDataFreshness(intelligence: any, metrics: any): string {
  const now = Date.now();
  const metricsAge = now - new Date(metrics.timestamp).getTime();
  
  if (metricsAge < 60000) return "fresh"; // < 1 minute
  if (metricsAge < 300000) return "recent"; // < 5 minutes
  if (metricsAge < 1800000) return "moderate"; // < 30 minutes
  return "stale";
}