import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

/** Rate card entry update data structure */
interface RateCardUpdateData {
  clientName?: string;
  clientId?: string | null;
  isBaseline?: boolean;
  baselineType?: string;
  isNegotiated?: boolean;
  negotiationDate?: Date;
  negotiatedBy?: string;
  msaReference?: string;
  editedBy?: string;
  editedAt?: Date;
}

/**
 * POST /api/rate-cards/bulk-update
 * Bulk update rate card entries
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const { ids, updates, userId = 'system' } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid or empty ids array', 400);
    }

    if (!updates || typeof updates !== 'object') {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid updates object', 400);
    }

    // Prepare update data
    const updateData: RateCardUpdateData = {};
    
    if (updates.clientName !== undefined) {
      updateData.clientName = updates.clientName;
      updateData.clientId = updates.clientId || null;
    }
    
    if (updates.isBaseline !== undefined) {
      updateData.isBaseline = updates.isBaseline;
      if (updates.isBaseline && updates.baselineType) {
        updateData.baselineType = updates.baselineType;
      }
    }
    
    if (updates.isNegotiated !== undefined) {
      updateData.isNegotiated = updates.isNegotiated;
      if (updates.isNegotiated) {
        if (updates.negotiationDate) {
          updateData.negotiationDate = new Date(updates.negotiationDate);
        }
        if (updates.negotiatedBy) {
          updateData.negotiatedBy = updates.negotiatedBy;
        }
        if (updates.msaReference) {
          updateData.msaReference = updates.msaReference;
        }
      }
    }

    // Add edit tracking
    updateData.editedBy = userId;
    updateData.editedAt = new Date();

    // Perform bulk update
    const result = await prisma.rateCardEntry.updateMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      data: updateData,
    });

    // Create audit log entries
    await Promise.all(
      ids.map((id) =>
        prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'BULK_UPDATE',
            entityType: 'RateCardEntry',
            entityId: id,
            changes: updates,
          },
        }).catch(() => {
          // Don't fail the whole operation if audit log fails
        })
      )
    );

    // Emit events for each updated rate card
    if (result.count > 0) {
      const { rateCardEvents } = await import('@/../../packages/data-orchestration/src/services/event-integration.helper');
      // For bulk updates, emit a single imported event to trigger cache invalidation
      await rateCardEvents.imported(result.count, tenantId, 'BULK_UPDATE');
    }

    return createSuccessResponse(ctx, {
      success: true,
      updatedCount: result.count,
      message: `Successfully updated ${result.count} rate card(s)`,
    });
  });
