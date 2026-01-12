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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'

// ============ GET - Fetch all favorites ============
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    // For demo mode, return mock data
    if (!session?.user?.id) {
      return NextResponse.json({
        success: true,
        data: {
          favorites: generateMockFavorites(),
          count: 5
        }
      })
    }
    
    const userId = session.user.id
    
    // Get user preferences with customSettings
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { customSettings: true }
    })
    
    const customSettings = preferences?.customSettings as Record<string, any> | null
    const favoriteIds = customSettings?.favoriteContracts as string[] || []
    
    if (favoriteIds.length === 0) {
      return NextResponse.json({
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
    
    return NextResponse.json({
      success: true,
      data: {
        favorites,
        count: favorites.length
      }
    })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch favorites'
    }, { status: 500 })
  }
}

// ============ POST - Add to favorites ============
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const { contractId } = await request.json()
    
    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: 'Contract ID is required'
      }, { status: 400 })
    }
    
    const userId = session.user.id
    
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
        return NextResponse.json({
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
    
    return NextResponse.json({
      success: true,
      message: 'Added to favorites'
    })
  } catch (error) {
    console.error('Error adding favorite:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add favorite'
    }, { status: 500 })
  }
}

// ============ DELETE - Remove from favorites ============
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contractId')
    
    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: 'Contract ID is required'
      }, { status: 400 })
    }
    
    const userId = session.user.id
    
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    })
    
    if (!preferences) {
      return NextResponse.json({
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
    
    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove favorite'
    }, { status: 500 })
  }
}

// ============ PATCH - Reorder favorites ============
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }
    
    const { orderedIds } = await request.json()
    
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({
        success: false,
        error: 'orderedIds array is required'
      }, { status: 400 })
    }
    
    const userId = session.user.id
    
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
    
    return NextResponse.json({
      success: true,
      message: 'Favorites reordered'
    })
  } catch (error) {
    console.error('Error reordering favorites:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reorder favorites'
    }, { status: 500 })
  }
}

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

function generateMockFavorites() {
  return [
    { id: 'fav-1', name: 'Microsoft Enterprise Agreement', supplier: 'Microsoft', status: 'active', value: 250000, addedAt: new Date() },
    { id: 'fav-2', name: 'AWS Services Contract', supplier: 'Amazon Web Services', status: 'expiring', value: 180000, addedAt: new Date() },
    { id: 'fav-3', name: 'Salesforce Enterprise', supplier: 'Salesforce', status: 'active', value: 120000, addedAt: new Date() },
    { id: 'fav-4', name: 'Google Cloud Platform', supplier: 'Google', status: 'pending', value: 95000, addedAt: new Date() },
    { id: 'fav-5', name: 'Adobe Creative Cloud', supplier: 'Adobe', status: 'active', value: 45000, addedAt: new Date() },
  ]
}
