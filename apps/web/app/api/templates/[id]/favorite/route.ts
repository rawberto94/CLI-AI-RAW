import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getServerSession } from '@/lib/auth';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

// POST /api/templates/[id]/favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();
    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const { isFavorite } = await request.json();
    
    const userId = session?.user?.id;
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

    return createSuccessResponse(ctx, {
      success: true,
      template: {
        id,
        isFavorite,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
