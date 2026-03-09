/**
 * AI Extension Recommendation API
 *
 * POST /api/contracts/[id]/extend/ai-recommend
 *
 * AI-powered recommendation for contract extension:
 * - Suggests optimal extension duration based on contract history
 * - Estimates value adjustment for extended period
 * - Flags risks of extending vs. renewing
 */

import { NextRequest } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { logger } from '@/lib/logger';

const RecommendationSchema = z.object({
  recommendedAction: z.enum(['extend', 'renew', 'renegotiate']),
  reasoning: z.string(),
  suggestedExtensionMonths: z.number().optional(),
  suggestedNewExpiration: z.string().optional(),
  valueRecommendation: z.object({
    adjustValue: z.boolean(),
    suggestedValue: z.number().optional(),
    adjustmentReason: z.string(),
  }),
  risks: z.array(z.object({
    risk: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
  advantages: z.array(z.string()),
  complianceNotes: z.array(z.string()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/contracts/extend/ai-recommend', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId, isDeleted: false },
      select: {
        contractTitle: true,
        contractType: true,
        totalValue: true,
        currency: true,
        effectiveDate: true,
        expirationDate: true,
        autoRenewalEnabled: true,
        noticePeriodDays: true,
        renewalStatus: true,
        status: true,
        supplierName: true,
        clientName: true,
        childContracts: {
          where: { relationshipType: 'RENEWAL' },
          select: { id: true },
        },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const daysRemaining = contract.expirationDate
      ? Math.ceil((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const contractAge = contract.effectiveDate
      ? Math.ceil((Date.now() - new Date(contract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

    const { object: recommendation } = await generateObject({
      model: openai('gpt-4o-mini') as any,
      schema: RecommendationSchema,
      prompt: `You are an expert contract manager. Recommend whether to extend, renew, or renegotiate this contract.

Contract: "${contract.contractTitle}"
Type: ${contract.contractType || 'General'}
Supplier: ${contract.supplierName || 'Unknown'}
Client: ${contract.clientName || 'Unknown'}
Value: ${contract.currency || 'USD'} ${contract.totalValue ?? 'N/A'}
Effective: ${contract.effectiveDate ? new Date(contract.effectiveDate).toISOString().split('T')[0] : 'N/A'}
Expiration: ${contract.expirationDate ? new Date(contract.expirationDate).toISOString().split('T')[0] : 'N/A'}
Days remaining: ${daysRemaining ?? 'N/A'}
Contract age: ${contractAge ?? 'N/A'} months
Auto-renewal: ${contract.autoRenewalEnabled ? 'Yes' : 'No'}
Notice period: ${contract.noticePeriodDays ?? 'N/A'} days
Has existing renewals: ${contract.childContracts.length > 0 ? 'Yes' : 'No'}
Current status: ${contract.status}

Provide a recommendation considering:
- Whether extension (same terms, longer date) or full renewal (renegotiate terms) is better
- Optimal extension duration if extending
- Whether value needs adjustment for the extended period
- Compliance and risk considerations
- Market conditions (assume typical enterprise procurement)`,
      temperature: 0.3,
    });

    logger.info('AI extension recommendation generated', { contractId, action: recommendation.recommendedAction });

    return createSuccessResponse(ctx, { recommendation });
  } catch (err) {
    logger.error('AI extension recommendation failed', { error: err instanceof Error ? err.message : String(err) });

    const errorMessage = err instanceof Error ? err.message : '';
    if (errorMessage.includes('API key') || errorMessage.includes('quota')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service temporarily unavailable', 503, { retryable: true });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate recommendation', 500, { retryable: true });
  }
}
