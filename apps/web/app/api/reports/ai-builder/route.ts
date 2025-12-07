import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ReportFilters {
  suppliers?: string[];
  categories?: string[];
  years?: string[];
  statuses?: string[];
}

interface DeepAnalysisResult {
  summary: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    averageValue: number;
    averageDurationMonths: number;
    shortestDurationMonths: number;
    longestDurationMonths: number;
  };
  contracts: Array<{
    id: string;
    title: string;
    supplierName: string;
    value: number;
    status: string;
    effectiveDate: Date | null;
    expirationDate: Date | null;
    durationMonths: number;
    category: string;
    daysUntilExpiry: number | null;
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[] }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
  };
  filters: ReportFilters;
}

/**
 * Perform deep analysis on contracts matching the given filters
 */
async function performDeepAnalysis(
  tenantId: string,
  filters: ReportFilters
): Promise<DeepAnalysisResult> {
  try {
    // Build dynamic query (always exclude DELETED)
    const where: any = { 
      tenantId,
      status: { not: 'DELETED' },
    };
    
    // Supplier filter
    if (filters.suppliers && filters.suppliers.length > 0) {
      where.OR = filters.suppliers.map(s => ({
        supplierName: { contains: s, mode: 'insensitive' }
      }));
    }
    
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map(c => ({
        OR: [
          { categoryL1: { contains: c, mode: 'insensitive' } },
          { categoryL2: { contains: c, mode: 'insensitive' } },
        ]
      }));
      where.AND = where.AND || [];
      where.AND.push({ OR: categoryConditions.flatMap(cc => cc.OR) });
    }
    
    // Status filter (exclude DELETED even if not in filter)
    if (filters.statuses && filters.statuses.length > 0) {
      const validStatuses = filters.statuses.filter(s => s !== 'DELETED');
      if (validStatuses.length > 0) {
        where.status = { in: validStatuses };
      }
    }
    
    // Year filter
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(year => {
        const yearNum = parseInt(year);
        return {
          OR: [
            { 
              effectiveDate: { 
                gte: new Date(`${yearNum}-01-01`), 
                lte: new Date(`${yearNum}-12-31`) 
              } 
            },
            { 
              AND: [
                { effectiveDate: { lte: new Date(`${yearNum}-12-31`) } },
                { expirationDate: { gte: new Date(`${yearNum}-01-01`) } },
              ]
            },
          ]
        };
      });
      where.AND = where.AND || [];
      where.AND.push({ OR: yearConditions.flatMap(yc => yc.OR) });
    }
    
    console.log('[AI Report Builder] Query filters:', filters);
    
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { totalValue: 'desc' },
      take: 100,
    });
    
    console.log(`[AI Report Builder] Found ${contracts.length} contracts`);
    
    if (contracts.length === 0) {
      return {
        summary: {
          totalContracts: 0,
          activeContracts: 0,
          totalValue: 0,
          averageValue: 0,
          averageDurationMonths: 0,
          shortestDurationMonths: 0,
          longestDurationMonths: 0,
        },
        contracts: [],
        byCategory: {},
        byStatus: {},
        byYear: {},
        riskAnalysis: {
          expiringIn30Days: 0,
          expiringIn90Days: 0,
          autoRenewalCount: 0,
          highValueAtRisk: 0,
        },
        filters,
      };
    }
    
    // Calculate durations
    const contractsWithDuration = contracts.map(c => {
      const effectiveDate = c.effectiveDate ? new Date(c.effectiveDate) : null;
      const expirationDate = c.expirationDate ? new Date(c.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      const daysUntilExpiry = expirationDate 
        ? Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: c.id,
        title: c.contractTitle || 'Untitled',
        supplierName: c.supplierName || 'Unknown',
        value: Number(c.totalValue) || 0,
        status: c.status,
        effectiveDate,
        expirationDate,
        durationMonths,
        category: c.categoryL1 || 'Uncategorized',
        daysUntilExpiry,
      };
    });
    
    // Calculate summary stats
    const totalValue = contractsWithDuration.reduce((sum, c) => sum + c.value, 0);
    const durations = contractsWithDuration.filter(c => c.durationMonths > 0).map(c => c.durationMonths);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const activeContracts = contractsWithDuration.filter(c => c.status === 'ACTIVE').length;
    
    // Group by category
    const byCategory: Record<string, { count: number; value: number; contracts: string[] }> = {};
    contractsWithDuration.forEach(c => {
      const cat = c.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, value: 0, contracts: [] };
      }
      byCategory[cat].count++;
      byCategory[cat].value += c.value;
      byCategory[cat].contracts.push(c.title);
    });
    
    // Group by status
    const byStatus: Record<string, number> = {};
    contractsWithDuration.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });
    
    // Group by year
    const byYear: Record<string, { count: number; value: number }> = {};
    contractsWithDuration.forEach(c => {
      const contractYear = c.effectiveDate?.getFullYear()?.toString() || 'Unknown';
      if (!byYear[contractYear]) {
        byYear[contractYear] = { count: 0, value: 0 };
      }
      byYear[contractYear].count++;
      byYear[contractYear].value += c.value;
    });
    
    // Risk analysis
    const expiringIn30Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30
    ).length;
    
    const expiringIn90Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90
    ).length;
    
    const autoRenewalCount = contracts.filter(c => c.autoRenewalEnabled).length;
    
    const highValueAtRisk = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90 && c.value > 100000
    ).length;
    
    return {
      summary: {
        totalContracts: contracts.length,
        activeContracts,
        totalValue,
        averageValue: contracts.length > 0 ? totalValue / contracts.length : 0,
        averageDurationMonths: Math.round(avgDuration),
        shortestDurationMonths: durations.length > 0 ? Math.min(...durations) : 0,
        longestDurationMonths: durations.length > 0 ? Math.max(...durations) : 0,
      },
      contracts: contractsWithDuration.slice(0, 20),
      byCategory,
      byStatus,
      byYear,
      riskAnalysis: {
        expiringIn30Days,
        expiringIn90Days,
        autoRenewalCount,
        highValueAtRisk,
      },
      filters,
    };
  } catch (e) {
    console.error('[AI Report Builder] Error:', e);
    return {
      summary: {
        totalContracts: 0,
        activeContracts: 0,
        totalValue: 0,
        averageValue: 0,
        averageDurationMonths: 0,
        shortestDurationMonths: 0,
        longestDurationMonths: 0,
      },
      contracts: [],
      byCategory: {},
      byStatus: {},
      byYear: {},
      riskAnalysis: {
        expiringIn30Days: 0,
        expiringIn90Days: 0,
        autoRenewalCount: 0,
        highValueAtRisk: 0,
      },
      filters,
    };
  }
}

