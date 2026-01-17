/**
 * AI Insights API
 * 
 * GET /api/ai/insights - Get AI-generated insights across contracts
 * 
 * Features:
 * - Cross-contract pattern detection
 * - Risk aggregation
 * - Savings opportunities
 * - Compliance gaps
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface Insight {
  id: string;
  type: 'risk' | 'opportunity' | 'compliance' | 'trend' | 'action';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact?: string;
  affectedContracts?: number;
  recommendation?: string;
  data?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const tenantId = await getServerTenantId();
    const { searchParams } = new URL(request.url);
    
    const insightType = searchParams.get('type'); // risk, opportunity, compliance, all
    const useAI = searchParams.get('ai') !== 'false';

    // Gather contract statistics
    const [
      totalContracts,
      expiringContracts,
      recentContracts,
      contractsByStatus,
      totalValue,
      riskArtifacts,
      complianceArtifacts,
    ] = await Promise.all([
      // Total contracts
      prisma.contract.count({
        where: { tenantId, status: { in: ['COMPLETED', 'ACTIVE'] } },
      }),
      
      // Expiring in next 90 days
      prisma.contract.count({
        where: {
          tenantId,
          status: { in: ['COMPLETED', 'ACTIVE'] },
          expirationDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      
      // Recent contracts (last 30 days)
      prisma.contract.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      
      // By status
      prisma.contract.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      
      // Total value
      prisma.contract.aggregate({
        where: { tenantId, totalValue: { not: null } },
        _sum: { totalValue: true },
      }),
      
      // Risk artifacts
      prisma.artifact.findMany({
        where: { tenantId, type: 'RISK' },
        select: { id: true, data: true, contractId: true },
        take: 50,
      }),
      
      // Compliance artifacts
      prisma.artifact.findMany({
        where: { tenantId, type: 'COMPLIANCE' },
        select: { id: true, data: true, contractId: true },
        take: 50,
      }),
    ]);

    const insights: Insight[] = [];

    // 1. Expiration Risk Insight
    if (expiringContracts > 0) {
      insights.push({
        id: 'exp-risk-1',
        type: 'risk',
        severity: expiringContracts > 5 ? 'critical' : expiringContracts > 2 ? 'high' : 'medium',
        title: `${expiringContracts} Contracts Expiring Soon`,
        description: `You have ${expiringContracts} contracts expiring in the next 90 days that require attention.`,
        impact: 'Service continuity risk if not renewed',
        affectedContracts: expiringContracts,
        recommendation: 'Review expiring contracts and initiate renewal discussions',
      });
    }

    // 2. Contract Volume Insight
    if (recentContracts > 0) {
      insights.push({
        id: 'volume-1',
        type: 'trend',
        severity: 'info',
        title: `${recentContracts} New Contracts This Month`,
        description: `Your contract portfolio has grown with ${recentContracts} new contracts in the last 30 days.`,
        data: { recentContracts, totalContracts },
      });
    }

    // 3. Value Analysis
    const totalValueNum = totalValue._sum.totalValue ? Number(totalValue._sum.totalValue) : 0;
    if (totalValueNum > 0) {
      insights.push({
        id: 'value-1',
        type: 'info' as any,
        severity: 'info',
        title: `$${(totalValueNum / 1000000).toFixed(1)}M Total Contract Value`,
        description: `Your managed contract portfolio has a total value of $${totalValueNum.toLocaleString()}.`,
        data: { totalValue: totalValueNum },
      });
    }

    // 4. Aggregate Risk Insights from Artifacts
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    const riskCategories = new Map<string, number>();

    for (const artifact of riskArtifacts) {
      const data = artifact.data as any;
      if (data?.riskLevel === 'HIGH' || data?.riskLevel === 'CRITICAL') highRiskCount++;
      else if (data?.riskLevel === 'MEDIUM') mediumRiskCount++;
      
      // Count risk categories
      if (data?.risks && Array.isArray(data.risks)) {
        for (const risk of data.risks) {
          const category = risk.category || 'Unknown';
          riskCategories.set(category, (riskCategories.get(category) || 0) + 1);
        }
      }
    }

    if (highRiskCount > 0) {
      insights.push({
        id: 'risk-aggregate-1',
        type: 'risk',
        severity: 'high',
        title: `${highRiskCount} High-Risk Contracts Identified`,
        description: `AI analysis found ${highRiskCount} contracts with significant risk factors requiring review.`,
        affectedContracts: highRiskCount,
        recommendation: 'Prioritize legal review for high-risk contracts',
        data: { highRiskCount, mediumRiskCount, riskCategories: Object.fromEntries(riskCategories) },
      });
    }

    // 5. Compliance Insights
    let nonCompliantCount = 0;
    for (const artifact of complianceArtifacts) {
      const data = artifact.data as any;
      if (data?.complianceScore && data.complianceScore < 70) {
        nonCompliantCount++;
      }
    }

    if (nonCompliantCount > 0) {
      insights.push({
        id: 'compliance-1',
        type: 'compliance',
        severity: 'medium',
        title: `${nonCompliantCount} Contracts Below Compliance Threshold`,
        description: `${nonCompliantCount} contracts scored below 70% on compliance checks.`,
        affectedContracts: nonCompliantCount,
        recommendation: 'Review compliance gaps and update contract terms',
      });
    }

    // 6. RAG Coverage Insight
    const contractsWithEmbeddings = await prisma.contract.count({
      where: { 
        tenantId,
        contractEmbeddings: { some: {} },
      },
    });

    const ragCoverage = totalContracts > 0 
      ? Math.round((contractsWithEmbeddings / totalContracts) * 100)
      : 0;

    if (ragCoverage < 80 && totalContracts > 0) {
      insights.push({
        id: 'rag-coverage-1',
        type: 'opportunity',
        severity: 'low',
        title: 'AI Search Can Be Improved',
        description: `Only ${ragCoverage}% of your contracts are indexed for AI-powered search. Process remaining contracts to improve search accuracy.`,
        affectedContracts: totalContracts - contractsWithEmbeddings,
        recommendation: 'Run batch RAG processing to index all contracts',
        data: { indexed: contractsWithEmbeddings, total: totalContracts, coverage: ragCoverage },
      });
    }

    // 7. Use OpenAI for deeper insights (if enabled and enough data)
    if (useAI && process.env.OPENAI_API_KEY && totalContracts >= 5) {
      try {
        const aiInsight = await generateAIInsight(tenantId, {
          totalContracts,
          expiringContracts,
          highRiskCount,
          totalValue: totalValueNum,
          riskCategories: Object.fromEntries(riskCategories),
        });
        
        if (aiInsight) {
          insights.push(aiInsight);
        }
      } catch {
        // AI insight generation failed, continue without it
      }
    }

    // Filter by type if requested
    const filteredInsights = insightType && insightType !== 'all'
      ? insights.filter(i => i.type === insightType)
      : insights;

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    filteredInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      insights: filteredInsights,
      summary: {
        totalInsights: filteredInsights.length,
        critical: filteredInsights.filter(i => i.severity === 'critical').length,
        high: filteredInsights.filter(i => i.severity === 'high').length,
        medium: filteredInsights.filter(i => i.severity === 'medium').length,
        portfolioStats: {
          totalContracts,
          expiringContracts,
          recentContracts,
          totalValue: totalValueNum,
          ragCoverage,
        },
      },
      generatedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    });

  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

async function generateAIInsight(
  tenantId: string,
  stats: {
    totalContracts: number;
    expiringContracts: number;
    highRiskCount: number;
    totalValue: number;
    riskCategories: Record<string, number>;
  }
): Promise<Insight | null> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a contract management AI analyst. Generate a single actionable insight based on portfolio statistics. Return JSON with: title (string), description (string), recommendation (string), severity (critical|high|medium|low).`,
      },
      {
        role: 'user',
        content: `Contract portfolio stats:
- Total contracts: ${stats.totalContracts}
- Expiring in 90 days: ${stats.expiringContracts}
- High-risk contracts: ${stats.highRiskCount}
- Total value: $${stats.totalValue.toLocaleString()}
- Risk categories: ${JSON.stringify(stats.riskCategories)}

Generate one strategic insight about this portfolio.`,
      },
    ],
    temperature: 0.5,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  try {
    const content = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      id: 'ai-insight-1',
      type: 'opportunity',
      severity: content.severity || 'medium',
      title: content.title || 'AI Portfolio Analysis',
      description: content.description || 'AI analysis of your contract portfolio.',
      recommendation: content.recommendation,
    };
  } catch {
    return null;
  }
}
