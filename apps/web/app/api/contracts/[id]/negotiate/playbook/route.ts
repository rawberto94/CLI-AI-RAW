import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import {
  generateAndStorePlaybook,
  type NegotiationPlaybook,
} from '@/lib/ai/negotiation-copilot.service';

/**
 * GET /api/contracts/[id]/negotiate/playbook
 * Fetch existing negotiation playbook for a contract
 */
export async function GET(
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
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const artifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId: ctx.tenantId,
        type: 'NEGOTIATION_POINTS' as any,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      return createSuccessResponse(ctx, { playbook: null, negotiationStatus: (contract as any).negotiationStatus || 'DRAFT' });
    }

    return createSuccessResponse(ctx, {
      playbook: artifact.data as unknown as NegotiationPlaybook,
      artifactId: artifact.id,
      generatedAt: artifact.createdAt,
      modelUsed: artifact.modelUsed,
      negotiationStatus: (contract as any).negotiationStatus || 'DRAFT',
      negotiationRound: (contract as any).negotiationRound || 0,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/contracts/[id]/negotiate/playbook
 * Generate a new AI negotiation playbook
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
    const body = await request.json().catch(() => ({}));

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (!contract.rawText) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Contract has no extracted text. Upload and process the contract first.', 422);
    }

    logger.info('Generating negotiation playbook', { contractId, tenantId: ctx.tenantId });

    const playbook = await generateAndStorePlaybook({
      contractId,
      tenantId: ctx.tenantId,
      ourRole: body.ourRole || 'auto',
      negotiationContext: body.negotiationContext,
    });

    // Update contract negotiation status
    const currentNegotiationStatus = (contract as any).negotiationStatus;
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...(currentNegotiationStatus === null ? { negotiationStatus: 'IN_NEGOTIATION', negotiationStartedAt: new Date() } : {}),
      } as any,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'NEGOTIATION_PLAYBOOK_GENERATED',
        resourceType: 'Contract',
        entityType: 'Contract',
        entityId: contractId,
        resource: contractId,
        details: { description: 'Generated AI negotiation playbook' },
        metadata: {
          overallPosition: playbook.overallPosition,
          difficulty: playbook.estimatedNegotiationDifficulty,
          clauseCount: playbook.clauses?.length || 0,
        },
      },
    });

    return createSuccessResponse(ctx, { playbook }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('DeploymentNotFound') || error.message.includes('does not exist'))) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service is not available. Please check Azure OpenAI deployment.', 503);
    }
    return handleApiError(ctx, error);
  }
}
