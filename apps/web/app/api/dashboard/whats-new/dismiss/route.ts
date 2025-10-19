import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// POST /api/dashboard/whats-new/dismiss - Dismiss a what's new item
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    if (!body.itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    // Get current dismissed items
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const dismissedItems = (preferences?.dismissedWhatsNew as string[]) || []

    // Add new dismissed item if not already dismissed
    if (!dismissedItems.includes(body.itemId)) {
      dismissedItems.push(body.itemId)

      // Update preferences
      await prisma.userPreferences.upsert({
        where: { userId },
        update: {
          dismissedWhatsNew: dismissedItems,
          updatedAt: new Date()
        },
        create: {
          userId,
          dismissedWhatsNew: dismissedItems
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Item dismissed successfully'
    })
  } catch (error) {
    console.error('Dismiss what\'s new item error:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss item' },
      { status: 500 }
    )
  }
}
