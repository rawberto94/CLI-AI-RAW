/**
 * AI Report Generation API
 * 
 * POST /api/contracts/ai-report - Generate comprehensive AI report for multiple contracts
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getServerTenantId } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = createOpenAIClient(key);
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

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

export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractIds, reportType = 'comprehensive' } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractIds array is required', 400);
    }

    if (contractIds.length > 20) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 20 contracts per report', 400);
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'No contracts found', 404);
    }

    // Prepare contract summaries for AI analysis
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
    if (!hasAIClientConfig()) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service not configured. Set OPENAI_API_KEY environment variable.', 503);
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

    return createSuccessResponse(ctx, {
      processingTime,
      report: result,
    });

  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Report generation failed', 500);
  }
});

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
  _reportType: string
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
  } catch {
    throw new Error('Failed to generate AI analysis');
  }
}

export const GET = withAuthApiHandler(async (_request, ctx) => {
  return createSuccessResponse(ctx, {
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
});
