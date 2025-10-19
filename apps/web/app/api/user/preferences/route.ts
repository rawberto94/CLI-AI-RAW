import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session (placeholder - replace with actual auth)
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  // For now, return a demo user ID
  return 'demo-user-id'
}

// GET /api/user/preferences - Get user preferences
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    if (!preferences) {
      // Return default preferences if none exist
      return NextResponse.json({
        success: true,
        data: {
          role: null,
          goals: [],
          dashboardLayout: null,
          theme: 'light',
          notifications: {},
          onboardingCompleted: false,
          onboardingSkipped: false,
          helpToursCompleted: [],
          customSettings: {}
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 }
    )
  }
}

// POST /api/user/preferences - Create or update user preferences
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    // Validate input
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        role: body.role,
        goals: body.goals || [],
        dashboardLayout: body.dashboardLayout,
        theme: body.theme || 'light',
        notifications: body.notifications || {},
        onboardingState: body.onboardingState,
        onboardingCompleted: body.onboardingCompleted || false,
        onboardingSkipped: body.onboardingSkipped || false,
        onboardingCompletedAt: body.onboardingCompleted ? new Date() : null,
        helpToursCompleted: body.helpToursCompleted || [],
        customSettings: body.customSettings || {},
        updatedAt: new Date()
      },
      create: {
        userId,
        role: body.role,
        goals: body.goals || [],
        dashboardLayout: body.dashboardLayout,
        theme: body.theme || 'light',
        notifications: body.notifications || {},
        onboardingState: body.onboardingState,
        onboardingCompleted: body.onboardingCompleted || false,
        onboardingSkipped: body.onboardingSkipped || false,
        onboardingCompletedAt: body.onboardingCompleted ? new Date() : null,
        helpToursCompleted: body.helpToursCompleted || [],
        customSettings: body.customSettings || {}
      }
    })

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    )
  }
}

// PATCH /api/user/preferences - Partial update of user preferences
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    // Validate input
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Check if preferences exist
    const existing = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'User preferences not found. Use POST to create.' },
        { status: 404 }
      )
    }

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.role !== undefined) updateData.role = body.role
    if (body.goals !== undefined) updateData.goals = body.goals
    if (body.dashboardLayout !== undefined) updateData.dashboardLayout = body.dashboardLayout
    if (body.theme !== undefined) updateData.theme = body.theme
    if (body.notifications !== undefined) updateData.notifications = body.notifications
    if (body.onboardingState !== undefined) updateData.onboardingState = body.onboardingState
    if (body.onboardingCompleted !== undefined) {
      updateData.onboardingCompleted = body.onboardingCompleted
      if (body.onboardingCompleted) {
        updateData.onboardingCompletedAt = new Date()
      }
    }
    if (body.onboardingSkipped !== undefined) updateData.onboardingSkipped = body.onboardingSkipped
    if (body.helpToursCompleted !== undefined) updateData.helpToursCompleted = body.helpToursCompleted
    if (body.customSettings !== undefined) updateData.customSettings = body.customSettings

    const preferences = await prisma.userPreferences.update({
      where: { userId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Patch preferences error:', error)
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    )
  }
}
