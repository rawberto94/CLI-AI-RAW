import OpenAI from 'openai';
import {
  createOpenAIClient,
  getOpenAIApiKey,
  hasAIClientConfig,
} from '@/lib/openai-client';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

let openAIClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openAIClient) {
    const key = getOpenAIApiKey();
    if (!key) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openAIClient = createOpenAIClient(key);
  }

  return openAIClient;
}

const openai = new Proxy({} as OpenAI, {
  get: (_target, prop) => (getOpenAI() as any)[prop],
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

interface PortfolioStats {
  totalValue: number;
  averageValue: number;
  riskDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

function calculatePortfolioStats(contracts: ContractSummary[]): PortfolioStats {
  const totalValue = contracts.reduce((sum, contract) => sum + (contract.totalValue || 0), 0);
  const averageValue = contracts.length > 0 ? totalValue / contracts.length : 0;
  const riskDistribution: Record<string, number> = {};
  const statusDistribution: Record<string, number> = {};

  for (const contract of contracts) {
    const risk = contract.riskLevel || 'unknown';
    riskDistribution[risk] = (riskDistribution[risk] || 0) + 1;

    const status = contract.status || 'unknown';
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  }

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
  _reportType: string,
): Promise<Partial<AIReportResult>> {
  const contractList = contracts
    .map(
      (contract) => `
Contract: ${contract.fileName}
Status: ${contract.status}
Value: $${(contract.totalValue || 0).toLocaleString()}
Risk: ${contract.riskLevel || 'Not assessed'}
Expires: ${contract.expirationDate ? new Date(contract.expirationDate).toLocaleDateString() : 'N/A'}
Content Preview: ${contract.textExcerpt.slice(0, 500)}...
---`,
    )
    .join('\n');

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
          content:
            'You are an expert contract portfolio analyst. Provide thorough, actionable insights in valid JSON format.',
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

export async function postContractAiReport(
  request: Request,
  context: ContractApiContext,
) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractIds, reportType = 'comprehensive' } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'contractIds array is required', 400);
    }

    if (contractIds.length > 20) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Maximum 20 contracts per report', 400);
    }

    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId: context.tenantId,
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
      return createErrorResponse(context, 'NOT_FOUND', 'No contracts found', 404);
    }

    const contractSummaries: ContractSummary[] = contracts.map((contract) => ({
      id: contract.id,
      fileName: contract.contractTitle || contract.fileName,
      status: contract.status,
      totalValue: contract.totalValue ? Number(contract.totalValue) : null,
      riskLevel: contract.expirationRisk,
      expirationDate: contract.expirationDate,
      textExcerpt: contract.rawText?.slice(0, 1500) || 'No text available',
    }));

    if (!hasAIClientConfig()) {
      return createErrorResponse(
        context,
        'SERVICE_UNAVAILABLE',
        'AI service not configured. Set OPENAI_API_KEY environment variable.',
        503,
      );
    }

    const portfolioStats = calculatePortfolioStats(contractSummaries);
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

    return createSuccessResponse(context, {
      processingTime,
      report: result,
    });
  } catch {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Report generation failed', 500);
  }
}

export async function getContractAiReportDescriptor(context: ContractApiContext) {
  return createSuccessResponse(context, {
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