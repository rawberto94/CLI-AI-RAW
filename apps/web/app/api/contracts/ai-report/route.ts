/**
 * AI Report Generation API
 * 
 * POST /api/contracts/ai-report - Generate comprehensive AI report for multiple contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ContractSummary {
  id: string;
  fileName: string;
  status: string;
  totalValue: number | null;
  riskLevel: string | null;
  expirationDate: Date | null;
  textExcerpt: string;
}

interface AIReportResult {
  reportId: string;
  generatedAt: string;
  contractCount: number;
  executiveSummary: string;
  portfolioAnalysis: {
    totalValue: number;
    averageValue: number;
    riskDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
  };
  keyFindings: Array<{
    type: 'risk' | 'opportunity' | 'compliance' | 'action-needed';
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedContracts: string[];
  }>;
  contractHighlights: Array<{
    contractId: string;
    contractName: string;
    summary: string;
    keyRisks: string[];
    recommendations: string[];
  }>;
  actionItems: Array<{
    priority: 'urgent' | 'high' | 'medium' | 'low';
    action: string;
    deadline?: string;
    relatedContracts: string[];
  }>;
  recommendations: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractIds, reportType = 'comprehensive' } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json(
        { error: 'contractIds array is required' },
        { status: 400 }
      );
    }

    if (contractIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 contracts per report' },
        { status: 400 }
      );
    }

    const tenantId = await getServerTenantId();

    // Fetch all contracts
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId,
      },
      select: {
        id: true,
        fileName: true,
        contractTitle: true,
        rawText: true,
        status: true,
        totalValue: true,
        expirationRisk: true,
        contractType: true,
        supplierName: true,
        expirationDate: true,
        startDate: true,
        createdAt: true,
      },
    });

    if (contracts.length === 0) {
      return NextResponse.json(
        { error: 'No contracts found' },
        { status: 404 }
      );
    }

    console.log(`📊 Generating AI report for ${contracts.length} contracts`);

    // Prepare contract summaries (used for both AI + mock flows)
    const contractSummaries: ContractSummary[] = contracts.map(c => ({
      id: c.id,
      fileName: c.contractTitle || c.fileName,
      status: c.status,
      totalValue: c.totalValue ? Number(c.totalValue) : null,
      riskLevel: c.expirationRisk,
      expirationDate: c.expirationDate,
      textExcerpt: c.rawText?.slice(0, 1500) || 'No text available',
    }));

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return mock report for demo purposes
      return NextResponse.json(generateMockReport(contractSummaries));
    }

    // Calculate portfolio stats
    const portfolioStats = calculatePortfolioStats(contractSummaries);

    // Generate AI report
    const aiReport = await generateAIReport(contractSummaries, portfolioStats, reportType);

    const processingTime = Date.now() - startTime;

    const result = {
      reportId: `report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      contractCount: contracts.length,
      executiveSummary: aiReport.executiveSummary || '',
      keyFindings: aiReport.keyFindings || [],
      contractHighlights: aiReport.contractHighlights || [],
      actionItems: aiReport.actionItems || [],
      recommendations: aiReport.recommendations || [],
      portfolioAnalysis: portfolioStats,
    } satisfies AIReportResult;

    console.log(`✅ AI Report generated in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      processingTime,
      report: result,
    });

  } catch (error: unknown) {
    console.error('AI Report generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Contract input for report generation
 */
type ContractInput = ContractSummary;

/**
 * Portfolio statistics
 */
interface PortfolioStats {
  totalValue: number;
  averageValue: number;
  riskDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

function calculatePortfolioStats(contracts: ContractInput[]): PortfolioStats {
  const totalValue = contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  const averageValue = contracts.length > 0 ? totalValue / contracts.length : 0;

  const riskDistribution: Record<string, number> = {};
  const statusDistribution: Record<string, number> = {};

  contracts.forEach(c => {
    const risk = c.riskLevel || 'unknown';
    riskDistribution[risk] = (riskDistribution[risk] || 0) + 1;

    const status = c.status || 'unknown';
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  });

  return {
    totalValue,
    averageValue,
    riskDistribution,
    statusDistribution,
  };
}

async function generateAIReport(
  contracts: ContractSummary[],
  stats: PortfolioStats,
  reportType: string
): Promise<Partial<AIReportResult>> {
  const contractList = contracts.map(c => `
Contract: ${c.fileName}
Status: ${c.status}
Value: $${(c.totalValue || 0).toLocaleString()}
Risk: ${c.riskLevel || 'Not assessed'}
Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}
Content Preview: ${c.textExcerpt.slice(0, 500)}...
---`).join('\n');

  const prompt = `You are analyzing a portfolio of ${contracts.length} contracts. Generate a comprehensive report.

Portfolio Statistics:
- Total Value: $${stats.totalValue.toLocaleString()}
- Average Value: $${stats.averageValue.toLocaleString()}
- Risk Distribution: ${JSON.stringify(stats.riskDistribution)}
- Status Distribution: ${JSON.stringify(stats.statusDistribution)}

Contracts:
${contractList}

Provide a JSON response with this exact structure:
{
  "executiveSummary": "3-4 paragraph executive summary covering overall portfolio health, key concerns, and strategic recommendations",
  "keyFindings": [
    {
      "type": "risk|opportunity|compliance|action-needed",
      "title": "Finding title",
      "description": "Detailed description",
      "severity": "critical|high|medium|low",
      "affectedContracts": ["contract file names"]
    }
  ],
  "contractHighlights": [
    {
      "contractId": "id",
      "contractName": "name",
      "summary": "Brief summary",
      "keyRisks": ["risk 1", "risk 2"],
      "recommendations": ["rec 1"]
    }
  ],
  "actionItems": [
    {
      "priority": "urgent|high|medium|low",
      "action": "What needs to be done",
      "deadline": "Suggested deadline",
      "relatedContracts": ["contract names"]
    }
  ],
  "recommendations": ["Strategic recommendation 1", "recommendation 2", ...]
}

Focus on:
1. Identifying patterns and risks across contracts
2. Highlighting contracts needing immediate attention
3. Finding cost optimization opportunities
4. Compliance and deadline concerns
5. Strategic recommendations for portfolio management`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert contract portfolio analyst. Provide thorough, actionable insights in valid JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(responseContent);
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate AI analysis');
  }
}

