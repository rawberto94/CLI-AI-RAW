import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardEntryService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext } from '@/lib/api-middleware';

const rateCardService = new rateCardEntryService(prisma);

/**
 * GET /api/rate-cards/[id]
 * Get a single rate card entry by ID
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params;
  const tenantId = ctx.tenantId;

  const entry = await rateCardService.getEntry(id, tenantId);

  return createSuccessResponse(ctx, entry);
});

/**
 * PUT /api/rate-cards/[id]
 * Update a rate card entry
 */
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params;
  const tenantId = ctx.tenantId;
  const body = await request.json();

  // Convert date strings to Date objects
  if (body.effectiveDate) {
    body.effectiveDate = new Date(body.effectiveDate);
  }
  if (body.expiryDate) {
    body.expiryDate = new Date(body.expiryDate);
  }

  const entry = await rateCardService.updateEntry(id, body, tenantId);

  return createSuccessResponse(ctx, entry);
});

/**
 * DELETE /api/rate-cards/[id]
 * Delete a rate card entry
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params;
  const tenantId = ctx.tenantId;

  await rateCardService.deleteEntry(id, tenantId);

  return createSuccessResponse(ctx, { message: 'Rate card deleted' });
});
