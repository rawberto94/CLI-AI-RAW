import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supplierBenchmarkService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const roleCategory = searchParams.get('roleCategory') || undefined;
    const country = searchParams.get('country') || undefined;
    const lineOfService = searchParams.get('lineOfService') || undefined;

    const benchmarkService = new supplierBenchmarkService(prisma);

    const bestValue = await benchmarkService.findBestValueSuppliers(
      ctx.tenantId,
      {
        roleCategory,
        country,
        lineOfService,
      }
    );

    return createSuccessResponse(ctx, { suppliers: bestValue });
  });
