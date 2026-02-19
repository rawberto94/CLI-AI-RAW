import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/favorite
 * Toggle favorite status for a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = ctx.tenantId
    const userId = ctx.userId
    const { id: contractId } = await params
    
    const body = await request.json()
    const { favorite } = body
    
    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { 
        id: contractId, 
        tenantId,
        isDeleted: false 
      },
      select: { id: true }
    })
    
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    // Get or create user preferences
    let userPrefs = await prisma.userPreferences.findUnique({
      where: { userId }
    })
    
    if (!userPrefs) {
      // Create user preferences with minimal required data
      userPrefs = await prisma.userPreferences.create({
        data: {
          user: { connect: { id: userId } }
        }
      })
    }
    
    // Parse existing custom settings
    const customSettings = (userPrefs.customSettings as Record<string, unknown>) || {}
    const favoriteContracts = (customSettings.favoriteContracts as string[]) || []
    
    // Toggle favorite
    let updatedFavorites: string[]
    if (favorite) {
      // Add to favorites if not already there
      if (!favoriteContracts.includes(contractId)) {
        updatedFavorites = [...favoriteContracts, contractId]
      } else {
        updatedFavorites = favoriteContracts
      }
    } else {
      // Remove from favorites
      updatedFavorites = favoriteContracts.filter(id => id !== contractId)
    }
    
    // Update user preferences
    await prisma.userPreferences.update({
      where: { userId },
      data: {
        customSettings: {
          ...customSettings,
          favoriteContracts: updatedFavorites
        }
      }
    })
    
    // Log activity
    await prisma.contractActivity.create({
      data: {
        contractId,
        tenantId,
        userId,
        type: 'favorite',
        action: favorite ? 'Contract added to favorites' : 'Contract removed from favorites',
        metadata: {}
      }
    })
    
    return createSuccessResponse(ctx, {
      success: true,
      favorite,
      message: favorite ? 'Contract added to favorites' : 'Contract removed from favorites'
    });
    
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/contracts/[id]/favorite
 * Check if a contract is favorited by the current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const userId = ctx.userId
    const { id: contractId } = await params
    
    // Get user preferences
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { customSettings: true }
    })
    
    if (!userPrefs) {
      return createSuccessResponse(ctx, { favorite: false });
    }
    
    const customSettings = (userPrefs.customSettings as Record<string, unknown>) || {}
    const favoriteContracts = (customSettings.favoriteContracts as string[]) || []
    
    return createSuccessResponse(ctx, {
      favorite: favoriteContracts.includes(contractId)
    });
    
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
