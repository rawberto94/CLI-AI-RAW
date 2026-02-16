/**
 * Contract Summarization API
 * 
 * POST /api/contracts/[id]/summarize
 * 
 * Generates a comprehensive AI-powered summary of a contract including:
 * - Executive overview
 * - Key points and highlights
 * - Party obligations
 * - Financial terms
 * - Key dates and deadlines
 * - Risk assessment
 * - Recommendations
 */

import { NextRequest } from 'next/server';
import { customContractAnalysis } from '@/lib/ai/custom-analysis';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface SummarizeRequest {
  includeRisks?: boolean;
  includeFinancials?: boolean;
  includeRecommendations?: boolean;
  language?: 'en' | 'de' | 'fr' | 'it';
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const contractId = params.id;

  try {
    const body: SummarizeRequest = await request.json().catch(() => ({}));

    // Fetch contract
    const { dbAdaptor } = await import('data-orchestration');
    const contract = await dbAdaptor.getClient().contract.findUnique({
      where: { id: contractId },
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
        // Get related data for summary
        totalValue: true,
        currency: true,
        effectiveDate: true,
        expirationDate: true,
        aiMetadata: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get contract text
    let contractText = contract.rawText || '';
    
    if (!contractText && contract.artifacts) {
      const textParts: string[] = [];
      for (const artifact of contract.artifacts) {
        if (artifact.data && typeof artifact.data === 'object') {
          textParts.push(JSON.stringify(artifact.data, null, 2));
        }
      }
      contractText = textParts.join('\n\n');
    }

    if (!contractText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No contract text available for summarization', 400);
    }

    // Generate comprehensive summary using AI
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

    // Parse the AI response
    let summary;
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisResult.answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, structure the text response
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
      // Fallback to structured data from contract
      const aiMeta = contract.aiMetadata as Record<string, any> || {};
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
        recommendations: analysisResult.suggestedFollowUps?.map(followUp => ({
          type: 'action',
          title: followUp,
          description: '',
          priority: 'medium',
        })) || [],
      };
    }

    return createSuccessResponse(ctx, {
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

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
