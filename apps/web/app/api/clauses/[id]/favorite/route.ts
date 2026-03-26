import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

const favoriteSchema = z.object({
  isFavorite: z.boolean({ required_error: 'isFavorite must be a boolean' }),
});

// POST /api/clauses/[id]/favorite - Toggle favorite status
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext & { params: Promise<{ id: string }> }) => {
  const tenantId = ctx.tenantId;
  const { id: clauseId } = await ctx.params;

  if (!clauseId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Clause ID is required', 400);
  }

  const body = await request.json();

  let validated;
  try {
    validated = favoriteSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
    }
    throw error;
  }

  const { isFavorite } = validated;

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
