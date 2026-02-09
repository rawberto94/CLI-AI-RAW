import { prisma } from '@/lib/prisma';
import { ObligationStatus, ObligationPriority, Prisma } from '@prisma/client';
import { getServerSession } from '@/lib/auth';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Status mapping
const statusMap: Record<string, ObligationStatus> = {
  pending: 'PENDING',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  overdue: 'OVERDUE',
  at_risk: 'AT_RISK',
  waived: 'WAIVED',
  cancelled: 'CANCELLED',
  disputed: 'DISPUTED',
};

const priorityMap: Record<string, ObligationPriority> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

/**
 * GET /api/obligations/v2/[id]
 * Get a specific obligation
 */
export async function GET(request: Request, { params }: RouteParams) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();

    const { id } = await params;

    const obligation = await prisma.obligation.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        contract: {
          select: {
            id: true,
            contractTitle: true,
            supplier: { select: { name: true } },
            client: { select: { name: true } },
          },
        },
        assignedToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        history: {
          orderBy: { performedAt: 'desc' },
          take: 20,
        },
        notifications: {
          orderBy: { scheduledFor: 'desc' },
          take: 10,
        },
      },
    });

    if (!obligation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
    }

    return createSuccessResponse(ctx, {
      obligation: {
        ...obligation,
        type: obligation.type.toLowerCase(),
        status: obligation.status.toLowerCase(),
        priority: obligation.priority.toLowerCase(),
        owner: obligation.owner.toLowerCase(),
        contractTitle: obligation.contract?.contractTitle,
        vendorName: obligation.contract?.supplier?.name || obligation.contract?.client?.name,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * PATCH /api/obligations/v2/[id]
 * Update an obligation
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();

    const { id } = await params;
    const body = await request.json();

    // Verify obligation exists
    const existing = await prisma.obligation.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
    }

    // Build update data
    const updateData: Prisma.ObligationUpdateInput = {
      updatedBy: session.user.id,
    };

    // Handle status changes
    if (body.status) {
      const newStatus = statusMap[body.status] || body.status as ObligationStatus;
      updateData.status = newStatus;

      // If completing, set completion info
      if (newStatus === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedBy = session.user.id;
        if (body.completionNotes) {
          updateData.completionNotes = body.completionNotes;
        }
      }
    }

    // Handle other field updates
    if (body.priority) {
      updateData.priority = priorityMap[body.priority] || body.priority;
    }
    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.assignedToUserId !== undefined) {
      updateData.assignedToUser = body.assignedToUserId 
        ? { connect: { id: body.assignedToUserId } }
        : { disconnect: true };
    }
    if (body.reminderDays) updateData.reminderDays = body.reminderDays;
    if (body.completionCriteria) updateData.completionCriteria = body.completionCriteria;
    if (body.tags) updateData.tags = body.tags;
    if (body.customFields) updateData.customFields = body.customFields;

    // Handle evidence attachment
    if (body.attachedEvidence) {
      const currentEvidence = existing.attachedEvidence as unknown[] || [];
      updateData.attachedEvidence = [...currentEvidence, ...body.attachedEvidence];
    }

    // Update obligation
    const updated = await prisma.obligation.update({
      where: { id },
      data: updateData,
      include: {
        contract: {
          select: { contractTitle: true },
        },
      },
    });

    // Create history entry
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (body.status && existing.status !== updated.status) {
      changes.status = { from: existing.status, to: updated.status };
    }
    if (body.priority && existing.priority !== updated.priority) {
      changes.priority = { from: existing.priority, to: updated.priority };
    }

    await prisma.obligationHistory.create({
      data: {
        obligationId: id,
        action: body.status === 'completed' ? 'COMPLETED' : 'UPDATED',
        description: body.status === 'completed' 
          ? 'Obligation marked as completed'
          : `Obligation updated: ${Object.keys(changes).join(', ')}`,
        previousValue: Object.keys(changes).length > 0 ? JSON.parse(JSON.stringify(changes)) : undefined,
        performedBy: session.user.id,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      obligation: {
        ...updated,
        type: updated.type.toLowerCase(),
        status: updated.status.toLowerCase(),
        priority: updated.priority.toLowerCase(),
        owner: updated.owner.toLowerCase(),
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/obligations/v2/[id]
 * Delete an obligation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();

    const { id } = await params;

    // Verify obligation exists
    const existing = await prisma.obligation.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
    }

    // Delete obligation (cascades to history and notifications)
    await prisma.obligation.delete({
      where: { id },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Obligation deleted',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
