import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session (placeholder - replace with actual auth)
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  // For now, return a demo user ID
  return 'demo-user-id'
}

// GET /api/user/onboarding - Get current onboarding state
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    return NextResponse.json({
      success: true,
      data: {
        completed: preferences?.onboardingCompleted || false,
        skipped: preferences?.onboardingSkipped || false,
        state: preferences?.onboardingState || null,
        role: preferences?.role,
        goals: preferences?.goals || []
      }
    })
  } catch (error) {
    console.error('Get onboarding state error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding state' },
      { status: 500 }
    )
  }
}

// POST /api/user/onboarding - Update onboarding progress
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

    // Update or create user preferences
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        onboardingState: body.state,
        role: body.role,
        goals: body.goals || [],
        onboardingCompleted: body.completed || false,
        onboardingCompletedAt: body.completed ? new Date() : null,
        updatedAt: new Date()
      },
      create: {
        userId,
        onboardingState: body.state,
        role: body.role,
        goals: body.goals || [],
        onboardingCompleted: body.completed || false,
        onboardingCompletedAt: body.completed ? new Date() : null
      }
    })

    // Track analytics if step info provided
    if (body.stepId && body.action) {
      await prisma.onboardingAnalytics.create({
        data: {
          userId,
          stepId: body.stepId,
          action: body.action,
          timeSpent: body.timeSpent || null,
          metadata: body.metadata || null
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Update onboarding progress error:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    )
  }
}
