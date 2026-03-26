import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createErrorResponse,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import {
  streamNegotiationAdvice,
  type NegotiationPlaybook,
} from '@/lib/ai/negotiation-copilot.service';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

const adviceRequestSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  contractText: z.string().optional(),
});

/**
 * POST /api/contracts/[id]/negotiate/advice
 * Stream real-time negotiation advice (SSE)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/contracts/negotiate/advice', AI_RATE_LIMITS.streaming);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId },
      select: { id: true, rawText: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    await auditLog({
      action: AuditAction.CONTRACT_VIEWED,
      resourceType: 'negotiation_advice',
      resourceId: contractId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    }).catch(err => logger.error('[Negotiate] Audit log failed:', err));

    const body = await request.json();
    const validated = adviceRequestSchema.parse(body);

    // Fetch existing playbook for context
    const playbookArtifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId: ctx.tenantId,
        type: 'NEGOTIATION_POINTS' as any,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      select: { data: true },
    });

    const playbook = playbookArtifact?.data as unknown as NegotiationPlaybook | undefined;

    logger.info('Streaming negotiation advice', { contractId, hasPlaybook: !!playbook });

    const result = await streamNegotiationAdvice({
      question: validated.question,
      contractId,
      tenantId: ctx.tenantId,
      contractText: validated.contractText || contract.rawText || undefined,
      playbook: playbook || undefined,
    });

    // Convert to SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors[0].message, 422);
    }
    if (error instanceof Error && (error.message.includes('DeploymentNotFound') || error.message.includes('does not exist'))) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service is not available.', 503);
    }
    const apiCtx = ctx;
    logger.error('Negotiation advice error', error instanceof Error ? error : undefined);
    return createErrorResponse(apiCtx, 'INTERNAL_ERROR', 'Failed to generate negotiation advice', 500);
  }
}
