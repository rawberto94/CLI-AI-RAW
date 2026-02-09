import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const user = await prisma.user.findUnique({
      where: { email: ctx.userId },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const { id } = params;

    // Verify rate card entry belongs to user's tenant
    const entry = await prisma.rateCardEntry.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!entry || entry.tenantId !== user.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card entry not found', 404);
    }

    // Compare against baselines
    const baselineService = new baselineManagementService(prisma);
    const comparisons = await baselineService.compareAgainstBaselines(id);

    return createSuccessResponse(ctx, { comparisons });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to compare against baselines', 500);
  }
}
