import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { id } = params;

    // Verify contract belongs to caller's tenant before returning rate cards
    const tenantId = ctx.tenantId;
    const contract = await prisma.contract.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get all rate cards for this contract
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        contractId: id,
      },
      include: {
        supplier: true,
        benchmarkSnapshots: {
          take: 1,
          orderBy: {
            snapshotDate: 'desc',
          },
        },
      },
      orderBy: {
        dailyRateUSD: 'desc',
      },
    });

    // Calculate summary statistics
    const summary = {
      total: rateCards.length,
      avgRate: rateCards.length > 0
        ? rateCards.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) / rateCards.length
        : 0,
      minRate: rateCards.length > 0
        ? Math.min(...rateCards.map(r => Number(r.dailyRateUSD)))
        : 0,
      maxRate: rateCards.length > 0
        ? Math.max(...rateCards.map(r => Number(r.dailyRateUSD)))
        : 0,
      roles: [...new Set(rateCards.map(r => r.roleStandardized))].length,
      suppliers: [...new Set(rateCards.map(r => r.supplierName))].length,
    };

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        rateCards,
        summary,
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
