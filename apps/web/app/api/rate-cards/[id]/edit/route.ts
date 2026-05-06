import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
    const { id } = await (ctx as any).params;
    const body = await request.json();
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
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
      editedBy: userId,
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
        editedBy: userId,
        editedAt: new Date(),
        editHistory: updatedHistory,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: currentRateCard.tenantId,
        userId,
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
});

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
    const { id } = await (ctx as any).params;
    const tenantId = ctx.tenantId;

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
});
