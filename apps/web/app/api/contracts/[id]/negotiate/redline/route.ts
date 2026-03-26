import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { generateRedlineSuggestion } from '@/lib/ai/negotiation-copilot.service';

const redlineRequestSchema = z.object({
  clauseText: z.string().min(10, 'Clause text must be at least 10 characters'),
  clauseType: z.string().optional(),
  contractType: z.string().optional(),
  objective: z.string().optional(),
});

/**
 * POST /api/contracts/[id]/negotiate/redline
 * Generate AI redline suggestion for a specific clause
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId },
      select: { id: true, contractType: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const body = await request.json();
    const validated = redlineRequestSchema.parse(body);

    logger.info('Generating redline suggestion', { contractId, clauseType: validated.clauseType });

    const redline = await generateRedlineSuggestion({
      clauseText: validated.clauseText,
      clauseType: validated.clauseType,
      contractType: validated.contractType || contract.contractType || undefined,
      tenantId: ctx.tenantId,
      objective: validated.objective,
    });

    return createSuccessResponse(ctx, { redline });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors[0].message, 422);
    }
    if (error instanceof Error && (error.message.includes('DeploymentNotFound') || error.message.includes('does not exist'))) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service is not available. Please check Azure OpenAI deployment.', 503);
    }
    return handleApiError(ctx, error);
  }
}
