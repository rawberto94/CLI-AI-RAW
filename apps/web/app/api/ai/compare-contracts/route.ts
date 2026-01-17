/**
 * AI Contract Group Comparison API
 * 
 * POST /api/ai/compare-contracts - Compare two groups of contracts with AI analysis
 * 
 * Enhanced with:
 * - Deep financial analysis
 * - Risk scoring and comparison
 * - Clause-level comparison (when available)
 * - Trend analysis
 * - Negotiation insights
 * - Supplier performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ContractSummary {
  title: string;
  supplier: string;
  value: number;
  effectiveDate: string | null;
  expirationDate: string | null;
  category: string | null;
  paymentTerms: string | null;
  autoRenewal?: boolean;
  noticePeriodDays?: number;
  currency?: string;
}

interface GroupData {
  name: string;
  contracts: ContractSummary[];
  totalValue: number;
  avgValue: number;
}

interface ComparisonMetrics {
  valueDifference: number;
  valueDifferencePercent: number;
  avgValueDifference: number;
  avgValueDifferencePercent: number;
  countDifference: number;
  riskScore1: number;
  riskScore2: number;
  supplierConcentration1: number;
  supplierConcentration2: number;
  expiringCount1: number;
  expiringCount2: number;
  avgDuration1: number;
  avgDuration2: number;
}

// Calculate comprehensive metrics for comparison
function calculateComparisonMetrics(group1: GroupData, group2: GroupData): ComparisonMetrics {
  const now = new Date();
  
  // Value calculations
  const valueDiff = group1.totalValue - group2.totalValue;
  const valueDiffPct = group2.totalValue > 0 ? (valueDiff / group2.totalValue) * 100 : 0;
  const avgDiff = group1.avgValue - group2.avgValue;
  const avgDiffPct = group2.avgValue > 0 ? (avgDiff / group2.avgValue) * 100 : 0;
  
  // Expiring contracts (within 90 days)
  const getExpiringCount = (contracts: ContractSummary[]) => 
    contracts.filter(c => {
      if (!c.expirationDate) return false;
      const days = Math.ceil((new Date(c.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 90;
    }).length;
  
  // Supplier concentration (Herfindahl-Hirschman Index simplified)
  const getSupplierConcentration = (contracts: ContractSummary[]) => {
    if (contracts.length === 0) return 0;
    const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
    if (totalValue === 0) return 0;
    
    const supplierValues: Record<string, number> = {};
    contracts.forEach(c => {
      const supplier = c.supplier || 'Unknown';
      supplierValues[supplier] = (supplierValues[supplier] || 0) + (c.value || 0);
    });
    
    const shares = Object.values(supplierValues).map(v => v / totalValue);
    const hhi = shares.reduce((sum, share) => sum + share * share, 0);
    return Math.round(hhi * 10000); // HHI scale 0-10000
  };
  
  // Risk score calculation
  const getRiskScore = (contracts: ContractSummary[]) => {
    if (contracts.length === 0) return 0;
    
    let riskPoints = 0;
    const totalContracts = contracts.length;
    
    contracts.forEach(c => {
      // Expiring soon
      if (c.expirationDate) {
        const days = Math.ceil((new Date(c.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) riskPoints += 3;
        else if (days <= 90) riskPoints += 2;
        else if (days <= 180) riskPoints += 1;
      }
      
      // No auto-renewal
      if (!c.autoRenewal) riskPoints += 0.5;
      
      // High value single contract
      if (c.value > 500000) riskPoints += 1;
      
      // Missing critical data
      if (!c.expirationDate) riskPoints += 1;
      if (!c.paymentTerms) riskPoints += 0.5;
    });
    
    return Math.round((riskPoints / (totalContracts * 6)) * 100);
  };
  
  // Average duration
  const getAvgDuration = (contracts: ContractSummary[]) => {
    const durations = contracts
      .filter(c => c.effectiveDate && c.expirationDate)
      .map(c => {
        const start = new Date(c.effectiveDate!);
        const end = new Date(c.expirationDate!);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      });
    return durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  };
  
  return {
    valueDifference: valueDiff,
    valueDifferencePercent: Math.round(valueDiffPct * 10) / 10,
    avgValueDifference: avgDiff,
    avgValueDifferencePercent: Math.round(avgDiffPct * 10) / 10,
    countDifference: group1.contracts.length - group2.contracts.length,
    riskScore1: getRiskScore(group1.contracts),
    riskScore2: getRiskScore(group2.contracts),
    supplierConcentration1: getSupplierConcentration(group1.contracts),
    supplierConcentration2: getSupplierConcentration(group2.contracts),
    expiringCount1: getExpiringCount(group1.contracts),
    expiringCount2: getExpiringCount(group2.contracts),
    avgDuration1: getAvgDuration(group1.contracts),
    avgDuration2: getAvgDuration(group2.contracts),
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { group1, group2 } = body as { group1: GroupData; group2: GroupData };

    if (!group1 || group2 === undefined) {
      return NextResponse.json(
        { error: 'Both group1 and group2 are required' },
        { status: 400 }
      );
    }

    if (group1.contracts.length === 0 || group2.contracts.length === 0) {
      return NextResponse.json(
        { error: 'Both groups must have at least one contract' },
        { status: 400 }
      );
    }

    // Calculate comparison metrics
    const metrics = calculateComparisonMetrics(group1, group2);

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      // Return fallback analysis
      return NextResponse.json({
        success: true,
        data: {
          analysis: generateFallbackAnalysis(group1, group2, metrics),
          metrics,
          source: 'fallback',
        },
      });
    }

    try {
      const prompt = buildComparisonPrompt(group1, group2, metrics);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst and procurement specialist with deep expertise in:
- Contract portfolio optimization
- Vendor management and negotiation strategies
- Risk assessment and mitigation
- Cost reduction and value optimization
- Compliance and governance

Analyze contract groups and provide:
1. Clear, actionable insights
2. Specific recommendations with expected impact
3. Risk factors with severity ratings
4. Negotiation leverage points
5. Strategic guidance for procurement decisions

Format responses in well-structured markdown with clear headings and bullet points.
Use emojis sparingly to highlight key points (💰 for money, ⚠️ for warnings, ✅ for positives, 📊 for data).
Be concise but comprehensive.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const analysis = completion.choices[0]?.message?.content || 'Unable to generate analysis';

      return NextResponse.json({
        success: true,
        data: {
          analysis,
          metrics,
          source: 'openai',
          model: 'gpt-4o-mini',
          processingTime: Date.now() - startTime,
        },
      });
    } catch (openaiError: unknown) {
      // Return fallback analysis on OpenAI error
      return NextResponse.json({
        success: true,
        data: {
          analysis: generateFallbackAnalysis(group1, group2, metrics),
          metrics,
          source: 'fallback',
          error: openaiError instanceof Error ? openaiError.message : 'OpenAI error',
        },
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to compare contracts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildComparisonPrompt(group1: GroupData, group2: GroupData, metrics: ComparisonMetrics): string {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  
  let prompt = `## Contract Group Comparison Analysis Request

### Group A: ${group1.name}
- **Number of Contracts:** ${group1.contracts.length}
- **Total Value:** ${formatCurrency(group1.totalValue)}
- **Average Contract Value:** ${formatCurrency(group1.avgValue)}
- **Risk Score:** ${metrics.riskScore1}/100
- **Supplier Concentration (HHI):** ${metrics.supplierConcentration1}/10000
- **Contracts Expiring Soon:** ${metrics.expiringCount1}
- **Avg Contract Duration:** ${metrics.avgDuration1} months

**Contracts in Group A:**
`;

  group1.contracts.forEach((c, i) => {
    prompt += `${i + 1}. **${c.title || 'Untitled'}** - ${c.supplier || 'Unknown'}\n`;
    prompt += `   Value: ${formatCurrency(c.value || 0)}`;
    if (c.effectiveDate) prompt += ` | Start: ${new Date(c.effectiveDate).toISOString().split('T')[0]}`;
    if (c.expirationDate) prompt += ` | End: ${new Date(c.expirationDate).toISOString().split('T')[0]}`;
    if (c.category) prompt += ` | Category: ${c.category}`;
    if (c.paymentTerms) prompt += ` | Terms: ${c.paymentTerms}`;
    prompt += '\n';
  });

  prompt += `
### Group B: ${group2.name}
- **Number of Contracts:** ${group2.contracts.length}
- **Total Value:** ${formatCurrency(group2.totalValue)}
- **Average Contract Value:** ${formatCurrency(group2.avgValue)}
- **Risk Score:** ${metrics.riskScore2}/100
- **Supplier Concentration (HHI):** ${metrics.supplierConcentration2}/10000
- **Contracts Expiring Soon:** ${metrics.expiringCount2}
- **Avg Contract Duration:** ${metrics.avgDuration2} months

**Contracts in Group B:**
`;

  group2.contracts.forEach((c, i) => {
    prompt += `${i + 1}. **${c.title || 'Untitled'}** - ${c.supplier || 'Unknown'}\n`;
    prompt += `   Value: ${formatCurrency(c.value || 0)}`;
    if (c.effectiveDate) prompt += ` | Start: ${new Date(c.effectiveDate).toISOString().split('T')[0]}`;
    if (c.expirationDate) prompt += ` | End: ${new Date(c.expirationDate).toISOString().split('T')[0]}`;
    if (c.category) prompt += ` | Category: ${c.category}`;
    if (c.paymentTerms) prompt += ` | Terms: ${c.paymentTerms}`;
    prompt += '\n';
  });

  prompt += `
### Pre-calculated Comparison Metrics
- **Value Difference:** ${formatCurrency(Math.abs(metrics.valueDifference))} (${metrics.valueDifferencePercent > 0 ? '+' : ''}${metrics.valueDifferencePercent}%)
- **Avg Value Difference:** ${formatCurrency(Math.abs(metrics.avgValueDifference))} (${metrics.avgValueDifferencePercent > 0 ? '+' : ''}${metrics.avgValueDifferencePercent}%)
- **Risk Score Comparison:** Group A: ${metrics.riskScore1} vs Group B: ${metrics.riskScore2}
- **Concentration Risk:** Group A: ${metrics.supplierConcentration1 > 2500 ? 'High' : metrics.supplierConcentration1 > 1500 ? 'Moderate' : 'Low'} vs Group B: ${metrics.supplierConcentration2 > 2500 ? 'High' : metrics.supplierConcentration2 > 1500 ? 'Moderate' : 'Low'}

---

Please provide a comprehensive procurement analysis including:

1. **Executive Summary** (3-4 sentences) - The most important takeaways
2. **Value for Money Analysis** - Which group offers better value? Why?
3. **Risk Assessment** - Compare risk profiles, highlight concerns
4. **Negotiation Insights** - Leverage points for upcoming renewals/negotiations
5. **Optimization Opportunities** - Specific, quantified savings opportunities
6. **Strategic Recommendations** - Prioritized actions with expected impact

Focus on actionable insights that a procurement manager can use immediately.`;

  return prompt;
}

function generateFallbackAnalysis(group1: GroupData, group2: GroupData, metrics: ComparisonMetrics): string {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  
  let analysis = `## Contract Group Comparison Analysis\n\n`;
  
  // Executive Summary
  analysis += `### 📋 Executive Summary\n`;
  analysis += `Comparing **${group1.name}** (${group1.contracts.length} contracts, ${formatCurrency(group1.totalValue)}) `;
  analysis += `with **${group2.name}** (${group2.contracts.length} contracts, ${formatCurrency(group2.totalValue)}). `;
  
  if (Math.abs(metrics.valueDifferencePercent) > 20) {
    analysis += `There is a **significant ${Math.abs(metrics.valueDifferencePercent)}% difference** in total value. `;
  }
  
  if (metrics.riskScore1 > metrics.riskScore2 + 10) {
    analysis += `${group1.name} presents higher risk and requires attention.`;
  } else if (metrics.riskScore2 > metrics.riskScore1 + 10) {
    analysis += `${group2.name} presents higher risk and requires attention.`;
  } else {
    analysis += `Both groups have comparable risk profiles.`;
  }
  analysis += `\n\n`;
  
  // Value Analysis
  analysis += `### 💰 Value for Money Analysis\n`;
  analysis += `| Metric | ${group1.name} | ${group2.name} | Difference |\n`;
  analysis += `|--------|---------------|---------------|------------|\n`;
  analysis += `| Total Value | ${formatCurrency(group1.totalValue)} | ${formatCurrency(group2.totalValue)} | ${metrics.valueDifferencePercent > 0 ? '+' : ''}${metrics.valueDifferencePercent}% |\n`;
  analysis += `| Avg Contract | ${formatCurrency(group1.avgValue)} | ${formatCurrency(group2.avgValue)} | ${metrics.avgValueDifferencePercent > 0 ? '+' : ''}${metrics.avgValueDifferencePercent}% |\n`;
  analysis += `| Contracts | ${group1.contracts.length} | ${group2.contracts.length} | ${metrics.countDifference > 0 ? '+' : ''}${metrics.countDifference} |\n`;
  analysis += `| Avg Duration | ${metrics.avgDuration1} mo | ${metrics.avgDuration2} mo | ${metrics.avgDuration1 - metrics.avgDuration2} mo |\n\n`;
  
  // Risk Assessment
  analysis += `### ⚠️ Risk Assessment\n`;
  analysis += `| Risk Factor | ${group1.name} | ${group2.name} |\n`;
  analysis += `|-------------|---------------|---------------|\n`;
  analysis += `| Risk Score | ${metrics.riskScore1}/100 | ${metrics.riskScore2}/100 |\n`;
  analysis += `| Expiring (90d) | ${metrics.expiringCount1} contracts | ${metrics.expiringCount2} contracts |\n`;
  analysis += `| Concentration | ${metrics.supplierConcentration1 > 2500 ? '🔴 High' : metrics.supplierConcentration1 > 1500 ? '🟡 Moderate' : '🟢 Low'} | ${metrics.supplierConcentration2 > 2500 ? '🔴 High' : metrics.supplierConcentration2 > 1500 ? '🟡 Moderate' : '🟢 Low'} |\n\n`;
  
  // Supplier Assessment
  const suppliers1 = [...new Set(group1.contracts.map(c => c.supplier).filter(Boolean))];
  const suppliers2 = [...new Set(group2.contracts.map(c => c.supplier).filter(Boolean))];
  
  analysis += `### 🏢 Supplier Assessment\n`;
  analysis += `- **${group1.name}** involves ${suppliers1.length} unique supplier(s): ${suppliers1.join(', ') || 'Unknown'}\n`;
  analysis += `- **${group2.name}** involves ${suppliers2.length} unique supplier(s): ${suppliers2.join(', ') || 'Unknown'}\n\n`;
  
  // Recommendations
  analysis += `### ✅ Strategic Recommendations\n`;
  
  let recNum = 1;
  
  if (metrics.expiringCount1 > 0 || metrics.expiringCount2 > 0) {
    analysis += `${recNum}. **Urgent:** Review ${metrics.expiringCount1 + metrics.expiringCount2} contracts expiring within 90 days for renewal decisions\n`;
    recNum++;
  }
  
  if (Math.abs(metrics.avgValueDifferencePercent) > 15) {
    const higher = metrics.avgValueDifferencePercent > 0 ? group1.name : group2.name;
    const lower = metrics.avgValueDifferencePercent > 0 ? group2.name : group1.name;
    analysis += `${recNum}. **Cost Optimization:** ${higher} has ${Math.abs(metrics.avgValueDifferencePercent)}% higher average contract value - review for potential renegotiation based on ${lower} benchmarks\n`;
    recNum++;
  }
  
  if (metrics.supplierConcentration1 > 2500 || metrics.supplierConcentration2 > 2500) {
    analysis += `${recNum}. **Diversification:** ${metrics.supplierConcentration1 > 2500 ? group1.name : group2.name} has high supplier concentration - consider diversifying to reduce dependency risk\n`;
    recNum++;
  }
  
  if (group1.contracts.length >= 3 && group2.contracts.length >= 3) {
    analysis += `${recNum}. **Consolidation:** With ${group1.contracts.length + group2.contracts.length} total contracts, evaluate consolidation opportunities for volume discounts\n`;
    recNum++;
  }
  
  analysis += `${recNum}. **Payment Terms:** Compare payment terms across groups to identify negotiation leverage\n`;
  
  analysis += `\n---\n*Analysis generated automatically. For deeper AI-powered insights, configure OpenAI integration.*`;
  
  return analysis;
}
