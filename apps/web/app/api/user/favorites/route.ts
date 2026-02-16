import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
/**
 * Favorite Contracts API Routes
 * 
 * POST /api/user/favorites - Add a contract to favorites
 * DELETE /api/user/favorites - Remove a contract from favorites
 * GET /api/user/favorites - Get all favorite contracts
 * PATCH /api/user/favorites - Reorder favorites
 * 
 * Note: Uses customSettings JSON field in UserPreferences to store favorites
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditTrailService } from 'data-orchestration/services';

// ============ GET - Fetch all favorites ============
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  // For demo mode, return mock data
  const userId = ctx.userId

  // Get user preferences with customSettings
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { customSettings: true }
  })

  const customSettings = preferences?.customSettings as Record<string, any> | null
  const favoriteIds = customSettings?.favoriteContracts as string[] || []

  if (favoriteIds.length === 0) {
    return createSuccessResponse(ctx, {
      success: true,
      data: { favorites: [], count: 0 }
    })
  }

  // Fetch contract details
  const contracts = await prisma.contract.findMany({
    where: {
      id: { in: favoriteIds },
      isDeleted: false,
    },
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      supplierName: true,
      status: true,
      totalValue: true,
      expirationDate: true,
      lastViewedAt: true,
      createdAt: true,
    }
  })

  // Map to favorites format, preserving order
  const favorites = favoriteIds
    .map(id => contracts.find(c => c.id === id))
    .filter(Boolean)
    .map(c => ({
      id: c!.id,
      name: c!.contractTitle || c!.fileName || 'Untitled Contract',
      supplier: c!.supplierName,
      status: mapContractStatus(c!.status),
      value: c!.totalValue ? Number(c!.totalValue) : undefined,
      expirationDate: c!.expirationDate,
      lastViewed: c!.lastViewedAt,
      addedAt: c!.createdAt,
    }))

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      favorites,
      count: favorites.length
    }
  })
});

// ============ POST - Add to favorites ============
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { contractId } = await request.json()

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400)
  }

  const userId = ctx.userId

  // Get or create user preferences
  let preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  })

  if (!preferences) {
    preferences = await prisma.userPreferences.create({
      data: {
        userId,
        customSettings: { favoriteContracts: [contractId] }
      }
    })
  } else {
    const customSettings = preferences.customSettings as Record<string, any> || {}
    const currentFavorites = customSettings.favoriteContracts as string[] || []

    // Check if already favorited
    if (currentFavorites.includes(contractId)) {
      return createSuccessResponse(ctx, {
        success: true,
        message: 'Already in favorites'
      })
    }

    // Add to favorites (at the beginning)
    await prisma.userPreferences.update({
      where: { userId },
      data: {
        customSettings: {
          ...customSettings,
          favoriteContracts: [contractId, ...currentFavorites]
        }
      }
    })
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Added to favorites'
  })
});

// ============ DELETE - Remove from favorites ============
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url)
  const contractId = searchParams.get('contractId')

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400)
  }

  const userId = ctx.userId

  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  })

  if (!preferences) {
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Not in favorites'
    })
  }

  const customSettings = preferences.customSettings as Record<string, any> || {}
  const currentFavorites = customSettings.favoriteContracts as string[] || []
  const updatedFavorites = currentFavorites.filter(id => id !== contractId)

  await prisma.userPreferences.update({
    where: { userId },
    data: {
      customSettings: {
        ...customSettings,
        favoriteContracts: updatedFavorites
      }
    }
  })

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Removed from favorites'
  })
});

// ============ PATCH - Reorder favorites ============
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { orderedIds } = await request.json()

  if (!Array.isArray(orderedIds)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'orderedIds array is required', 400)
  }

  const userId = ctx.userId

  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  })

  const customSettings = preferences?.customSettings as Record<string, any> || {}

  await prisma.userPreferences.update({
    where: { userId },
    data: {
      customSettings: {
        ...customSettings,
        favoriteContracts: orderedIds
      }
    }
  })

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Favorites reordered'
  })
});

// ============ HELPERS ============

function mapContractStatus(status: string): 'active' | 'pending' | 'expiring' | 'expired' | 'draft' {
  switch (status) {
    case 'ACTIVE':
      return 'active'
    case 'PENDING':
    case 'PROCESSING':
      return 'pending'
    case 'EXPIRING':
      return 'expiring'
    case 'EXPIRED':
      return 'expired'
    case 'DRAFT':
      return 'draft'
    default:
      return 'active'
  }
}
