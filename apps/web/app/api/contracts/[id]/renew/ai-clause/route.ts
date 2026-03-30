/**
 * AI Clause Generation API
 *
 * POST /api/contracts/[id]/renew/ai-clause
 *
 * Generates or improves individual clause text using LLM.
 * Called when user clicks "Generate with AI" on a specific clause.
 */

import { NextRequest } from 'next/server';
import { getAIModel } from '@/lib/ai/ai-sdk-provider';
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

const RequestSchema = z.object({
  action: z.enum(['improve', 'generate', 'simplify', 'strengthen']),
  clauseTitle: z.string(),
  currentContent: z.string().optional(),
  context: z.string().optional().describe('Additional context such as industry, jurisdiction, etc.'),
});

const GeneratedClauseSchema = z.object({
  title: z.string(),
  content: z.string().describe('The full clause text, production-ready'),
  changesSummary: z.string().describe('Brief explanation of what was changed/generated and why'),
  riskLevel: z.enum(['low', 'medium', 'high']),
  legalNotes: z.array(z.string()).describe('Important legal considerations for this clause'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/contracts/renew/ai-clause', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const { id: contractId } = await params;
    const body = await request.json();
    const input = RequestSchema.parse(body);

    // Fetch contract for context
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId, isDeleted: false },
      select: {
        contractTitle: true,
        contractType: true,
        supplierName: true,
        clientName: true,
      },
    });

    const contractContext = contract
      ? `Contract: "${contract.contractTitle}" (${contract.contractType || 'General'}), between ${contract.clientName || 'Client'} and ${contract.supplierName || 'Supplier'}`
      : '';

    const actionPrompts: Record<string, string> = {
      improve: `Improve the following clause for a contract renewal. Make it more precise, reduce ambiguity, and ensure it protects both parties fairly. Maintain the original intent.`,
      generate: `Generate a professional, legally-sound clause for a contract renewal. The clause should be comprehensive and enterprise-grade.`,
      simplify: `Simplify the following clause while preserving its legal effect. Use plain language that non-lawyers can understand. Keep all critical protections.`,
      strengthen: `Strengthen the following clause to provide better protection. Add specific remedies, tighter timelines, and clearer obligations. Make it more enforceable.`,
    };

    const { object: result } = await generateObject({
      model: getAIModel(),
      schema: GeneratedClauseSchema,
      prompt: `You are an expert contract attorney specializing in enterprise procurement.

${actionPrompts[input.action]}

${contractContext}
${input.context ? `Additional context: ${input.context}` : ''}

Clause Title: "${input.clauseTitle}"
${input.currentContent ? `Current Content:\n${input.currentContent}` : '(No existing content — generate from scratch)'}

Generate production-ready clause text. Be specific with timelines, obligations, and remedies. Do not use placeholder brackets like [X days] — use reasonable defaults.`,
      temperature: 0.2,
    });

    logger.info('AI clause generated', { contractId, action: input.action, clause: input.clauseTitle });

    return createSuccessResponse(ctx, { clause: result });
  } catch (err) {
    logger.error('AI clause generation failed', { error: err instanceof Error ? err.message : String(err) });

    if (err instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request body', 400);
    }

    const errorMessage = err instanceof Error ? err.message : '';
    if (errorMessage.includes('API key') || errorMessage.includes('quota')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service temporarily unavailable', 503, { retryable: true });
    }

    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate clause', 500, { retryable: true });
  }
}
