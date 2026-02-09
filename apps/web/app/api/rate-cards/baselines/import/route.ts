import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    // Mock user for now - in production, get from session
    const mockTenantId = 'tenant-1';

    const body = await request.json();
    const { baselines, options } = body;

    if (!baselines || !Array.isArray(baselines)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request: baselines array is required', 400);
    }

    const baselineService = new baselineManagementService(prisma);

    const result = await baselineService.importBaselines(
      mockTenantId,
      baselines,
      {
        updateExisting: options?.updateExisting ?? true,
        batchSize: options?.batchSize ?? 100,
        autoApprove: options?.autoApprove ?? false,
      }
    );

    return createSuccessResponse(ctx, result);
  });
