import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getQuickActionsForRole, UserRole } from '@/lib/dashboard/default-layouts'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// GET /api/dashboard/quick-actions - Get user's quick actions
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const role = (preferences?.role as UserRole) || 'analyst'
    const customActions = preferences?.quickActions

    // Return custom actions if exists, otherwise default for role
    const actions = customActions || getQuickActionsForRole(role)

    return NextResponse.json({
      success: true,
      data: actions
    })
  } catch (error) {
    console.error('Get quick actions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick actions' },
      { status: 500 }
    )
  }
}

// POST /api/dashboard/quick-actions - Save custom quick actions
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    if (!body.actions || !Array.isArray(body.actions)) {
      return NextResponse.json(
        { error: 'Invalid actions data' },
        { status: 400 }
      )
    }

    // Update user preferences with custom actions
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        quickActions: body.actions,
        updatedAt: new Date()
      },
      create: {
        userId,
        quickActions: body.actions
      }
    })

    return NextResponse.json({
      success: true,
      data: preferences.quickActions
    })
  } catch (error) {
    console.error('Save quick actions error:', error)
    return NextResponse.json(
      { error: 'Failed to save quick actions' },
      { status: 500 }
    )
  }
}
