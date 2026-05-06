import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  withContractApiHandler,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { generateRedlineSuggestion } from '@/lib/ai/negotiation-copilot.service';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

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
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  if (!ctx.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID required', 401);
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/contracts/negotiate/redline', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
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

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'negotiation_redline',
      resourceId: contractId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { clauseType: validated.clauseType },
    }).catch(err => logger.error('[Negotiate] Audit log failed:', err));

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
})
