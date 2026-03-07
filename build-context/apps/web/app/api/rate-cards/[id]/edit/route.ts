import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export const PATCH = async (request: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id } = params;
    const body = await request.json();
    const tenantId = ctx.tenantId;
    
    // Require tenant ID for security - stricter in production
    if (!tenantId) {
      if (process.env.NODE_ENV === 'production') {
        return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
      }
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const {
      clientName,
      clientId,
      isBaseline,
      baselineType,
      isNegotiated,
      negotiationDate,
      negotiatedBy,
      msaReference,
      dailyRate,
      currency,
      roleStandardized,
      seniority,
      country,
      supplierName,
      editedBy,
    } = body;

    // Fetch current rate card - scoped to tenant
    const currentRateCard = await prisma.rateCardEntry.findFirst({
      where: { id, tenantId },
    });

    if (!currentRateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found or access denied', 404);
    }

    if (!currentRateCard.isEditable) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'This rate card is locked and cannot be edited', 403);
    }

    // Build edit history entry
    const editHistoryEntry = {
      timestamp: new Date().toISOString(),
      editedBy: editedBy || 'Unknown',
      changes: Object.keys(body)
        .filter((key) => key !== 'editedBy')
        .map((key) => `${key}: ${(currentRateCard as any)[key]} → ${body[key]}`)
        .join(', '),
    };

    // Get existing edit history
    const existingHistory = (currentRateCard.editHistory as any[]) || [];
    const updatedHistory = [...existingHistory, editHistoryEntry];

    // Update rate card
    const updatedRateCard = await prisma.rateCardEntry.update({
      where: { id },
      data: {
        ...(clientName !== undefined && { clientName }),
        ...(clientId !== undefined && { clientId }),
        ...(isBaseline !== undefined && { isBaseline }),
        ...(baselineType !== undefined && { baselineType }),
        ...(isNegotiated !== undefined && { isNegotiated }),
        ...(negotiationDate !== undefined && { negotiationDate: new Date(negotiationDate) }),
        ...(negotiatedBy !== undefined && { negotiatedBy }),
        ...(msaReference !== undefined && { msaReference }),
        ...(dailyRate !== undefined && { dailyRate }),
        ...(currency !== undefined && { currency }),
        ...(roleStandardized !== undefined && { roleStandardized }),
        ...(seniority !== undefined && { seniority }),
        ...(country !== undefined && { country }),
        ...(supplierName !== undefined && { supplierName }),
        editedBy: editedBy || 'Unknown',
        editedAt: new Date(),
        editHistory: updatedHistory,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: currentRateCard.tenantId,
        userId: editedBy,
        action: 'rate_card_updated',
        resource: id,
        resourceType: 'RateCardEntry',
        details: {
          changes: editHistoryEntry.changes,
          previousValues: {
            clientName: currentRateCard.clientName,
            isBaseline: currentRateCard.isBaseline,
            isNegotiated: currentRateCard.isNegotiated,
            dailyRate: currentRateCard.dailyRate.toString(),
          },
          newValues: {
            clientName,
            isBaseline,
            isNegotiated,
            dailyRate,
          },
        },
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      rateCard: updatedRateCard,
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update rate card', 500);
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const { id } = params;
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const rateCard = await prisma.rateCardEntry.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        contract: {
          select: {
            id: true,
            fileName: true,
            clientName: true,
          },
        },
      },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    return createSuccessResponse(ctx, rateCard);
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch rate card', 500);
  }
}
