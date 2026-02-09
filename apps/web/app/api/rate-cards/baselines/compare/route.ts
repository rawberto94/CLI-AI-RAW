import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const user = await prisma.user.findFirst({
      where: { 
        email: ctx.userId,
        tenantId: ctx.tenantId 
      },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const body = await request.json();
    const {
      minVariancePercentage = 5,
      baselineTypes,
      categoryL1,
      categoryL2,
    } = body;

    const baselineService = new baselineManagementService(prisma);
    const result = await baselineService.bulkCompareAgainstBaselines(
      user.tenantId,
      {
        minVariancePercentage,
        baselineTypes,
        categoryL1,
        categoryL2,
      }
    );

    return createSuccessResponse(ctx, result);
  });
