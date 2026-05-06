import { NextRequest } from 'next/server';

import {
  customContractAnalysis,
  getAnalysisTemplates,
  type AnalysisTemplate,
  type ConversationMessage,
} from '@/lib/ai/custom-analysis';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

interface SummarizeRequest {
  includeRisks?: boolean;
  includeFinancials?: boolean;
  includeRecommendations?: boolean;
  language?: 'en' | 'de' | 'fr' | 'it';
}

async function getContractClient() {
  const { dbAdaptor } = await import('data-orchestration');
  return dbAdaptor.getClient().contract;
}

function buildStructuredText(
  items: Array<{ data?: unknown; value?: unknown }> | null | undefined,
) {
  if (!items?.length) {
    return '';
  }

  const textParts: string[] = [];
  for (const item of items) {
    const payload = item.data ?? item.value;
    if (payload && typeof payload === 'object') {
      textParts.push(JSON.stringify(payload, null, 2));
    }
  }

  return textParts.join('\n\n');
}

export async function postContractSummary(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  try {
    const body: SummarizeRequest = await request.json().catch(() => ({}));
    const contractClient = await getContractClient();
    const contract = await contractClient.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        artifacts: {
          select: {
            type: true,
            data: true,
          },
        },
        totalValue: true,
        currency: true,
        effectiveDate: true,
        expirationDate: true,
        aiMetadata: true,
      },
    });

    if (!contract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const contractText = contract.rawText || buildStructuredText(contract.artifacts);
    if (!contractText) {
      return createErrorResponse(
        context,
        'BAD_REQUEST',
        'No contract text available for summarization',
        400,
      );
    }

    const summaryPrompt = `Provide a comprehensive executive summary of this contract. 

Structure your response as JSON with the following format:
{
  "overview": "One paragraph overview",
  "keyPoints": ["point 1", "point 2", ...],
  "parties": [
    {
      "name": "Party Name",
      "role": "Client/Supplier/etc",
      "obligations": ["obligation 1", "obligation 2"]
    }
  ],
  "financials": {
    "totalValue": number or null,
    "currency": "USD/EUR/etc",
    "paymentTerms": "description",
    "penalties": "description"
  },
  "dates": {
    "effectiveDate": "YYYY-MM-DD or null",
    "expirationDate": "YYYY-MM-DD or null",
    "renewalTerms": "description",
    "noticePeriod": "description"
  },
  "risks": {
    "level": "low/medium/high",
    "factors": [
      {
        "title": "Risk title",
        "description": "Risk description",
        "severity": "low/medium/high"
      }
    ]
  },
  "obligations": [
    {
      "party": "Party name",
      "items": ["obligation 1", "obligation 2"]
    }
  ],
  "recommendations": [
    {
      "type": "action/warning/opportunity",
      "title": "Recommendation title",
      "description": "Recommendation description",
      "priority": "low/medium/high"
    }
  ]
}`;

    const analysisResult = await customContractAnalysis({
      prompt: summaryPrompt,
      contractText,
      template: 'summary',
      language: body.language || 'en',
      format: 'json',
    });

    let summary;
    try {
      const jsonMatch = analysisResult.answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        summary = {
          overview: analysisResult.answer,
          keyPoints: analysisResult.keyPoints || [],
          parties: [],
          financials: {
            totalValue: contract.totalValue ? Number(contract.totalValue) : null,
            currency: contract.currency || 'USD',
            paymentTerms: null,
            penalties: null,
          },
          dates: {
            effectiveDate: contract.effectiveDate?.toISOString().split('T')[0] || null,
            expirationDate: contract.expirationDate?.toISOString().split('T')[0] || null,
            renewalTerms: null,
            noticePeriod: null,
          },
          risks: {
            level: 'medium',
            factors: [],
          },
          obligations: [],
          recommendations: [],
        };
      }
    } catch {
      const aiMeta = (contract.aiMetadata as Record<string, any>) || {};
      const externalParties = aiMeta.external_parties || [];
      summary = {
        overview: analysisResult.answer,
        keyPoints: analysisResult.keyPoints || [],
        parties: externalParties.map((party: any) => ({
          name: party.legalName || party.name || 'Unknown',
          role: party.role || 'Party',
          obligations: [],
        })),
        financials: {
          totalValue: contract.totalValue ? Number(contract.totalValue) : null,
          currency: contract.currency || 'USD',
          paymentTerms: null,
          penalties: null,
        },
        dates: {
          effectiveDate: contract.effectiveDate?.toISOString().split('T')[0] || null,
          expirationDate: contract.expirationDate?.toISOString().split('T')[0] || null,
          renewalTerms: null,
          noticePeriod: null,
        },
        risks: {
          level: 'medium',
          factors: [],
        },
        obligations: [],
        recommendations:
          analysisResult.suggestedFollowUps?.map((followUp) => ({
            type: 'action',
            title: followUp,
            description: '',
            priority: 'medium',
          })) || [],
      };
    }

    return createSuccessResponse(context, {
      success: true,
      summary,
      metadata: {
        contractId,
        generatedAt: new Date().toISOString(),
        model: analysisResult.metadata.model,
        tokensUsed: analysisResult.metadata.tokensUsed,
        processingTime: analysisResult.metadata.processingTime,
      },
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}

export async function postContractCustomAnalysis(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  try {
    const body = await request.json();
    const {
      prompt,
      template,
      conversationHistory,
      focusAreas,
      language,
      format,
    } = body;

    if (!prompt && !template) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Either prompt or template is required', 400);
    }

    const contractClient = await getContractClient();
    const contract = await contractClient.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        contractArtifacts: {
          select: {
            type: true,
            value: true,
          },
        },
      },
    });

    if (!contract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const contractText = contract.rawText || buildStructuredText(contract.contractArtifacts);
    if (!contractText) {
      return createErrorResponse(context, 'BAD_REQUEST', 'No contract text available for analysis', 400);
    }

    const result = await customContractAnalysis({
      prompt: prompt || '',
      contractText,
      template: (template as AnalysisTemplate) || 'custom',
      conversationHistory: conversationHistory as ConversationMessage[],
      focusAreas,
      language,
      format,
    });

    return createSuccessResponse(context, {
      success: true,
      contractId,
      contractName: contract.fileName,
      analysis: result,
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}

export async function getContractAnalysisTemplateCatalog(context: ContractApiContext) {
  try {
    const templates = getAnalysisTemplates();

    return createSuccessResponse(context, {
      templates,
      supportedLanguages: ['en', 'de', 'fr', 'it'],
      supportedFormats: ['text', 'json', 'markdown', 'bullet-points'],
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}