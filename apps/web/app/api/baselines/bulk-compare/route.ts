/**
 * POST /api/baselines/bulk-compare
 * 
 * Compare all rate card entries against baselines
 */

import { NextRequest } from 'next/server';
import { baselineManagementService } from 'data-orchestration/services';
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant-server";
import { getServerSession } from '@/lib/auth';
import { getApiContext, createSuccessResponse, handleApiError, createErrorResponse, createValidationErrorResponse } from '@/lib/api-middleware';
import { z } from 'zod';

const bulkCompareSchema = z.object({
  minVariancePercentage: z.number().min(0).max(100).default(5),
  baselineTypes: z.array(z.string()).optional(),
  categoryL1: z.string().optional(),
  categoryL2: z.string().optional(),
});

// Using singleton prisma instance from @/lib/prisma

export async function POST(req: NextRequest) {
  const ctx = getApiContext(req);
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const tenantId = await getServerTenantId();
    const body = await req.json();

    const parsed = bulkCompareSchema.safeParse(body);
    if (!parsed.success) {
      return createValidationErrorResponse(ctx, parsed.error);
    }

    const {
      minVariancePercentage,
      baselineTypes,
      categoryL1,
      categoryL2,
    } = parsed.data;

    const service = new baselineManagementService(prisma);
    const result = await service.bulkCompareAgainstBaselines(tenantId, {
      minVariancePercentage,
      baselineTypes,
      categoryL1,
      categoryL2,
    });

    return createSuccessResponse(ctx, result);
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
