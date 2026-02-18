import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/obligations/[id]
 * Get a specific obligation by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { id } = await params;

    // Search for obligation in all contracts
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        contractTitle: true,
        metadata: true,
        supplier: { select: { name: true } },
      },
    });

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const obligation = obligations.find(
        (o: unknown) => (o as Record<string, unknown>).id === id
      );

      if (obligation) {
        return createSuccessResponse(ctx, {
          obligation: {
            ...(obligation as Record<string, unknown>),
            contractId: contract.id,
            contractTitle: contract.contractTitle,
            vendorName: contract.supplier?.name,
          },
        });
      }
    }

    return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * PATCH /api/obligations/[id]
 * Update an obligation (status, notes, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes, evidence, completedBy } = body;

    // Find the contract containing this obligation
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        metadata: true,
      },
    });

    let foundContract: { id: string; metadata: unknown } | null = null;
    let obligationIndex = -1;
    let existingObligation: Record<string, unknown> | null = null;

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const idx = obligations.findIndex(
        (o: unknown) => (o as Record<string, unknown>).id === id
      );

      if (idx !== -1) {
        foundContract = contract;
        obligationIndex = idx;
        existingObligation = obligations[idx] as Record<string, unknown>;
        break;
      }
    }

    if (!foundContract || !existingObligation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
    }

    const now = new Date();

    // Build history entry
    const historyEntry = {
      id: crypto.randomUUID(),
      action: status === 'completed' ? 'status_changed' : evidence ? 'evidence_added' : 'updated',
      description: status
        ? `Status changed from ${existingObligation.status} to ${status}${notes ? `: ${notes}` : ''}`
        : notes || 'Obligation updated',
      previousStatus: existingObligation.status,
      newStatus: status || existingObligation.status,
      performedBy: session.user.id,
      performedAt: now.toISOString(),
    };

    // Update obligation
    const updatedObligation: Record<string, unknown> = {
      ...existingObligation,
      ...(status && { status }),
      ...(status === 'completed' && {
        completedAt: now.toISOString(),
        completedBy: completedBy || session.user.id,
        completionNotes: notes,
      }),
      updatedAt: now.toISOString(),
      history: [...((existingObligation.history as unknown[]) || []), historyEntry],
    };

    // Add evidence if provided
    if (evidence && Array.isArray(evidence)) {
      const existingEvidence = (updatedObligation.attachedEvidence as unknown[]) || [];
      const newEvidence = evidence.map((e: Record<string, unknown>) => ({
        ...e,
        id: crypto.randomUUID(),
        uploadedAt: now.toISOString(),
        uploadedBy: session.user.id,
      }));
      updatedObligation.attachedEvidence = [...existingEvidence, ...newEvidence];
    }

    // Update in contract metadata
    const meta = foundContract.metadata as Record<string, unknown> | null;
    const obligations = (meta?.obligations as unknown[]) || [];
    obligations[obligationIndex] = updatedObligation;

    await prisma.contract.update({
      where: { id: foundContract.id },
      data: {
        metadata: JSON.parse(JSON.stringify({
          ...(meta || {}),
          obligations,
        })),
        updatedAt: now,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      obligation: updatedObligation,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/obligations/[id]
 * Delete an obligation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const { id } = await params;

    // Find and remove from contract
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        metadata: true,
      },
    });

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const filteredObligations = obligations.filter(
        (o: unknown) => (o as Record<string, unknown>).id !== id
      );

      if (filteredObligations.length !== obligations.length) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            metadata: JSON.parse(JSON.stringify({
              ...(meta || {}),
              obligations: filteredObligations,
            })),
            updatedAt: new Date(),
          },
        });

        return createSuccessResponse(ctx, {
          success: true,
          message: 'Obligation deleted',
        });
      }
    }

    return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
