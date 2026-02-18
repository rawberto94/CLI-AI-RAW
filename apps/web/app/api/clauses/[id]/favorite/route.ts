import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

// POST /api/clauses/[id]/favorite - Toggle favorite status
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext & { params: Promise<{ id: string }> }) => {
  const tenantId = ctx.tenantId;
  const { id: clauseId } = await ctx.params;

  if (!clauseId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Clause ID is required', 400);
  }

  const { isFavorite } = await request.json();

  // Verify clause belongs to tenant
  const clause = await prisma.clauseLibrary.findFirst({
    where: { id: clauseId, tenantId },
  });

  if (!clause) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Clause not found', 404);
  }

  // Update favorite status via tags field
  const currentTags = (clause.tags && typeof clause.tags === 'object') ? clause.tags as Record<string, unknown> : {};
  await prisma.clauseLibrary.update({
    where: { id: clause.id },
    data: {
      tags: {
        ...currentTags,
        isFavorite: !!isFavorite,
        favoritedAt: isFavorite ? new Date().toISOString() : null,
      },
      updatedAt: new Date(),
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    clause: {
      id: clauseId,
      isFavorite: !!isFavorite,
    },
    source: 'database',
  });
});
