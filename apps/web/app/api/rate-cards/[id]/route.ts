import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardEntryService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext } from '@/lib/api-middleware';

const rateCardService = new rateCardEntryService(prisma);

/**
 * GET /api/rate-cards/[id]
 * Get a single rate card entry by ID
 */
export const GET = async (request: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { id } = params;
    
    // Production mode requires real tenant authentication
    if (process.env.NODE_ENV === 'production' && !ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;

    // Require tenant ID for data isolation
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const entry = await rateCardService.getEntry(id, tenantId);

    return createSuccessResponse(ctx, entry);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found. Please try again.', 404);
  }
}

/**
 * PUT /api/rate-cards/[id]
 * Update a rate card entry
 */
export const PUT = async (request: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { id } = params;
    const body = await request.json();
    
    // Production mode requires authentication
    if (process.env.NODE_ENV === 'production' && !ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;

    // Require tenant ID for data isolation
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Convert date strings to Date objects
    if (body.effectiveDate) {
      body.effectiveDate = new Date(body.effectiveDate);
    }
    if (body.expiryDate) {
      body.expiryDate = new Date(body.expiryDate);
    }

    const entry = await rateCardService.updateEntry(id, body, tenantId);

    return createSuccessResponse(ctx, entry);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to update rate card. Please try again.', 400);
  }
}

/**
 * DELETE /api/rate-cards/[id]
 * Delete a rate card entry
 */
export const DELETE = async (request: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { id } = params;
    
    // Production mode requires authentication
    if (process.env.NODE_ENV === 'production' && !ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;

    // Require tenant ID for data isolation
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    await rateCardService.deleteEntry(id, tenantId);

    return createSuccessResponse(ctx, { message: 'Rate card deleted' });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to delete rate card. Please try again.', 400);
  }
}