/**
 * Generate AI summary of the analysis
 */
async function generateAISummary(analysis: DeepAnalysisResult): Promise<string> {
  if (analysis.summary.totalContracts === 0) {
    return 'No contracts found matching the specified filters. Try adjusting your filter criteria.';
  }
  
  const prompt = `You are an AI contract analyst. Based on the following data, provide a concise executive summary with key insights and recommendations:

**Contract Analysis Data:**
- Total Contracts: ${analysis.summary.totalContracts}
- Active Contracts: ${analysis.summary.activeContracts}
- Total Value: $${analysis.summary.totalValue.toLocaleString()}
- Average Contract Value: $${Math.round(analysis.summary.averageValue).toLocaleString()}
- Average Duration: ${analysis.summary.averageDurationMonths} months
- Duration Range: ${analysis.summary.shortestDurationMonths} to ${analysis.summary.longestDurationMonths} months

**By Category:**
${Object.entries(analysis.byCategory).map(([cat, data]) => `- ${cat}: ${data.count} contracts, $${data.value.toLocaleString()}`).join('\n')}

**By Status:**
${Object.entries(analysis.byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

**Risk Analysis:**
- Expiring in 30 days: ${analysis.riskAnalysis.expiringIn30Days}
- Expiring in 90 days: ${analysis.riskAnalysis.expiringIn90Days}
- Auto-renewal enabled: ${analysis.riskAnalysis.autoRenewalCount}
- High-value contracts at risk: ${analysis.riskAnalysis.highValueAtRisk}

**Top Contracts:**
${analysis.contracts.slice(0, 5).map((c, i) => `${i + 1}. ${c.title} - ${c.supplierName} - $${c.value.toLocaleString()}`).join('\n')}

Please provide:
1. A brief executive summary (2-3 sentences)
2. Key insights about spending and duration patterns
3. Risk highlights requiring attention
4. 2-3 actionable recommendations

Format with markdown (bold, bullets). Be concise and actionable.`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are ConTigo AI, a contract intelligence assistant. Provide concise, actionable insights.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });
    
    return completion.choices[0]?.message?.content || 'Analysis complete.';
  } catch (e) {
    console.error('[AI Report Builder] OpenAI error:', e);
    return 'Unable to generate AI summary at this time. Please review the data above for insights.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters } = body;
    
    // Get tenant ID (in production, from session)
    const tenantId = 'demo-tenant';
    
    // Perform analysis
    const analysis = await performDeepAnalysis(tenantId, filters || {});
    
    // Generate AI summary
    const aiSummary = await generateAISummary(analysis);
    
    return NextResponse.json({
      success: true,
      analysis,
      aiSummary,
    });
  } catch (error: any) {
    console.error('[AI Report Builder] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
