import { NextRequest, NextResponse } from 'next/server';
import { getSupplierBenchmarks, getSupplierRiskDistribution, mockContractMetrics } from '@/lib/mock-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeAnalytics = searchParams.get('analytics') === 'true';

    const benchmarks = getSupplierBenchmarks(category || undefined);
    
    let response: any = {
      benchmarks,
      total: benchmarks.length
    };

    if (includeAnalytics) {
      const riskDistribution = getSupplierRiskDistribution();
      const avgRate = benchmarks.reduce((sum, b) => sum + b.avgRate, 0) / benchmarks.length;
      const totalValue = benchmarks.reduce((sum, b) => sum + b.totalValue, 0);
      
      response.analytics = {
        riskDistribution,
        avgMarketRate: Math.round(avgRate * 100) / 100,
        totalPortfolioValue: totalValue,
        supplierCount: benchmarks.length,
        categories: [...new Set(benchmarks.map(b => b.category))],
        performanceMetrics: {
          avgPerformanceScore: Math.round(benchmarks.reduce((sum, b) => sum + b.performanceScore, 0) / benchmarks.length),
          topPerformers: benchmarks
            .filter(b => b.performanceScore >= 90)
            .sort((a, b) => b.performanceScore - a.performanceScore)
            .slice(0, 5)
            .map(b => ({ supplier: b.supplier, score: b.performanceScore })),
          costOptimizationOpportunities: benchmarks
            .filter(b => b.marketPosition === 'above')
            .map(b => ({
              supplier: b.supplier,
              category: b.category,
              potentialSavings: Math.round((b.avgRate - (b.avgRate * 0.85)) * 2000), // Assume 15% reduction possible
              currentSpend: b.totalValue
            }))
        },
        lastUpdated: new Date().toISOString()
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Supplier benchmarks API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier benchmarks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suppliers, category } = body;

    // Simulate benchmarking analysis
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing time

    const mockBenchmarkResults = {
      analysisId: `analysis-${Date.now()}`,
      category: category || 'General',
      suppliersAnalyzed: suppliers?.length || 10,
      marketInsights: {
        avgMarketRate: 155.50,
        rateRange: { min: 95, max: 275 },
        recommendedRange: { min: 140, max: 170 },
        outliers: [
          { supplier: 'Premium Tech Corp', rate: 275, reason: 'Significantly above market' },
          { supplier: 'Budget Solutions', rate: 95, reason: 'Significantly below market' }
        ]
      },
      optimizationOpportunities: [
        {
          type: 'rate_negotiation',
          suppliers: ['TechServices Inc.', 'CloudSolutions LLC'],
          potentialSavings: 450000,
          confidence: 85
        },
        {
          type: 'supplier_consolidation',
          suppliers: ['DataPro Systems', 'Analytics Plus'],
          potentialSavings: 280000,
          confidence: 78
        }
      ],
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      analysis: mockBenchmarkResults,
      message: 'Supplier benchmarking completed successfully'
    });
  } catch (error) {
    console.error('Supplier benchmarking error:', error);
    return NextResponse.json(
      { error: 'Failed to perform supplier benchmarking' },
      { status: 500 }
    );
  }
}