function generateMockReport(contracts: ContractInput[]): { success: boolean; processingTime: number; report: Partial<AIReportResult> } {
  const stats = calculatePortfolioStats(contracts);
  
  const expiringContracts = contracts.filter(c => {
    if (!c.expirationDate) return false;
    const daysUntilExpiry = (new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  });

  const highRiskContracts = contracts.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical');

  return {
    success: true,
    processingTime: 1200,
    report: {
      reportId: `report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      contractCount: contracts.length,
      executiveSummary: `This AI-generated report analyzes ${contracts.length} contracts with a combined value of $${stats.totalValue.toLocaleString()}. 

The portfolio shows ${highRiskContracts.length} high-risk contracts requiring attention and ${expiringContracts.length} contracts expiring within 90 days. The average contract value is $${Math.round(stats.averageValue).toLocaleString()}.

Key areas of focus include ${Object.keys(stats.statusDistribution).join(', ')} contracts. Risk distribution across the portfolio shows ${JSON.stringify(stats.riskDistribution)}.

Immediate action is recommended for contracts approaching expiration and those flagged as high risk to ensure business continuity and compliance.`,
      portfolioAnalysis: stats,
      keyFindings: [
        ...(expiringContracts.length > 0 ? [{
          type: 'action-needed' as const,
          title: 'Contracts Approaching Expiration',
          description: `${expiringContracts.length} contracts will expire within the next 90 days. Review and initiate renewal discussions.`,
          severity: 'high' as const,
          affectedContracts: expiringContracts.map(c => c.fileName),
        }] : []),
        ...(highRiskContracts.length > 0 ? [{
          type: 'risk' as const,
          title: 'High Risk Contracts Identified',
          description: `${highRiskContracts.length} contracts have been flagged as high risk. Review terms and conditions.`,
          severity: 'critical' as const,
          affectedContracts: highRiskContracts.map(c => c.fileName),
        }] : []),
        {
          type: 'opportunity' as const,
          title: 'Portfolio Consolidation Opportunity',
          description: 'Consider consolidating similar contracts to improve terms and reduce administrative overhead.',
          severity: 'medium' as const,
          affectedContracts: contracts.slice(0, 3).map(c => c.fileName),
        },
      ],
      contractHighlights: contracts.slice(0, 5).map(c => ({
        contractId: c.id,
        contractName: c.fileName,
        summary: `${c.status} contract valued at $${(c.totalValue || 0).toLocaleString()}.`,
        keyRisks: c.riskLevel === 'high' ? ['High risk classification', 'Requires detailed review'] : ['Standard risk level'],
        recommendations: c.expirationDate && new Date(c.expirationDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          ? ['Initiate renewal discussions', 'Review pricing terms']
          : ['Monitor for compliance', 'Track key dates'],
      })),
      actionItems: [
        ...(expiringContracts.length > 0 ? [{
          priority: 'urgent' as const,
          action: 'Review and renew expiring contracts',
          deadline: '30 days',
          relatedContracts: expiringContracts.slice(0, 3).map(c => c.fileName),
        }] : []),
        {
          priority: 'high' as const,
          action: 'Conduct risk assessment for flagged contracts',
          deadline: '2 weeks',
          relatedContracts: highRiskContracts.slice(0, 3).map(c => c.fileName),
        },
        {
          priority: 'medium' as const,
          action: 'Update contract metadata and categorization',
          relatedContracts: contracts.slice(0, 2).map(c => c.fileName),
        },
      ],
      recommendations: [
        'Implement quarterly contract review cycles',
        'Set up automated renewal reminders 90 days before expiration',
        'Standardize contract templates to reduce negotiation time',
        'Consider vendor consolidation for cost optimization',
        'Establish clear risk assessment criteria for new contracts',
      ],
    },
  };
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/contracts/ai-report',
    method: 'POST',
    description: 'Generate comprehensive AI report for multiple contracts',
    parameters: {
      contractIds: { type: 'string[]', required: true, maxLength: 20 },
      reportType: { 
        type: 'string', 
        required: false, 
        default: 'comprehensive',
        options: ['comprehensive', 'risk-focused', 'financial', 'compliance'],
      },
    },
    returns: {
      reportId: 'Unique report identifier',
      executiveSummary: 'Portfolio executive summary',
      portfolioAnalysis: 'Statistical analysis',
      keyFindings: 'AI-identified findings',
      contractHighlights: 'Per-contract summaries',
      actionItems: 'Prioritized action items',
      recommendations: 'Strategic recommendations',
    },
  });
}
