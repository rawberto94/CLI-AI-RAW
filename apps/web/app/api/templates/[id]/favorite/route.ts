import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getServerSession } from '@/lib/auth';

// POST /api/templates/[id]/favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const { isFavorite } = await request.json();
    
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check template exists
    const template = await prisma.contractTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      template: {
        id,
        isFavorite,
      },
    });
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
