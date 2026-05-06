import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

// POST /api/templates/[id]/favorite - Toggle favorite status
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/favorite', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const tenantId = ctx.tenantId;
  const { id } = await (ctx as any).params as { id: string };
  const { isFavorite } = await request.json();
  
  const userId = ctx.userId;
  if (!userId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  // Check template exists
  const template = await prisma.contractTemplate.findFirst({
    where: { id, tenantId },
  });

  if (!template) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
  }

  // Store favorite in user preferences (or template metadata)
  // Update the template metadata with user's favorite status
  const existingMetadata = (template.metadata as Record<string, unknown>) || {};
  const favorites = (existingMetadata.favorites as string[]) || [];
  
  let updatedFavorites: string[];
  if (isFavorite) {
    // Add user to favorites if not already there
    updatedFavorites = favorites.includes(userId) ? favorites : [...favorites, userId];
  } else {
    // Remove user from favorites
    updatedFavorites = favorites.filter(f => f !== userId);
  }

  await prisma.contractTemplate.update({
    where: { id },
    data: {
      metadata: {
        ...existingMetadata,
        favorites: updatedFavorites,
      },
    },
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'template',
    resourceId: id,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    metadata: { operation: isFavorite ? 'favorite' : 'unfavorite' },
  }).catch(err => logger.error('[Template] Audit log failed', err));

  return createSuccessResponse(ctx, {
    success: true,
    template: {
      id,
      isFavorite,
    },
  });
})
