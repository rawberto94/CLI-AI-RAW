import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'

/**
 * POST /api/contracts/[id]/favorite
 * Toggle favorite status for a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenantId = session.user.tenantId
    const userId = session.user.id
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
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
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
    
    return NextResponse.json({
      success: true,
      favorite,
      message: favorite ? 'Contract added to favorites' : 'Contract removed from favorites'
    })
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to update favorite status' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/contracts/[id]/favorite
 * Check if a contract is favorited by the current user
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const { id: contractId } = await params
    
    // Get user preferences
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { customSettings: true }
    })
    
    if (!userPrefs) {
      return NextResponse.json({ favorite: false })
    }
    
    const customSettings = (userPrefs.customSettings as Record<string, unknown>) || {}
    const favoriteContracts = (customSettings.favoriteContracts as string[]) || []
    
    return NextResponse.json({
      favorite: favoriteContracts.includes(contractId)
    })
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to check favorite status' },
      { status: 500 }
    )
  }
}
