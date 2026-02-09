import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/comparisons/[id]
 * Get a specific comparison
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    const comparison = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      include: {
        targetRate: true,
      },
    });

    if (!comparison) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    return createSuccessResponse(ctx, { comparison });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch comparison: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

/**
 * PATCH /api/rate-cards/comparisons/[id]
 * Update a comparison
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    const body = await request.json();
    const { name, description, isShared } = body;

    const comparison = await prisma.rateComparison.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isShared !== undefined && { isShared }),
      },
      include: {
        targetRate: true,
      },
    });

    return createSuccessResponse(ctx, { comparison });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update comparison: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

/**
 * DELETE /api/rate-cards/comparisons/[id]
 * Delete a comparison
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    await prisma.rateComparison.delete({
      where: { id: existing.id },
    });

    return createSuccessResponse(ctx, { success: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to delete comparison: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}
